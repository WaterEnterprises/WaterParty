import { createClient } from "@libsql/client";
import { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } from "./config";
import { parseJSON } from "./helpers";

if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
  throw new Error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables must be defined.");
}

export const db = createClient({
  url: TURSO_DATABASE_URL,
  authToken: TURSO_AUTH_TOKEN,
});

export async function ensureColumn(tableName: string, columnName: string, columnDef: string) {
  try {
    const info = await db.execute(`PRAGMA table_info(${tableName})`);
    const exists = info.rows.some((col: any) => col.name === columnName);
    if (!exists) {
      await db.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
      console.log(`Migration: Added column ${columnName} to ${tableName}`);
    }
  } catch (e) {
    console.error(`Migration failed for ${tableName}.${columnName}`, e);
  }
}

export async function runMigrations() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      ID TEXT PRIMARY KEY,
      RealName TEXT,
      Email TEXT,
      Password TEXT,
      ProfilePhotos TEXT,
      TrustScore REAL,
      Thumbnail TEXT,
      Bio TEXT,
      Instagram TEXT,
      Twitter TEXT,
      Gender TEXT,
      JobTitle TEXT,
      Company TEXT,
      School TEXT,
      Degree TEXT
    );
  `);

  await ensureColumn("users", "HostedCount", "INTEGER DEFAULT 0");
  await ensureColumn("users", "HostingRating", "REAL DEFAULT 0");
  await ensureColumn("users", "Reach", "INTEGER DEFAULT 0");
  await ensureColumn("users", "Latitude", "REAL DEFAULT 0");
  await ensureColumn("users", "Longitude", "REAL DEFAULT 0");
  await ensureColumn("crowdfund_contributions", "OriginalAmount", "REAL DEFAULT 0");
  await ensureColumn("crowdfund_contributions", "PlatformFee", "REAL DEFAULT 0");
  await ensureColumn("users", "StripeAccountID", "TEXT DEFAULT ''");
  await ensureColumn("users", "Birthday", "TEXT DEFAULT ''");
  await ensureColumn("users", "StripeCustomerID", "TEXT DEFAULT ''");
  await ensureColumn("parties", "CrowdfundCurrency", "TEXT DEFAULT 'BRL'");
  await ensureColumn("users", "StripePaymentMethodIDs", "TEXT DEFAULT '[]'");
  await ensureColumn("parties", "FundsReleased", "INTEGER DEFAULT 0");
  await ensureColumn("parties", "PartyDate", "TEXT DEFAULT ''");
  await ensureColumn("crowdfund_contributions", "Status", "TEXT DEFAULT 'active'");
  await ensureColumn("parties", "PayoutRetries", "INTEGER DEFAULT 0");
  await ensureColumn("parties", "LastPayoutAttempt", "TEXT DEFAULT ''");
  await ensureColumn("users", "IsAdmin", "INTEGER DEFAULT 0");
  await ensureColumn("users", "Balance", "REAL DEFAULT 0");
  await ensureColumn("users", "VK", "TEXT DEFAULT ''");
  await ensureColumn("users", "ShowEmail", "INTEGER DEFAULT 0");
  await ensureColumn("users", "Telegram", "TEXT DEFAULT ''");
  await ensureColumn("users", "WhatsApp", "TEXT DEFAULT ''");
  await ensureColumn("users", "Facebook", "TEXT DEFAULT ''");
  await ensureColumn("users", "PreferredCurrency", "TEXT DEFAULT 'USD'");

  try {
    await db.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_contributions_pi ON crowdfund_contributions(StripePaymentIntentID)");
    console.log("Migration: Created unique index on crowdfund_contributions.StripePaymentIntentID");
  } catch (e) {
    console.error("Migration failed for unique index:", e);
  }

  await db.execute(`CREATE TABLE IF NOT EXISTS withdrawal_requests (
    ID TEXT PRIMARY KEY,
    PartyID TEXT,
    UserID TEXT,
    Amount REAL,
    Status TEXT DEFAULT 'pending',
    StripeTransferID TEXT DEFAULT '',
    CreatedAt TEXT
  )`);

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS parties (
      ID TEXT PRIMARY KEY,
      HostID TEXT,
      Title TEXT,
      Description TEXT,
      PartyPhotos TEXT,
      StartTime TEXT,
      DurationHours INTEGER,
      Status TEXT,
      Address TEXT,
      City TEXT,
      GeoLat REAL,
      GeoLon REAL,
      MaxCapacity INTEGER,
      CurrentGuestCount INTEGER,
      VibeTags TEXT,
      Rules TEXT,
      ChatRoomID TEXT,
      Thumbnail TEXT,
      CrowdfundTarget REAL,
      CrowdfundCurrent REAL,
      CrowdfundCurrency TEXT DEFAULT 'BRL',
      PartyType TEXT
    );
    CREATE TABLE IF NOT EXISTS chats (
      ID TEXT PRIMARY KEY,
      PartyID TEXT,
      Title TEXT,
      ImageUrl TEXT,
      RecentMessages TEXT,
      IsGroup INTEGER,
      ParticipantIDs TEXT
    );
    CREATE TABLE IF NOT EXISTS registrations (
      ID TEXT PRIMARY KEY,
      PartyID TEXT,
      UserID TEXT,
      Status TEXT,
      Timestamp TEXT
    );
    CREATE TABLE IF NOT EXISTS swipes (
      ID TEXT PRIMARY KEY,
      UserID TEXT,
      PartyID TEXT,
      Direction TEXT,
      Timestamp TEXT
    );
    CREATE TABLE IF NOT EXISTS user_reports (
      ID TEXT PRIMARY KEY,
      ReporterID TEXT,
      ReportedUserID TEXT,
      Reason TEXT,
      Details TEXT,
      Timestamp TEXT
    );
    CREATE TABLE IF NOT EXISTS media (
      ID TEXT PRIMARY KEY,
      Data BLOB,
      MimeType TEXT,
      FileName TEXT,
      CreatedAt TEXT
    );
    CREATE TABLE IF NOT EXISTS media_chunks (
      MediaID TEXT,
      ChunkIndex INTEGER,
      Data BLOB,
      PRIMARY KEY (MediaID, ChunkIndex)
    );
    CREATE TABLE IF NOT EXISTS sessions (
      ID TEXT PRIMARY KEY,
      UserID TEXT,
      CreatedAt TEXT,
      ExpiresAt TEXT,
      Revoked INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS crowdfund_contributions (
      ID TEXT PRIMARY KEY,
      PartyID TEXT,
      UserID TEXT,
      Amount REAL,
      StripePaymentIntentID TEXT,
      CreatedAt TEXT
    );
    CREATE TABLE IF NOT EXISTS tips (
      ID TEXT PRIMARY KEY,
      SenderID TEXT,
      ReceiverID TEXT,
      Amount REAL,
      Currency TEXT DEFAULT 'USD',
      StripePaymentIntentID TEXT,
      CreatedAt TEXT
    );
    CREATE TABLE IF NOT EXISTS messages (
      ID TEXT PRIMARY KEY,
      ChatID TEXT,
      SenderID TEXT,
      Content TEXT,
      ImageUrl TEXT,
      VideoUrl TEXT,
      CreatedAt TEXT
    );
    CREATE TABLE IF NOT EXISTS push_tokens (
      UserID TEXT,
      Token TEXT,
      Platform TEXT DEFAULT 'unknown',
      CreatedAt TEXT,
      UpdatedAt TEXT,
      PRIMARY KEY (UserID, Token)
    );
    CREATE TABLE IF NOT EXISTS party_boosts (
      ID TEXT PRIMARY KEY,
      PartyID TEXT,
      UserID TEXT,
      BoostType TEXT DEFAULT 'video_ad',
      CreatedAt TEXT,
      ExpiresAt TEXT,
      Active INTEGER DEFAULT 1
    );
  `);

  // Create index for party_boosts lookups
  try {
    await db.execute("CREATE INDEX IF NOT EXISTS idx_party_boosts_party ON party_boosts(PartyID, Active)");
  } catch (e) {
    console.error("Failed to create party_boosts index:", e);
  }

  // Migrate existing RecentMessages JSON to messages table
  try {
    const chatsResult = await db.execute("SELECT ID, RecentMessages FROM chats WHERE RecentMessages IS NOT NULL AND RecentMessages != '[]'");
    let migratedCount = 0;
    for (const row of chatsResult.rows) {
      const chatRow = row as any;
      const existingMessages = parseJSON(chatRow.RecentMessages, []);
      if (!Array.isArray(existingMessages) || existingMessages.length === 0) continue;

      // Check if messages already migrated for this chat
      const existingCount = await db.execute({
        sql: "SELECT COUNT(*) as count FROM messages WHERE ChatID = ?",
        args: [chatRow.ID],
      });
      if (Number((existingCount.rows[0] as any)?.count || 0) > 0) continue;

      for (const msg of existingMessages) {
        const msgId = "msg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
        await db.execute({
          sql: "INSERT INTO messages (ID, ChatID, SenderID, Content, ImageUrl, VideoUrl, CreatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
          args: [msgId, chatRow.ID, msg.SenderID || "", msg.Content || "", msg.ImageUrl || "", msg.VideoUrl || "", msg.Timestamp || new Date().toISOString()],
        });
        migratedCount++;
      }

      // After migration, set RecentMessages to last message only (for preview)
      const lastMsg = existingMessages[existingMessages.length - 1];
      if (lastMsg) {
        await db.execute({
          sql: "UPDATE chats SET RecentMessages = ? WHERE ID = ?",
          args: [JSON.stringify([lastMsg]), chatRow.ID],
        });
      }
    }
    if (migratedCount > 0) {
      console.log(`Migration: Migrated ${migratedCount} messages from RecentMessages JSON to messages table`);
    }
  } catch (e) {
    console.error("Message migration failed:", e);
  }

  try {
    await db.execute("CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(ChatID, CreatedAt)");
  } catch (e) {
    console.error("Failed to create messages index:", e);
  }  // Create chat_participants junction table (for fast indexed chat lookups)
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS chat_participants (
      ChatID TEXT,
      UserID TEXT,
      PRIMARY KEY (ChatID, UserID)
    )`);
    await db.execute("CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON chat_participants(UserID)");
    await db.execute("CREATE INDEX IF NOT EXISTS idx_chat_participants_chat ON chat_participants(ChatID)");
  } catch (e) {
    console.error("Failed to create chat_participants table:", e);
  }

  console.log("Database initialized successfully.");
}
