import { Hono } from "hono";
import crypto from "crypto";
import { db } from "../db";
import { paymentLimiter } from "../middleware/rate-limiter";
import { sessionMiddleware } from "../middleware/session";
import { stripe } from "../stripe-init";
import { STRIPE_PUBLISHABLE_KEY, PLATFORM_FEE_PERCENT } from "../config";

function getUserId(c: any): string {
  return c.get("userId") || "";
}

export function registerTipRoutes(app: Hono) {
  // ─── Get user balance ──────────────────────────────────────────
  app.get("/api/users/:id/balance", async (c) => {
    try {
      const userId = c.req.param("id");

      // Sum all tips received
      const tipsResult = await db.execute({
        sql: "SELECT COALESCE(SUM(Amount), 0) as total FROM tips WHERE ReceiverID = ?",
        args: [userId],
      });
      const tipsTotal = Number((tipsResult.rows[0] as any)?.total || 0);

      // Sum all crowdfund contributions made to parties this user hosted
      const hostedResult = await db.execute({
        sql: "SELECT ID FROM parties WHERE HostID = ?",
        args: [userId],
      });
      const hostedPartyIds = hostedResult.rows.map((r: any) => r.ID);
      let crowdfundTotal = 0;
      if (hostedPartyIds.length > 0) {
        const placeholders = hostedPartyIds.map(() => "?").join(",");
        const contribResult = await db.execute({
          sql: `SELECT COALESCE(SUM(Amount), 0) as total FROM crowdfund_contributions WHERE PartyID IN (${placeholders})`,
          args: hostedPartyIds,
        });
        crowdfundTotal = Number((contribResult.rows[0] as any)?.total || 0);
      }

      // Sum all withdrawal amounts (already paid out)
      const wdResult = await db.execute({
        sql: "SELECT COALESCE(SUM(Amount), 0) as total FROM withdrawal_requests WHERE UserID = ? AND Status = 'completed'",
        args: [userId],
      });
      const withdrawnTotal = Number((wdResult.rows[0] as any)?.total || 0);

      // Available balance = received - withdrawn
      const totalReceived = tipsTotal + crowdfundTotal;
      const availableBalance = Math.max(0, totalReceived - withdrawnTotal);

      return c.json({
        totalReceived: Math.round(totalReceived * 100) / 100,
        totalWithdrawn: Math.round(withdrawnTotal * 100) / 100,
        availableBalance: Math.round(availableBalance * 100) / 100,
        tipsReceived: Math.round(tipsTotal * 100) / 100,
        crowdfundEarned: Math.round(crowdfundTotal * 100) / 100,
      });
    } catch (e: any) {
      console.error("Failed to fetch user balance:", e);
      return c.json({ error: e.message || "Failed to fetch balance" }, 500);
    }
  });

  // ─── Create payment intent for a tip ───────────────────────────
  app.post("/api/tips/create-payment-intent", paymentLimiter, sessionMiddleware, async (c) => {
    try {
      if (!stripe) return c.json({ error: "Stripe not configured" }, 503);

      const { amount, receiverId, currency } = await c.req.json();
      const senderId = getUserId(c);

      if (!amount || amount < 1) return c.json({ error: "Amount must be at least 1" }, 400);
      if (amount > 10000) return c.json({ error: "Amount must not exceed 10,000" }, 400);
      if (!receiverId) return c.json({ error: "receiverId is required" }, 400);
      if (senderId === receiverId) return c.json({ error: "Cannot send money to yourself" }, 400);

      // Validate currency (default to USD)
      const supportedCurrencies = ["BRL", "USD", "EUR", "GBP"];
      const tipCurrency = (currency || "USD").toUpperCase();
      if (!supportedCurrencies.includes(tipCurrency)) {
        return c.json({ error: `Unsupported currency. Supported: ${supportedCurrencies.join(", ")}` }, 400);
      }

      // Verify receiver exists
      const receiverResult = await db.execute({
        sql: "SELECT ID, RealName FROM users WHERE ID = ?",
        args: [receiverId],
      });
      if (receiverResult.rows.length === 0) return c.json({ error: "Receiver not found" }, 404);

      const amountInCents = Math.round(amount * 100);

      // Get or create customer for the sender
      const senderResult = await db.execute({
        sql: "SELECT StripeCustomerID FROM users WHERE ID = ?",
        args: [senderId],
      });
      const senderRow = senderResult.rows[0] as any;
      let customerId = senderRow?.StripeCustomerID || "";

      if (!customerId) {
        const idemKey = `create_customer_tip_${senderId}_${Date.now()}`;
        const customer = await stripe.customers.create(
          { metadata: { userId: senderId } },
          { idempotencyKey: idemKey }
        );
        customerId = customer.id;
        await db.execute({
          sql: "UPDATE users SET StripeCustomerID = ? WHERE ID = ?",
          args: [customerId, senderId],
        });
      }

      const piIdemKey = `tip_pi_${senderId}_${receiverId}_${Date.now()}`;
      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: amountInCents,
          currency: tipCurrency.toLowerCase(),
          customer: customerId,
          automatic_payment_methods: { enabled: true },
          metadata: { type: "tip", senderId, receiverId, currency: tipCurrency },
        },
        { idempotencyKey: piIdemKey }
      );

      return c.json({
        clientSecret: paymentIntent.client_secret,
        publishableKey: STRIPE_PUBLISHABLE_KEY,
        paymentIntentId: paymentIntent.id,
        platformFeePercent: PLATFORM_FEE_PERCENT,
        currency: tipCurrency,
      });
    } catch (e: any) {
      console.error("Tip payment intent creation failed:", e);
      return c.json({ error: e.message || "Failed to create payment" }, 500);
    }
  });

  // ─── Record a completed tip ────────────────────────────────────
  app.post("/api/tips/record", paymentLimiter, sessionMiddleware, async (c) => {
    try {
      const { paymentIntentId, receiverId, amount, savePaymentMethod, paymentMethodId } = await c.req.json();
      const senderId = getUserId(c);

      if (!paymentIntentId || !receiverId || !amount) {
        return c.json({ error: "Missing required fields" }, 400);
      }
      if (typeof amount !== "number" || isNaN(amount) || amount <= 0) {
        return c.json({ error: "Amount must be a positive number" }, 400);
      }

      // Verify the payment intent with Stripe
      if (stripe) {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (pi.status !== "succeeded") {
          return c.json({ error: "Payment has not been completed" }, 400);
        }
        if (pi.metadata?.senderId !== senderId) {
          return c.json({ error: "PaymentIntent does not belong to this user" }, 403);
        }
      }

      // Check for duplicates
      const existing = await db.execute({
        sql: "SELECT ID FROM tips WHERE StripePaymentIntentID = ?",
        args: [paymentIntentId],
      });
      if (existing.rows.length > 0) {
        return c.json({ error: "This tip has already been recorded" }, 409);
      }

      // Save payment method if requested
      if (savePaymentMethod && paymentMethodId && stripe) {
        try {
          const userResult = await db.execute({ sql: "SELECT StripePaymentMethodIDs FROM users WHERE ID = ?", args: [senderId] });
          const userRow = userResult.rows[0] as any;
          const existingIDs: string[] = userRow?.StripePaymentMethodIDs ? JSON.parse(userRow.StripePaymentMethodIDs) : [];
          if (!existingIDs.includes(paymentMethodId)) {
            existingIDs.push(paymentMethodId);
            await db.execute({ sql: "UPDATE users SET StripePaymentMethodIDs = ? WHERE ID = ?", args: [JSON.stringify(existingIDs), senderId] });
          }
        } catch (e) {
          console.error("Failed to save payment method:", e);
        }
      }

      // Get currency from the Stripe PaymentIntent metadata
      let tipCurrency = "USD";
      if (stripe) {
        try {
          const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
          tipCurrency = (pi.metadata?.currency || "USD").toUpperCase();
        } catch {}
      }

      const tipId = "tip_" + Date.now() + "_" + crypto.randomBytes(4).toString("hex");
      const now = new Date().toISOString();

      await db.execute({
        sql: "INSERT INTO tips (ID, SenderID, ReceiverID, Amount, Currency, StripePaymentIntentID, CreatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: [tipId, senderId, receiverId, amount, tipCurrency, paymentIntentId, now],
      });

      // Update receiver's balance
      await db.execute({
        sql: "UPDATE users SET Balance = COALESCE(Balance, 0) + ? WHERE ID = ?",
        args: [amount, receiverId],
      });

      return c.json({ success: true, tipId, amount });
    } catch (e: any) {
      console.error("Tip recording failed:", e);
      return c.json({ error: e.message || "Failed to record tip" }, 500);
    }
  });

  // ─── Get tip history for a user ────────────────────────────────
  app.get("/api/tips/history", sessionMiddleware, async (c) => {
    try {
      const userId = getUserId(c);

      const sentResult = await db.execute({
        sql: `SELECT tips.*, users.RealName as ReceiverName, users.Thumbnail as ReceiverThumbnail
              FROM tips JOIN users ON tips.ReceiverID = users.ID
              WHERE tips.SenderID = ?
              ORDER BY tips.CreatedAt DESC LIMIT 50`,
        args: [userId],
      });

      const receivedResult = await db.execute({
        sql: `SELECT tips.*, users.RealName as SenderName, users.Thumbnail as SenderThumbnail
              FROM tips JOIN users ON tips.SenderID = users.ID
              WHERE tips.ReceiverID = ?
              ORDER BY tips.CreatedAt DESC LIMIT 50`,
        args: [userId],
      });

      const mapTip = (row: any, direction: "sent" | "received") => ({
        id: row.ID,
        amount: row.Amount,
        direction,
        otherUserId: direction === "sent" ? row.ReceiverID : row.SenderID,
        otherName: direction === "sent" ? row.ReceiverName : row.SenderName,
        otherThumbnail: direction === "sent" ? row.ReceiverThumbnail : row.SenderThumbnail,
        createdAt: row.CreatedAt,
      });

      const sent = sentResult.rows.map((r: any) => mapTip(r, "sent"));
      const received = receivedResult.rows.map((r: any) => mapTip(r, "received"));

      return c.json({ sent, received });
    } catch (e: any) {
      console.error("Failed to fetch tip history:", e);
      return c.json({ error: e.message || "Failed to fetch tip history" }, 500);
    }
  });
}
