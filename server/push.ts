/**
 * Push Notification Service
 *
 * Sends push notifications via FCM HTTP v1 API using raw HTTP requests.
 * No firebase-admin SDK needed — uses Bun's built-in crypto + fetch.
 *
 * Setup:
 * 1. Create a Firebase project: https://console.firebase.google.com
 * 2. Go to Project Settings → Service accounts → Generate new private key
 * 3. Set the full JSON as FIREBASE_SERVICE_ACCOUNT_JSON env var
 *
 * For Android: Place google-services.json in android/app/
 * For iOS: Upload APNs key in Firebase Console
 */

import crypto from "crypto";
import { db } from "./db";
import { FIREBASE_SERVICE_ACCOUNT_JSON } from "./config";

// ─── OAuth2 token management ───────────────────────────────────────

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
  [key: string]: unknown;
}

let cachedServiceAccount: ServiceAccount | null = null;
let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

/**
 * Base64 URL-safe encode (no padding).
 */
function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Parse the service account JSON once.
 */
function getServiceAccount(): ServiceAccount | null {
  if (cachedServiceAccount) return cachedServiceAccount;
  if (!FIREBASE_SERVICE_ACCOUNT_JSON) return null;
  try {
    cachedServiceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON) as ServiceAccount;
    return cachedServiceAccount;
  } catch (e) {
    console.error("[push] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:", e);
    return null;
  }
}

/**
 * Generate a signed JWT assertion and exchange it for an OAuth2 access token.
 */
async function refreshAccessToken(): Promise<string | null> {
  const sa = getServiceAccount();
  if (!sa) {
    console.warn("[push] Firebase service account not configured — push disabled");
    return null;
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const claims = {
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };

    // Encode header + claims
    const headerB64 = base64UrlEncode(Buffer.from(JSON.stringify(header)));
    const claimsB64 = base64UrlEncode(Buffer.from(JSON.stringify(claims)));
    const signingInput = `${headerB64}.${claimsB64}`;

    // Sign with RSA-SHA256 using the service account's private key
    const sign = crypto.createSign("RSA-SHA256");
    sign.update(signingInput);
    sign.end();
    const signature = sign.sign(sa.private_key, "base64");
    const signatureB64 = base64UrlEncode(Buffer.from(signature, "base64"));

    const jwt = `${signingInput}.${signatureB64}`;

    // Exchange JWT for access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error(`[push] OAuth2 token exchange failed (${tokenResponse.status}): ${errText.slice(0, 200)}`);
      return null;
    }

    const tokenData = (await tokenResponse.json()) as { access_token: string; expires_in: number };
    cachedAccessToken = tokenData.access_token;
    tokenExpiresAt = Date.now() + (tokenData.expires_in - 60) * 1000; // 1min buffer
    return cachedAccessToken;
  } catch (e: any) {
    console.error("[push] Failed to get access token:", e.message);
    return null;
  }
}

/**
 * Get a valid access token (cached or freshly exchanged).
 */
async function getAccessToken(): Promise<string | null> {
  if (cachedAccessToken && Date.now() < tokenExpiresAt) {
    return cachedAccessToken;
  }
  return refreshAccessToken();
}

// ─── Push Notification Sending ──────────────────────────────────────

interface PushPayload {
  title: string;
  body: string;
  /** Public HTTPS URL of an image to include in the rich notification (Android shows inline) */
  image?: string;
  data?: Record<string, string>;
}

/**
 * Send a push notification to a specific user via FCM HTTP v1 API.
 * Looks up all registered push tokens and sends to each.
 * If payload.image is set, it's included as notification.image for rich push (Android).
 * For iOS rich push, a Notification Service Extension in Xcode is required.
 */
export async function sendPushNotification(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  try {
    const sa = getServiceAccount();
    if (!sa) return;

    const accessToken = await getAccessToken();
    if (!accessToken) return;

    // Fetch user's push tokens
    const result = await db.execute({
      sql: "SELECT Token, Platform FROM push_tokens WHERE UserID = ?",
      args: [userId],
    });

    const tokens = result.rows as Array<{ Token: string; Platform: string }>;
    if (tokens.length === 0) return;

    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

    // Send to each token
    const results = await Promise.allSettled(
      tokens.map(async (row) => {
        try {
          const body = JSON.stringify({
            message: {
              token: row.Token,
              notification: {
                title: payload.title,
                body: payload.body,
                ...(payload.image ? { image: payload.image } : {}),
              },
              data: payload.data || {},
              android: {
                priority: "high",
                notification: {
                  channelId: "chat_messages",
                  priority: "high",
                },
              },
              apns: {
                payload: {
                  aps: {
                    sound: "default",
                    badge: 1,
                    "content-available": 1,
                  },
                },
              },
            },
          });

          const response = await fetch(fcmUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json; charset=utf-8",
            },
            body,
          });

          if (!response.ok) {
            const errBody = await response.text();
            // If token is invalid (404/400), remove it
            if (response.status === 404 || response.status === 400) {
              const errJson = JSON.parse(errBody);
              if (
                errJson.error?.details?.some(
                  (d: any) =>
                    d.reason === "INVALID_ARGUMENT" &&
                    d.field?.includes("token"),
                )
              ) {
                console.warn(`[push] Removing invalid token for user ${userId}`);
                await db.execute({
                  sql: "DELETE FROM push_tokens WHERE UserID = ? AND Token = ?",
                  args: [userId, row.Token],
                });
              }
            } else {
              console.warn(`[push] FCM error (${response.status}): ${errBody.slice(0, 200)}`);
            }
          }
        } catch (err: any) {
          console.warn(`[push] Failed to send to token: ${err.message}`);
        }
      }),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    if (succeeded > 0) {
      console.log(`[push] Sent notification to ${succeeded}/${tokens.length} devices for user ${userId}`);
    }
  } catch (e: any) {
    console.error("[push] Failed to send push notification:", e.message);
  }
}

/**
 * Register a push token for a user.
 */
export async function registerPushToken(
  userId: string,
  token: string,
  platform: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO push_tokens (UserID, Token, Platform, CreatedAt, UpdatedAt)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(UserID, Token) DO UPDATE SET
            Platform = ?,
            UpdatedAt = ?`,
    args: [userId, token, platform, now, now, platform, now],
  });
  console.log(`[push] Registered token for user ${userId} (${platform})`);
}

/**
 * Unregister a push token for a user.
 */
export async function unregisterPushToken(
  userId: string,
  token: string,
): Promise<void> {
  await db.execute({
    sql: "DELETE FROM push_tokens WHERE UserID = ? AND Token = ?",
    args: [userId, token],
  });
  console.log(`[push] Unregistered token for user ${userId}`);
}
