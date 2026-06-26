/**
 * WaterParty Library Barrel
 *
 * Simplifies imports from the utilities directory:
 *   import { getAssetUrl, cn, useStore } from '../lib';
 *
 * Instead of:
 *   import { getAssetUrl } from '../lib/constants';
 *   import { cn } from '../lib/utils';
 *   import { useStore } from '../lib/Store';
 *
 * Files inside src/lib/ should keep direct imports to avoid circular deps.
 */

// ─── Core Constants & Cache ─────────────────────────────────────
export {
  HOST,
  isCapacitor,
  rawAppUrl,
  API_BASE,
  WS_BASE,
  storeSessionToken,
  getSessionToken,
  clearSession,
  fetchWithAuth,
  PLACEHOLDER_IMAGE,
  getAssetUrl,
  validateStoredUser,
  storeUser,
  loadStoredUser,
  clearStoredUser,
  CACHE_VERSION,
  storeChatsCache,
  loadChatsCacheAsync,
  storeFeedCache,
  loadFeedCacheAsync,
  storePartyDetail,
  loadPartiesDetailAsync,
  storeChatMessagesCache,
  loadChatMessagesCacheAsync,
  storeUserProfile,
  getUserProfileSync,
  getPartyDetailSync,
  loadProfilesAsync,
  clearLocalDataCacheAsync,
  clearLocalDataCache,
  checkCacheSizeAsync,
  checkCacheSize,
  getStoredCacheVersionAsync,
  setCacheVersionAsync,
  checkCacheVersionAndInvalidateAsync,
} from './constants';

// ─── State Management ───────────────────────────────────────────
export {
  StoreProvider,
  useStore,
} from './Store';

// ─── Types ──────────────────────────────────────────────────────
export type {
  User,
  Party,
  ChatRoom,
  Message,
} from './types';

// ─── Utilities ──────────────────────────────────────────────────
export {
  cn,
  useMediaQuery,
  blobToBase64,
  uploadImage,
  uploadVideo,
  compressAndUpload,
  compressImageForProfile,
  compressImageBlob,
} from './utils';

// ─── Theme Context ──────────────────────────────────────────────
export {
  ThemeProvider,
  useTheme,
} from './ThemeContext';

// ─── Capacitor API Wrappers ─────────────────────────────────────
export {
  isCapacitorNative,
  hasCapacitorApp,
  onBackButton,
  capacitorRequestLocationPermissions,
  capacitorGetCurrentPosition,
  saveMediaToDevice,
} from './capacitor';

// ─── Theme Tokens ───────────────────────────────────────────────
export {
  colors,
  fonts,
  fontSizes,
  fontWeights,
  spacing,
  radii,
  shadows,
  gradients,
} from './theme';

// ─── Sanitization ───────────────────────────────────────────────
export {
  stripHtml,
  decodeHtml,
  sanitizeText,
  isSafeString,
  sanitizeHandle,
} from './sanitize';

// ─── Logger ─────────────────────────────────────────────────────
export { logger } from './logger';
