/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Push Notification Hook
 *
 * Registers for push notifications via Capacitor Push Notifications plugin
 * and sends the token to the server for FCM-based push delivery.
 *
 * Works on both iOS and Android via Capacitor.
 *
 * On web/desktop, this gracefully degrades (no-op).
 */

import { useEffect, useRef } from "react";
import { useStore } from "../lib/Store";
import { API_BASE, fetchWithAuth } from "../lib/constants";
import { isCapacitorNative } from "../lib/capacitor";

/**
 * Determine the platform string for push token registration.
 */
function getPlatform(): string {
  if (typeof window === "undefined") return "unknown";
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/web/i.test(ua)) return "web";
  return "browser";
}

/**
 * Hook that registers for push notifications when the user is authenticated.
 * Call once at the app root level.
 */
export function usePushNotifications() {
  const { user } = useStore();
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!user || registeredRef.current) return;

    // Check if we're in a Capacitor native environment
    if (!isCapacitorNative()) {
      registeredRef.current = true; // Mark as done so we don't retry
      return;
    }

    let cancelled = false;

    async function register() {
      try {
        const { PushNotifications } = await import(
          "@capacitor/push-notifications"
        );

        // Check permission status
        const permStatus = await PushNotifications.checkPermissions();

        if (
          permStatus.receive === "prompt" ||
          permStatus.receive === "prompt-with-rationale"
        ) {
          const result = await PushNotifications.requestPermissions();
          if (result.receive !== "granted") {
            console.log("[push] Push notification permission denied");
            return;
          }
        } else if (permStatus.receive === "denied") {
          console.log(
            "[push] Push notification permission previously denied",
          );
          return;
        }

        // Register for push
        await PushNotifications.register();

        // Listen for registration token
        PushNotifications.addListener("registration", async (tokenResult) => {
          if (cancelled || !tokenResult.value) return;

          const token = tokenResult.value;
          const platform = getPlatform();
          console.log(`[push] Got push token for ${platform}: ${token.slice(0, 20)}...`);

          // Send token to server
          try {
            const res = await fetchWithAuth(`${API_BASE}/api/push/register`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token, platform }),
            });
            if (res.ok) {
              console.log("[push] Token registered on server");
              registeredRef.current = true;
            }
          } catch (e) {
            console.error("[push] Failed to register token on server:", e);
          }
        });

        // Handle incoming notifications while app is open (foreground)
        PushNotifications.addListener(
          "pushNotificationReceived",
          () => {
            // System handles the notification banner/sound automatically.
            // We could update in-app state here if needed.
          },
        );

        // Handle notification tap — navigate to the chat
        PushNotifications.addListener("pushNotificationActionPerformed", async (action) => {
          if (cancelled) return;
          const notificationData = action.notification.data;
          const chatId = notificationData?.chatId as string | undefined;

          if (chatId) {
            // Use window.location for navigation from the Capacitor notification listener
            setTimeout(() => {
              window.location.href = `/chat/${chatId}`;
            }, 300);
          }
        });
      } catch (e: any) {
        console.warn("[push] Push notification setup failed:", e.message);
        registeredRef.current = true; // Don't retry on failure
      }
    }

    register();

    return () => {
      cancelled = true;
    };
  }, [user?.ID]);
}
