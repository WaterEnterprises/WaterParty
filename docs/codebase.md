# WaterParty Codebase Documentation

## Overview

**WaterParty** is a cross-platform party-matching mobile app built with React + TypeScript (frontend) and Hono/Bun (backend). Users swipe to discover nearby parties, host events, chat in real-time, and contribute to crowdfunded events. Deployed via Capacitor for native iOS/Android.

---

## Root Configuration Files

### `package.json`
Project manifest. Defines scripts, dependencies, and metadata.
- **Entry**: `src/main.tsx` (React app)
- **Scripts**: `dev:server` (Hono hot-reload), `dev:device` (Android ADB deploy), `build:capacitor` (CSS+Web+Copy), `build:render` (full production build + server bundle), `start` (run production server)
- **Key deps**: React 19, Hono 4, Capacitor 8, Tailwind CSS v4, Stripe, Turso/libSQL, Motion (animation), Leaflet (maps)
- **Runtime**: Bun (package manager + bundler + server runtime)

### `tsconfig.json`
TypeScript configuration targeting ES2022 with bundler module resolution. Enables JSX (`react-jsx`), allows JS imports, no emit (Bun handles compilation). Includes only `src/` directory.

*(Note: `vite.config.ts` was previously used but the project now uses `scripts/build-web.js` directly with Bun's bundler for the React SPA build.)*

### `capacitor.config.ts`
Capacitor native app config:
- **App ID**: `com.waterparty.app`
- **Web dir**: `dist/`
- **Android scheme**: HTTP (cleartext enabled for dev)
- **Plugins configured**: SplashScreen (2s, dark bg), StatusBar (dark style), Keyboard (resize body), Haptics, PushNotifications
- Allows mixed content and navigation to any URL (required for Stripe Connect)

### `index.html`
SPA entry point. Includes:
- PWA meta tags (theme-color `#090A10`, mobile-web-app-capable, apple-mobile-web-app)
- Loading skeleton (CSS gradient animation while JS boots)
- Runtime error overlay (catches `window.onerror` and unhandled promise rejections)
- CSS link to `/assets/index.css`, JS entry to `/assets/main.js`
- Error styling: dark theme, monospace font, red titles

### `.env.example`
Template for environment variables:
- `APP_URL`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- `JAVA_HOME` (for Android builds)
- `ADMIN_USER_IDS`, `ADMOB_*` IDs
- Rate limiting config (optional)

### `metadata.json`
App metadata for deployment platforms. Declares geolocation permission requirement.

### `bun.lock`
Bun lockfile (equivalent to `package-lock.json`).

### `eslint.config.js`
ESLint flat configuration. Uses TypeScript-ESLint with recommended rules. Referenced by the `lint:eslint` script defined in `package.json`.

### `README.md`
Project documentation covering features, stack, setup, build pipeline, CI/CD, API endpoints, auth, and image processing.

---

## Root Files

### `codebase.md`
This file — comprehensive documentation of the entire repository.

### `debug.ts`
Capacitor debug configuration file. Used for connecting to a live-reload dev server during native app development. Overrides the server URL for Capacitor builds.

### `neue_frutiger_world_regular.ttf`
Custom brand font (Neue Frutiger World) used throughout the app via `@font-face` in `index.css`. Loaded at startup with `font-display: swap` for optimal rendering. Registered in the Tailwind `@theme` as `--font-sans`.

### `public/manifest.webmanifest`
Web App Manifest for PWA support. Defines app icons at multiple sizes (48×48 to 512×512) for installation on mobile home screens.

---

## Source Code — `/src/`

### Entry Point

#### `src/main.tsx`
React entry point. Renders `<App />` inside `<StrictMode>` into `#root` DOM element. CSS is handled by Tailwind CLI and linked via `index.html`.

### Root Component

#### `src/App.tsx`
Top-level app component orchestrating:
- **Providers** (outer to inner): `Router` (BrowserRouter) → `ThemeProvider` → `ToastProvider` → `StoreProvider`
- **MainApp** inner component handles:
  - Route definitions (`/` SwipePage, `/messages` MessagesPage, `/chat/:chatId` ChatRoomPage, `/create` CreatePartyPage, `/profile` ProfilePage, `/wallet` WalletPage, `/admin` AdminDashboard, `/privacy` PrivacyPage)
  - Auth gating: shows `AuthPage` when `user` is null
  - Public route: `/privacy` bypasses auth
  - Bottom nav bar (hidden on chat pages)
  - Back button navigation handler (Android hardware back)
  - User validation on popstate (reloads if user missing from localStorage)

### Global Styles

#### `src/index.css`
Tailwind CSS v4 entry with `@import "tailwindcss"` and custom `@theme` block defining:
- **Brand colors**: `brand-primary` (#FF3B5C), `brand-secondary` (#7042F8), `brand-accent` (#00D2FF)
- **Font tokens**: `text-2xs` (6px), `text-micro` (8px), `text-nano` (9px), `text-tiny` (10px)
- **Surface colors** (themeable): `base`, `card`, `overlay`, `elevated`, `auth`
- **Text colors** (themeable): `text-primary`, `text-secondary`, `text-muted`, `text-faint`
- **Border colors**: `border-subtle`, `border-default`, `border-strong`
- **Glass colors**: `glass`, `glass-hover`, `glass-active`
- **Dark/Light mode**: `:root` (dark defaults) + `.light` class overrides using CSS custom properties
- **Global styles**: Custom font `Neue Frutiger World`, input/textarea/select styling, button transitions, h1/h2/h3/label defaults
- **Safe area utilities**: `.safe-area-top`, `.safe-area-bottom`, etc. for notched devices
- **Mobile enhancements**: `-webkit-tap-highlight-color: transparent`, scroll momentum, user-select prevention

### Library / Utilities

#### `src/lib/index.ts` (Barrel)
Barrel export file that re-exports everything from all `src/lib/` modules. Simplifies imports to a single path:

```ts
// Instead of multiple imports:
import { getAssetUrl } from '../lib/constants';
import { cn } from '../lib/utils';
import { useStore } from '../lib/Store';

// Use the barrel:
import { getAssetUrl, cn, useStore } from '../lib';
```

Re-exports from: `constants.ts`, `Store.tsx`, `types.ts` (type-only), `utils.ts`, `ThemeContext.tsx`, `capacitor.ts`, `theme.ts`, `sanitize.ts`, `logger.ts`. Does not include `theme.js` (it's a re-export wrapper).

#### `src/lib/constants.ts`
Core constants and utilities:
- **Platform detection**: `isCapacitor` flag detecting Capacitor native WebView
- **API URLs**: `API_BASE` (relative on web, absolute on native), `WS_BASE` (WebSocket URL)
- **Session management**: `storeSessionToken()`, `getSessionToken()`, `clearSession()` (localStorage)
- **Auth fetch**: `fetchWithAuth()` — adds `x-session-token` header
- **Media helpers**: `getAssetUrl()` (builds media URLs from IDs), `PLACEHOLDER_IMAGE` (SVG data-URI)
- **User cache**: `storeUser()`, `loadStoredUser()`, `clearStoredUser()` via localStorage
- **IndexedDB cache layer**: Full offline-capable data cache with `idbGet()`, `idbSet()`, `idbDelete()`, `idbClear()`, size monitoring
  - Caches: `storeChatsCache()` / `loadChatsCacheAsync()`, `storeFeedCache()` / `loadFeedCacheAsync()`
  - Party details: `storePartyDetail()` / `loadPartiesDetailAsync()`
  - User profiles: `storeUserProfile()` / `getUserProfileSync()` / `loadProfilesAsync()`
  - Clear: `clearLocalDataCacheAsync()` / `clearLocalDataCache()`
  - Size monitoring: `checkCacheSizeAsync()` (warns at 80MB, critical at 95MB)

#### `src/lib/Store.tsx`
Global state management via React Context + `useReducer`:
- **State shape**: `user`, `feed` (Party[]), `chats` (ChatRoom[]), `registrations`, `fetchedParties`, `coords`
- **Reducer actions**: `SET_USER`, `SET_FEED`, `ADD_TO_FEED`, `REMOVE_FROM_FEED`, `SET_CHATS`, `ADD_OR_UPDATE_CHAT`, `REMOVE_CHAT`, `SET_REGISTRATIONS`, `SET_FETCHED_PARTY`, `SET_COORDS`, `LOGOUT`
- **WebSocket management**: Auto-connects on login with session token, reconnects on close, queues messages until open
- **IndexedDB hydration**: Loads cached chats/feed on mount before WS connects (separate flags per data type)
- **HTTP fallbacks**: Fetches `/api/chats` and `/api/feed` on mount as backup
- **Background sync**: Polls chats (2min), feed (1min), profile (2min) with `requestIdleCallback` when visible
- **Key context methods**: `login()`, `logout()`, `saveProfile()`, `sendSocketMessage()`, `initializeApp()`, `refreshLocation()`, `fetchPartyById()`, `fetchMissingParties()`, `fetchUserProfile()`, `addLocalChat()`, `removeChat()`, `removeFromFeed()`

#### `src/lib/capacitor.ts`
Typed Capacitor API wrapper (re-exported via barrel `src/lib/index.ts`):
- **`isCapacitorNative()`** — Detects if running in a Capacitor native WebView via `window.Capacitor.isNative`
- **`hasCapacitorApp()`** — Checks for Capacitor global object presence
- **`onBackButton(handler)`** — Registers Android hardware back-button listener, returns cleanup function; gracefully no-ops on web
- **`capacitorRequestLocationPermissions()`** — Requests geolocation permission through Capacitor plugin API
- **`capacitorGetCurrentPosition()`** — Gets current GPS position via Capacitor Geolocation plugin
- **`saveMediaToDevice(url, mediaId, mimeType)`** — Downloads a media URL and saves it to a "Water Party" folder in Documents via `@capacitor/filesystem`; supports jpg, png, gif, mp4, webm
- All functions wrapped in try/catch — safe to call in plain browsers

#### `src/lib/logger.ts`
Unified logger with environment-aware gating (re-exported via barrel `src/lib/index.ts` as `{ logger }`):
- **Development**: `debug()`, `log()`, `info()`, `warn()`, `error()` all print to console with `[level]` prefix
- **Production**: `debug()` and `log()` are replaced with no-ops; `info()`, `warn()`, `error()` remain visible
- Environment detected via `process.env.NODE_ENV` or `window.__PROD__`
- Guards against missing `console` in older runtimes

#### `src/lib/sanitize.ts`
Input sanitization utilities for XSS prevention (re-exported via barrel `src/lib/index.ts`):
- **`stripHtml(input)`** — HTML-entity encodes `< > " ' /` to prevent injection; basic XSS defence for user text displayed in UI
- **`decodeHtml(input)`** — Reverses `stripHtml`, decoding entities back to characters
- **`sanitizeText(input)`** — Combines `stripHtml` + trimming; safe for DOM text content insertion
- **`isSafeString(input)`** — Validates no script injection patterns (`<script`, `javascript:`, `on*=`, etc.); returns boolean
- **`sanitizeHandle(input)`** — Cleans social-media handles: strips `@`, URL prefixes, domain prefixes (instagram.com/, t.me/, etc.), trailing slashes/query params

#### `src/lib/theme.ts`
TypeScript source of truth for all brand design tokens — the file that `theme.js` mirrors. Exports typed constants organized into:
- **`colors`** — Brand (primary `#FF3B5C`, secondary `#7042F8`, accent `#00D2FF`), background surface colors (`bg.base`, `bg.card`, `bg.overlay`, `bg.elevated`, `bg.auth`), text opacity scale (`primary`/`secondary`/`muted`/`faint`), border opacities, status colors (success/error/warning/info/emerald)
- **`fonts`** — `brand` (Neue Frutiger World stack), `system` fallback
- **`fontSizes`** — Semantic scale (`2xs` through `xl`) with documented fluid `clamp()` values (360px–768px viewport)
- **`spacing`** — Page padding, section gaps, card/chip padding
- **`radii`** — Border-radius tokens (`sm` 8px through `full` 9999px)
- **`shadows`** — Card, elevated, and glow presets (primary/accent/success)
- **`gradients`** — Primary action, success, overlay fade, header fade, tab active


Imported directly by components and modules that need TypeScript-typed access to brand values (e.g., canvas rendering, inline styles, dynamic gradients).

Note: the `tw` Tailwind class helper utility was removed in a cleanup — it was never imported anywhere. Tailwind classes are used directly in JSX.

#### `src/lib/theme.js`
Re-exports all values from the TypeScript theme source (`theme.ts`) via `export * from './theme.ts'`. Exists for modules that import `.js` instead of `.ts` (e.g., server-side or bundler contexts that don't resolve TypeScript).

Before consolidation, this file manually duplicated all brand tokens (colors, fonts, font sizes, spacing, radii, shadows, gradients) — now it's a thin re-export wrapper with `theme.ts` as the single source of truth.

#### `src/lib/ThemeContext.tsx`
Dark/Light theme context:
- Stores theme in `localStorage` under `wp_theme` key
- Toggles `.light` class on `<html>` element
- Provides `theme`, `toggle()`, `setTheme()` via React context
- Default: dark mode

#### `src/lib/types.ts`
TypeScript interfaces:
- **User**: ID, RealName, Email, ProfilePhotos, Age, Gender, Bio, JobTitle, School, Social handles (Instagram, Twitter, VK, Telegram, WhatsApp, Facebook), TrustScore, Thumbnail, IsAdmin, etc.
- **Party**: ID, HostID, Title, Description, PartyPhotos, StartTime, DurationHours, Address, City, GeoLat/Lon, MaxCapacity, CurrentGuestCount, VibeTags, ChatRoomID, Crowdfund fields, PartyType
- **ChatRoom**: ID, PartyID, Title, ImageUrl, RecentMessages, IsGroup, ParticipantIDs
- **Message**: ID, ChatID, SenderID, Content, ImageUrl, VideoUrl, CreatedAt, Timestamp (legacy)

#### `src/lib/utils.ts`
Utility functions:
- `cn()` — Tailwind class merge (clsx + tailwind-merge)
- `useMediaQuery()` — React hook for CSS media query matching
- `blobToBase64()` — Converts Blob to base64 data-URI
- `uploadImage()` — Uploads via `/api/upload` with multipart/form-data
- `uploadVideo()` — Direct video upload wrapper
- `compressAndUpload()` — Compress image then upload
- `compressImageForProfile()` — 9:16 center-crop + compress for profile photos (max 4000px, q0.92)
- `compressImageBlob()` — Generic image compression preserving aspect ratio

### Pages

#### `src/pages/AuthPage.tsx`
Login/Registration screen:
- Toggle between Sign In and Registration modes
- **Login**: email/username + password
- **Registration**: Full form with name, email, password, profile photos (up to 9, camera/gallery with crop), birthday, gender, bio, social handles, work/education
- Photo action sheet (Camera/Gallery) with inline selection
- PhotoEditor integration for cropping to 9:16
- Base64 photo upload during registration (no session yet)
- Loading screen with progress stages: auth → data → done
- Fetches chats + feed after successful auth
- Calls `initializeApp()` to bootstrap the store
- Dark theme with glow effects and animated background

#### `src/pages/SwipePage.tsx`
Main discovery feed with Tinder-style card swiping:
- **SwipeCard** (memoized): draggable card with photo carousel, date/time/distance badges, host info, vibe tags, action buttons (pass/like)
- Drag gestures with threshold detection (100px or 500px/s velocity)
- Send `SWIPE` via WebSocket on each action
- **Party Detail Overlay**: full-screen with PhotoCarousel, description, stats grid, host info, DM button
- **User Profile Overlay**: full-screen profile view with photos, bio, work/education, socials, DM button
- Location prompt modal (GPS required for party discovery)
- AdMob interstitials every 5 swipes
- Back button handling for overlays
- Location refresh on visibility change

#### `src/pages/MessagesPage.tsx`
Chat list with tabbed view (Party Chats / Direct Messages):
- Segmented control tabs (pill-style toggle)
- Sorts chats by most recent message
- Shows chat thumbnail, title, last message preview, timestamp, party details (location, time, capacity)
- Fetches missing party details on mount
- Empty states for each tab

#### `src/pages/ChatRoomPage.tsx`
Router that detects chat type and renders the appropriate page:
- Party/group chat → `<PartyChatPage />`
- Direct message → `<DmChatPage />`
- Shows loading state until chat data is available

#### `src/pages/PartyChatPage.tsx`
Group chat interface for party members:
- Message bubbles with avatar, sender info, date separators
- Sent messages: brand gradient (left-aligned), received: dark card (right-aligned)
- Photo/video attachments with lightbox viewer
- **Party Info Sidebar**: PhotoCarousel, stats grid (timeline, location, capacity, status), address, host info, DM host button, delete/dissolve controls (host only)
- **Guest Management**: approval/rejection of join requests (host only)
- **Fundraiser bar**: progress bar, contribute button
- **Stripe Connect**: onboarding flow for hosts to receive payouts
- Camera capture and media upload
- User profile overlay on avatar click
- Report user modal

#### `src/pages/DmChatPage.tsx`
Direct message chat interface:
- Message bubbles (same layout as PartyChatPage)
- Sender avatar with profile overlay on click
- Photo/video attachments with lightbox
- **DM Info Sidebar**: user profile with PhotoCarousel, bio, stats, socials, report + delete conversation
- Tip modal integration (Stripe-powered)
- Camera capture
- User profile overlay

#### `src/pages/CreatePartyPage.tsx`
Party creation form:
- Photo gallery (up to 16, camera/gallery with crop)
- Core details: title, description
- Logistics: date picker, time picker, duration slider (1-6h), capacity slider (10-300)
- **Map Picker** (Leaflet): search by address (Nominatim), click-to-set-pin, reverse geocoding, current location button
- **Visibility Boost**: watch rewarded ad to promote party
- **Crowdfunding**: opt-in target amount + currency selector (BRL/USD/EUR/GBP)
- **Vibe Architecture**: party type selector (RAVE, HOUSE PARTY, ROOFTOP, CLUB, DINNER, OTHER) with custom type input
- Photo compression + upload pipeline with yield-based UI responsiveness
- Validates all fields before submission

#### `src/pages/ProfilePage.tsx`
User profile management:
- **View mode** (memoized `ProfileViewContent`): PhotoCarousel, name, bio, gender, social links (Instagram, X, VK, Telegram, WhatsApp, Facebook, Email), work/education cards, Wallet button, Edit button, Logout, Theme toggle (Sun/Moon), Admin Dashboard link
- **Edit mode**: Full form with name, photo gallery editor (crop/delete/reorder), bio, birthday, gender, social links, work/education fields
- Photo uploading pipeline with compression
- Save via `UPDATE_PROFILE` WebSocket event
- Handle cleanup: strips `@` prefixes, extracts handles from full URLs
- Dark gradient background

#### `src/pages/WalletPage.tsx`
Wallet and earnings dashboard:
- Current balance display with Stripe Connect integration
- Earnings history with total received/tips/contributions breakdown
- Withdrawal functionality for party hosts
- Empty state for new users without Stripe Connect
- Animated loading skeleton

#### `src/pages/AdminDashboard.tsx`
Admin-only analytics and management panel:
- Platform revenue overview (total collected, platform fees)
- Platform stats (total users, parties, active users)
- Test push notification functionality
- Protected by `ADMIN_USER_IDS` environment variable
- Loading/error states

#### `src/pages/PrivacyPage.tsx`
Public privacy policy page:
- Accessible without authentication (bypasses auth gating)
- Dark-themed layout consistent with app styling
- Statically rendered content

### Components

#### `src/components/BottomNav.tsx`
Fixed bottom navigation bar with 4 tabs:
- Swipe (Layers icon), Chats (MessageSquare), Party (PartyPopper, neon glow animation), Profile (User)
- Active state: brand-primary color
- Hide on `/chat/` and `/admin` routes
- Uses `motion` for animated neon glow layoutId

#### `src/components/CameraCapture.tsx`
Full-screen camera capture overlay:
- Uses Capacitor Camera plugin with front/back toggle
- Flash control (on/off/auto)
- Photo preview + retake/accept workflow
- Fallback to file input if Capacitor unavailable
- Animated UI with glass morphism

#### `src/components/Carousel.tsx`
Lightweight image carousel for swipe cards:
- Touch-swipe navigation
- Arrow buttons, dot indicators (bar variant)
- Click-to-navigate option
- Optimized with `object-contain` for landscape

#### `src/components/ChatInputBar.tsx`
Message input bar with:
- Text input with placeholder
- Send button (brand gradient when active)
- Media attachment buttons: camera, gallery, send money
- Upload progress indicator
- Compact design with `text-nano` font

#### `src/components/ChatLightbox.tsx`
Full-screen media lightbox:
- Image viewer with download support
- Video player with download support
- Close button with backdrop blur

#### `src/components/FundraiserContributeModal.tsx`
Crowdfunding contribution modal:
- Amount input with currency formatting
- Stripe Payment Element integration
- Platform fee display (6%)
- Success/error states
- Animated entry with spring physics

#### `src/components/PhotoCarousel.tsx`
Photo carousel used across multiple pages (Swipe, Profile, Chat):
- Touch-swipe navigation
- Arrow buttons, dot indicators
- Gradient overlays (customizable)
- Trust score badge
- Close/navigation buttons via children slots
- Memoized for performance

#### `src/components/PhotoEditor.tsx`
Client-side photo cropping tool:
- Fixed 9:16 aspect ratio for profile photos
- Drag-to-pan, zoom via slider
- Canvas-based crop output
- Spring-animated UI

#### `src/components/ReportUserModal.tsx`
User reporting modal:
- Reason selection (harassment, inappropriate content, spam, hate speech, other)
- Optional details textarea
- Error handling, loading state, success confirmation
- Animated with Motion

#### `src/components/SocialIcons.tsx`
SVG icon components for social platforms:
- InstagramIcon, XIcon, VkIcon, TelegramIcon, WhatsAppIcon, FacebookIcon
- Used in profile pages for social link display

#### `src/components/TipModal.tsx`
Peer-to-peer tipping modal:
- Amount selection (fixed amounts or custom)
- Stripe payment processing
- Success notification with chat integration
- Receiver info display

#### `src/components/UserProfileCard.tsx`
Full-screen user profile card (used in chat info sidebars):
- PhotoCarousel with gradient overlay
- Bio, gender, work/education, socials sections
- Report button
- Optional "Send Message" button for group chat contexts
- Spring-animated entry from bottom

#### `src/components/VideoCard.tsx`
Video player card for chat messages:
- Thumbnail preview
- Play button overlay
- Click-to-expand into lightbox
- Loading state

### Hooks

#### `src/hooks/useBackButton.ts`
Android hardware back button handler:
- Registers a native back-button listener in Capacitor WebView
- Accepts a handler function that receives the current pathname
- Uses a ref to avoid stale closures
- Auto-cleans on unmount
- Gracefully degrades on web

#### `src/hooks/usePushNotifications.ts`
Push notification registration:
- Registers with Capacitor Push Notifications plugin
- Requests permission (prompt → granted/denied)
- Sends the FCM/APNs token to server via `POST /api/push/register`
- Handles foreground notification receipt and background notification taps
- Navigates to the relevant chat on notification tap
- No-op on web

#### `src/hooks/useAdMob.ts`
AdMob integration with interstitial and rewarded video ads:
- Initializes `@capacitor-community/admob` on mount
- **Interstitial**: `prepareInterstitial()` + `showInterstitial()` — shown every 5 swipes
- **Rewarded video**: `prepareRewarded()` + `showRewarded()` — for party visibility boost
- `watchPartyBoostReward()` — full flow: prepare → show → wait for reward → return boolean
- Uses build-time injected ad unit IDs from `process.env.ADMOB_*` (with test ID fallbacks)
- Contains `AdMobInit` component (renders null, initializes on mount)
- Graceful no-op on web

#### `src/hooks/useCamera.ts`
Camera and gallery image capture abstraction:
- `pickImage()` — Opens device gallery (native Capacitor or browser fallback with `<input type="file">`)
- `takePhoto()` — Opens device camera (native or browser with `capture="environment"`)
- Returns `CameraImageResult[]` with File objects + preview URLs
- Supports multiple image selection on native via `pickImages()`
- Handles cancellation gracefully

#### `src/hooks/useChatRoom.ts`
Shared chat room logic used by both `PartyChatPage` and `DmChatPage`:
- **Message fetching**: Loads history from `/api/chats/:chatId/messages?limit=100` with AbortController
- **Optimistic updates**: Immediately adds sent messages to local state before server confirms
- **Media handling**: Image compression + upload, video upload with thumbnail extraction
- **Real-time sync**: Polls for new messages via WebSocket RecentMessages diff
- **Report flow**: Validates reason, submits to `/api/reports`, handles success/error
- **DM creation**: Creates direct message chats via `/api/chats/dm`
- **Media download**: Saves to device (Capacitor) or triggers browser download
- **State management**: Manages 40+ state variables shared between both chat page components
- **ETA helper**: Computes time-until-party or time-remaining for group chats

#### `src/hooks/useToast.tsx`
Toast notification system:
- Context-based toast provider
- Auto-dismiss with configurable duration
- Multiple toast types (success, error, info)
- Animated entry/exit with Motion
- Positioned at bottom of screen

---

## Server — `/server/`

### `server/index.ts`
Hono backend entry point:
- Configures middleware: CORS, session auth, rate limiter, body parser
- Registers all route handlers from `/routes/`
- Sets up WebSocket endpoint at `/ws`
- Static file serving for `dist/` (production) or Vite proxy (dev)
- Serves uploaded media via `/api/media/:id`
- `GET /api/health` — Health check (reports DB connection status, Stripe config status, uptime)
- Starts Bun HTTP server

### `server/config.ts`
Environment configuration loader:
- Validates required env vars (TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, STRIPE_SECRET_KEY)
- Exports typed config object with all settings
- Telegram bot token for admin notifications

### `server/db.ts`
Database client and schema:
- Turso/libSQL connection with auth
- **Schema**: tables for users, sessions, messages, chat_rooms, chat_participants, parties, party_photos, registrations, swipes, reports, tips, uploads, admob_clicks, notifications
- Migration functions for table creation
- Prepared statements for common queries
- Auto-create tables on startup

### `server/helpers.ts`
Data enrichment and utility functions:
- **Data mapping**: `mapUser()`, `mapParty()`, `mapChat()` — transforms raw DB rows into typed objects (parses JSON fields, normalizes booleans)
- **Parties**: `getEnrichedParties()` — fetches all parties with host info (names, thumbnails), cached with 30s TTL; `invalidatePartiesCache()` — clears cache on mutations
- **Chats**: `getEnrichedChats(userId)` — fetches user's chats via `chat_participants` junction table, enriches DM titles with partner names; `getEnrichedChatsForUsers(userIds)` — batch version for WS broadcasts
- **Messages**: `getChatMessages(chatId, limit, before)` — paginated message fetch; `getLastMessage(chatId)` — single last message lookup
- **Participants**: `syncChatParticipants(chatID, participantIDs)` — syncs `chat_participants` junction table; `backfillChatParticipants()` — one-time migration from legacy JSON
- **Feed exclusions**: `getUserExclusionsForFeed(userIDs)` — batch-fetch registrations + swipes for N users in 2 DB queries
- **Distance**: `getDistance(lat1, lon1, lat2, lon2)` — Haversine formula for party proximity sorting
- **JSON safety**: `parseJSON(str, def)` — safe JSON parse with default fallback

### `server/push.ts`
Push notification service:
- Sends push notifications via Capacitor Push Notifications API
- Notification payload formatting

### `server/stripe-init.ts`
Stripe SDK initialization:
- Creates Stripe instance with secret key
- Webhook signing secret configuration
- Payment intent helpers

### `server/telegram.ts`
Telegram bot integration:
- Sends admin notifications about new registrations and logins
- Configurable bot token and chat ID

### `server/tsconfig.json`
TypeScript config for server code. Separate from the frontend config.

### `server/middleware/session.ts`
Session authentication middleware:
- Validates session tokens from cookies or `x-session-token` header
- Attaches `userId` to request context
- Session expiry management (7-day inactivity timeout)

### `server/middleware/rate-limiter.ts`
Rate limiting middleware:
- Configurable limits per endpoint type (auth, api, payment, upload)
- Window-based limiting (default 15 min)
- Doubled limits in development mode
- Stores state in Turso DB (`rate_limits` table) — persistent across restarts and server instances

### `server/routes/auth.ts`
Authentication routes:
- `POST /login` — Email/password authentication with bcrypt, creates session
- `POST /register` — User registration with profile photo upload (base64), creates session
- `POST /api/logout` — Revokes the session (single session), clears cookie
- `DELETE /api/account` — Full account deletion cascade (sessions, registrations, swipes, messages, reports, tips, hosted parties, DMs)
- Rate limited (50 requests per 15 min, doubled to 100 in development)

### `server/routes/users.ts`
User profile routes:
- `GET /api/users/:id` — Fetch user profile (returns public data)
- *(No `POST /api/users/:id` — profile updates are handled via WebSocket `UPDATE_PROFILE` event)*

### `server/routes/parties.ts`
Party management routes:
- `GET /api/feed` — Nearby parties feed (with geolocation filtering)
- `GET /api/party/:id` — Single party details
- `GET /api/parties?ids=...` — Batch party fetch

### `server/routes/chats.ts`
Chat room routes:
- `GET /api/chats` — User's chat rooms list
- `POST /api/chats/dm` — Create or find existing DM chat

### `server/routes/upload.ts`
Media upload route:
- `POST /api/upload` — Multipart file upload
- Accepts images and videos
- Crops images to 9:16 using sharp
- Stores in database as BLOBs
- Returns media ID

### `server/routes/payments.ts`
Stripe payment routes:
- `POST /api/create-payment-intent` — Creates Stripe PaymentIntent for crowdfund contributions
- Handles 6% platform fee

### `server/routes/connect.ts`
Stripe Connect routes:
- `POST /api/connect/onboarding` — Creates Stripe Connect onboarding link for hosts
- `GET /api/connect/status` — Check Connect account status
- `POST /api/connect/withdraw` — Withdraw fundraiser balance

### `server/routes/reports.ts`
User reporting route:
- `POST /api/reports` — Submit user report (stored with reason + details)

### `server/routes/tips.ts`
Peer-to-peer tipping routes:
- `POST /api/create-tip-intent` — Creates PaymentIntent for tips
- `GET /api/tips` — List tips (sent/received)

### `server/routes/webhook.ts`
Stripe webhook handler:
- Verifies webhook signature
- Handles `payment_intent.succeeded` for crowdfund contributions
- Updates crowdfund current amounts in database
- Records tips on payment success

### `server/routes/admin.ts`
Admin dashboard routes:
- Protected by ADMIN_USER_IDS check
- Stats/analytics endpoints
- User management (suspend, view)

### `server/routes/ads.ts`
AdMob-related routes:
- Tracks ad impressions/clicks
- Rewarded ad validation

### `server/routes/notifications.ts`
Push notification routes:
- Registers device tokens
- Sends notifications via Capacitor API

### `server/ws/handler.ts`
WebSocket event handler:
- Events handled: `GET_FEED`, `GET_CHATS`, `SWIPE`, `SEND_MESSAGE`, `CREATE_PARTY`, `UPDATE_PROFILE`, `DELETE_CHAT`, `DELETE_PARTY`, `DELETE_ACCOUNT`, `GET_REGISTRATIONS`, `APPROVE_JOIN_REQUEST`, `UPDATE_LOCATION`, `DM_CREATED`, `PARTY_UPDATED`
- Broadcasts relevant events to connected clients
- Handles session authentication for WS connections
- Message persistence (INSERT into messages table)

### `server/scheduler/payout.ts`
Background job for Stripe Connect payouts:
- Scheduled task that processes pending payouts to hosts
- Withdraws from Stripe Connect accounts

---

## Test Files (all in `tests/`)

### `tests/test-server.js`
Server-side test runner script.

### `tests/test-register.js` / `tests/test-login-success.js` / `tests/test-login-fail.js` / `tests/test-duplicate-email.js` / `tests/test-new-email-and-then-duplicate.js`
Authentication test scripts:
- Tests registration flow (success, duplicate email)
- Tests login flow (success, invalid credentials)

### `tests/test-post.js`
API endpoint test script.

### `tests/payment-endpoints.test.ts`
Payment endpoint integration tests (requires running server):
- Health check, unauthenticated request rejection
- Input validation for amounts, party IDs, auth
- Withdraw request validation
- Works with or without Stripe configured

### `tests/test-tips.js`
Peer-to-peer tipping test script.

### `tests/seed-data.cjs`
Seed data generator — registers 12 mock users and creates 24 parties with real-looking profile photos (pravatar.cc) and scenic party images (picsum.photos).

### `tests/cleanup.cjs`
Test data cleanup script.

### `tests/testaccounts.md`
Documentation of test accounts and their credentials.

---

## Platform-Specific Files

### Android (`/android/`)

Standard Capacitor Android project:
- `app/build.gradle` — App-level Gradle config
- `app/src/main/AndroidManifest.xml` — Permissions (geolocation, camera), activity declarations
- `app/src/main/java/com/waterparty/app/MainActivity.java` — Main activity extending CapacitorActivity
- `app/src/main/res/` — Resources: drawables, layouts, strings, styles
- `build.gradle` — Project-level Gradle config
- `settings.gradle` — Module settings
- `gradle.properties`, `variables.gradle` — Build configuration
- `gradlew` / `gradlew.bat` — Gradle wrapper

### iOS (`/ios/`)

Standard Capacitor iOS project:
- `App/App/AppDelegate.swift` — iOS app delegate
- `App/App/Assets.xcassets/` — App icon and splash assets
- `App/App/Base.lproj/` — LaunchScreen and Main storyboards
- `App/App/Info.plist` — App configuration (permissions, schemes)
- `App/App.xcodeproj/` — Xcode project file
- `App/CapApp-SPM/` — Swift Package Manager dependencies

---

## CI/CD

### `.github/workflows/ci.yml`
GitHub Actions workflow:
- Trigger: push to `main`
- Jobs: `web-build` (production assets), `android-build` (unsigned debug APK), `android-release` (signed release APK + AAB with keystore secrets), `ios-build` (simulator `.app`), `release` (GitHub Release with all artifacts)
- Uses `oven-sh/setup-bun@v2` — no Node.js needed

---

## Scripts

### `scripts/build-web.js`
Bun-based web bundling script (replaced former Vite config). Called by `build:web`. Produces optimized production bundle in `dist/assets/`. Injects AdMob ad unit IDs from environment variables.

### `scripts/dev-web.sh`
Development web server script. Starts CSS watcher + JS/TS watcher in parallel. Copies static assets on startup. Used by `dev:web`.

### `scripts/run-android-dev.sh`
Deploys to Android device via ADB: builds web, syncs Capacitor, runs on device. Handles Terabox cleanup, ADB reverse port forwarding.

### `scripts/generate-dist-package.js`
Generates `dist/package.json` with production-only dependencies (locked versions from root `package.json`). Chained after `build:server` for reproducible deployments.

### `scripts/seed-data.cjs`
Seed data generator (same as `tests/seed-data.cjs` — root copy for convenience). Registers mock users + creates parties for development/testing.
