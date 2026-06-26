# WaterParty 🌊🎉

A cross-platform party-matching app that lets users swipe to discover nearby parties, host their own events, and chat in real-time. Built with **React**, **Bun**, **Tailwind CSS v4**, and **Capacitor** for native iOS/Android deployment.

---

## 📱 Platforms

| Platform | Distribution |
|---|---|
| **Web** | [waterparty-react-14hr.onrender.com](https://waterparty-react-14hr.onrender.com) |
| **Android** | Signed APK + AAB via GitHub Actions CI |
| **iOS** | Simulator builds via GitHub Actions (device builds require Apple Developer account) |

---

## ✨ Features

- **Tinder-Style Swiping** — Discover parties near you with interactive card swiping
- **Rich Profiles** — Photos, bio, work/education, social links, and trust scores
- **Party Hosting** — Create events with geo-location, photos, vibe tags, and crowdfunding
- **Real-Time Chat** — WebSocket-powered party chats and direct messages
- **Photo Editing** — Built-in crop tool with 9:16 aspect ratio for profile photos
- **Crowdfunding** — Stripe-powered contributions with 6% platform fee
- **Dark Theme** — Premium dark UI with cyan/magenta/purple accents

---

## 🛠 Stack

| Layer | Technology |
|---|---|
| **Runtime** | Bun (runtime + package manager + bundler) |
| **Frontend** | React 19, TypeScript, Tailwind CSS v4 |
| **Routing** | React Router v7 |
| **Animation** | Motion (framer-motion) |
| **Mobile** | Capacitor (iOS + Android) |
| **Backend** | Hono (Bun-native web framework), TypeScript |
| **Database** | Turso (libSQL) — edge-hosted SQLite |
| **Auth** | Session-based (httpOnly cookies + x-session-token header) |
| **WebSocket** | Hono/Bun WebSocket (`createBunWebSocket`) |
| **Payments** | Stripe (payment intents + Connect) |
| **Image Processing** | sharp (server-side), Canvas API (client-side) |
| **CI/CD** | GitHub Actions |

---

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh) v1.2+ (install via `curl -fsSL https://bun.sh/install | bash`)
- Android Studio (for Android builds)
- Xcode (for iOS builds, macOS only)

### Installation

```bash
git clone <your-repo-url>
cd WaterParty-React
bun install
```

### Environment

Copy `.env.example` to `.env` and configure:

```env
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-turso-token
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLISHABLE_KEY=pk_...
PORT=3000
```

### Development

```bash
# Local dev server with hot-reload (http://localhost:3000)
bun run dev:server

# Build web + deploy to Android device via ADB
bun run dev:device
```

---

## 🏗 Project Structure

```
WaterParty-React/
├── .github/workflows/   # CI/CD pipelines
├── android/             # Android native project
├── ios/                 # iOS native project
├── src/
│   ├── components/      # Reusable UI components
│   ├── pages/           # Page-level components
│   ├── hooks/           # Custom React hooks
│   ├── lib/
│   │   ├── Store.tsx    # Global state (React Context + useReducer)
│   │   ├── types.ts     # TypeScript interfaces
│   │   ├── constants.ts # API URLs, session management
│   │   └── utils.ts     # Helpers (image compression, uploads)
│   ├── App.tsx          # Root component with routing
│   ├── main.tsx         # Entry point
│   └── index.css        # Global styles + Tailwind
├── scripts/
│   └── run-android-dev.sh  # Android dev deployment script
├── server/
│   ├── index.ts         # Hono backend + Bun WebSocket server
│   ├── config.ts        # Environment config
│   ├── db.ts            # Turso/libSQL database client + migrations
│   ├── stripe-init.ts   # Stripe initialization
│   ├── telegram.ts      # Telegram bot notifications
│   ├── routes/          # API route handlers (Hono context pattern)
│   ├── middleware/       # Hono middleware (session, rate-limiter)
│   ├── ws/              # WebSocket handler (hono/bun WebSocket)
│   └── scheduler/       # Background jobs (payouts)
├── capacitor.config.ts  # Capacitor configuration
├── bun.lock             # Bun lockfile
├── package.json
└── README.md
```

---

## 📦 Build Pipeline

Everything is run through **Bun** — no npm, no Node.js required (except for Gradle/Xcode native builds).

| Command | What it does |
|---|---|
| `bun run dev:server` | Local dev server with `--hot` auto-reload on `http://localhost:3000` |
| `bun run dev:device` | Build web → sync Capacitor → deploy to Android device via ADB |
| `bun run build:capacitor` | CSS + Web bundle + Static copy (for mobile apps, no server) |
| `bun run build:render` | Full production build: CSS → Web → Assets → Server bundle |
| `bun run build` | Alias for `build:render` (used by CI and Render) |
| `bun run start` | Starts the production server (`bun run dist/server.cjs`) |
| `bun run clean` | Removes `dist/` |
| `bun run lint` | TypeScript type-check (`tsc --noEmit`) |

---

## 🤖 CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push to `main`:

| Job | Output |
|---|---|
| **web-build** | Production web assets (`dist/`) |
| **android-build** | Unsigned debug APK |
| **android-release** | Signed release APK + AAB (requires keystore secrets) |
| **ios-build** | iOS simulator `.app` bundle |
| **release** | GitHub Release with all artifacts |

All CI jobs use `oven-sh/setup-bun@v2` — no Node.js setup needed.

### Android Release Signing

To produce signed release builds, add these secrets to your GitHub repo:

| Secret | Description |
|---|---|
| `KEYSTORE_BASE64` | Base64-encoded keystore file |
| `KEYSTORE_PASSWORD` | Keystore password |
| `KEY_ALIAS` | Key alias (e.g. `waterparty`) |
| `KEY_PASSWORD` | Key password |

---

## 📄 Key API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/login` | User login (rate-limited) |
| POST | `/register` | User registration (rate-limited) |
| GET | `/api/feed` | Party feed (requires session) |
| GET | `/api/chats` | User's chat rooms |
| POST | `/api/chats/dm` | Create or find DM chat |
| GET | `/api/users/:id` | User profile |
| GET | `/api/party/:id` | Party details |
| POST | `/api/upload` | Image upload (multipart) |
| GET | `/api/media/:id` | Serve stored media |
| POST | `/api/reports` | Report a user |
| POST | `/api/create-payment-intent` | Stripe payment intent |
| POST | `/api/crowdfund/contribute` | Record contribution |
| POST | `/api/connect/onboarding` | Stripe Connect onboarding |
| GET | `/api/connect/status` | Stripe Connect status |
| POST | `/api/connect/withdraw` | Withdraw fundraiser balance |
| POST | `/api/logout` | Logout |

**WebSocket** at `/ws` — events: `GET_FEED`, `GET_CHATS`, `SWIPE`, `SEND_MESSAGE`, `CREATE_PARTY`, `UPDATE_PROFILE`, etc.

---

## 🔑 Session & Auth

- Sessions use httpOnly cookies + a `x-session-token` header fallback
- Session token is also stored in `localStorage` for WebSocket connections
- Sessions expire after 7 days of inactivity
- Rate limiting: 20 auth attempts per 15 minutes

---

## 📸 Image Processing

- Client-side: Canvas API compresses and center-crops profile photos to 9:16
- Server-side: sharp validates and crops uploaded images to 9:16, stores in Turso as BLOBs
- Images served via `/api/media/:id` with 1-year cache headers

---

## 📝 License

Apache 2.0
