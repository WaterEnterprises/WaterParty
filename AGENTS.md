# WaterParty React — Agent Guide

## Commands

| Command | Purpose |
|---|---|
| `bun run dev:server` | Local Hono server at `localhost:3000`, auto-reloads |
| `bun run dev:web` | Watch-mode frontend rebuild (requires `dev:server` running) |
| `bun run dev:device` | Build + ADB-deploy to Android device |
| `bun run lint` | `tsc --noEmit` — **only checks `src/`, NOT server code** |
| `bun run lint:eslint` | ESLint across whole repo |
| `bun run build` | Full production build (`build:render`) |
| `bun run start` | Production server from `dist/` |
| `bun run clean` | Remove `dist/` |
| `npx tsx tests/...` | Run test scripts (need server running) |
| `node scripts/seed-data.cjs` | Seed 12 users + 24 parties (need server running; password: `password123`) |

## Architecture

- **Frontend** (`src/`): React 19 SPA. Entry `src/main.tsx` → `App.tsx` (routing). State via React Context + `useReducer` (`src/lib/Store.tsx`). CSS via Tailwind v4 (`@import "tailwindcss"`, NOT `@tailwind` directives).
- **Backend** (`server/`): Hono + Bun WebSocket. Entry `server/index.ts`. DB migrations auto-run on startup (`runMigrations()` in `db.ts`). Routes in `routes/`, middleware in `middleware/`, WS in `ws/handler.ts`.
- **DB**: Turso (libSQL) — edge-hosted SQLite. Client in `server/db.ts`.
- **Mobile**: Capacitor 8 (iOS + Android), config in `capacitor.config.ts`, `webDir: "dist"`.
- **Two tsconfigs**: root (`src/` only), `server/tsconfig.json` (server code). `tsc --noEmit` ignores server.

## Build Pipeline

1. `build:css` — `bunx @tailwindcss/cli` → `dist/assets/index.css`
2. `build:web` — Bun bundles `src/main.tsx` → `dist/assets/`
3. Static copy (`index.html`, `public/*`, branding, font)
4. `build:server` — Bun bundles `server/index.ts` → `dist/server.cjs` (`--target=bun --packages=external`)
5. `generate-dist-package.js` — minimal `dist/package.json` with prod deps

## Auth & Session

- httpOnly cookie + `x-session-token` header + `localStorage` fallback
- Session token stored in `localStorage` key `waterparty_session_id`
- WebSocket connects via `/ws?session=<token>` or `/ws?uid=<ID>`

## Testing

- **No test framework** — scripts are plain JS/TS files run via `npx tsx` against a running server.
- `tests/payment-endpoints.test.ts`, `tests/test-*.js` — manual smoke tests.
- Test accounts documented in `tests/testaccounts.md` (password: `password123`).

## Key Quirks

- Tailwind **v4** — uses `@import "tailwindcss"`, CLI is `@tailwindcss/cli`, NOT PostCSS plugin.
- Server uses Bun's native bundler, not tsc. ESLint ignores `dist/`, `android/`, `ios/`, `scripts/`, `*.cjs`.
- Caching layer (`src/lib/cache.ts`) uses Capacitor Filesystem on native, IndexedDB fallback on web.
- `cn()` utility (`src/lib/utils.ts`) combines `clsx` + `tailwind-merge`.
- Design tokens defined as CSS custom properties in `src/index.css` — dark theme default, `.light` class toggles.
- AdMob IDs injected at build time via `scripts/build-web.js` `define` — using Google test IDs as defaults.
- Rate limiting: Turso-backed, defaults double in development mode.
