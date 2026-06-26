/**
 * Typed Capacitor API wrapper.
 *
 * Provides safe access to Capacitor plugins without `(window as any).Capacitor`
 * peppered across the codebase. Each access is guarded by a try/catch so that
 * code works identically in plain browsers.
 */

import { Filesystem, Directory } from "@capacitor/filesystem";

export interface CapacitorApp {
  addListener(
    event: "backButton",
    handler: () => void,
  ): { remove(): void };
}

export interface CapacitorPlugins {
  App?: CapacitorApp;
  Geolocation?: {
    requestPermissions: () => Promise<{ location: "granted" | "denied" | "prompt" }>;
    getCurrentPosition: () => Promise<{ coords: { latitude: number; longitude: number } }>;
  };
  Filesystem?: {
    mkdir: (opts: { path: string; directory: string; recursive: boolean }) => Promise<void>;
    writeFile: (opts: { path: string; data: string; directory: string }) => Promise<void>;
  };
}

export interface CapacitorGlobal {
  isNative?: boolean;
  Plugins?: CapacitorPlugins;
}

/** Retrieve the Capacitor global object, or null outside a native WebView. */
function getCapacitor(): CapacitorGlobal | null {
  try {
    const cap = (window as { Capacitor?: CapacitorGlobal }).Capacitor;
    return cap ?? null;
  } catch {
    return null;
  }
}

/** True when running inside a Capacitor / native WebView. */
export const isCapacitorNative = (): boolean => {
  const cap = getCapacitor();
  return cap !== null && cap.isNative === true;
};

/** Check if the Capacitor App plugin is available. */
export function hasCapacitorApp(): boolean {
  return getCapacitor()?.Plugins?.App != null;
}

/** Register a native back-button handler. Returns a cleanup function. */
export function onBackButton(handler: () => void): () => void {
  try {
    const app = getCapacitor()?.Plugins?.App;
    if (app) {
      const listener = app.addListener("backButton", handler);
      return () => {
        try {
          listener.remove();
        } catch {
          /* ignore cleanup errors */
        }
      };
    }
  } catch {
    /* Capacitor not available */
  }
  return () => {};
}

/** Geolocation helpers via Capacitor (falls back from browser API elsewhere). */
export async function capacitorRequestLocationPermissions(): Promise<"granted" | "denied" | "prompt"> {
  try {
    const geo = getCapacitor()?.Plugins?.Geolocation;
    if (geo) {
      const result = await geo.requestPermissions();
      return result.location;
    }
  } catch {
    /* not available */
  }
  return "denied";
}

export async function capacitorGetCurrentPosition(): Promise<{ lat: number; lon: number } | null> {
  try {
    const geo = getCapacitor()?.Plugins?.Geolocation;
    if (geo) {
      const pos = await geo.getCurrentPosition();
      return { lat: pos.coords.latitude, lon: pos.coords.longitude };
    }
  } catch {
    /* not available */
  }
  return null;
}

/** Capacitor Filesystem helpers for saving media to a "Water Party" folder. */
export async function saveMediaToDevice(
  url: string,
  mediaId: string,
  mimeType: string,
): Promise<boolean> {
  try {
    const cap = getCapacitor();
    if (!cap || !cap.isNative) return false;

    const ext =
      mimeType === "video/mp4" ? ".mp4" :
      mimeType === "video/webm" ? ".webm" :
      mimeType === "image/png" ? ".png" :
      mimeType === "image/gif" ? ".gif" :
      ".jpg";

    const fileName = `Water-Party-${mediaId}${ext}`;

    await Filesystem.mkdir({
      path: "Water Party",
      directory: Directory.Documents,
      recursive: false,
    }).catch(() => {});

    const response = await fetch(url);
    const blob = await response.blob();
    const base64 = await blobToBase64(blob);

    await Filesystem.writeFile({
      path: `Water Party/${fileName}`,
      data: base64,
      directory: Directory.Documents,
    });

    return true;
  } catch {
    return false;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
