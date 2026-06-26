import { Hono } from "hono";
import { db } from "../db";
import { sessionMiddleware } from "../middleware/session";
import { apiLimiter } from "../middleware/rate-limiter";

// Rate limit: 10 boosts per minute per user
const boostLimiter = apiLimiter;

export function registerAdsRoutes(app: Hono) {
  // POST /api/ads/boost — Record a rewarded video ad view + boost a party
  app.post("/api/ads/boost", boostLimiter, sessionMiddleware, async (c) => {
    const userId = c.get("userId") as string;
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const { partyId } = await c.req.json<{ partyId: string }>();
    if (!partyId) {
      return c.json({ error: "partyId is required" }, 400);
    }

    // Verify the party exists
    const partyResult = await db.execute({
      sql: "SELECT ID, HostID FROM parties WHERE ID = ?",
      args: [partyId],
    });
    if (partyResult.rows.length === 0) {
      return c.json({ error: "Party not found" }, 404);
    }

    const boostId = "boost_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
    const now = new Date().toISOString();
    // Boost expires in 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await db.execute({
      sql: `INSERT INTO party_boosts (ID, PartyID, UserID, BoostType, CreatedAt, ExpiresAt, Active)
            VALUES (?, ?, ?, 'video_ad', ?, ?, 1)`,
      args: [boostId, partyId, userId, now, expiresAt],
    });

    console.log(`[Ads] Party ${partyId} boosted by user ${userId} (rewarded ad)`);

    return c.json({ success: true, boostId, expiresAt });
  });

  // GET /api/ads/boosts/:partyId — Check if a party is boosted
  app.get("/api/ads/boosts/:partyId", async (c) => {
    const partyId = c.req.param("partyId");
    const now = new Date().toISOString();

    const result = await db.execute({
      sql: `SELECT COUNT(*) as count FROM party_boosts
            WHERE PartyID = ? AND Active = 1 AND ExpiresAt > ?`,
      args: [partyId, now],
    });

    const count = Number((result.rows[0] as any)?.count || 0);
    return c.json({ boosted: count > 0, boostCount: count });
  });

  // GET /api/ads/boosts/user/me — Get user's active boosts
  app.get("/api/ads/boosts/user/me", sessionMiddleware, async (c) => {
    const userId = c.get("userId") as string;
    const now = new Date().toISOString();
    const result = await db.execute({
      sql: `SELECT p.ID, p.Title, pb.ExpiresAt FROM party_boosts pb
            JOIN parties p ON p.ID = pb.PartyID
            WHERE pb.UserID = ? AND pb.Active = 1 AND pb.ExpiresAt > ?
            ORDER BY pb.ExpiresAt DESC`,
      args: [userId, now],
    });
    return c.json({ boosts: result.rows });
  });
}
