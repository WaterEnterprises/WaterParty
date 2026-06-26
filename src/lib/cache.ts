/**
 * WaterParty Cache Layer
 *
 * On native (Capacitor / Android): stores JSON cache files in the
 * Android CACHE directory using @capacitor/filesystem. When the user
 * hits "Clear cache" in Android settings, these files are cleaned up.
 *
 * On web: falls back to IndexedDB (same behavior as before).
 *
 * In-memory snapshots are kept for synchronous access (getUserProfileSync
 * and getPartyDetailSync). All persistent I/O is async.
 */

import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";

// ─── Cache Directory ──────────────────────────────────────────────
const CACHE_DIR = "waterparty_cache";

// Detect if we're running inside a Capacitor native WebView
const isNative = (): boolean => {
  try {
    return !!(window as any).Capacitor?.isNative;
  } catch {
    return false;
  }
};

// ─── In-Memory Snapshots (synchronous access) ────────────────────
let memChats: any[] | null = null;
let memFeed: any[] | null = null;
let memPartiesDetail: Record<string, any> | null = null;
let memProfiles: Record<string, any> | null = null;

// ─── Cache Key Constants ──────────────────────────────────────────
const CHATS_KEY = "chats";
const FEED_KEY = "feed";
const PARTIES_DETAIL_KEY = "parties_detail";
const PROFILES_KEY = "profiles";
const CACHE_VERSION_KEY = "__cache_version";
const MESSAGES_KEY_PREFIX = "messages_";
const CACHE_VERSION_VALUE = 1;

// ─── Internal Helpers: Filesystem (native) ───────────────────────
let _dirInited = false;

async function ensureCacheDir(): Promise<void> {
  if (_dirInited) return;
  if (!isNative()) return;
  try {
    await Filesystem.mkdir({
      path: CACHE_DIR,
      directory: Directory.Cache,
      recursive: true,
    });
  } catch {
    // likely already exists
  }
  _dirInited = true;
}

async function fsWrite(key: string, value: unknown): Promise<void> {
  await ensureCacheDir();
  try {
    await Filesystem.writeFile({
      path: `${CACHE_DIR}/${key}`,
      data: JSON.stringify(value),
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
  } catch {
    // quota or permissions issue
  }
}

async function fsRead<T>(key: string): Promise<T | null> {
  await ensureCacheDir();
  try {
    const result = await Filesystem.readFile({
      path: `${CACHE_DIR}/${key}`,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    const raw = result.data as string;
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function fsDelete(key: string): Promise<void> {
  await ensureCacheDir();
  try {
    await Filesystem.deleteFile({
      path: `${CACHE_DIR}/${key}`,
      directory: Directory.Cache,
    });
  } catch {
    // file may not exist
  }
}

async function fsClear(): Promise<void> {
  await ensureCacheDir();
  try {
    await Filesystem.rmdir({
      path: CACHE_DIR,
      directory: Directory.Cache,
      recursive: true,
    });
  } catch {
    // may not exist
  }
  _dirInited = false; // force re-create on next write
}

// ─── Internal Helpers: IndexedDB (web fallback) ──────────────────
const DB_NAME = "waterparty_cache";
const DB_VERSION = 2;
const STORE_NAME = "cache";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => {
        resolve(req.result ?? null);
        db.close();
      };
      req.onerror = () => {
        reject(req.error);
        db.close();
      };
    });
  } catch {
    return null;
  }
}

async function idbSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const req = tx.objectStore(STORE_NAME).put(value, key);
      req.onsuccess = () => {
        resolve();
        db.close();
      };
      req.onerror = () => {
        reject(req.error);
        db.close();
      };
    });
  } catch {
    /* quota exceeded or unavailable */
  }
}

async function idbDelete(key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const req = tx.objectStore(STORE_NAME).delete(key);
      req.onsuccess = () => {
        resolve();
        db.close();
      };
      req.onerror = () => {
        reject(req.error);
        db.close();
      };
    });
  } catch {}
}

async function idbClearAll(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const req = tx.objectStore(STORE_NAME).clear();
      req.onsuccess = () => {
        resolve();
        db.close();
      };
      req.onerror = () => {
        reject(req.error);
        db.close();
      };
    });
  } catch {}
}

// ─── Dispatch Helpers (native vs web) ────────────────────────────
function useFilesystem(): boolean {
  return isNative();
}

async function storeGet<T>(key: string): Promise<T | null> {
  return useFilesystem() ? fsRead<T>(key) : idbGet<T>(key);
}

async function storeSet(key: string, value: unknown): Promise<void> {
  if (useFilesystem()) {
    await fsWrite(key, value);
  } else {
    await idbSet(key, value);
  }
}

async function storeDelete(key: string): Promise<void> {
  if (useFilesystem()) {
    await fsDelete(key);
  } else {
    await idbDelete(key);
  }
}

async function storeClear(): Promise<void> {
  if (useFilesystem()) {
    await fsClear();
  } else {
    await idbClearAll();
  }
}

async function storeEstimateSize(): Promise<number> {
  try {
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      return estimate.usage ?? 0;
    }
  } catch {}
  return 0;
}

// ─── Public API ──────────────────────────────────────────────────

/** Store chats cache (async — fire-and-forget from reducer) */
export function storeChatsCache(chats: unknown[]): void {
  memChats = chats;
  storeSet(CHATS_KEY, chats).catch(() => {});
}

/** Load chats cache from storage (async — call on app mount) */
export async function loadChatsCacheAsync<T>(): Promise<T[] | null> {
  if (memChats) return memChats as T[];
  const stored = await storeGet<any[]>(CHATS_KEY);
  if (stored && Array.isArray(stored)) {
    memChats = stored;
    return stored as T[];
  }
  return null;
}

/** Store feed cache (async — fire-and-forget from reducer) */
export function storeFeedCache(feed: unknown[]): void {
  memFeed = feed;
  storeSet(FEED_KEY, feed).catch(() => {});
}

/** Load feed cache from storage (async — call on app mount) */
export async function loadFeedCacheAsync<T>(): Promise<T[] | null> {
  if (memFeed) return memFeed as T[];
  const stored = await storeGet<any[]>(FEED_KEY);
  if (stored && Array.isArray(stored)) {
    memFeed = stored;
    return stored as T[];
  }
  return null;
}

/** Store a party detail (fire-and-forget from reducer) */
export function storePartyDetail(id: string, data: any): void {
  if (!memPartiesDetail) memPartiesDetail = {};
  memPartiesDetail[id] = data;
  storeSet(PARTIES_DETAIL_KEY, memPartiesDetail).catch(() => {});
}

/** Load all cached party details from storage */
export async function loadPartiesDetailAsync(): Promise<Record<string, any> | null> {
  if (memPartiesDetail) return memPartiesDetail;
  const stored = await storeGet<Record<string, any>>(PARTIES_DETAIL_KEY);
  if (stored && typeof stored === "object") {
    memPartiesDetail = stored;
    return stored;
  }
  return null;
}

/** Get a party detail from in-memory cache (sync, instant) */
export function getPartyDetailSync(partyId: string): any | null {
  return memPartiesDetail?.[partyId] ?? null;
}

/** Store messages for a specific chat (fire-and-forget from useChatRoom) */
export function storeChatMessagesCache(chatId: string, messages: any[]): void {
  storeSet(`${MESSAGES_KEY_PREFIX}${chatId}`, messages).catch(() => {});
}

/** Load cached messages for a specific chat from storage */
export async function loadChatMessagesCacheAsync(chatId: string): Promise<any[] | null> {
  try {
    const stored = await storeGet<any[]>(`${MESSAGES_KEY_PREFIX}${chatId}`);
    if (stored && Array.isArray(stored)) {
      return stored;
    }
  } catch {}
  return null;
}

/** Store a user profile (keyed by user ID) */
export function storeUserProfile(userId: string, data: any): void {
  if (!memProfiles) memProfiles = {};
  memProfiles[userId] = data;
  storeSet(PROFILES_KEY, memProfiles).catch(() => {});
}

/** Get a user profile from in-memory cache (sync, instant) */
export function getUserProfileSync(userId: string): any | null {
  return memProfiles?.[userId] ?? null;
}

/** Load all cached user profiles from storage */
export async function loadProfilesAsync(): Promise<Record<string, any> | null> {
  if (memProfiles) return memProfiles;
  const stored = await storeGet<Record<string, any>>(PROFILES_KEY);
  if (stored && typeof stored === "object") {
    memProfiles = stored;
    return stored;
  }
  return null;
}

/** Clear all cached data (called on logout) */
export async function clearLocalDataCacheAsync(): Promise<void> {
  memChats = null;
  memFeed = null;
  memPartiesDetail = null;
  memProfiles = null;
  await storeClear().catch(() => {});
  try {
    localStorage.removeItem("waterparty_chats");
    localStorage.removeItem("waterparty_feed");
  } catch {}
}

/** Synchronous clear for logout (fires async storage clear) */
export function clearLocalDataCache(): void {
  memChats = null;
  memFeed = null;
  memPartiesDetail = null;
  memProfiles = null;
  storeClear().catch(() => {});
  try {
    localStorage.removeItem("waterparty_chats");
    localStorage.removeItem("waterparty_feed");
  } catch {}
}

// ─── Cache Versioning ────────────────────────────────────────────

/** Read the stored cache version from storage. Returns 0 if none found. */
export async function getStoredCacheVersionAsync(): Promise<number> {
  try {
    const v = await storeGet<number>(CACHE_VERSION_KEY);
    return v ?? 0;
  } catch {
    return 0;
  }
}

/** Write the current CACHE_VERSION into storage. */
export async function setCacheVersionAsync(): Promise<void> {
  await storeSet(CACHE_VERSION_KEY, CACHE_VERSION_VALUE);
}

/** The cache version constant (exported for reference) */
export const CACHE_VERSION = CACHE_VERSION_VALUE;

/**
 * Check if the stored cache version matches the current CACHE_VERSION.
 * If mismatched (or no version stored), clears all cached data and
 * writes the current version. Returns true if cache was cleared.
 *
 * Call this once on app mount, before loading cached data.
 */
export async function checkCacheVersionAndInvalidateAsync(): Promise<boolean> {
  try {
    const storedVersion = await getStoredCacheVersionAsync();
    if (storedVersion === CACHE_VERSION) {
      return false;
    }
    console.info(
      `[Cache] Version mismatch: stored=${storedVersion}, current=${CACHE_VERSION}. Clearing cache.`
    );
    await clearLocalDataCacheAsync();
    await setCacheVersionAsync();
    return true;
  } catch {
    try {
      await clearLocalDataCacheAsync();
    } catch {}
    try {
      await setCacheVersionAsync();
    } catch {}
    return true;
  }
}

// ─── Cache Size Monitoring ───────────────────────────────────────
const CACHE_WARN_THRESHOLD = 80 * 1024 * 1024;   // 80 MB
const CACHE_CRITICAL_THRESHOLD = 95 * 1024 * 1024; // 95 MB

/**
 * Check storage usage and log warnings if approaching limits.
 * Call this after storing data to stay informed about cache health.
 */
export async function checkCacheSizeAsync(): Promise<void> {
  try {
    const bytes = await storeEstimateSize();
    if (bytes > CACHE_CRITICAL_THRESHOLD) {
      console.warn(
        `[Cache] CRITICAL: Storage usage at ${(bytes / 1024 / 1024).toFixed(1)}MB ` +
        `— approaching limit. Consider clearing cache.`
      );
    } else if (bytes > CACHE_WARN_THRESHOLD) {
      console.info(
        `[Cache] Storage usage at ${(bytes / 1024 / 1024).toFixed(1)}MB`
      );
    }
  } catch {}
}

/** Synchronous check (fire-and-forget async check) */
export function checkCacheSize(): void {
  checkCacheSizeAsync().catch(() => {});
}
