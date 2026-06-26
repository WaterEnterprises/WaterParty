import { Hono } from "hono";
import { db } from "../db";
import { apiLimiter } from "../middleware/rate-limiter";
import { sessionMiddleware } from "../middleware/session";
import { mapUser, invalidatePartiesCache, countryToCurrency } from "../helpers";
import { broadcastChatsGlobal } from "../ws/handler";

function validateUpdateProfilePayload(payload: any): string | null {
  const realName = (payload.RealName || "").trim();
  if (!realName || realName.length < 2) return "Full name must be at least 2 characters";
  if (payload.Bio && payload.Bio.length > 500) return "Bio must be 500 characters or less";
  if (payload.Gender && !['MALE', 'FEMALE', 'OTHER'].includes((payload.Gender || '').toUpperCase())) return "Gender must be MALE, FEMALE, or OTHER";
  if (payload.Birthday && !/^\d{4}-\d{2}-\d{2}$/.test(payload.Birthday)) return "Birthday must be in YYYY-MM-DD format";
  if (payload.Instagram && payload.Instagram.length > 100) return "Instagram handle must be 100 characters or less";
  if (payload.Twitter && payload.Twitter.length > 100) return "Twitter handle must be 100 characters or less";
  if (payload.VK && payload.VK.length > 100) return "VK handle must be 100 characters or less";
  if (payload.Telegram && payload.Telegram.length > 100) return "Telegram handle must be 100 characters or less";
  if (payload.WhatsApp) {
    const digitsOnly = String(payload.WhatsApp).replace(/[^0-9]/g, '');
    if (digitsOnly.length < 7) return "WhatsApp number must have at least 7 digits";
    if (digitsOnly.length > 15) return "WhatsApp number must have at most 15 digits";
    if (payload.WhatsApp.length > 100) return "WhatsApp must be 100 characters or less";
  }
  if (payload.Facebook && payload.Facebook.length > 100) return "Facebook must be 100 characters or less";
  if (payload.JobTitle && payload.JobTitle.length > 100) return "Job title must be 100 characters or less";
  if (payload.Company && payload.Company.length > 100) return "Company must be 100 characters or less";
  if (payload.School && payload.School.length > 100) return "School must be 100 characters or less";
  if (payload.Degree && payload.Degree.length > 100) return "Degree must be 100 characters or less";
  if (payload.ShowEmail !== undefined && ![0, 1, true, false].includes(payload.ShowEmail)) return "ShowEmail must be true or false";
  return null;
}

export function registerUserRoutes(app: Hono) {
  app.get("/api/users/:id", apiLimiter, async (c) => {
    try {
      const id = c.req.param("id");
      const result = await db.execute({
        sql: "SELECT * FROM users WHERE ID = ?",
        args: [id],
      });
      const userRow = result.rows[0] as any;
      if (!userRow) return c.json({ error: "User not found" }, 404);
      const safeUser = { ...userRow };
      delete safeUser.Password;
      return c.json(mapUser(safeUser));
    } catch (e: any) {
      console.error(e);
      return c.json({ error: e.message || "Internal server error" }, 500);
    }
  });

  /**
   * POST /api/users/currency — Detect and save currency from GPS coordinates.
   * Takes lat/lon, reverse geocodes via Nominatim, maps to supported currency,
   * saves to user profile, and returns the currency code.
   */
  app.post("/api/users/currency", apiLimiter, sessionMiddleware, async (c) => {
    try {
      const userId = c.get("userId") as string;
      const { lat, lon } = await c.req.json();

      if (lat === undefined || lon === undefined) {
        return c.json({ error: "lat and lon are required" }, 400);
      }

      let currency: string | null = null;

      // Reverse geocode via Nominatim (free, no API key)
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (geoRes.ok) {
          const geoData = await geoRes.json() as any;
          const countryCode = geoData?.address?.country_code;
          if (countryCode) {
            currency = countryToCurrency(countryCode);
          }
        }
      } catch (e) {
        console.warn("Nominatim reverse geocode failed:", e);
      }

      // Default to USD if GPS geocoding failed
      const result = currency || 'USD';

      // Save to database
      await db.execute({
        sql: "UPDATE users SET PreferredCurrency = ?, Latitude = ?, Longitude = ? WHERE ID = ?",
        args: [result, lat, lon, userId],
      });

      console.log(`[Currency] User ${userId.slice(-8)} → ${result} (lat: ${lat.toFixed(2)}, lon: ${lon.toFixed(2)})`);

      return c.json({ currency: result });
    } catch (e: any) {
      console.error("Currency detection failed:", e);
      return c.json({ error: e.message || "Failed to detect currency" }, 500);
    }
  });

  app.post("/api/users/:id", apiLimiter, sessionMiddleware, async (c) => {
    try {
      const targetId = c.req.param("id");
      const authenticatedUserId = c.get("userId") as string;

      // Only allow updating your own profile
      if (targetId !== authenticatedUserId) {
        return c.json({ error: "You can only update your own profile" }, 403);
      }

      const payload = await c.req.json();

      // Validate payload
      const validationError = validateUpdateProfilePayload(payload);
      if (validationError) return c.json({ error: validationError }, 400);

      // Update the user
      await db.execute({
        sql: "UPDATE users SET RealName = ?, Bio = ?, Thumbnail = ?, ProfilePhotos = ?, Instagram = ?, Twitter = ?, VK = ?, Telegram = ?, WhatsApp = ?, Facebook = ?, Gender = ?, Birthday = ?, JobTitle = ?, Company = ?, School = ?, Degree = ?, ShowEmail = ? WHERE ID = ?",
        args: [(payload.RealName || "").trim(), payload.Bio, payload.Thumbnail,
          JSON.stringify(payload.ProfilePhotos || (payload.Thumbnail ? [payload.Thumbnail] : [])),
          payload.Instagram || "", payload.Twitter || "", payload.VK || "", payload.Telegram || "",
          payload.WhatsApp || "", payload.Facebook || "",
          payload.Gender ? payload.Gender.toUpperCase() : "", payload.Birthday || "",
          payload.JobTitle || "", payload.Company || "", payload.School || "", payload.Degree || "",
          payload.ShowEmail ? 1 : 0, authenticatedUserId],
      });

      // Fetch and return updated user
      const updatedResult = await db.execute({ sql: "SELECT * FROM users WHERE ID = ?", args: [authenticatedUserId] });
      const updatedRow = updatedResult.rows[0] as any;
      if (!updatedRow) return c.json({ error: "User not found after update" }, 404);

      const safeUser = { ...updatedRow };
      delete safeUser.Password;

      // Invalidate caches and broadcast to WS clients
      invalidatePartiesCache();
      broadcastChatsGlobal();

      return c.json({ user: mapUser(safeUser) });
    } catch (e: any) {
      console.error("Profile update failed:", e);
      return c.json({ error: e.message || "Failed to update profile" }, 500);
    }
  });
}
