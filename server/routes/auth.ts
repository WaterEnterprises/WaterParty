import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import sharp from "sharp";
import { db } from "../db";
import { authLimiter } from "../middleware/rate-limiter";
import { sessionMiddleware, createSession } from "../middleware/session";
import { sendTelegramMessage } from "../telegram";
import { mapUser, countryToCurrency } from "../helpers";

export function registerAuthRoutes(app: Hono) {
  app.post("/login", authLimiter, async (c) => {
    try {
      const { email, password } = await c.req.json();
      const safeEmail = (email || "").trim().toLowerCase();

      const result = await db.execute({
        sql: "SELECT * FROM users WHERE LOWER(TRIM(Email)) = ?",
        args: [safeEmail],
      });
      const userRow = result.rows[0] as any;

      if (!userRow || !bcrypt.compareSync(password, userRow.Password as string)) {
        return c.json({ error: "Invalid username or password" }, 401);
      }
      const safeUser = { ...userRow };
      delete safeUser.Password;

      const { sessionId } = await createSession(safeUser.ID, c);
      sendTelegramMessage(`<b>New Login</b>\nUser: ${safeUser.RealName}\nEmail: ${safeUser.Email}`);

      return c.json({ user: mapUser(safeUser), sessionId });
    } catch (e: any) {
      console.error(e);
      return c.json({ error: e.message || "Internal server error" }, 500);
    }
  });

  app.post("/register", authLimiter, async (c) => {
    try {
      const { user, password, lat, lon } = await c.req.json();

      if (!user || typeof user !== 'object') {
        return c.json({ error: "Missing user registration data" }, 400);
      }

      const safeEmail = (user.Email || "").trim().toLowerCase();
      if (!safeEmail) return c.json({ error: "Email is required" }, 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) return c.json({ error: "Invalid email format" }, 400);
      if (!password || password.length < 8) return c.json({ error: "Password must be at least 8 characters long" }, 400);

      const realName = (user.RealName || "").trim();
      if (!realName || realName.length < 2) return c.json({ error: "Full name is required (at least 2 characters)" }, 400);

      const profilePhotos = Array.isArray(user.ProfilePhotos) ? user.ProfilePhotos : [];
      if (profilePhotos.length === 0) return c.json({ error: "At least one profile photo is required" }, 400);

      if (user.Gender && !['MALE', 'FEMALE', 'OTHER'].includes((user.Gender || '').toUpperCase())) return c.json({ error: "Gender must be MALE, FEMALE, or OTHER" }, 400);
      if (user.Birthday) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(user.Birthday)) return c.json({ error: "Birthday must be in YYYY-MM-DD format" }, 400);
        const birthdayDate = new Date(user.Birthday + 'T00:00:00Z');
        if (isNaN(birthdayDate.getTime())) return c.json({ error: "Birthday must be a valid date" }, 400);
        const minAge = new Date();
        minAge.setFullYear(minAge.getFullYear() - 9);
        if (birthdayDate > minAge) return c.json({ error: "You must be at least 9 years old" }, 400);
      }
      if (user.Bio && user.Bio.length > 500) return c.json({ error: "Bio must be 500 characters or less" }, 400);
      if (user.Instagram && user.Instagram.length > 100) return c.json({ error: "Instagram handle must be 100 characters or less" }, 400);
      if (user.Twitter && user.Twitter.length > 100) return c.json({ error: "Twitter handle must be 100 characters or less" }, 400);
      if (user.JobTitle && user.JobTitle.length > 100) return c.json({ error: "Job title must be 100 characters or less" }, 400);
      if (user.Company && user.Company.length > 100) return c.json({ error: "Company name must be 100 characters or less" }, 400);
      if (user.School && user.School.length > 100) return c.json({ error: "School name must be 100 characters or less" }, 400);
      if (user.Degree && user.Degree.length > 100) return c.json({ error: "Degree must be 100 characters or less" }, 400);

      const existingResult = await db.execute({
        sql: "SELECT * FROM users WHERE LOWER(TRIM(Email)) = ?",
        args: [safeEmail],
      });
      if (existingResult.rows[0]) return c.json({ error: "Email address already registered" }, 400);

      const processedPhotoIds: string[] = [];
      let photoIdx = 0;
      for (const photo of profilePhotos) {
        if (typeof photo === 'string' && photo.startsWith('data:')) {
          try {
            const [mimeInfo, base64Data] = photo.split(',');
            const buffer = Buffer.from(base64Data, 'base64');
            const processedBuffer = await sharp(buffer)
              .resize(1080, 1920, { fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: 92 })
              .toBuffer();
            const mediaId = 'media_' + Date.now() + '_' + (photoIdx++) + '_' + crypto.randomBytes(4).toString('hex');
            const now = new Date().toISOString();
            await db.execute({
              sql: 'INSERT INTO media (ID, Data, MimeType, FileName, CreatedAt) VALUES (?, ?, ?, ?, ?)',
              args: [mediaId, processedBuffer, 'image/jpeg', `profile_${photoIdx}.jpg`, now],
            });
            processedPhotoIds.push(mediaId);
          } catch (e) {
            console.error('Failed to process profile photo:', e);
          }
        } else if (typeof photo === 'string' && photo.startsWith('media_')) {
          processedPhotoIds.push(photo);
        }
      }

      if (processedPhotoIds.length === 0) {
        processedPhotoIds.push(...profilePhotos.filter((p: any) => typeof p === 'string'));
      }

      const newID = "user_" + Date.now();
      const hash = bcrypt.hashSync(password, 10);

      await db.execute({
        sql: "INSERT INTO users (ID, RealName, Email, Password, ProfilePhotos, TrustScore, Thumbnail, Bio, Instagram, Twitter, Gender, Birthday, JobTitle, Company, School, Degree, HostedCount, HostingRating, Reach, ShowEmail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [newID, realName, safeEmail, hash, JSON.stringify(processedPhotoIds), 100, processedPhotoIds[0] || "",
          user.Bio || "", user.Instagram || "", user.Twitter || "", user.Gender ? user.Gender.toUpperCase() : "", user.Birthday || "",
          user.JobTitle || "", user.Company || "", user.School || "", user.Degree || "", 0, 0, 0, user.ShowEmail ? 1 : 0],
      });

      // Detect currency from GPS coords if provided
      if (lat !== undefined && lon !== undefined) {
        let preferredCurrency: string | null = null;
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
            { signal: AbortSignal.timeout(5000) }
          );
          if (geoRes.ok) {
            const geoData = await geoRes.json() as any;
            const countryCode = geoData?.address?.country_code;
            if (countryCode) {
              preferredCurrency = countryToCurrency(countryCode);
            }
          }
        } catch (e) {
          console.warn("Registration reverse geocode failed:", e);
        }

        await db.execute({
          sql: "UPDATE users SET PreferredCurrency = ?, Latitude = ?, Longitude = ? WHERE ID = ?",
          args: [preferredCurrency || 'USD', lat, lon, newID],
        });
      }

      const userResult = await db.execute({ sql: "SELECT * FROM users WHERE ID = ?", args: [newID] });
      const userRow = userResult.rows[0] as any;
      const safeUser = { ...userRow };
      delete safeUser.Password;

      const { sessionId } = await createSession(newID, c);
      sendTelegramMessage(`<b>New Registration</b>\nUser: ${safeUser.RealName}\nEmail: ${safeUser.Email}\nID: ${safeUser.ID}`);

      return c.json({ user: mapUser(safeUser), sessionId });
    } catch (e: any) {
      console.error(e);
      return c.json({ error: e.message || "Internal server error" }, 500);
    }
  });

  app.post("/api/logout", async (c) => {
    try {
      const sessionId = c.req.header("x-session-token");
      if (sessionId) {
        await db.execute({ sql: "UPDATE sessions SET Revoked = 1 WHERE ID = ?", args: [sessionId] });
      }
      setCookie(c, "session", "", { path: "/", maxAge: 0 });
      return c.json({ success: true });
    } catch (e: any) {
      console.error("Logout failed:", e);
      return c.json({ error: e.message || "Logout failed" }, 500);
    }
  });

  app.delete("/api/account", sessionMiddleware, async (c) => {
    try {
      const userId = c.get("userId") as string;
      if (!userId) return c.json({ error: "Not authenticated" }, 401);

      // Delete all user-related data in parallel
      const promises = [
        // Revoke all sessions for this user
        db.execute({ sql: "DELETE FROM sessions WHERE UserID = ?", args: [userId] }),

        // Delete registrations (party join requests)
        db.execute({ sql: "DELETE FROM registrations WHERE UserID = ?", args: [userId] }),

        // Delete swipes
        db.execute({ sql: "DELETE FROM swipes WHERE UserID = ?", args: [userId] }),

        // Delete messages sent by user
        db.execute({ sql: "DELETE FROM messages WHERE SenderID = ?", args: [userId] }),

        // Delete push notification tokens
        db.execute({ sql: "DELETE FROM push_tokens WHERE UserID = ?", args: [userId] }),

        // Delete user reports (both as reporter and reported)
        db.execute({ sql: "DELETE FROM user_reports WHERE ReporterID = ? OR ReportedUserID = ?", args: [userId, userId] }),

        // Delete tips (both sent and received)
        db.execute({ sql: "DELETE FROM tips WHERE SenderID = ? OR ReceiverID = ?", args: [userId, userId] }),

        // Delete crowdfund contributions
        db.execute({ sql: "DELETE FROM crowdfund_contributions WHERE UserID = ?", args: [userId] }),

        // Remove from chat_participants
        db.execute({ sql: "DELETE FROM chat_participants WHERE UserID = ?", args: [userId] }),

        // Delete withdrawal requests
        db.execute({ sql: "DELETE FROM withdrawal_requests WHERE UserID = ?", args: [userId] }),

        // Delete party boosts
        db.execute({ sql: "DELETE FROM party_boosts WHERE UserID = ?", args: [userId] }),
      ];

      await Promise.all(promises);

      // Find all parties hosted by this user
      const hostedPartiesResult = await db.execute({
        sql: "SELECT ID, ChatRoomID FROM parties WHERE HostID = ?",
        args: [userId],
      });

      // Delete the hosted parties and their chat rooms + registrations
      for (const row of hostedPartiesResult.rows) {
        const party = row as any;
        await Promise.all([
          db.execute({ sql: "DELETE FROM registrations WHERE PartyID = ?", args: [party.ID] }),
          db.execute({ sql: "DELETE FROM party_boosts WHERE PartyID = ?", args: [party.ID] }),
          db.execute({ sql: "DELETE FROM crowdfund_contributions WHERE PartyID = ?", args: [party.ID] }),
        ]);
        if (party.ChatRoomID) {
          await Promise.all([
            db.execute({ sql: "DELETE FROM messages WHERE ChatID = ?", args: [party.ChatRoomID] }),
            db.execute({ sql: "DELETE FROM chat_participants WHERE ChatID = ?", args: [party.ChatRoomID] }),
            db.execute({ sql: "DELETE FROM chats WHERE ID = ?", args: [party.ChatRoomID] }),
          ]);
        }
        await db.execute({ sql: "DELETE FROM parties WHERE ID = ?", args: [party.ID] });
      }

      // Delete any DMs where user is the only remaining participant (after user removal)
      const userChatsResult = await db.execute({
        sql: "SELECT ID FROM chats WHERE IsGroup = 0 AND ParticipantIDs LIKE ?",
        args: [`%${userId}%`],
      });
      for (const row of userChatsResult.rows) {
        const chat = row as any;
        await Promise.all([
          db.execute({ sql: "DELETE FROM messages WHERE ChatID = ?", args: [chat.ID] }),
          db.execute({ sql: "DELETE FROM chat_participants WHERE ChatID = ?", args: [chat.ID] }),
          db.execute({ sql: "DELETE FROM chats WHERE ID = ?", args: [chat.ID] }),
        ]);
      }

      // Finally delete the user row
      await db.execute({ sql: "DELETE FROM users WHERE ID = ?", args: [userId] });

      // Clear session cookie
      setCookie(c, "session", "", { path: "/", maxAge: 0 });

      return c.json({ success: true, message: "Account deleted successfully" });
    } catch (e: any) {
      console.error("Account deletion failed:", e);
      return c.json({ error: e.message || "Failed to delete account" }, 500);
    }
  });
}
