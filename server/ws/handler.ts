import { createBunWebSocket } from "hono/bun";
import type { Context } from "hono";
import { db } from "../db";
import { mapChat, mapParty, mapUser, getEnrichedChats, getEnrichedParties, getDistance, invalidatePartiesCache, invalidateChatsCache, parseJSON, syncChatParticipants, getEnrichedChatsForUsers, getUserExclusionsForFeed } from "../helpers";
import { APP_URL } from "../config";

/** Resolve a media ID or relative URL to an absolute HTTPS URL for push notifications */
function resolvePushImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("media_")) {
    const base = APP_URL.replace(/\/+$/, "");
    return `${base}/api/media/${encodeURIComponent(url)}`;
  }
  // Relative URL — prefix with APP_URL
  if (url.startsWith("/")) {
    const base = APP_URL.replace(/\/+$/, "");
    return `${base}${url}`;
  }
  return undefined;
}

const { upgradeWebSocket, websocket } = createBunWebSocket();

// Global store of authenticated WS clients
export const wsClients = new Set<{ ws: any; userId: string }>();

function validateCreatePartyPayload(payload: any): string | null {
  if (!payload.Title?.trim() || payload.Title.length < 3) return "Title too short";
  if (!payload.Description?.trim() || payload.Description.length < 10) return "Description too short";
  if (!payload.City?.trim()) return "City is required";
  if (!payload.Address?.trim()) return "Address is required";
  if (!payload.PartyType?.trim()) return "Party vibe/type is required";
  if (!payload.StartTime) return "Start time is required";
  if (!payload.GeoLat || !payload.GeoLon) return "Map location is required";
  if (Number(payload.MaxCapacity) <= 0 || Number(payload.MaxCapacity) > 300) return "Capacity must be between 1 and 300";
  if (Number(payload.DurationHours) <= 0 || Number(payload.DurationHours) > 6) return "Duration must be between 1 and 6 hours";
  if (payload.CrowdfundTarget && (isNaN(Number(payload.CrowdfundTarget)) || Number(payload.CrowdfundTarget) < 0)) return "Crowdfund target must be a positive number";
  if (payload.CrowdfundCurrency && !['BRL', 'USD', 'EUR'].includes(payload.CrowdfundCurrency)) return "Invalid currency";
  if (!payload.PartyPhotos?.length) return "At least one photo required";
  return null;
}

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

function broadcastFeedUpdate() {
  // Non-blocking fire-and-forget broadcast
  (async () => {
    try {
      invalidatePartiesCache();
      const allParties = await getEnrichedParties();
      const clients = [...wsClients];
      if (clients.length === 0) return;

      // Batch exclusion queries across ALL connected users in 2 DB queries
      const userExclusions = await getUserExclusionsForFeed(clients.map(c => c.userId));

      for (const { ws, userId } of clients) {
        const excluded = userExclusions.get(userId) || new Set<string>();
        const filteredFeed = allParties.filter((p: any) => !excluded.has(p.ID));
        try {
          ws.send(JSON.stringify({ Event: "FEED_UPDATE", Payload: filteredFeed }));
        } catch (innerE) {
          console.error("Failed to send feed to user", userId, innerE);
        }
      }
    } catch (e) {
      console.error("Failed to run broadcastFeedUpdate", e);
    }
  })();
}

export function broadcastChatsGlobal() {
  const clients = [...wsClients];
  if (clients.length === 0) return;

  // Batch: query all chat participants for all connected users in a single DB round-trip
  const userIds = clients.map(c => c.userId);
  getEnrichedChatsForUsers(userIds).then(userChatsMap => {
    for (const { ws, userId } of clients) {
      const chats = userChatsMap.get(userId) || [];
      try {
        ws.send(JSON.stringify({ Event: "CHATS_LIST", Payload: chats }));
      } catch (e) {
        console.error("Failed to broadcast chats to client", userId, e);
      }
    }
  }).catch(e => {
    console.error("Failed to batch-load chats for broadcast:", e);
  });
}

export const wsHandler = upgradeWebSocket((c: Context) => ({
  async onOpen(evt: any, ws: any) {
    // Auth happens on first message (supports SessionToken in message body)
  },
  async onMessage(evt: any, ws: any) {
    try {
      const { Event, Payload, SessionToken } = JSON.parse(evt.data.toString());

      // Get session from message body, or don't require auth for some events
      let userId: string | null = null;
      if (SessionToken) {
        try {
          const sessionResult = await db.execute({
            sql: "SELECT UserID FROM sessions WHERE ID = ? AND ExpiresAt > ? AND Revoked = 0",
            args: [SessionToken, new Date().toISOString()],
          });
          const row = sessionResult.rows[0] as any;
          if (row) userId = row.UserID;
        } catch {}
      }
      if (!userId) {
        return ws.send(JSON.stringify({ Event: "ERROR", Payload: { message: "Authentication required" } }));
      }

      // Register or update client
      const existing = [...wsClients].find(c => c.userId === userId);
      if (existing) existing.ws = ws;
      else wsClients.add({ ws, userId });

      const send = (ev: string, data: any) => {
        try { ws.send(JSON.stringify({ Event: ev, Payload: data })); } catch {}
      };

      const broadcastChats = () => {
        broadcastChatsGlobal();
      };

      switch (Event) {
        case "GET_CHATS": {
          const enriched = await getEnrichedChats(userId);
          send("CHATS_LIST", enriched);
          break;
        }
        case "GET_FEED": {
          const { Lat, Lon } = Payload || {};
          let mappedParties = await getEnrichedParties();
          const registrationsResult = await db.execute({ sql: "SELECT PartyID FROM registrations WHERE UserID = ?", args: [userId] });
          const swipedResult = await db.execute({ sql: "SELECT PartyID FROM swipes WHERE UserID = ?", args: [userId] });
          const excludedPartyIDs = new Set<string>();
          registrationsResult.rows.forEach((row: any) => excludedPartyIDs.add(row.PartyID));
          swipedResult.rows.forEach((row: any) => excludedPartyIDs.add(row.PartyID));
          mappedParties = mappedParties.filter((p: any) => !excludedPartyIDs.has(p.ID));
          if (typeof Lat === "number" && typeof Lon === "number") {
            mappedParties.sort((a: any, b: any) => {
              const distA = getDistance(Lat, Lon, a.GeoLat || 0, a.GeoLon || 0);
              const distB = getDistance(Lat, Lon, b.GeoLat || 0, b.GeoLon || 0);
              return distB - distA;
            });
          }
          send("FEED_UPDATE", mappedParties);
          break;
        }
        case "SWIPE": {
          const { PartyID, Direction } = Payload;
          if (!PartyID || !Direction) return send("ERROR", { message: "PartyID and Direction are required" });
          if (!['left', 'right'].includes(Direction)) return send("ERROR", { message: "Direction must be 'left' or 'right'" });
          const swipeID = `swipe_${Date.now()}_${userId}_${PartyID}`;
          await db.execute({
            sql: "INSERT INTO swipes (ID, UserID, PartyID, Direction, Timestamp) VALUES (?, ?, ?, ?, ?)",
            args: [swipeID, userId, PartyID, Direction, new Date().toISOString()],
          });
          if (Direction === "right") {
            const regID = `reg_${Date.now()}_${userId}`;
            const existingResult = await db.execute({ sql: "SELECT * FROM registrations WHERE PartyID = ? AND UserID = ?", args: [PartyID, userId] });
            if (!existingResult.rows[0]) {
              await db.execute({
                sql: "INSERT INTO registrations (ID, PartyID, UserID, Status, Timestamp) VALUES (?, ?, ?, ?, ?)",
                args: [regID, PartyID, userId, "PENDING", new Date().toISOString()],
              });
            }
          }
          break;
        }
        case "CREATE_PARTY": {
          const validationError = validateCreatePartyPayload(Payload);
          if (validationError) return send("ERROR", { message: validationError });
          const pID = "party_" + Date.now();
          const imgUrl = Payload.PartyPhotos?.[0] || Payload.Thumbnail || "";
          await db.execute({
            sql: `INSERT INTO parties (ID, HostID, Title, Description, PartyPhotos, StartTime, DurationHours, Status, Address, City, GeoLat, GeoLon, MaxCapacity, CurrentGuestCount, VibeTags, Rules, ChatRoomID, Thumbnail, CrowdfundTarget, CrowdfundCurrent, CrowdfundCurrency, PartyType) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [pID, userId, Payload.Title, Payload.Description, JSON.stringify(Payload.PartyPhotos || []),
              Payload.StartTime, Payload.DurationHours, "OPEN", Payload.Address, Payload.City,
              Payload.GeoLat || 0, Payload.GeoLon || 0, Payload.MaxCapacity, 1,
              JSON.stringify(Payload.VibeTags || []), JSON.stringify(Payload.Rules || []),
              Payload.ChatRoomID, imgUrl, Payload.CrowdfundTarget || 0, 0,
              Payload.CrowdfundCurrency || "BRL", Payload.PartyType || "OTHER"],
          });
          await db.execute({
            sql: `INSERT INTO chats (ID, PartyID, Title, ImageUrl, RecentMessages, IsGroup, ParticipantIDs) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            args: [Payload.ChatRoomID, pID, Payload.Title, imgUrl, JSON.stringify([]), 1, JSON.stringify([userId])],
          });
          await syncChatParticipants(Payload.ChatRoomID, [userId]);

          // If user watched a rewarded ad boost, apply it
          if (Payload.Boost) {
            const boostId = "boost_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
            const now = new Date().toISOString();
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            await db.execute({
              sql: `INSERT INTO party_boosts (ID, PartyID, UserID, BoostType, CreatedAt, ExpiresAt, Active)
                    VALUES (?, ?, ?, 'video_ad', ?, ?, 1)`,
              args: [boostId, pID, userId, now, expiresAt],
            });
            console.log(`[Ads] Party ${pID} boosted by user ${userId} (via create-party boost flag)`);
          }
          const newlyCreatedResult = await db.execute({ sql: "SELECT * FROM parties WHERE ID = ?", args: [pID] });
          const newlyCreatedParty = newlyCreatedResult.rows[0];
          if (newlyCreatedParty) send("PARTY_CREATED", mapParty(newlyCreatedParty));
          invalidatePartiesCache();
          broadcastFeedUpdate();
          // Use chat_participants junction table for fast lookup
          const chatIDsResult = await db.execute({ sql: "SELECT ChatID FROM chat_participants WHERE UserID = ?", args: [userId] });
          const userChatIDs = chatIDsResult.rows.map((r: any) => r.ChatID);
          if (userChatIDs.length > 0) {
            const cp = userChatIDs.map(() => "?").join(",");
            const cResult = await db.execute({ sql: `SELECT * FROM chats WHERE ID IN (${cp})`, args: userChatIDs });
            send("CHATS_LIST", cResult.rows.map((row: any) => mapChat(row)));
          } else {
            send("CHATS_LIST", []);
          }
          break;
        }
        case "UPDATE_PROFILE": {
          const profileError = validateUpdateProfilePayload(Payload);
          if (profileError) return send("ERROR", { message: profileError });
          await db.execute({
            sql: "UPDATE users SET RealName = ?, Bio = ?, Thumbnail = ?, ProfilePhotos = ?, Instagram = ?, Twitter = ?, VK = ?, Telegram = ?, WhatsApp = ?, Facebook = ?, Gender = ?, Birthday = ?, JobTitle = ?, Company = ?, School = ?, Degree = ?, ShowEmail = ? WHERE ID = ?",
            args: [(Payload.RealName || "").trim(), Payload.Bio, Payload.Thumbnail,
              JSON.stringify(Payload.ProfilePhotos || (Payload.Thumbnail ? [Payload.Thumbnail] : [])),
              Payload.Instagram || "", Payload.Twitter || "", Payload.VK || "", Payload.Telegram || "",
              Payload.WhatsApp || "", Payload.Facebook || "",              Payload.Gender ? Payload.Gender.toUpperCase() : "", Payload.Birthday || "",
              Payload.JobTitle || "", Payload.Company || "", Payload.School || "", Payload.Degree || "",
              Payload.ShowEmail ? 1 : 0, userId],
          });
          const updatedUserResult = await db.execute({ sql: "SELECT * FROM users WHERE ID = ?", args: [userId] });
          const updatedUser = updatedUserResult.rows[0];
          if (updatedUser) {
            send("PROFILE_UPDATED", mapUser(updatedUser));
            invalidatePartiesCache();
            broadcastFeedUpdate();
            broadcastChats();
          }
          break;
        }
        case "CREATE_DM": {
          const { TargetUserID } = Payload;
          if (!TargetUserID) return send("ERROR", { message: "TargetUserID is required" });
          const meResult = await db.execute({ sql: "SELECT * FROM users WHERE ID = ?", args: [userId] });
          const me = meResult.rows[0] as any;
          const otherResult = await db.execute({ sql: "SELECT * FROM users WHERE ID = ?", args: [TargetUserID] });
          const other = otherResult.rows[0] as any;
          if (me && other) {
            const allChatsResult = await db.execute({
              sql: "SELECT * FROM chats WHERE IsGroup = 0 AND ParticipantIDs LIKE ? AND ParticipantIDs LIKE ?",
              args: [`%${userId}%`, `%${TargetUserID}%`],
            });
            const existing = allChatsResult.rows.map((row) => mapChat(row as any))[0];
            let chatID: string;
            if (existing) {
              chatID = existing.ID;
            } else {
              chatID = "dm_" + Date.now() + "_" + userId + "_" + TargetUserID;
              await db.execute({
                sql: `INSERT INTO chats (ID, PartyID, Title, ImageUrl, RecentMessages, IsGroup, ParticipantIDs) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                args: [chatID, "DM",
                  `${(!me.RealName || me.RealName.toLowerCase() === "unknown") ? "" : me.RealName} & ${(!other.RealName || other.RealName.toLowerCase() === "unknown") ? "" : other.RealName}`,
                  "", JSON.stringify([]), 0, JSON.stringify([userId, TargetUserID])],
              });
            }
            broadcastChats();
            send("DM_CREATED", { ChatID: chatID });
          }
          break;
        }
        case "SEND_MESSAGE": {
          const { ChatID, Content, ImageUrl, VideoUrl } = Payload;
          if (!ChatID) return send("ERROR", { message: "ChatID is required" });
          if (!Content?.trim() && !ImageUrl && !VideoUrl) return send("ERROR", { message: "Content, ImageUrl, or VideoUrl is required" });
          
          const now = new Date().toISOString();
          const msgId = "msg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
          
          // Insert into normalized messages table
          await db.execute({
            sql: "INSERT INTO messages (ID, ChatID, SenderID, Content, ImageUrl, VideoUrl, CreatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
            args: [msgId, ChatID, userId, Content || "", ImageUrl || "", VideoUrl || "", now],
          });
          
          // Update RecentMessages with just the last message for chat preview
          const newMessage = {
            SenderID: userId, Timestamp: now, Content,
            ImageUrl: ImageUrl || undefined, VideoUrl: VideoUrl || undefined,
          };
          await db.execute({ sql: "UPDATE chats SET RecentMessages = ? WHERE ID = ?", args: [JSON.stringify([newMessage]), ChatID] });
          
          broadcastChats();
          
          // Sync chat_participants + get participant IDs for push notifications (one query)
          let participantIDs: string[] = [];
          try {
            const chatResult = await db.execute({ sql: "SELECT ParticipantIDs FROM chats WHERE ID = ?", args: [ChatID] });
            const chatRow = chatResult.rows[0] as any;
            if (chatRow) {
              participantIDs = parseJSON(chatRow.ParticipantIDs, []);
              await syncChatParticipants(ChatID, participantIDs);
            }
          } catch { /* non-critical */ }

          // Broadcast new message to all participants in real-time
          const newMsgPayload = {
            ID: msgId,
            ChatID,
            SenderID: userId,
            Content: Content || "",
            ImageUrl: ImageUrl || "",
            VideoUrl: VideoUrl || "",
            CreatedAt: now,
          };
          // Enrich with sender info
          const senderResult = await db.execute({
            sql: "SELECT RealName, Thumbnail FROM users WHERE ID = ?",
            args: [userId],
          });
          const senderRow = senderResult.rows[0] as any;
          if (senderRow) {
            newMsgPayload.SenderName = (!senderRow.RealName || senderRow.RealName.toLowerCase() === "unknown") ? "" : senderRow.RealName;
            newMsgPayload.SenderThumbnail = senderRow.Thumbnail || "";
          }

          for (const pid of participantIDs) {
            const client = [...wsClients].find(c => c.userId === pid);
            if (client) {
              try {
                client.ws.send(JSON.stringify({ Event: "NEW_MESSAGE", Payload: newMsgPayload }));
              } catch {}
            }
          }

          // Send push notification to other chat participants
          if (participantIDs.length > 0) {
            const otherUserIds = participantIDs.filter((id: string) => id !== userId);
            if (otherUserIds.length > 0) {
              try {
                // Get sender info
                const senderResult = await db.execute({
                  sql: "SELECT RealName FROM users WHERE ID = ?",
                  args: [userId],
                });
                const senderRow = senderResult.rows[0] as any;
                const senderName = senderRow?.RealName || "Someone";

                // Get chat info for notification title
                const chatInfo = await db.execute({ sql: "SELECT Title, IsGroup FROM chats WHERE ID = ?", args: [ChatID] });
                const chatInfoRow = chatInfo.rows[0] as any;
                const isGroup = Boolean(chatInfoRow?.IsGroup);
                const title = isGroup ? chatInfoRow?.Title || "Party Chat" : senderName;

                for (const otherId of otherUserIds) {
                  const isOnline = [...wsClients].some(c => c.userId === otherId);
                  if (!isOnline) {
                    const { sendPushNotification } = await import("../push");
                    const truncatedContent = (Content || "").slice(0, 200);
                    sendPushNotification(otherId, {
                      title,
                      body: truncatedContent || (ImageUrl ? "📷 Photo" : VideoUrl ? "🎥 Video" : "New message"),
                      image: resolvePushImageUrl(ImageUrl),
                      data: { chatId: ChatID, type: isGroup ? "party" : "dm" },
                    }).catch((e: any) => console.error("Push notification error:", e));
                  }
                }
              } catch (e) {
                console.error("Failed to send push notifications:", e);
              }
            }
          }
          break;
        }
        case "GET_REGISTRATIONS": {
          const { PartyID } = Payload;
          if (!PartyID) return send("ERROR", { message: "PartyID is required" });
          const regsResult = await db.execute({
            sql: `SELECT registrations.*, users.RealName, users.Thumbnail as UserThumbnail, users.ProfilePhotos as UserProfilePhotos 
                  FROM registrations JOIN users ON registrations.UserID = users.ID WHERE PartyID = ?`,
            args: [PartyID],
          });
          send("REGISTRATIONS_LIST", regsResult.rows.map((r: any) => ({
            ...r, UserProfilePhotos: r.UserProfilePhotos ? JSON.parse(r.UserProfilePhotos) : [],
          })));
          break;
        }
        case "APPROVE_JOIN_REQUEST": {
          const { RegistrationID } = Payload;
          if (!RegistrationID) return send("ERROR", { message: "RegistrationID is required" });
          const regResult = await db.execute({ sql: "SELECT * FROM registrations WHERE ID = ?", args: [RegistrationID] });
          const reg = regResult.rows[0] as any;
          if (reg && reg.Status === "PENDING") {
            await db.execute({ sql: "UPDATE registrations SET Status = ? WHERE ID = ?", args: ["APPROVED", RegistrationID] });
            const partyResult = await db.execute({ sql: "SELECT * FROM parties WHERE ID = ?", args: [reg.PartyID] });
            const party = partyResult.rows[0] as any;
            if (party) {
              const chatResult = await db.execute({ sql: "SELECT * FROM chats WHERE ID = ?", args: [party.ChatRoomID] });
              const chat = chatResult.rows[0] as any;
              if (chat) {
                const pIDs = JSON.parse(chat.ParticipantIDs);
                if (!pIDs.includes(reg.UserID)) {
                  pIDs.push(reg.UserID);
                  await db.execute({ sql: "UPDATE chats SET ParticipantIDs = ? WHERE ID = ?", args: [JSON.stringify(pIDs), party.ChatRoomID] });
                  await syncChatParticipants(party.ChatRoomID, pIDs);
                  await db.execute({ sql: "UPDATE parties SET CurrentGuestCount = CurrentGuestCount + 1 WHERE ID = ?", args: [reg.PartyID] });
                }
              }
            }
            const regsResult = await db.execute({
              sql: `SELECT registrations.*, users.RealName, users.Thumbnail as UserThumbnail, users.ProfilePhotos as UserProfilePhotos 
                    FROM registrations JOIN users ON registrations.UserID = users.ID WHERE PartyID = ?`,
              args: [reg.PartyID],
            });
            send("REGISTRATIONS_LIST", regsResult.rows.map((r: any) => ({
              ...r, UserProfilePhotos: r.UserProfilePhotos ? JSON.parse(r.UserProfilePhotos) : [],
            })));
            broadcastFeedUpdate();
            broadcastChats();
          }
          break;
        }
        case "DELETE_CHAT": {
          const { ChatID } = Payload;
          if (!ChatID) return send("ERROR", { message: "ChatID is required" });
          const chatResult = await db.execute({ sql: "SELECT * FROM chats WHERE ID = ?", args: [ChatID] });
          const chatRow = chatResult.rows[0] as any;
          if (chatRow) {
            const chat = mapChat(chatRow);
            if (chat.ParticipantIDs?.includes(userId)) {
              await db.execute({ sql: "DELETE FROM chats WHERE ID = ?", args: [ChatID] });
              broadcastChats();
            }
          }
          break;
        }
        case "UPDATE_LOCATION": {
          const { Lat, Lon } = Payload;
          if (typeof Lat === 'number' && typeof Lon === 'number') {
            await db.execute({ sql: "UPDATE users SET Latitude = ?, Longitude = ? WHERE ID = ?", args: [Lat, Lon, userId] });
          }
          break;
        }
        case "DELETE_ACCOUNT": {
          // Server-side cleanup for WS-authenticated clients
          try {
            // Delete all user data (same as HTTP DELETE /api/account)
            await Promise.all([
              db.execute({ sql: "DELETE FROM sessions WHERE UserID = ?", args: [userId] }),
              db.execute({ sql: "DELETE FROM registrations WHERE UserID = ?", args: [userId] }),
              db.execute({ sql: "DELETE FROM swipes WHERE UserID = ?", args: [userId] }),
              db.execute({ sql: "DELETE FROM messages WHERE SenderID = ?", args: [userId] }),
              db.execute({ sql: "DELETE FROM push_tokens WHERE UserID = ?", args: [userId] }),
              db.execute({ sql: "DELETE FROM user_reports WHERE ReporterID = ? OR ReportedUserID = ?", args: [userId, userId] }),
              db.execute({ sql: "DELETE FROM tips WHERE SenderID = ? OR ReceiverID = ?", args: [userId, userId] }),
              db.execute({ sql: "DELETE FROM crowdfund_contributions WHERE UserID = ?", args: [userId] }),
              db.execute({ sql: "DELETE FROM chat_participants WHERE UserID = ?", args: [userId] }),
              db.execute({ sql: "DELETE FROM withdrawal_requests WHERE UserID = ?", args: [userId] }),
              db.execute({ sql: "DELETE FROM party_boosts WHERE UserID = ?", args: [userId] }),
            ]);

            // Delete parties hosted by this user
            const hostedResult = await db.execute({
              sql: "SELECT ID, ChatRoomID FROM parties WHERE HostID = ?",
              args: [userId],
            });
            for (const row of hostedResult.rows) {
              const party = row as any;
              if (party.ChatRoomID) {
                await Promise.all([
                  db.execute({ sql: "DELETE FROM messages WHERE ChatID = ?", args: [party.ChatRoomID] }),
                  db.execute({ sql: "DELETE FROM chat_participants WHERE ChatID = ?", args: [party.ChatRoomID] }),
                  db.execute({ sql: "DELETE FROM chats WHERE ID = ?", args: [party.ChatRoomID] }),
                ]);
              }
              await Promise.all([
                db.execute({ sql: "DELETE FROM registrations WHERE PartyID = ?", args: [party.ID] }),
                db.execute({ sql: "DELETE FROM party_boosts WHERE PartyID = ?", args: [party.ID] }),
                db.execute({ sql: "DELETE FROM crowdfund_contributions WHERE PartyID = ?", args: [party.ID] }),
                db.execute({ sql: "DELETE FROM parties WHERE ID = ?", args: [party.ID] }),
              ]);
            }

            // Delete DMs involving this user
            const dmResult = await db.execute({
              sql: "SELECT ID FROM chats WHERE IsGroup = 0 AND ParticipantIDs LIKE ?",
              args: [`%${userId}%`],
            });
            for (const row of dmResult.rows) {
              const chat = row as any;
              await Promise.all([
                db.execute({ sql: "DELETE FROM messages WHERE ChatID = ?", args: [chat.ID] }),
                db.execute({ sql: "DELETE FROM chat_participants WHERE ChatID = ?", args: [chat.ID] }),
                db.execute({ sql: "DELETE FROM chats WHERE ID = ?", args: [chat.ID] }),
              ]);
            }

            await db.execute({ sql: "DELETE FROM users WHERE ID = ?", args: [userId] });

            send("ACCOUNT_DELETED", {});
            broadcastFeedUpdate();
            broadcastChats();

            // Remove from connected clients
            const entry = [...wsClients].find(c => c.userId === userId);
            if (entry) wsClients.delete(entry);
          } catch (e) {
            console.error("Account deletion failed:", e);
            send("ERROR", { message: "Failed to delete account" });
          }
          break;
        }
        case "DELETE_PARTY": {
          const { PartyID } = Payload;
          if (!PartyID) return send("ERROR", { message: "PartyID is required" });
          const partyResult = await db.execute({ sql: "SELECT * FROM parties WHERE ID = ?", args: [PartyID] });
          const party = partyResult.rows[0] as any;
          if (party && party.HostID === userId) {
            await db.execute({ sql: "DELETE FROM parties WHERE ID = ?", args: [PartyID] });
            await db.execute({ sql: "DELETE FROM chats WHERE ID = ?", args: [party.ChatRoomID] });
            await db.execute({ sql: "DELETE FROM registrations WHERE PartyID = ?", args: [PartyID] });
            broadcastFeedUpdate();
            broadcastChats();
          }
          break;
        }
      }
    } catch (e: any) {
      console.error("WS Error processing message", e);
      try {
        ws.send(JSON.stringify({ Event: "ERROR", Payload: { message: e?.message || "An unexpected error occurred" } }));
      } catch {}
    }
  },
  onClose(evt: any, ws: any) {
    // Remove from global store
    const entry = [...wsClients].find(c => c.ws === ws);
    if (entry) wsClients.delete(entry);
  },
}));

export { websocket };
