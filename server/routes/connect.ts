import { Hono } from "hono";
import crypto from "crypto";
import { db } from "../db";
import { paymentLimiter } from "../middleware/rate-limiter";
import { sessionMiddleware } from "../middleware/session";
import { stripe } from "../stripe-init";
import { invalidatePartiesCache, getEnrichedParties } from "../helpers";
import { wsClients } from "../ws/handler";

function getUserId(c: any): string {
  return c.get("userId") || "";
}

export function registerConnectRoutes(app: Hono) {
  app.post("/api/connect/onboarding", sessionMiddleware, async (c) => {
    try {
      if (!stripe) return c.json({ error: "Stripe not configured" }, 503);
      const userId = getUserId(c);

      const userResult = await db.execute({ sql: "SELECT * FROM users WHERE ID = ?", args: [userId] });
      const userRow = userResult.rows[0] as any;
      if (!userRow) return c.json({ error: "User not found" }, 404);

      let accountId = userRow.StripeAccountID;
      if (!accountId) {
        const acctIdemKey = `connect_acct_${userId}_${Date.now()}`;
        const account = await stripe.accounts.create({
          type: "express", country: "US", email: userRow.Email, business_type: "individual",
          capabilities: { transfers: { requested: true } },
          metadata: { userId },
        }, { idempotencyKey: acctIdemKey });
        accountId = account.id;
        await db.execute({ sql: "UPDATE users SET StripeAccountID = ? WHERE ID = ?", args: [accountId, userId] });
      }

      const linkIdemKey = `connect_link_${accountId}_${Date.now()}`;
      const origin = c.req.header("origin") || "https://waterparty-react-14hr.onrender.com";
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${origin}/messages`,
        return_url: `${origin}/messages`,
        type: "account_onboarding",
      }, { idempotencyKey: linkIdemKey });

      return c.json({ onboardingUrl: accountLink.url, accountId });
    } catch (e: any) {
      console.error("Stripe Connect onboarding failed:", e);
      return c.json({ error: e.message || "Failed to create onboarding link" }, 500);
    }
  });

  app.get("/api/connect/status", sessionMiddleware, async (c) => {
    try {
      if (!stripe) return c.json({ error: "Stripe not configured" }, 503);
      const userId = getUserId(c);

      const userResult = await db.execute({ sql: "SELECT StripeAccountID FROM users WHERE ID = ?", args: [userId] });
      const userRow = userResult.rows[0] as any;
      if (!userRow?.StripeAccountID) return c.json({ connected: false, accountId: null });

      const account = await stripe.accounts.retrieve(userRow.StripeAccountID);
      return c.json({
        connected: account.details_submitted && account.payouts_enabled,
        accountId: userRow.StripeAccountID,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
      });
    } catch (e: any) {
      console.error("Stripe Connect status check failed:", e);
      return c.json({ error: e.message || "Failed to check account status" }, 500);
    }
  });

  app.post("/api/connect/withdraw", paymentLimiter, sessionMiddleware, async (c) => {
    try {
      if (!stripe) return c.json({ error: "Stripe not configured" }, 503);

      const { partyId } = await c.req.json();
      const userId = getUserId(c);
      if (!partyId) return c.json({ error: "partyId is required" }, 400);

      const partyResult = await db.execute({ sql: "SELECT * FROM parties WHERE ID = ?", args: [partyId] });
      const party = partyResult.rows[0] as any;
      if (!party) return c.json({ error: "Party not found" }, 404);
      if (party.HostID !== userId) return c.json({ error: "Only the host can withdraw funds" }, 403);

      const balance = Number(party.CrowdfundCurrent || 0);
      if (balance < 1) return c.json({ error: "No funds available to withdraw. Minimum withdrawal is $1." }, 400);

      const userResult = await db.execute({ sql: "SELECT StripeAccountID FROM users WHERE ID = ?", args: [userId] });
      const userRow = userResult.rows[0] as any;
      if (!userRow?.StripeAccountID) return c.json({ error: "No Stripe account connected. Please connect your Stripe account first." }, 400);

      const connectedAccountId = userRow.StripeAccountID;
      const connectedAccount = await stripe.accounts.retrieve(connectedAccountId);
      if (!connectedAccount.details_submitted || !connectedAccount.payouts_enabled) {
        return c.json({ error: "Your Stripe account onboarding is not complete. Please finish setting up your account." }, 400);
      }

      const currency = (party.CrowdfundCurrency || "BRL").toLowerCase();
      const amountInCents = Math.round(balance * 100);
      const transferIdemKey = `transfer_${partyId}_${Date.now()}`;
      const transfer = await stripe.transfers.create({
        amount: amountInCents, currency, destination: connectedAccountId,
        metadata: { partyId, userId, type: "fundraiser_withdrawal" },
      }, { idempotencyKey: transferIdemKey });

      const withdrawalId = "wd_" + Date.now() + "_" + crypto.randomBytes(4).toString("hex");
      const now = new Date().toISOString();
      await db.execute({
        sql: "INSERT INTO withdrawal_requests (ID, PartyID, UserID, Amount, Status, StripeTransferID, CreatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: [withdrawalId, partyId, userId, balance, "completed", transfer.id, now],
      });

      const updateResult = await db.execute({
        sql: "UPDATE parties SET CrowdfundCurrent = 0, FundsReleased = 1 WHERE ID = ? AND CrowdfundCurrent = ?",
        args: [partyId, balance],
      });

      if (Number(updateResult.rowsAffected) === 0) {
        return c.json({ error: "This withdrawal was already processed. The balance has changed." }, 409);
      }

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
            console.error("Failed to broadcast feed after withdrawal:", e);
          }
        }
      } catch (e) {
        console.error("Failed to get enriched parties for broadcast:", e);
      }

      return c.json({
        success: true, withdrawalId, amount: balance, transferId: transfer.id,
        message: `${currency.toUpperCase()} ${balance.toFixed(2)} has been sent to your Stripe account. It will arrive in your bank within 2-3 business days.`,
      });
    } catch (e: any) {
      console.error("Stripe Connect withdrawal failed:", e);
      return c.json({ error: e.message || "Failed to process withdrawal" }, 500);
    }
  });
}
