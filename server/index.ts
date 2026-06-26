import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import path from "path";
import { db, runMigrations } from "./db";
import { stripe } from "./stripe-init";
import { sendTelegramMessage } from "./telegram";
import { PORT, NODE_ENV } from "./config";
import { registerAuthRoutes } from "./routes/auth";
import { registerPartyRoutes } from "./routes/parties";
import { registerChatRoutes } from "./routes/chats";
import { registerUserRoutes } from "./routes/users";
import { registerReportRoutes } from "./routes/reports";
import { registerPaymentRoutes } from "./routes/payments";
import { registerTipRoutes } from "./routes/tips";
import { registerConnectRoutes } from "./routes/connect";
import { registerAdminRoutes } from "./routes/admin";
import { registerNotificationRoutes } from "./routes/notifications";
import { registerUploadRoutes } from "./routes/upload";
import { registerWebhookRoutes } from "./routes/webhook";
import { registerAdsRoutes } from "./routes/ads";
import { wsHandler, websocket } from "./ws/handler";
import { startPayoutScheduler } from "./scheduler/payout";
import { backfillChatParticipants } from "./helpers";

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  const msg = `<b>🚨 UNCAUGHT EXCEPTION</b>\nMessage: ${(err.message || '').slice(0, 500)}\nStack: ${(err.stack || '').slice(0, 1000)}`;
  sendTelegramMessage(msg).finally(() => process.exit(1));
});

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
  const msg = `<b>🚨 UNHANDLED REJECTION</b>\nReason: ${String(reason).slice(0, 500)}`;
  sendTelegramMessage(msg).finally(() => process.exit(1));
});

async function startServer() {
  await runMigrations();

  // Fix DM chat titles that contain "The Stellar Foundation"
  try {
    const badChats = await db.execute({
      sql: `SELECT * FROM chats WHERE IsGroup = 0 AND Title LIKE '%The Stellar Foundation%'`,
    });
    for (const chatRow of badChats.rows) {
      const chat = chatRow as any;
      const participantIDs = JSON.parse(chat.ParticipantIDs || "[]");
      if (participantIDs.length === 2) {
        const [uid1, uid2] = participantIDs;
        const usersResult = await db.execute({ sql: "SELECT ID, RealName FROM users WHERE ID IN (?, ?)", args: [uid1, uid2] });
        const userMap = new Map<string, string>();
        for (const u of usersResult.rows) {
          const uRow = u as any;
          const name = (!uRow.RealName || uRow.RealName.toLowerCase() === "unknown") ? "" : uRow.RealName;
          userMap.set(uRow.ID, name);
        }
        const name1 = userMap.get(uid1) || "";
        const name2 = userMap.get(uid2) || "";
        const correctTitle = `${name1} & ${name2}`;
        if (correctTitle !== chat.Title) {
          await db.execute({ sql: "UPDATE chats SET Title = ? WHERE ID = ?", args: [correctTitle, chat.ID] });
          console.log(`Fixed DM title: "${chat.Title}" → "${correctTitle}"`);
        }
      }
    }
  } catch (e) {
    console.error("DM title migration failed:", e);
  }

  // Backfill chat_participants table from existing ParticipantIDs JSON
  backfillChatParticipants().catch(e => console.error("Chat participants backfill failed:", e));

  const app = new Hono();

  // Security headers (Helmet replacement)
  app.use("/*", secureHeaders({
    crossOriginResourcePolicy: "cross-origin",
  }));

  // CORS
  app.use("/*", cors({
    origin: [
      "https://waterparty-react-14hr.onrender.com",
      "https://ais-pre-lr54twg5655e4thhbtygne-661033979019.us-east1.run.app",
      "capacitor://localhost",
      "http://localhost",
      "http://localhost:3000",
    ],
    allowHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization", "x-session-token", "x-user-id", "X-User-Id"],
    allowMethods: ["POST", "GET", "OPTIONS", "PUT", "DELETE", "PATCH"],
    credentials: true,
  }));

  // HTTPS redirect in production
  if (NODE_ENV === "production") {
    app.use("/*", async (c, next) => {
      const proto = c.req.header("x-forwarded-proto") || c.req.header("x-forwarded-protocol");
      if (proto === "http") {
        return c.redirect(`https://${c.req.header("host")}${c.req.path}`, 301);
      }
      c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
      await next();
    });
  }

  // Logging
  app.use("/*", async (c, next) => {
    console.log(`${c.req.method} ${c.req.url}`);
    await next();
  });

  // Webhook routes must be registered before body parsing (raw body needed)
  registerWebhookRoutes(app);

  // Health check
  app.get("/api/health", async (c) => {
    try {
      await db.execute("SELECT 1");
      const stripeOk = stripe !== null;
      return c.json({ status: "ok", uptime: process.uptime(), db: "connected", stripe: stripeOk ? "configured" : "not_configured", timestamp: new Date().toISOString() });
    } catch (e: any) {
      return c.json({ status: "error", db: "disconnected", stripe: stripe !== null ? "configured" : "not_configured" }, 503);
    }
  });

  // Register route groups
  registerAuthRoutes(app);

  registerPartyRoutes(app);
  registerChatRoutes(app);
  registerUserRoutes(app);
  registerReportRoutes(app);
  registerPaymentRoutes(app);
  registerTipRoutes(app);
  registerConnectRoutes(app);
  registerAdminRoutes(app);
  registerUploadRoutes(app);
  registerNotificationRoutes(app);
  registerAdsRoutes(app);

  // WebSocket endpoint
  app.get("/ws", wsHandler);

  // Static file serving — SPA fallback for non-API routes
  app.use("/*", serveStatic({ root: "./dist" }));
  app.get("*", async (c) => {
    const url = c.req.path;
    if (url.startsWith("/api") || url === "/login" || url === "/register") {
      return c.json({ error: "API endpoint not found", path: url }, 404);
    }
    const distPath = path.join(process.cwd(), "dist", "index.html");
    const file = Bun.file(distPath);
    return new Response(file, { headers: { "Content-Type": "text/html" } });
  });

  startPayoutScheduler();

  // Start Bun server with WebSocket support
  const server = Bun.serve({
    port: PORT,
    hostname: "0.0.0.0",
    fetch: app.fetch,
    websocket,
  });

  console.log(`Hono server + Turso libSQL WS running on port ${PORT}`);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received — shutting down gracefully...`);
    await sendTelegramMessage(`<b>Server Shutdown</b>\nSignal: ${signal}\nUptime: ${Math.round(process.uptime())}s`);
    server.stop();
    try { db.close(); } catch (e) { console.error('DB close error:', e); }
    setTimeout(() => { console.error('Forced exit after timeout'); process.exit(1); }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer();
