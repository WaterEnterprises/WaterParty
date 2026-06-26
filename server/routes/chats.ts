import { Hono } from "hono";
import { db } from "../db";
import { apiLimiter } from "../middleware/rate-limiter";
import { sessionMiddleware } from "../middleware/session";
import { mapChat, getEnrichedChats, getChatMessages, syncChatParticipants } from "../helpers";
import { broadcastChatsGlobal } from "../ws/handler";

function getUserId(c: any): string {
  return c.get("userId") || "";
}

export function registerChatRoutes(app: Hono) {
  app.get("/api/chats", apiLimiter, sessionMiddleware, async (c) => {
    try {
      const userId = getUserId(c);
      const chats = await getEnrichedChats(userId);
      return c.json(chats);
    } catch (e: any) {
      console.error('CHATS HANDLER ERROR:', e);
      return c.json({ error: e.message || "Internal server error" }, 500);
    }
  });

  app.post("/api/chats/dm", apiLimiter, sessionMiddleware, async (c) => {
    try {
      const { targetUserId } = await c.req.json();
      const sourceUserId = getUserId(c);
      if (!targetUserId) return c.json({ error: "Missing targetUserId" }, 400);

      const meResult = await db.execute({ sql: "SELECT * FROM users WHERE ID = ?", args: [sourceUserId] });
      const me = meResult.rows[0] as any;
      const otherResult = await db.execute({ sql: "SELECT * FROM users WHERE ID = ?", args: [targetUserId] });
      const other = otherResult.rows[0] as any;

      if (!me || !other) return c.json({ error: "User not found" }, 404);

      const allChatsResult = await db.execute({
        sql: "SELECT * FROM chats WHERE IsGroup = 0 AND ParticipantIDs LIKE ? AND ParticipantIDs LIKE ?",
        args: [`%${sourceUserId}%`, `%${targetUserId}%`],
      });
      const existing = allChatsResult.rows.map((row) => mapChat(row as any))[0];

      let chatID: string;
      if (existing) {
        chatID = existing.ID;
      } else {
        chatID = "dm_" + Date.now() + "_" + sourceUserId + "_" + targetUserId;
        await db.execute({
          sql: `INSERT INTO chats (ID, PartyID, Title, ImageUrl, RecentMessages, IsGroup, ParticipantIDs) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [chatID, "DM",
            `${(!me.RealName || me.RealName.toLowerCase() === "unknown") ? "" : me.RealName} & ${(!other.RealName || other.RealName.toLowerCase() === "unknown") ? "" : other.RealName}`,
            "", JSON.stringify([]), 0, JSON.stringify([sourceUserId, targetUserId])],
        });
        await syncChatParticipants(chatID, [sourceUserId, targetUserId]);
      }

      broadcastChatsGlobal();
      return c.json({ ChatID: chatID });
    } catch (e: any) {
      console.error(e);
      return c.json({ error: e.message || "Internal server error" }, 500);
    }
  });

  app.get("/api/chats/:id/messages", apiLimiter, sessionMiddleware, async (c) => {
    try {
      const chatId = c.req.param("id");
      const userId = getUserId(c);
      const limit = Math.min(Number(c.req.query("limit")) || 50, 100);
      const before = c.req.query("before") || undefined;

      // Verify user is a participant of this chat
      const chatResult = await db.execute({
        sql: "SELECT ParticipantIDs FROM chats WHERE ID = ?",
        args: [chatId],
      });
      const chatRow = chatResult.rows[0] as any;
      if (!chatRow) return c.json({ error: "Chat not found" }, 404);

      const participantIDs = JSON.parse(chatRow.ParticipantIDs || "[]");
      if (!participantIDs.includes(userId)) {
        return c.json({ error: "Not a participant of this chat" }, 403);
      }

      const messages = await getChatMessages(chatId, limit, before);

      // Enrich messages with sender info (names, thumbnails)
      const senderIds = [...new Set<string>(messages.map((m: any) => m.SenderID).filter(Boolean))];
      const userMap = new Map<string, any>();
      if (senderIds.length > 0) {
        const placeholders = senderIds.map(() => "?").join(",");
        const usersResult = await db.execute({
          sql: `SELECT ID, RealName, Thumbnail FROM users WHERE ID IN (${placeholders})`,
          args: senderIds,
        });
        for (const row of usersResult.rows) {
          const u = row as any;
          userMap.set(u.ID, u);
        }
      }

      const enriched = messages.map((m: any) => {
        const sender = userMap.get(m.SenderID);
        return {
          ...m,
          SenderName: sender ? ((!sender.RealName || sender.RealName.toLowerCase() === "unknown") ? "" : sender.RealName) : "",
          SenderThumbnail: sender?.Thumbnail || "",
        };
      });

      return c.json(enriched);
    } catch (e: any) {
      console.error("Failed to fetch messages:", e);
      return c.json({ error: e.message || "Failed to fetch messages" }, 500);
    }
  });
}
