import type { Context, Next } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import crypto from "crypto";
import { db } from "../db";
import { SESSION_TTL_MS } from "../config";

export async function sessionMiddleware(c: Context, next: Next) {
  const sessionId = getCookie(c, "session") || c.req.header("x-session-token");
  if (!sessionId) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  try {
    const result = await db.execute({
      sql: "SELECT * FROM sessions WHERE ID = ? AND ExpiresAt > ? AND Revoked = 0",
      args: [sessionId, new Date().toISOString()],
    });
    const row = result.rows[0] as any;
    if (!row) {
      return c.json({ error: "Session expired or invalid" }, 401);
    }
    c.set("userId", row.UserID);
    await next();
  } catch (e) {
    console.error("Session lookup failed:", e);
    return c.json({ error: "Authentication failed" }, 500);
  }
}

export async function createSession(userId: string, c: Context): Promise<{ sessionId: string }> {
  const sessionId = "sess_" + crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  await db.execute({
    sql: "INSERT INTO sessions (ID, UserID, CreatedAt, ExpiresAt, Revoked) VALUES (?, ?, ?, ?, 0)",
    args: [sessionId, userId, now.toISOString(), expiresAt.toISOString()],
  });

  setCookie(c, "session", sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  setCookie(c, "session_id", sessionId, {
    secure: true,
    sameSite: "Strict",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });

  return { sessionId };
}
