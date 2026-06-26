# WaterParty Architecture Diagrams

> Mermaid.js diagrams documenting the full architecture of the WaterParty app.
> Generated from the live codebase — June 2026.

---

## 1. System Context (C4 Level 1)

```mermaid
graph TB
  title System Context — WaterParty

  User("User")
  subgraph "WaterParty App"
    WP("React SPA + Hono Server")
  end
  subgraph "External Services"
    TURSO("Turso/libSQL")
    STRIPE("Stripe")
    ADMOB("AdMob")
    TELEGRAM("Telegram Bot")
    PUSH("Push Notifications")
    LEAFLET("Leaflet / Nominatim")
  end

  User -->|"Uses via browser or native app"| WP
  WP -->|"Reads/writes data"| TURSO
  WP -->|"Payment processing, payouts, tips"| STRIPE
  WP -->|"Interstitial & rewarded ads"| ADMOB
  WP -->|"Admin alerts"| TELEGRAM
  WP -->|"FCM/APNs"| PUSH
  WP -->|"Map tiles & geocoding"| LEAFLET
```

---

## 2. Frontend Architecture

```mermaid
graph TB
  subgraph "React App (src/)"
    ENTRY["main.tsx (ReactDOM.createRoot)"]
    APP["App.tsx (Root)"]
    STORE["Store.tsx (Context + useReducer)"]
    ROUTER["React Router"]

    ENTRY --> APP

    subgraph "Providers (outer → inner)"
      direction LR
      P1["BrowserRouter"]
      P2["ThemeProvider"]
      P3["ToastProvider"]
      P4["StoreProvider"]
    end

    APP --> P1 --> P2 --> P3 --> P4

    subgraph "Pages"
      AUTH["AuthPage"]
      SWIPE["SwipePage"]
      MESSAGES["MessagesPage"]
      CHAT["ChatRoomPage → PartyChatPage / DmChatPage"]
      CREATE["CreatePartyPage"]
      PROFILE["ProfilePage"]
      WALLET["WalletPage"]
      ADMIN["AdminDashboard"]
      PRIVACY["PrivacyPage"]
    end

    subgraph "Components"
      BOTTOM_NAV["BottomNav"]
      PHOTO_CAR["PhotoCarousel"]
      CHAT_INPUT["ChatInputBar"]
      CHAT_LIGHTBOX["ChatLightbox"]
      USER_CARD["UserProfileCard"]
      SOCIAL_ICONS["SocialIcons"]
      PHOTO_EDITOR["PhotoEditor"]
      CAMERA_CAP["CameraCapture"]
      TIP_MODAL["TipModal"]
      FUNDRAISER["FundraiserContributeModal"]
      REPORT_MODAL["ReportUserModal"]
      VIDEO_CARD["VideoCard"]
      CAROUSEL["Carousel"]
    end

    subgraph "Hooks"
      HK_CHAT["useChatRoom"]
      HK_CAMERA["useCamera"]
      HK_ADMOB["useAdMob"]
      HK_BACK["useBackButton"]
      HK_PUSH["usePushNotifications"]
      HK_TOAST["useToast"]
    end

    subgraph "Lib"
      LIB_CONSTANTS["constants.ts (API, session, cache)"]
      LIB_STORE["Store.tsx (state management)"]
      LIB_TYPES["types.ts (User, Party, Chat, Message)"]
      LIB_UTILS["utils.ts (cn, upload, compress)"]
      LIB_SANITIZE["sanitize.ts (XSS prevention)"]
      LIB_THEME["theme.ts (design tokens)"]
      LIB_THEME_CTX["ThemeContext.tsx (dark/light)"]
      LIB_CAPACITOR["capacitor.ts (native API wrappers)"]
      LIB_LOGGER["logger.ts (env-aware logging)"]
      LIB_CACHE["cache.ts (IndexedDB layer)"]
      LIB_INDEX["index.ts (barrel re-exports)"]
    end

    ROUTER --> AUTH
    ROUTER --> SWIPE
    ROUTER --> MESSAGES
    ROUTER --> CHAT
    ROUTER --> CREATE
    ROUTER --> PROFILE
    ROUTER --> WALLET
    ROUTER --> ADMIN
    ROUTER --> PRIVACY

    SWIPE --> PHOTO_CAR
    SWIPE --> USER_CARD
    SWIPE --> CAROUSEL

    CHAT --> HK_CHAT
    HK_CHAT --> CHAT_INPUT
    HK_CHAT --> CHAT_LIGHTBOX
    HK_CHAT --> VIDEO_CARD
    HK_CHAT --> REPORT_MODAL
    HK_CHAT --> CAMERA_CAP
    CHAT --> USER_CARD

    CREATE --> PHOTO_EDITOR
    CREATE --> CAMERA_CAP

    PROFILE --> PHOTO_CAR
    PROFILE --> PHOTO_EDITOR
    PROFILE --> SOCIAL_ICONS

    MESSAGES --> BOTTOM_NAV
    SWIPE --> BOTTOM_NAV
    PROFILE --> BOTTOM_NAV

    TIP_MODAL --> STORE
    FUNDRAISER --> STORE
    REPORT_MODAL --> STORE

    APP --> HK_BACK
    APP --> HK_PUSH
    APP --> HK_ADMOB
    APP --> HK_TOAST

    STORE --> LIB_CONSTANTS
    STORE --> LIB_TYPES
    PAGES --> LIB_UTILS
    PAGES --> SOCIAL_ICONS
    PAGES --> USER_CARD
    PAGES --> PHOTO_CAR
    PAGES --> PHOTO_EDITOR
    PAGES --> CAMERA_CAP
  end

  style ENTRY fill:#1a1a2e,stroke:#00d2ff
  style STORE fill:#1a1a2e,stroke:#ff3b5c
```

---

## 3. Backend Architecture

```mermaid
graph TB
  subgraph "Hono Server (server/)"
    ENTRY["index.ts (Hono + Bun serve)"]
    DB["db.ts (Turso client + migrations)"]
    HELPERS["helpers.ts (data enrichment)"]
    CONFIG["config.ts (env loader)"]
    STRIPE["stripe-init.ts"]
    TELEGRAM["telegram.ts"]
    PUSH["push.ts"]

    subgraph "Middleware"
      SESSION["session.ts (cookie + x-session-token)"]
      RATE_LIMIT["rate-limiter.ts (Turso-backed)"]
    end

    subgraph "HTTP Routes"
      AUTH["POST /login"]
      REGISTER["POST /register"]
      LOGOUT["POST /api/logout"]
      DELETE_ACCT["DELETE /api/account"]
      USERS["GET /api/users/:id"]
      PARTIES_1["GET /api/feed"]
      PARTIES_2["GET /api/party/:id"]
      PARTIES_3["GET /api/parties?ids="]
      CHATS_1["GET /api/chats"]
      CHATS_2["POST /api/chats/dm"]
      CHATS_3["GET /api/chats/:id/messages"]
      UPLOAD["POST /api/upload"]
      PAYMENTS_1["POST /api/create-payment-intent"]
      PAYMENTS_2["POST /api/crowdfund/contribute"]
      TIPS_1["POST /api/create-tip-intent"]
      CONNECT["POST /api/connect/onboarding"]
      REPORTS["POST /api/reports"]
      ADMIN["Admin endpoints"]
      NOTIFICATIONS["POST /api/push/register"]
      WEBHOOK["POST /api/webhook (Stripe)"]
      HEALTH["GET /api/health"]
    end

    subgraph "WebSocket (ws/handler.ts)"
      WS["/ws endpoint"]
      WS_AUTH["Session validation"]
      WS_DISPATCH["Event dispatcher (switch)"]
      WS_CLIENTS["wsClients Set<{ws, userId}>"]

      WS_EVENTS["Events:
        • GET_FEED / GET_CHATS
        • SWIPE / SEND_MESSAGE
        • CREATE_PARTY / UPDATE_PROFILE
        • DELETE_CHAT / DELETE_PARTY
        • DELETE_ACCOUNT
        • CREATE_DM / APPROVE_JOIN_REQUEST
        • GET_REGISTRATIONS
        • UPDATE_LOCATION"]
    end

    subgraph "Scheduler"
      PAYOUT["payout.ts (Stripe Connect payouts)"]
    end

    ENTRY --> DB
    ENTRY --> CONFIG
    ENTRY --> HELPERS
    ENTRY --> STRIPE
    ENTRY --> TELEGRAM
    ENTRY --> PUSH
    ENTRY --> SESSION
    ENTRY --> RATE_LIMIT
    ENTRY --> AUTH
    ENTRY --> REGISTER
    ENTRY --> LOGOUT
    ENTRY --> DELETE_ACCT
    ENTRY --> USERS
    ENTRY --> PARTIES_1
    ENTRY --> PARTIES_2
    ENTRY --> PARTIES_3
    ENTRY --> CHATS_1
    ENTRY --> CHATS_2
    ENTRY --> CHATS_3
    ENTRY --> UPLOAD
    ENTRY --> PAYMENTS_1
    ENTRY --> PAYMENTS_2
    ENTRY --> TIPS_1
    ENTRY --> CONNECT
    ENTRY --> REPORTS
    ENTRY --> ADMIN
    ENTRY --> NOTIFICATIONS
    ENTRY --> WEBHOOK
    ENTRY --> HEALTH
    ENTRY --> WS
    ENTRY --> PAYOUT

    WS --> WS_AUTH --> WS_DISPATCH
    WS_DISPATCH --> WS_CLIENTS
    WS_DISPATCH --> WS_EVENTS
  end

  subgraph "External Services"
    TURSO[("Turso / libSQL")]
    STRIPE_SVC["Stripe API"]
    TELEGRAM_SVC["Telegram Bot API"]
    CAPACITOR_PS["Capacitor Push Notifications"]
  end

  DB --> TURSO
  HELPERS --> TURSO
  STRIPE --> STRIPE_SVC
  PAYMENTS_1 --> STRIPE_SVC
  PAYMENTS_2 --> STRIPE_SVC
  TIPS_1 --> STRIPE_SVC
  CONNECT --> STRIPE_SVC
  WEBHOOK --> STRIPE_SVC
  TELEGRAM --> TELEGRAM_SVC
  PUSH --> CAPACITOR_PS

  style WS fill:#2d1b69,stroke:#7042f8
  style ENTRY fill:#1a1a2e,stroke:#00d2ff
  style DB fill:#0d2818,stroke:#00d2ff
```

---

## 4. Data Flow — Key User Journeys

### 4a. Login / Registration

```mermaid
sequenceDiagram
  actor User
  participant AuthPage
  participant Store
  participant Server as Hono Server
  participant Turso
  participant Stripe

  alt Login
    User->>AuthPage: Enter email + password
    AuthPage->>Server: POST /login {email, password}
    Server->>Turso: SELECT * FROM users WHERE email = ?
    Server->>Server: bcrypt.compareSync(password, hash)
    Server->>Turso: INSERT INTO sessions (UserID, ExpiresAt)
    Server->>AuthPage: 200 {user, sessionId}
    AuthPage->>Store: storeSessionToken(sessionId)
    AuthPage->>Store: initializeApp(user, chats, feed)
    Store->>Turso: GET /api/chats (via HTTP)
    Store->>Turso: GET /api/feed (via HTTP)
    Store->>Server: WebSocket connect (with session)
    Server->>Store: WS FEED_UPDATE, CHATS_LIST
    Store->>AuthPage: Render main app
  else Registration
    User->>AuthPage: Fill name, email, password, photos
    AuthPage->>AuthPage: Compress & convert photos to base64
    AuthPage->>Server: POST /register {user, password}
    Server->>Turso: Check duplicate email
    Server->>Server: sharp-process photos → base64 → BLOB insert
    Server->>Server: bcrypt.hashSync(password, 10)
    Server->>Turso: INSERT INTO users
    Server->>Turso: INSERT INTO sessions
    Server->>Telegram: Send notification
    Server->>AuthPage: 200 {user, sessionId}
    AuthPage->>Store: initializeApp(user, chats, feed)
  end
```

### 4b. Swipe & Party Discovery

```mermaid
sequenceDiagram
  actor User
  participant SwipePage
  participant Store
  participant Server as WS Handler
  participant Turso

  User->>SwipePage: Load feed
  SwipePage->>Store: Load cached feed from IndexedDB
  Store->>SwipePage: Render cached parties instantly
  Store->>Server: WS GET_FEED {Lat, Lon}
  Server->>Turso: SELECT * FROM parties
  Server->>Turso: SELECT registrations (exclude joined)
  Server->>Turso: SELECT swipes (exclude swiped)
  Server->>SwipePage: WS FEED_UPDATE (filtered, sorted)
  SwipePage->>Store: dispatch SET_FEED

  User->>SwipePage: Swipe RIGHT (like)
  SwipePage->>Server: WS SWIPE {PartyID, Direction: 'right'}
  Server->>Turso: INSERT INTO swipes
  Server->>Turso: INSERT INTO registrations (PENDING)

  User->>SwipePage: View party detail
  SwipePage->>SwipePage: Show Party Detail Overlay
  User->>SwipePage: Tap "Send Message"
  SwipePage->>Server: WS CREATE_DM {TargetUserID}
  Server->>Turso: Find or create DM chat
  Server->>SwipePage: WS DM_CREATED {ChatID}
  SwipePage->>User: Navigate to /chat/:chatId
```

### 4c. Real-time Messaging

```mermaid
sequenceDiagram
  actor Alice
  actor Bob
  participant DmChatPage
  participant Store
  participant Server as WS Handler
  participant Turso
  participant Push as Push Notifications

  Alice->>DmChatPage: Type message + tap Send
  DmChatPage->>DmChatPage: Optimistic update (local state)
  DmChatPage->>Store: addLocalChat (update preview)
  DmChatPage->>Server: WS SEND_MESSAGE {ChatID, Content}
  Server->>Turso: INSERT INTO messages
  Server->>Turso: UPDATE chats SET RecentMessages
  Server->>Store: WS NEW_MESSAGE (to Alice & Bob)

  alt Bob is online
    Server->>Bob's WS: WS NEW_MESSAGE {message}
  else Bob is offline
    Server->>Push: Send push notification to Bob
    Push->>Bob: "Alice: [message]"
  end

  Bob->>DmChatPage: Opens chat
  DmChatPage->>Server: GET /api/chats/:id/messages?limit=100
  Server->>Turso: SELECT * FROM messages WHERE ChatID = ?
  Server->>DmChatPage: Message history (enriched with sender names)
```

### 4d. Payment Flow (Crowdfund Contribution)

```mermaid
sequenceDiagram
  actor User
  participant PartyChat
  participant FundModal as FundraiserContributeModal
  participant Server
  participant Stripe
  participant Turso

  User->>PartyChat: Tap "Contribute" button
  PartyChat->>FundModal: Open modal
  User->>FundModal: Enter amount + payment details
  FundModal->>Server: POST /api/create-payment-intent {amount, partyId}
  Server->>Turso: Check party exists + target not exceeded
  Server->>Stripe: stripe.paymentIntents.create({amount, currency})
  Stripe->>Server: Return client_secret
  Server->>FundModal: 200 {clientSecret, publishableKey}

  FundModal->>Stripe: stripe.confirmCardPayment(clientSecret)
  Stripe->>FundModal: Payment succeeds

  FundModal->>Server: POST /api/crowdfund/contribute {pi_id, partyId, amount}
  Server->>Stripe: Verify PaymentIntent status
  Server->>Turso: INSERT INTO crowdfund_contributions
  Server->>Turso: UPDATE parties SET CrowdfundCurrent += amount
  Server->>PartyChat: Broadcast FEED_UPDATE to all WS clients
  FundModal->>User: Show success UI
```

---

## 5. Database Schema (Entity-Relationship)

```mermaid
erDiagram
  users {
    string ID PK
    string RealName
    string Email UK
    string Password
    string ProfilePhotos "JSON array of media IDs"
    float TrustScore
    string Thumbnail
    string Bio
    string Instagram
    string Twitter
    string VK
    string Telegram
    string WhatsApp
    string Facebook
    string Gender
    string Birthday
    string JobTitle
    string Company
    string School
    string Degree
    int ShowEmail
    int IsAdmin
    float Balance
    string StripeCustomerID
    string StripeAccountID
    string StripePaymentMethodIDs "JSON array"
    float Latitude
    float Longitude
    int HostedCount
    float HostingRating
    int Reach
  }

  sessions {
    string ID PK
    string UserID FK
    string CreatedAt
    string ExpiresAt
    int Revoked
  }

  parties {
    string ID PK
    string HostID FK
    string Title
    string Description
    string PartyPhotos "JSON array"
    string StartTime
    int DurationHours
    string Status
    string Address
    string City
    float GeoLat
    float GeoLon
    int MaxCapacity
    int CurrentGuestCount
    string VibeTags "JSON array"
    string Rules "JSON array"
    string ChatRoomID
    string Thumbnail
    float CrowdfundTarget
    float CrowdfundCurrent
    string CrowdfundCurrency
    string PartyType
    string PartyDate
    int FundsReleased
    int PayoutRetries
    string LastPayoutAttempt
  }

  chats {
    string ID PK
    string PartyID "DM for direct messages"
    string Title
    string ImageUrl
    string RecentMessages "JSON array (last message)"
    int IsGroup "0=DM, 1=group"
    string ParticipantIDs "JSON array"
  }

  chat_participants {
    string ChatID PK, FK
    string UserID PK, FK
  }

  messages {
    string ID PK
    string ChatID FK
    string SenderID FK
    string Content
    string ImageUrl
    string VideoUrl
    string CreatedAt
  }

  registrations {
    string ID PK
    string PartyID FK
    string UserID FK
    string Status "PENDING | APPROVED"
    string Timestamp
  }

  swipes {
    string ID PK
    string UserID FK
    string PartyID FK
    string Direction "left | right"
    string Timestamp
  }

  media {
    string ID PK
    blob Data "NULL for large files"
    string MimeType
    string FileName
    string CreatedAt
  }

  media_chunks {
    string MediaID PK, FK
    int ChunkIndex PK
    blob Data
  }

  crowdfund_contributions {
    string ID PK
    string PartyID FK
    string UserID FK
    float Amount
    float OriginalAmount
    float PlatformFee
    string StripePaymentIntentID UK
    string CreatedAt
    string Status
  }

  tips {
    string ID PK
    string SenderID FK
    string ReceiverID FK
    float Amount
    string Currency
    string StripePaymentIntentID
    string CreatedAt
  }

  user_reports {
    string ID PK
    string ReporterID FK
    string ReportedUserID FK
    string Reason
    string Details
    string Timestamp
  }

  push_tokens {
    string UserID PK, FK
    string Token PK
    string Platform
    string CreatedAt
    string UpdatedAt
  }

  party_boosts {
    string ID PK
    string PartyID FK
    string UserID FK
    string BoostType
    string CreatedAt
    string ExpiresAt
    int Active
  }

  withdrawal_requests {
    string ID PK
    string PartyID FK
    string UserID FK
    float Amount
    string Status
    string StripeTransferID
    string CreatedAt
  }

  rate_limits {
    string Key PK
    int Count
    int ResetAt
  }

  users ||--o{ sessions : "has"
  users ||--o{ messages : "sends"
  users ||--o{ parties : "hosts"
  users ||--o{ registrations : "submits"
  users ||--o{ swipes : "swipes"
  users ||--o{ crowdfund_contributions : "contributes"
  users ||--o{ tips : "sends/receives"
  users ||--o{ push_tokens : "registers"
  users ||--o{ user_reports : "reports"
  parties ||--o{ registrations : "receives"
  parties ||--o{ crowdfund_contributions : "funds"
  parties ||--o{ party_boosts : "boosted by"
  chats ||--o{ messages : "contains"
  chats ||--o{ chat_participants : "has participant"
  users ||--o{ chat_participants : "participates in"
  media ||--o{ media_chunks : "chunked into"
  parties ||--o{ withdrawal_requests : "has"
```

---

## 6. Build & Deploy Pipeline

```mermaid
graph LR
  subgraph "Build Pipeline"
    CSS["bunx @tailwindcss/cli\nindex.css → dist/assets/index.css"]
    WEB["bun run scripts/build-web.js\nmain.tsx → dist/assets/main.js"]
    COPY["cp index.html, public/*,\nbranding.jpg, font → dist/"]
    SERVER["bun build server/index.ts\n--outfile=dist/server.cjs\n--packages=external"]
    PKG_JSON["bun run generate-dist-package.js\ndist/package.json"]
  end

  CI["GitHub Actions CI\n(.github/workflows/ci.yml)"]

  subgraph "Deploy Artifacts"
    WEB_BUILD["Web: dist/ (SPA + server)"]
    ANDROID_DEBUG["Android: unsigned debug APK"]
    ANDROID_RELEASE["Android: signed release APK + AAB"]
    IOS_BUILD["iOS: simulator .app"]
  end

  CSS --> WEB --> COPY --> WEB_BUILD
  COPY --> SERVER --> PKG_JSON --> WEB_BUILD
  WEB_BUILD --> CI
  CI --> ANDROID_DEBUG
  CI --> ANDROID_RELEASE
  CI --> IOS_BUILD
```

---

## 7. Component Tree (React Hierarchy)

```mermaid
graph TB
  APP["<App />"]
  AUTH["<AuthPage />"]
  MAIN["<MainApp />"]

  subgraph "When not authenticated"
    AUTH
  end

  subgraph "When authenticated"
    SWIPE["<SwipePage />"]
    MESSAGES["<MessagesPage />"]
    CHAT_ROOM["<ChatRoomPage />"]
    DM["<DmChatPage />"]
    PARTY_CHAT["<PartyChatPage />"]
    CREATE["<CreatePartyPage />"]
    PROFILE["<ProfilePage />"]
    WALLET["<WalletPage />"]
    ADMIN["<AdminDashboard />"]
    PRIVACY["<PrivacyPage />"]
    BOTTOM_NAV["<BottomNav />"]

    PROFILE --> PROFILE_VIEW["ProfileViewContent (memoized)"]
    PROFILE --> PHOTO_EDITOR["<PhotoEditor />"]

    DM --> DM_SIDEBAR["renderDmSidebar"]
    DM --> CAMERA["<CameraCapture />"]
    DM --> LIGHTBOX["<ChatLightbox />"]
    DM --> REPORT["<ReportUserModal />"]
    DM --> TIP["<TipModal />"]
    DM --> CHAT_INPUT["<ChatInputBar />"]

    PARTY_CHAT --> FUND["<FundraiserContributeModal />"]
    PARTY_CHAT --> CAMERA2["<CameraCapture />"]
    PARTY_CHAT --> LIGHTBOX2["<ChatLightbox />"]
    PARTY_CHAT --> REPORT2["<ReportUserModal />"]
    PARTY_CHAT --> CHAT_INPUT2["<ChatInputBar />"]

    SWIPE --> SWIPE_CARD["SwipeCard (memoized)"]
    SWIPE --> PARTY_DETAIL["PartyDetailOverlay"]
    SWIPE --> USER_CARD_OVERLAY["UserProfileOverlay"]
    SWIPE --> PHOTO_CAR["<PhotoCarousel />"]
  end

  APP --> AUTH
  APP --> MAIN

  subgraph "Providers (wrap MAIN)"
    PROVIDERS["Router > ThemeProvider > ToastProvider > StoreProvider"]
    APP --> PROVIDERS --> MAIN
  end

  style AUTH fill:#2d1b69,stroke:#7042f8
  style APP fill:#1a1a2e,stroke:#ff3b5c
```
