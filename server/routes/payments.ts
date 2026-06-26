import { Hono } from "hono";
import crypto from "crypto";
import { db } from "../db";
import { paymentLimiter } from "../middleware/rate-limiter";
import { sessionMiddleware } from "../middleware/session";
import { stripe } from "../stripe-init";
import { PLATFORM_FEE_PERCENT, STRIPE_PUBLISHABLE_KEY } from "../config";
import { invalidatePartiesCache, getEnrichedParties } from "../helpers";
import { wsClients } from "../ws/handler";

function getUserId(c: any): string {
  return c.get("userId") || "";
}

export function registerPaymentRoutes(app: Hono) {
  app.post("/api/create-payment-intent", paymentLimiter, sessionMiddleware, async (c) => {
    try {
      if (!stripe) return c.json({ error: "Stripe not configured" }, 503);

      const { amount, partyId } = await c.req.json();
      const userId = getUserId(c);

      if (!amount || amount < 1) return c.json({ error: "Amount must be at least 1" }, 400);
      if (amount > 10000) return c.json({ error: "Amount must not exceed 10,000" }, 400);
      if (!partyId) return c.json({ error: "partyId is required" }, 400);

      const partyResult = await db.execute({
        sql: "SELECT ID, Title, CrowdfundTarget, CrowdfundCurrent, CrowdfundCurrency FROM parties WHERE ID = ?",
        args: [partyId],
      });
      const partyRow = partyResult.rows[0] as any;
      if (!partyRow) return c.json({ error: "Party not found" }, 404);

      const currentBalance = Number(partyRow.CrowdfundCurrent || 0);
      const targetAmount = Number(partyRow.CrowdfundTarget || 0);
      if (targetAmount > 0 && currentBalance + amount > targetAmount) {
        return c.json({ error: "Contribution would exceed the party's fundraising target" }, 400);
      }

      const currency = (partyRow.CrowdfundCurrency || "BRL").toLowerCase();
      const amountInCents = Math.round(amount * 100);

      const userResult = await db.execute({ sql: "SELECT StripeCustomerID FROM users WHERE ID = ?", args: [userId] });
      const userRow = userResult.rows[0] as any;
      let customerId = userRow?.StripeCustomerID || "";

      if (!customerId) {
        const idemKey = `create_customer_${userId}_${Date.now()}`;
        const customer = await stripe.customers.create({ metadata: { userId } }, { idempotencyKey: idemKey });
        customerId = customer.id;
        await db.execute({ sql: "UPDATE users SET StripeCustomerID = ? WHERE ID = ?", args: [customerId, userId] });
      }

      const piIdemKey = `create_pi_${partyId}_${userId}_${Date.now()}`;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency,
        customer: customerId,
        automatic_payment_methods: { enabled: true },
        metadata: { partyId, userId },
      }, { idempotencyKey: piIdemKey });

      return c.json({
        clientSecret: paymentIntent.client_secret,
        publishableKey: STRIPE_PUBLISHABLE_KEY,
        paymentIntentId: paymentIntent.id,
        platformFeePercent: PLATFORM_FEE_PERCENT,
        currency: currency.toUpperCase(),
      });
    } catch (e: any) {
      console.error("Stripe create-payment-intent failed:", e);
      return c.json({ error: e.message || "Payment intent creation failed" }, 500);
    }
  });

  app.post("/api/crowdfund/contribute", paymentLimiter, sessionMiddleware, async (c) => {
    try {
      const { paymentIntentId, partyId, amount, savePaymentMethod, paymentMethodId } = await c.req.json();
      const userId = getUserId(c);

      if (!paymentIntentId || !partyId || !amount) return c.json({ error: "Missing required fields" }, 400);
      if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) return c.json({ error: "Amount must be a positive number" }, 400);
      if (amount > 10000) return c.json({ error: "Amount must not exceed 10,000" }, 400);

      if (stripe) {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId as string);
        if (pi.status !== 'succeeded') return c.json({ error: "Payment has not been completed" }, 400);
        if (pi.metadata?.userId !== userId) return c.json({ error: "PaymentIntent does not belong to this user" }, 403);
        const piAmount = (pi.amount_received || pi.amount) / 100;
        if (Math.abs(piAmount - amount) > 0.01) return c.json({ error: "Amount does not match PaymentIntent" }, 400);
      }

      const existing = await db.execute({
        sql: "SELECT ID FROM crowdfund_contributions WHERE StripePaymentIntentID = ?",
        args: [paymentIntentId],
      });
      if (existing.rows.length > 0) return c.json({ error: "This payment has already been recorded" }, 409);

      if (savePaymentMethod && paymentMethodId && stripe) {
        try {
          const userResult = await db.execute({ sql: "SELECT StripePaymentMethodIDs FROM users WHERE ID = ?", args: [userId] });
          const userRow = userResult.rows[0] as any;
          const existingIDs: string[] = userRow?.StripePaymentMethodIDs ? JSON.parse(userRow.StripePaymentMethodIDs) : [];
          if (!existingIDs.includes(paymentMethodId)) {
            existingIDs.push(paymentMethodId);
            await db.execute({ sql: "UPDATE users SET StripePaymentMethodIDs = ? WHERE ID = ?", args: [JSON.stringify(existingIDs), userId] });
          }
        } catch (e) {
          console.error("Failed to save payment method:", e);
        }
      }

      const feePercent = PLATFORM_FEE_PERCENT / 100;
      const feeAmount = Math.round(amount * feePercent * 100) / 100;
      const netAmount = Math.round((amount - feeAmount) * 100) / 100;

      const contributionId = "contrib_" + Date.now() + "_" + crypto.randomBytes(4).toString("hex");
      const now = new Date().toISOString();

      await db.execute({
        sql: "INSERT INTO crowdfund_contributions (ID, PartyID, UserID, Amount, OriginalAmount, PlatformFee, StripePaymentIntentID, CreatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        args: [contributionId, partyId, userId, netAmount, amount, feeAmount, paymentIntentId, now],
      });

      await db.execute({
        sql: "UPDATE parties SET CrowdfundCurrent = COALESCE(CrowdfundCurrent, 0) + ? WHERE ID = ?",
        args: [netAmount, partyId],
      });

      invalidatePartiesCache();

      // Broadcast feed update to all WS clients
      try {
        const allParties = await getEnrichedParties();
        for (const { ws, userId: uid } of wsClients) {
          try {
            const registrationsResult = await db.execute({ sql: "SELECT PartyID FROM registrations WHERE UserID = ?", args: [uid] });
            const swipedResult = await db.execute({ sql: "SELECT PartyID FROM swipes WHERE UserID = ?", args: [uid] });
            const excludedPartyIDs = new Set<string>();
            registrationsResult.rows.forEach((row: any) => excludedPartyIDs.add(row.PartyID));
            swipedResult.rows.forEach((row: any) => excludedPartyIDs.add(row.PartyID));
            const filteredFeed = allParties.filter((p: any) => !excludedPartyIDs.has(p.ID));
            ws.send(JSON.stringify({ Event: "FEED_UPDATE", Payload: filteredFeed }));
          } catch (e) {
            console.error("Failed to broadcast feed after contribution:", e);
          }
        }
      } catch (e) {
        console.error("Failed to get enriched parties for broadcast:", e);
      }

      return c.json({ success: true, contributionId });
    } catch (e: any) {
      console.error("Contribution recording failed:", e);
      return c.json({ error: e.message || "Failed to record contribution" }, 500);
    }
  });

  app.get("/api/saved-payment-methods", sessionMiddleware, async (c) => {
    try {
      if (!stripe) return c.json({ error: "Stripe not configured" }, 503);
      const userId = getUserId(c);
      const userResult = await db.execute({ sql: "SELECT StripeCustomerID FROM users WHERE ID = ?", args: [userId] });
      const userRow = userResult.rows[0] as any;
      const customerId = userRow?.StripeCustomerID;
      if (!customerId) return c.json({ paymentMethods: [] });

      const paymentMethods = await stripe.paymentMethods.list({ customer: customerId, type: 'card' });
      const saved = await db.execute({ sql: "SELECT StripePaymentMethodIDs FROM users WHERE ID = ?", args: [userId] });
      const savedRow = saved.rows[0] as any;
      const savedIDs: string[] = savedRow?.StripePaymentMethodIDs ? JSON.parse(savedRow.StripePaymentMethodIDs) : [];

      const methods = paymentMethods.data
        .filter(pm => savedIDs.includes(pm.id))
        .map(pm => ({ id: pm.id, brand: pm.card?.brand, last4: pm.card?.last4, expMonth: pm.card?.exp_month, expYear: pm.card?.exp_year, billingDetails: pm.billing_details }));

      return c.json({ paymentMethods: methods });
    } catch (e: any) {
      console.error("Failed to list payment methods:", e);
      return c.json({ error: e.message || "Failed to list payment methods" }, 500);
    }
  });

  app.post("/api/detach-payment-method", sessionMiddleware, async (c) => {
    try {
      if (!stripe) return c.json({ error: "Stripe not configured" }, 503);
      const { paymentMethodId } = await c.req.json();
      const userId = getUserId(c);
      if (!paymentMethodId) return c.json({ error: "paymentMethodId is required" }, 400);

      const userResult = await db.execute({ sql: "SELECT StripePaymentMethodIDs FROM users WHERE ID = ?", args: [userId] });
      const userRow = userResult.rows[0] as any;
      const savedIDs: string[] = userRow?.StripePaymentMethodIDs ? JSON.parse(userRow.StripePaymentMethodIDs) : [];
      if (!savedIDs.includes(paymentMethodId)) return c.json({ error: "Payment method not found" }, 404);

      await stripe.paymentMethods.detach(paymentMethodId);
      const updated = savedIDs.filter((id: string) => id !== paymentMethodId);
      await db.execute({ sql: "UPDATE users SET StripePaymentMethodIDs = ? WHERE ID = ?", args: [JSON.stringify(updated), userId] });

      return c.json({ success: true });
    } catch (e: any) {
      console.error("Failed to detach payment method:", e);
      return c.json({ error: e.message || "Failed to detach payment method" }, 500);
    }
  });

  app.get("/api/crowdfund/contributions/:partyId", async (c) => {
    try {
      const partyId = c.req.param("partyId");
      const result = await db.execute({
        sql: `SELECT crowdfund_contributions.*, users.RealName, users.Thumbnail, users.ProfilePhotos
              FROM crowdfund_contributions JOIN users ON crowdfund_contributions.UserID = users.ID
              WHERE PartyID = ? ORDER BY crowdfund_contributions.CreatedAt DESC LIMIT 50`,
        args: [partyId],
      });

      const contributions = result.rows.map((row: any) => ({
        id: row.ID, partyId: row.PartyID, userId: row.UserID, amount: row.Amount, createdAt: row.CreatedAt,
        userName: (!row.RealName || row.RealName.toLowerCase() === "unknown") ? "" : row.RealName,
        userThumbnail: row.Thumbnail || (JSON.parse(row.ProfilePhotos || "[]")?.[0]) || "",
      }));
      return c.json(contributions);
    } catch (e: any) {
      console.error("Failed to fetch contributions:", e);
      return c.json({ error: e.message || "Failed to fetch contributions" }, 500);
    }
  });
}
