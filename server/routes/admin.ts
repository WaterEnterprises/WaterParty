import { Hono } from "hono";
import { db } from "../db";
import { apiLimiter } from "../middleware/rate-limiter";
import { sessionMiddleware } from "../middleware/session";
import { PLATFORM_FEE_PERCENT, ADMIN_USER_IDS } from "../config";

function getUserId(c: any): string {
  return c.get("userId") || "";
}

async function isAdminUser(userId: string): Promise<boolean> {
  // Check ADMIN_USER_IDS env var first
  if (ADMIN_USER_IDS.includes(userId)) return true;
  // Fall back to DB IsAdmin column
  try {
    const result = await db.execute({
      sql: "SELECT IsAdmin FROM users WHERE ID = ?",
      args: [userId],
    });
    return Boolean((result.rows[0] as any)?.IsAdmin);
  } catch {
    return false;
  }
}

export function registerAdminRoutes(app: Hono) {
  app.get("/api/platform/revenue", apiLimiter, sessionMiddleware, async (c) => {
    try {
      const userId = getUserId(c);
      if (!(await isAdminUser(userId))) {
        return c.json({ error: "Admin access only" }, 403);
      }
      const result = await db.execute(
        `SELECT COUNT(*) as totalContributions, COALESCE(SUM(OriginalAmount), 0) as totalCollected,
                COALESCE(SUM(PlatformFee), 0) as totalFees, COALESCE(SUM(Amount), 0) as totalToParties
         FROM crowdfund_contributions`
      );
      const row = result.rows[0] as any;
      return c.json({
        totalContributions: Number(row.totalContributions || 0),
        totalCollected: Number(row.totalCollected || 0),
        totalFees: Number(row.totalFees || 0),
        totalToParties: Number(row.totalToParties || 0),
        platformFeePercent: PLATFORM_FEE_PERCENT,
      });
    } catch (e: any) {
      console.error("Failed to fetch platform revenue:", e);
      return c.json({ error: e.message || "Failed to fetch revenue" }, 500);
    }
  });

  app.get("/api/platform/stats", apiLimiter, sessionMiddleware, async (c) => {
    try {
      const userId = getUserId(c);
      if (!(await isAdminUser(userId))) {
        return c.json({ error: "Admin access only" }, 403);
      }
      const userCountResult = await db.execute("SELECT COUNT(*) as count FROM users");
      const partyCountResult = await db.execute("SELECT COUNT(*) as count FROM parties");
      const contributionCountResult = await db.execute("SELECT COUNT(*) as count FROM crowdfund_contributions");
      const withdrawalCountResult = await db.execute("SELECT COUNT(*) as count FROM withdrawal_requests");

      return c.json({
        totalUsers: Number((userCountResult.rows[0] as any).count || 0),
        totalParties: Number((partyCountResult.rows[0] as any).count || 0),
        totalContributions: Number((contributionCountResult.rows[0] as any).count || 0),
        totalWithdrawals: Number((withdrawalCountResult.rows[0] as any).count || 0),
      });
    } catch (e: any) {
      console.error("Failed to fetch platform stats:", e);
      return c.json({ error: e.message || "Failed to fetch stats" }, 500);
    }
  });

  app.get("/api/platform/withdrawals", apiLimiter, sessionMiddleware, async (c) => {
    try {
      const userId = getUserId(c);
      if (!(await isAdminUser(userId))) {
        return c.json({ error: "Admin access only" }, 403);
      }

      const result = await db.execute({
        sql: `SELECT withdrawal_requests.*, parties.Title as PartyTitle, users.RealName as UserName
              FROM withdrawal_requests JOIN parties ON withdrawal_requests.PartyID = parties.ID
              JOIN users ON withdrawal_requests.UserID = users.ID
              ORDER BY withdrawal_requests.CreatedAt DESC LIMIT 200`,
      });

      const withdrawals = result.rows.map((row: any) => ({
        id: row.ID, partyId: row.PartyID, partyTitle: row.PartyTitle || "Unknown Party",
        userName: (!row.UserName || row.UserName.toLowerCase() === "unknown") ? "" : row.UserName,
        amount: row.Amount, status: row.Status, stripeTransferId: row.StripeTransferID || "", createdAt: row.CreatedAt,
      }));
      return c.json(withdrawals);
    } catch (e: any) {
      console.error("Failed to fetch all withdrawals:", e);
      return c.json({ error: e.message || "Failed to fetch all withdrawals" }, 500);
    }
  });

  app.get("/api/withdrawals/history", sessionMiddleware, async (c) => {
    try {
      const userId = getUserId(c);
      const result = await db.execute({
        sql: `SELECT withdrawal_requests.*, parties.Title as PartyTitle
              FROM withdrawal_requests JOIN parties ON withdrawal_requests.PartyID = parties.ID
              WHERE withdrawal_requests.UserID = ?
              ORDER BY withdrawal_requests.CreatedAt DESC LIMIT 100`,
        args: [userId],
      });

      const withdrawals = result.rows.map((row: any) => ({
        id: row.ID, partyId: row.PartyID, partyTitle: row.PartyTitle || "Unknown Party",
        amount: row.Amount, status: row.Status, stripeTransferId: row.StripeTransferID || "", createdAt: row.CreatedAt,
      }));
      return c.json(withdrawals);
    } catch (e: any) {
      console.error("Failed to fetch withdrawal history:", e);
      return c.json({ error: e.message || "Failed to fetch withdrawal history" }, 500);
    }
  });
}
