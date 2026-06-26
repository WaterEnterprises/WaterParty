import { db } from "./db";
import { ADMIN_USER_IDS } from "./config";

export const parseJSON = (str: any, def: any = []) => {
  try {
    return str ? JSON.parse(str) : def;
  } catch {
    return def;
  }
};

export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const mapUser = (row: any) => ({
  ...row,
  ProfilePhotos: parseJSON(row.ProfilePhotos),
  Birthday: row.Birthday || "",
  IsAdmin: Boolean(row.IsAdmin) || (typeof row.ID === 'string' && ADMIN_USER_IDS.includes(row.ID)),
  Balance: Number(row.Balance || 0),
});

export const mapParty = (row: any) => ({
  ...row,
  PartyPhotos: parseJSON(row.PartyPhotos),
  VibeTags: parseJSON(row.VibeTags),
  Rules: parseJSON(row.Rules),
});

export const mapChat = (row: any) => ({
  ...row,
  RecentMessages: parseJSON(row.RecentMessages),
  ParticipantIDs: parseJSON(row.ParticipantIDs),
  IsGroup: Boolean(row.IsGroup),
});

export async function getChatMessages(chatId: string, limit = 50, before?: string) {
  if (before) {
    const result = await db.execute({
      sql: `SELECT * FROM messages WHERE ChatID = ? AND CreatedAt < ? ORDER BY CreatedAt DESC LIMIT ?`,
      args: [chatId, before, limit],
    });
    return result.rows.reverse();
  }
  const result = await db.execute({
    sql: `SELECT * FROM messages WHERE ChatID = ? ORDER BY CreatedAt DESC LIMIT ?`,
    args: [chatId, limit],
  });
  return result.rows.reverse();
}

export async function getLastMessage(chatId: string) {
  const result = await db.execute({
    sql: `SELECT * FROM messages WHERE ChatID = ? ORDER BY CreatedAt DESC LIMIT 1`,
    args: [chatId],
  });
  return result.rows[0] || null;
}

let cachedEnrichedParties: any[] | null = null;
const PARTIES_CACHE_TTL_MS = 30_000;
let partiesCacheExpiresAt = 0;

export function invalidatePartiesCache() {
  cachedEnrichedParties = null;
  partiesCacheExpiresAt = 0;
}

export async function getEnrichedParties() {
  if (cachedEnrichedParties && Date.now() < partiesCacheExpiresAt) {
    return cachedEnrichedParties;
  }

  const result = await db.execute("SELECT * FROM parties");
  const parties = result.rows.map((row: any) => mapParty(row));

  const hostIds = [...new Set<string>(parties.map((p: any) => p.HostID).filter(Boolean))];
  const hostMap = new Map<string, any>();
  if (hostIds.length > 0) {
    const placeholders = hostIds.map(() => "?").join(",");
    const hostsResult = await db.execute({
      sql: `SELECT ID, RealName, Thumbnail, ProfilePhotos FROM users WHERE ID IN (${placeholders})`,
      args: hostIds,
    });
    for (const row of hostsResult.rows) {
      const h = row as any;
      hostMap.set(h.ID, h);
    }
  }

  const enriched = parties.map((p: any) => {
    const hostData = hostMap.get(p.HostID);
    if (hostData) {
      p.HostName = (!hostData.RealName || hostData.RealName.toLowerCase() === "unknown") ? "" : hostData.RealName;
      p.HostThumbnail = hostData.Thumbnail || parseJSON(hostData.ProfilePhotos)?.[0] || "";
    }
    return p;
  });

  cachedEnrichedParties = enriched;
  partiesCacheExpiresAt = Date.now() + PARTIES_CACHE_TTL_MS;
  return enriched;
}

// ─── Currency detection ─────────────────────────────────────────────

const SUPPORTED_CURRENCIES = ["USD", "BRL", "EUR", "GBP"];

const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  'BR': 'BRL',
  'US': 'USD',
  'GB': 'GBP',
  'DE': 'EUR', 'FR': 'EUR', 'IT': 'EUR', 'ES': 'EUR', 'PT': 'EUR',
  'NL': 'EUR', 'BE': 'EUR', 'AT': 'EUR', 'FI': 'EUR', 'GR': 'EUR',
  'IE': 'EUR', 'LU': 'EUR', 'SK': 'EUR', 'SI': 'EUR', 'EE': 'EUR',
  'LV': 'EUR', 'LT': 'EUR', 'MT': 'EUR', 'CY': 'EUR', 'HR': 'EUR',
};

export function countryToCurrency(countryCode: string): string | null {
  const currency = COUNTRY_CURRENCY_MAP[countryCode.toUpperCase()];
  if (currency && SUPPORTED_CURRENCIES.includes(currency)) return currency;
  return null;
}

// ─── Chat participant sync ───────────────────────────────────────────

/**
 * Sync the chat_participants junction table from a chat's ParticipantIDs JSON.
 * Call this whenever a chat is created or its participants change.
 */
export async function syncChatParticipants(chatID: string, participantIDs: string[]): Promise<void> {
  // Remove existing entries for this chat, then insert new ones
  await db.execute({
    sql: "DELETE FROM chat_participants WHERE ChatID = ?",
    args: [chatID],
  });
  for (const uid of participantIDs) {
    await db.execute({
      sql: "INSERT OR IGNORE INTO chat_participants (ChatID, UserID) VALUES (?, ?)",
      args: [chatID, uid],
    });
  }
}

/**
 * Backfill the chat_participants table from existing chats' ParticipantIDs JSON.
 * Runs once per DB connection startup.
 */
export async function backfillChatParticipants(): Promise<void> {
  try {
    const result = await db.execute("SELECT ID, ParticipantIDs FROM chats");
    for (const row of result.rows) {
      const r = row as any;
      const ids = parseJSON(r.ParticipantIDs, []);
      if (Array.isArray(ids) && ids.length > 0) {
        await syncChatParticipants(r.ID, ids);
      }
    }
    console.log(`Chat participants backfilled for ${result.rows.length} chats`);
  } catch (e) {
    console.error("Chat participants backfill failed:", e);
  }
}

// ─── Feed exclusion batching ─────────────────────────────────────

/**
 * Batch-fetch feed exclusions (registrations + swipes) for multiple users
 * in 2 DB queries total, instead of 2 per user.
 * Returns a Map<string, Set<string>> of userId → excluded PartyIDs.
 */
export async function getUserExclusionsForFeed(userIDs: string[]): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>();
  if (userIDs.length === 0) return result;

  // Initialize empty sets for all users
  for (const uid of userIDs) {
    result.set(uid, new Set());
  }

  // Batch 1: all registrations
  const placeholders = userIDs.map(() => "?").join(",");
  try {
    const regResult = await db.execute({
      sql: `SELECT UserID, PartyID FROM registrations WHERE UserID IN (${placeholders})`,
      args: userIDs,
    });
    for (const row of regResult.rows) {
      const r = row as any;
      const set = result.get(r.UserID);
      if (set) set.add(r.PartyID);
    }
  } catch { /* non-critical */ }

  // Batch 2: all swipes
  try {
    const swipeResult = await db.execute({
      sql: `SELECT UserID, PartyID FROM swipes WHERE UserID IN (${placeholders})`,
      args: userIDs,
    });
    for (const row of swipeResult.rows) {
      const r = row as any;
      const set = result.get(r.UserID);
      if (set) set.add(r.PartyID);
    }
  } catch { /* non-critical */ }

  return result;
}

// ─── Chat caching ───────────────────────────────────────────────────
const CHATS_CACHE_TTL_MS = 30_000; // 30 seconds (was 10s)
const chatsCache = new Map<string, { data: any[]; expiresAt: number }>();

export function invalidateChatsCache(userID?: string) {
  if (userID) {
    chatsCache.delete(userID);
  } else {
    chatsCache.clear();
  }
}

export async function getEnrichedChats(userID: string) {
  // Check cache first
  const cached = chatsCache.get(userID);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  // Use chat_participants junction table for fast indexed lookup instead of LIKE '%id%'
  const chatIDsResult = await db.execute({
    sql: "SELECT ChatID FROM chat_participants WHERE UserID = ?",
    args: [userID],
  });
  const chatIDs = chatIDsResult.rows.map((r: any) => r.ChatID);

  if (chatIDs.length === 0) {
    chatsCache.set(userID, { data: [], expiresAt: Date.now() + CHATS_CACHE_TTL_MS });
    return [];
  }

  // Fetch all chats in a single batch query using IN
  const placeholders = chatIDs.map(() => "?").join(",");
  const chatsResult = await db.execute({
    sql: `SELECT * FROM chats WHERE ID IN (${placeholders})`,
    args: chatIDs,
  });
  const allChats = chatsResult.rows.map((row: any) => mapChat(row));

  // Batch-fetch all DM partner user info in a single query
  const otherIds = [...new Set<string>(
    allChats
      .filter((c: any) => !c.IsGroup)
      .map((c: any) => c.ParticipantIDs?.find((id: string) => id !== userID))
      .filter(Boolean)
  )];

  const userMap = new Map<string, any>();
  if (otherIds.length > 0) {
    const userPlaceholders = otherIds.map(() => "?").join(",");
    const usersResult = await db.execute({
      sql: `SELECT ID, RealName, Thumbnail, ProfilePhotos FROM users WHERE ID IN (${userPlaceholders})`,
      args: otherIds,
    });
    for (const row of usersResult.rows) {
      const u = row as any;
      userMap.set(u.ID, u);
    }
  }

  for (const chat of allChats) {
    if (!chat.IsGroup) {
      const otherID = chat.ParticipantIDs?.find((id: string) => id !== userID);
      if (otherID) {
        const other = userMap.get(otherID);
        if (other) {
          const name = (!other.RealName || other.RealName.toLowerCase() === "unknown") ? "" : other.RealName;
          chat.Title = name;
          chat.ImageUrl = other.Thumbnail || parseJSON(other.ProfilePhotos)?.[0] || chat.ImageUrl;
        }
      }
    }
  }

  // Cache the result
  chatsCache.set(userID, { data: allChats, expiresAt: Date.now() + CHATS_CACHE_TTL_MS });

  return allChats;
}

/**
 * Batch-fetch enriched chats for multiple users in a single DB round-trip.
 * Used by broadcastChatsGlobal to avoid N queries for N connected clients.
 */
export async function getEnrichedChatsForUsers(userIDs: string[]): Promise<Map<string, any[]>> {
  if (userIDs.length === 0) return new Map();

  // Fetch all chat participants for all users in one query
  const cpPlaceholders = userIDs.map(() => "?").join(",");
  const cpResult = await db.execute({
    sql: `SELECT cp.ChatID, cp.UserID FROM chat_participants cp WHERE cp.UserID IN (${cpPlaceholders})`,
    args: userIDs,
  });

  // Group chat IDs by user
  const userChatIDs = new Map<string, Set<string>>();
  const allChatIDs = new Set<string>();
  for (const row of cpResult.rows) {
    const r = row as any;
    if (!userChatIDs.has(r.UserID)) userChatIDs.set(r.UserID, new Set());
    userChatIDs.get(r.UserID)!.add(r.ChatID);
    allChatIDs.add(r.ChatID);
  }

  if (allChatIDs.size === 0) {
    return new Map(userIDs.map(id => [id, []]));
  }

  // Fetch all chats in a single query
  const chatPlaceholders = [...allChatIDs].map(() => "?").join(",");
  const chatsResult = await db.execute({
    sql: `SELECT * FROM chats WHERE ID IN (${chatPlaceholders})`,
    args: [...allChatIDs],
  });
  const allChats = new Map<string, any>();
  for (const row of chatsResult.rows) {
    const chat = mapChat(row as any);
    allChats.set(chat.ID, chat);
  }

  // Fetch all DM partner user info in a single batch
  const allOtherIds = new Set<string>();
  for (const chat of allChats.values()) {
    if (!chat.IsGroup) {
      for (const pid of (chat.ParticipantIDs || [])) {
        allOtherIds.add(pid);
      }
    }
  }
  const userMap = new Map<string, any>();
  if (allOtherIds.size > 0) {
    const userPlaceholders = [...allOtherIds].map(() => "?").join(",");
    const usersResult = await db.execute({
      sql: `SELECT ID, RealName, Thumbnail, ProfilePhotos FROM users WHERE ID IN (${userPlaceholders})`,
      args: [...allOtherIds],
    });
    for (const row of usersResult.rows) {
      const u = row as any;
      userMap.set(u.ID, u);
    }
  }

  // Enrich DM chats with partner names
  for (const chat of allChats.values()) {
    if (!chat.IsGroup) {
      // Find the partner's name — any participant that isn't the current user
      // We set Title to the first-found partner name (will be overwritten per-user below)
      const partnerId = chat.ParticipantIDs?.find((id: string) => id !== userIDs[0]);
      if (partnerId) {
        const other = userMap.get(partnerId);
        if (other) {
          const name = (!other.RealName || other.RealName.toLowerCase() === "unknown") ? "" : other.RealName;
          chat.ImageUrl = other.Thumbnail || parseJSON(other.ProfilePhotos)?.[0] || chat.ImageUrl;
        }
      }
    }
  }

  // Build per-user result map
  const result = new Map<string, any[]>();
  for (const uid of userIDs) {
    const ids = userChatIDs.get(uid);
    if (!ids) {
      result.set(uid, []);
      continue;
    }
    const userChats: any[] = [];
    for (const cid of ids) {
      const chat = allChats.get(cid);
      if (chat) {
        // Set DM title to the other participant's name from this user's perspective
        if (!chat.IsGroup) {
          const otherID = chat.ParticipantIDs?.find((id: string) => id !== uid);
          if (otherID) {
            const other = userMap.get(otherID);
            if (other) {
              chat.Title = (!other.RealName || other.RealName.toLowerCase() === "unknown") ? "" : other.RealName;
            }
          }
        }
        userChats.push(chat);
      }
    }
    result.set(uid, userChats);

    // Update per-user cache
    chatsCache.set(uid, { data: userChats, expiresAt: Date.now() + CHATS_CACHE_TTL_MS });
  }

  return result;
}
