import { Hono } from "hono";
import { apiLimiter } from "../middleware/rate-limiter";
import { sessionMiddleware } from "../middleware/session";
import { registerPushToken, unregisterPushToken, sendPushNotification } from "../push";

function getUserId(c: any): string {
  return c.get("userId") || "";
}

export function registerNotificationRoutes(app: Hono) {
  // Test endpoint — sends a sample push notification to the current user
  app.post("/api/push/test", apiLimiter, sessionMiddleware, async (c) => {
    try {
      const userId = getUserId(c);
      if (!userId) return c.json({ error: "Not authenticated" }, 401);

      const { title, body, image } = await c.req.json().catch(() => ({}));

      await sendPushNotification(userId, {
        title: title || "🔔 WaterParty Test",
        body: body || "This is a test push notification. If you see this, push is working!",
        image: image || undefined,
        data: { test: "true", timestamp: String(Date.now()) },
      });

      return c.json({
        success: true,
        message: "Test notification sent. Check your device.",
        note: "For rich image push on iOS, you need a Notification Service Extension in Xcode. Android shows images inline.",
      });
    } catch (e: any) {
      console.error("Test push failed:", e);
      return c.json({ error: e.message || "Failed to send test push" }, 500);
    }
  });

  // Register a push notification token
  // Register a push notification token
  app.post("/api/push/register", apiLimiter, sessionMiddleware, async (c) => {
    try {
      const userId = getUserId(c);
      const { token, platform } = await c.req.json();

      if (!token || typeof token !== "string") {
        return c.json({ error: "Token is required" }, 400);
      }

      await registerPushToken(userId, token, platform || "unknown");
      return c.json({ success: true });
    } catch (e: any) {
      console.error("Push token registration failed:", e);
      return c.json({ error: e.message || "Failed to register push token" }, 500);
    }
  });

  // Unregister a push notification token
  app.post("/api/push/unregister", apiLimiter, sessionMiddleware, async (c) => {
    try {
      const userId = getUserId(c);
      const { token } = await c.req.json();

      if (!token || typeof token !== "string") {
        return c.json({ error: "Token is required" }, 400);
      }

      await unregisterPushToken(userId, token);
      return c.json({ success: true });
    } catch (e: any) {
      console.error("Push token unregistration failed:", e);
      return c.json({ error: e.message || "Failed to unregister push token" }, 500);
    }
  });
}
