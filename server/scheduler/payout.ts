import { db } from "../db";
import { stripe } from "../stripe-init";
import crypto from "crypto";
import { sendTelegramMessage } from "../telegram";

export function startPayoutScheduler() {
  const PAYOUT_CHECK_INTERVAL = 30 * 60 * 1000;

  setInterval(async () => {
    try {
      if (!stripe) return;

      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);
      const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);

      const partiesResult = await db.execute({
        sql: `SELECT p.ID, p.HostID, p.Title, p.CrowdfundCurrent, p.CrowdfundCurrency, p.StartTime, p.PayoutRetries, u.StripeAccountID
              FROM parties p JOIN users u ON u.ID = p.HostID
              WHERE (p.FundsReleased = 0 AND p.CrowdfundCurrent > 0 AND u.StripeAccountID != '')
                AND (
                  (p.StartTime > ? AND p.StartTime < ?)
                  OR
                  (p.PayoutRetries < 3 AND p.PayoutRetries > 0 AND (p.LastPayoutAttempt = '' OR p.LastPayoutAttempt < ?))
                )`,
        args: [in24h.toISOString(), in25h.toISOString(), fiveMinAgo.toISOString()],
      });

      for (const row of partiesResult.rows) {
        const party = row as any;
        const amount = Number(party.CrowdfundCurrent);
        if (amount <= 0) continue;

        const currency = (party.CrowdfundCurrency || "BRL").toLowerCase();

        try {
          const transferIdemKey = `payout_${party.ID}_${Date.now()}`;
          const transfer = await stripe.transfers.create({
            amount: Math.round(amount * 100),
            currency,
            destination: party.StripeAccountID,
            transfer_group: party.ID,
            metadata: { partyId: party.ID, hostId: party.HostID },
          }, { idempotencyKey: transferIdemKey });

          await db.execute({
            sql: "INSERT INTO withdrawal_requests (ID, PartyID, UserID, Amount, Status, StripeTransferID, CreatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
            args: [
              "payout_" + Date.now() + "_" + crypto.randomBytes(4).toString("hex"),
              party.ID, party.HostID, amount, 'completed', transfer.id, new Date().toISOString(),
            ],
          });

          await db.execute({
            sql: "UPDATE parties SET FundsReleased = 1, PayoutRetries = 0, LastPayoutAttempt = ? WHERE ID = ?",
            args: [new Date().toISOString(), party.ID],
          });

          console.log(`Payout: ${amount} ${currency.toUpperCase()} released to ${party.HostID} for party "${party.Title}" (transfer: ${transfer.id})`);

          await sendTelegramMessage(
            `<b>Payout Completed</b>\nParty: ${party.Title}\nAmount: ${currency.toUpperCase()} ${amount}\nHost: ${party.HostID}\nTransfer: ${transfer.id}`
          );
        } catch (e: any) {
          console.error(`Payout failed for party ${party.ID}:`, e.message);
          const retries = Number(party.PayoutRetries || 0) + 1;
          await db.execute({
            sql: "UPDATE parties SET PayoutRetries = ?, LastPayoutAttempt = ? WHERE ID = ?",
            args: [retries, new Date().toISOString(), party.ID],
          });

          await sendTelegramMessage(
            `<b>Payout Failed</b>\nParty: ${party.Title}\nAmount: ${currency.toUpperCase()} ${amount}\nHost: ${party.HostID}\nError: ${e.message}\nRetry: ${retries}/3`
          );
        }
      }
    } catch (e: any) {
      console.error('Payout scheduler error:', e);
    }
  }, PAYOUT_CHECK_INTERVAL);
}
