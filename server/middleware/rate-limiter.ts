import type { Context, Next } from "hono";
import { db } from "../db";
import { NODE_ENV } from "../config";

/**
 * Persistent rate limiter backed by Turso.
 *
 * Stores rate-limit entries in a `rate_limits` table so counters survive
 * server restarts and work correctly across multiple server instances.
 *
 * Limits are configurable via environment variables:
 *   RATE_LIMIT_AUTH     — auth endpoints (default: 50)
 *   RATE_LIMIT_API      — general API (default: 200)
 *   RATE_LIMIT_PAYMENT  — payment/tip endpoints (default: 30)
 *   RATE_LIMIT_UPLOAD   — upload endpoints (default: 500)
 *   RATE_LIMIT_WINDOW_MS — window in ms (default: 900000 = 15 min)
 *
 * In development mode, all limits are doubled automatically.
 */

const TABLE_NAME = "rate_limits";

async function ensureTable() {
  try {
    await db.executeMultiple(`
      CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        Key TEXT PRIMARY KEY,
        Count INTEGER DEFAULT 0,
        ResetAt INTEGER DEFAULT 0
      )
    `);
  } catch {
    // table already exists or concurrent migration
  }
}

// Run migration once at module load
ensureTable().catch(() => {});

function createRateLimiter(windowMs: number, max: number) {
  return async function rateLimitMiddleware(c: Context, next: Next) {
    // Resolve client IP with proper fallbacks
    const forwarded = c.req.header("x-forwarded-for");
    const ip =
      (forwarded ? forwarded.split(",")[0]?.trim() : undefined) ||
      c.req.header("x-real-ip") ||
      // Bun exposes the remote address via c.env.remote
      (c.env as { remote?: { address?: string } })?.remote?.address ||
      // Last resort — keeps localhost requests isolated from each other
      "127.0.0.1";

    const now = Date.now();
    const key = `rl:${ip}:${Math.floor(now / windowMs)}`;

    try {
      // Upsert: increment count if within window, reset if expired
      await db.execute({
        sql: `
          INSERT INTO ${TABLE_NAME} (Key, Count, ResetAt)
          VALUES (?, 1, ?)
          ON CONFLICT(Key) DO UPDATE SET
            Count = CASE
              WHEN ? >= ResetAt THEN 1
              ELSE Count + 1
            END,
            ResetAt = CASE
              WHEN ? >= ResetAt THEN ?
              ELSE ResetAt
            END
        `,
        args: [key, now + windowMs, now, now, now + windowMs],
      });

      // Read current count
      const result = await db.execute({
        sql: `SELECT Count, ResetAt FROM ${TABLE_NAME} WHERE Key = ?`,
        args: [key],
      });

      const row = result.rows[0] as { Count: number; ResetAt: number } | undefined;
      const count = row?.Count ?? 1;

      // Set rate-limit headers
      c.header("X-RateLimit-Limit", String(max));
      c.header("X-RateLimit-Remaining", String(Math.max(0, max - count)));
      c.header("X-RateLimit-Reset", String(Math.ceil((row?.ResetAt ?? now + windowMs) / 1000)));

      if (count > max) {
        return c.json({ error: "Too many requests, please try again later" }, 429);
      }
    } catch {
      // If DB is unavailable, fall through (don't block requests)
    }

    await next();
  };
}

/**
 * Read a rate-limit config from environment, with a base default.
 * In development mode the limit is doubled to make testing easier.
 */
function getLimit(envVar: string, defaultLimit: number): number {
  const fromEnv = process.env[envVar];
  if (fromEnv) return Number(fromEnv) || defaultLimit;
  return NODE_ENV === "development" ? defaultLimit * 2 : defaultLimit;
}

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;

// ─── Exported Limiters ──────────────────────────────────────────────

/** Auth endpoints — 50 requests per 15 min (100 in dev) */
export const authLimiter = createRateLimiter(windowMs, getLimit("RATE_LIMIT_AUTH", 50));

/** General API — 200 requests per 15 min (400 in dev) */
export const apiLimiter = createRateLimiter(windowMs, getLimit("RATE_LIMIT_API", 200));

/** Payment/tip endpoints — 30 requests per 15 min (60 in dev) */
export const paymentLimiter = createRateLimiter(windowMs, getLimit("RATE_LIMIT_PAYMENT", 30));

/** Upload endpoints — 500 requests per 15 min (1000 in dev) */
export const uploadLimiter = createRateLimiter(windowMs, getLimit("RATE_LIMIT_UPLOAD", 500));
