import { Hono } from "hono";
import { db } from "../db";
import { apiLimiter } from "../middleware/rate-limiter";
import { sessionMiddleware } from "../middleware/session";
import { mapParty, getEnrichedParties, getDistance } from "../helpers";

function getUserId(c: any): string {
  return c.get("userId") || "";
}

export function registerPartyRoutes(app: Hono) {
  app.get("/api/feed", apiLimiter, sessionMiddleware, async (c) => {
    try {
      const lat = c.req.query("lat");
      const lon = c.req.query("lon");
      const userId = getUserId(c);

      let mappedParties = await getEnrichedParties();

      const registrationsResult = await db.execute({
        sql: "SELECT PartyID FROM registrations WHERE UserID = ?",
        args: [userId],
      });
      const swipedResult = await db.execute({
        sql: "SELECT PartyID FROM swipes WHERE UserID = ?",
        args: [userId],
      });

      const excludedPartyIDs = new Set<string>();
      registrationsResult.rows.forEach((row: any) => excludedPartyIDs.add(row.PartyID));
      swipedResult.rows.forEach((row: any) => excludedPartyIDs.add(row.PartyID));

      mappedParties = mappedParties.filter((p: any) => !excludedPartyIDs.has(p.ID));

      if (lat && lon) {
        const Lat = parseFloat(lat);
        const Lon = parseFloat(lon);
        if (!isNaN(Lat) && !isNaN(Lon)) {
          mappedParties.sort((a: any, b: any) => {
            const distA = getDistance(Lat, Lon, a.GeoLat || 0, a.GeoLon || 0);
            const distB = getDistance(Lat, Lon, b.GeoLat || 0, b.GeoLon || 0);
            return distB - distA;
          });
        }
      }
      return c.json(mappedParties);
    } catch (e: any) {
      console.error(e);
      return c.json({ error: e.message || "Internal server error" }, 500);
    }
  });

  // Batch fetch multiple parties by IDs (must be before /api/party/:id or Hono matches :id as "parties")
  app.get("/api/parties", apiLimiter, async (c) => {
    try {
      const idsParam = c.req.query("ids");
      if (!idsParam) return c.json([]);
      const ids = idsParam.split(",").filter(Boolean);
      if (ids.length === 0) return c.json([]);
      const placeholders = ids.map(() => "?").join(",");
      const result = await db.execute({
        sql: `SELECT * FROM parties WHERE ID IN (${placeholders})`,
        args: ids,
      });
      return c.json(result.rows.map((row: any) => mapParty(row)));
    } catch (e: any) {
      console.error("Batch party fetch error:", e);
      return c.json({ error: e.message || "Internal server error" }, 500);
    }
  });

  app.get("/api/party/:id", apiLimiter, async (c) => {
    try {
      const id = c.req.param("id");
      const result = await db.execute({
        sql: "SELECT * FROM parties WHERE ID = ?",
        args: [id],
      });
      const partyRow = result.rows[0] as any;
      if (!partyRow) return c.json({ error: "Party not found" }, 404);
      return c.json(mapParty(partyRow));
    } catch (e: any) {
      console.error(e);
      return c.json({ error: e.message || "Internal server error" }, 500);
    }
  });
}
