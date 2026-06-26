import { Hono } from "hono";
import crypto from "crypto";
import Stripe from "stripe";
import { db } from "../db";
import { stripe } from "../stripe-init";
import { STRIPE_WEBHOOK_SECRET, PLATFORM_FEE_PERCENT } from "../config";
import { invalidatePartiesCache } from "../helpers";

export function registerWebhookRoutes(app: Hono) {
  app.post("/api/stripe/webhook", async (c) => {
    const sig = c.req.header("stripe-signature");
    if (!sig || !STRIPE_WEBHOOK_SECRET || !stripe) {
      return c.text("Webhook signature missing or stripe not configured", 400);
    }

    const rawBuffer = await c.req.raw.arrayBuffer();
    const rawBody = Buffer.from(rawBuffer);

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(rawBody, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
      console.error('Stripe webhook signature verification failed:', err.message);
      return c.text(`Webhook Error: ${err.message}`, 400);
    }

    try {
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const pi = event.data.object as Stripe.PaymentIntent;
          const meta = pi.metadata || {};
          const amount = (pi.amount_received || pi.amount) / 100;

          // ── DM tip payment ──────────────────────────────────────
          if (meta.type === "tip" && meta.senderId && meta.receiverId) {
            const existing = await db.execute({
              sql: "SELECT ID FROM tips WHERE StripePaymentIntentID = ?",
              args: [pi.id],
            });
            if (existing.rows.length > 0) {
              console.log(`Webhook: tip for PI ${pi.id} already recorded, skipping`);
              break;
            }
            const tipId = "tip_" + Date.now() + "_" + crypto.randomBytes(4).toString("hex");
            const now = new Date().toISOString();
            await db.execute({
              sql: "INSERT INTO tips (ID, SenderID, ReceiverID, Amount, StripePaymentIntentID, CreatedAt) VALUES (?, ?, ?, ?, ?, ?)",
              args: [tipId, meta.senderId, meta.receiverId, amount, pi.id, now],
            });
            await db.execute({
              sql: "UPDATE users SET Balance = COALESCE(Balance, 0) + ? WHERE ID = ?",
              args: [amount, meta.receiverId],
            });
            console.log(`Webhook: recorded tip ${tipId} for PI ${pi.id}`);
            break;
          }

          // ── Crowdfund contribution ──────────────────────────────
          const { partyId, userId } = meta;
          if (!partyId || !userId) {
            console.warn('Webhook: payment_intent.succeeded with unknown metadata', meta);
            break;
          }
          const existing = await db.execute({
            sql: "SELECT ID FROM crowdfund_contributions WHERE StripePaymentIntentID = ?",
            args: [pi.id],
          });
          if (existing.rows.length > 0) {
            console.log(`Webhook: contribution for PI ${pi.id} already recorded, skipping`);
            break;
          }
          const feePercent = PLATFORM_FEE_PERCENT / 100;
          const feeAmount = Math.round(amount * feePercent * 100) / 100;
          const netAmount = Math.round((amount - feeAmount) * 100) / 100;
          const contributionId = "contrib_" + Date.now() + "_" + crypto.randomBytes(4).toString("hex");
          const now = new Date().toISOString();
          await db.execute({
            sql: "INSERT INTO crowdfund_contributions (ID, PartyID, UserID, Amount, OriginalAmount, PlatformFee, StripePaymentIntentID, CreatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            args: [contributionId, partyId, userId, netAmount, amount, feeAmount, pi.id, now],
          });
          await db.execute({
            sql: "UPDATE parties SET CrowdfundCurrent = COALESCE(CrowdfundCurrent, 0) + ? WHERE ID = ?",
            args: [netAmount, partyId],
          });
          invalidatePartiesCache();
          console.log(`Webhook: recorded contribution ${contributionId} for PI ${pi.id}`);
          break;
        }
        case 'charge.dispute.created': {
          const dispute = event.data.object as Stripe.Dispute;
          const piId = dispute.payment_intent as string;
          if (!piId) break;
          const contribResult = await db.execute({
            sql: "SELECT ID, PartyID, Amount FROM crowdfund_contributions WHERE StripePaymentIntentID = ?",
            args: [piId],
          });
          if (contribResult.rows.length === 0) break;
          const contrib = contribResult.rows[0] as any;
          await db.execute({
            sql: "UPDATE parties SET CrowdfundCurrent = COALESCE(CrowdfundCurrent, 0) - ? WHERE ID = ?",
            args: [contrib.Amount, contrib.PartyID],
          });
          await db.execute({
            sql: "UPDATE crowdfund_contributions SET Status = 'disputed' WHERE ID = ?",
            args: [contrib.ID],
          });
          invalidatePartiesCache();
          console.log(`Webhook: chargeback processed for PI ${piId}, reversed ${contrib.Amount} from party ${contrib.PartyID}`);
          break;
        }
      }
    } catch (e: any) {
      console.error('Webhook handler error:', e);
    }

    return c.json({ received: true });
  });
}
