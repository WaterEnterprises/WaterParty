export const HOST = typeof window !== 'undefined' ? window.location.host : '';

const isBrowser = typeof window !== 'undefined' && window.location;

// Helper: detect if running inside a Capacitor/native WebView.
// Checks for:
// 1. Capacitor global object
// 2. capacitor:// protocol (androidScheme default)
// 3. localhost without port (bundled mode — covers http, https, or any scheme)
//    Browser dev uses localhost:3000 (with port), so it's excluded.
const isNativeWebView = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const cap = (window as { Capacitor?: { isNative?: boolean } }).Capacitor;
    if (cap) return true;
  } catch {}
  if (window.location.protocol === 'capacitor:') return true;
  if (window.location.origin.startsWith('capacitor://')) return true;
  // Bundled mode: localhost without port (androidScheme can be http, https, capacitor)
  if (window.location.hostname === 'localhost' && !window.location.port) return true;
  return false;
};

export const isCapacitor = isNativeWebView();

// Determine the base URL for API calls.
// In the browser (dev + production), we use relative URLs (empty string).
// In Capacitor native apps, an absolute URL is needed.
const getAppUrl = (): string => {
  if (!isNativeWebView()) return '';

  // Dev mode: Capacitor loaded from a live dev server with a specific port (e.g. http://localhost:3000).
  if (window.location.port) {
    return window.location.origin;
  }

  // Production Capacitor build (bundled from filesystem — no port in URL).
  // androidScheme is 'http' so the origin is just http://localhost with no port.
  return 'https://waterparty-react-14hr.onrender.com';
};

export const rawAppUrl = getAppUrl();

// Use relative paths on standard web to avoid CORS, absolute URL inside native apps
export const API_BASE = isCapacitor ? rawAppUrl : '';

export const WS_BASE = (() => {
  if (isCapacitor && rawAppUrl) {
    const wsUrl = rawAppUrl.replace(/^http/, 'ws');
    return wsUrl.endsWith('/') ? wsUrl + 'ws' : wsUrl + '/ws';
  }
  // Browser: connect to the same host the page is served from
  return (isBrowser ? (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host + '/ws' : '/ws');
})();

// ─── Session Token Management ──────────────────────────────────────
// The httpOnly cookie is automatically sent with fetch requests.
// We also store a non-httpOnly session_id cookie set by the server
// (as a fallback for WebSocket connections which don't send cookies via the API).

const SESSION_KEY = 'waterparty_session_id';

export function storeSessionToken(token: string) {
  try {
    localStorage.setItem(SESSION_KEY, token);
  } catch {}
}

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {}
}

// ─── Authenticated Fetch ───────────────────────────────────────────
// The httpOnly cookie is auto-sent, but we also include x-session-token
// header as a fallback for environments where cookies aren't available.

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const sessionToken = getSessionToken();
  const headers = { ...options.headers } as Record<string, string>;
  if (sessionToken) {
    headers['x-session-token'] = sessionToken;
  }
  return fetch(url, { ...options, headers });
}

// ─── Media URL Builder ─────────────────────────────────────────────

/** Local placeholder used when no image is available (inline SVG data-URI). */
export const PLACEHOLDER_IMAGE =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">` +
    `<rect width="400" height="400" fill="#1A1C2A"/>` +
    `<circle cx="200" cy="180" r="50" fill="#2A2D3E"/>` +
    `<path d="M100 320 Q200 260 300 320" stroke="#2A2D3E" stroke-width="8" fill="none" stroke-linecap="round"/>` +
    `</svg>`
  );

export const getAssetUrl = (url: string) => {
  if (!url) return PLACEHOLDER_IMAGE;
  // If it's a media ID (starts with "media_"), build the URL
  if (url.startsWith('media_')) {
    return `${API_BASE}/api/media/${encodeURIComponent(url)}`;
  }
  if (url.startsWith('data:') || url.startsWith('http') || url.startsWith('blob:')) return url;
  return `${API_BASE}/assets/${encodeURIComponent(url)}`;
};

// ─── Cached User Validation ───────────────────────────────────────────

export function validateStoredUser(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const obj = raw as Record<string, unknown>;
  return typeof obj.ID === "string" && obj.ID.length > 0;
}

export function storeUser(user: unknown): void {
  try {
    if (validateStoredUser(user)) {
      localStorage.setItem("waterparty_user", JSON.stringify(user));
    }
  } catch {
    /* storage full or disabled */
  }
}

export function loadStoredUser<T>(): T | null {
  try {
    const stored = localStorage.getItem("waterparty_user");
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (!validateStoredUser(parsed)) {
      localStorage.removeItem("waterparty_user");
      return null;
    }
    return parsed as T;
  } catch {
    localStorage.removeItem("waterparty_user");
    return null;
  }
}

export function clearStoredUser(): void {
  try {
    localStorage.removeItem("waterparty_user");
  } catch {}
}

// ─── Local Data Cache ──────────────────────────────────────────────
// Now delegated to src/lib/cache.ts which uses @capacitor/filesystem
// with Directory.Cache on native (Android "Clear cache" cleans it up),
// falling back to IndexedDB on web.
//
// Re-exports from cache.ts for backward compatibility.

export {
  CACHE_VERSION,
  storeChatsCache,
  loadChatsCacheAsync,
  storeFeedCache,
  loadFeedCacheAsync,
  storePartyDetail,
  loadPartiesDetailAsync,
  getPartyDetailSync,
  storeChatMessagesCache,
  loadChatMessagesCacheAsync,
  storeUserProfile,
  getUserProfileSync,
  loadProfilesAsync,
  clearLocalDataCacheAsync,
  clearLocalDataCache,
  getStoredCacheVersionAsync,
  setCacheVersionAsync,
  checkCacheVersionAndInvalidateAsync,
  checkCacheSizeAsync,
  checkCacheSize,
} from "./cache";
