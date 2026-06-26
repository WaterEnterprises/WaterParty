# WaterParty — One-Page Investor Summary

**Tagline:** *Swipe into the party. Meet people. Have fun.*

**Umbrella:** A product of **Water Enterprises** (Stellarium Foundation) — alongside Water AI, humanoid robotics, and decentralized compute. Mission: *Elevation to Eden.*

---

## The Problem

Finding spontaneous, real-world social events near you is still broken. Facebook Events is cluttered with ads and irrelevant suggestions. Meetup is rigid (RSVPs weeks in advance). Bumble BFF feels transactional. There is **no app that combines real-time discovery, social trust, and frictionless transactions** for the 18–35 nightlife and social-event market.

## The Solution

WaterParty is a **Tinder-style mobile app for parties and social events**. Users swipe through nearby parties, RSVP instantly, chat with attendees, and participate in the event's economy — all in one place.

### Core Features

| Feature | Description |
|---|---|
| **Swipe Discovery** | Tinder-style card swiping to discover parties near you |
| **Host & Create** | Anyone can throw a party — set time, location, guest list, and vibe |
| **In-App Chat** | Per-party chat rooms for attendees and hosts |
| **Tips & Tipping** | Send monetary tips to hosts or attendees via Stripe |
| **Crowdfunding** | Raise money for parties collectively — shared financial goal |
| **Currency Auto-Detect** | GPS-based currency detection (BRL, USD, EUR, GBP) — seamless global use |
| **Rich Profiles** | Bio, photos, social links (IG, X, VK, Telegram, WhatsApp, FB), verifiable trust scores |
| **Push Notifications** | Real-time alerts for new parties, messages, and followers |
| **AdMob Integration** | Monetization via interstitial and rewarded ads |

## Market Opportunity

- **Total Addressable Market:** $150B+ global nightlife and event industry
- **Target Demographic:** 18–35 year olds in urban areas — smartphone-native, social, experience-seeking
- **Key Verticals:** Student parties, nightlife events, pop-up socials, festivals, community gatherings
- **Competitive Gap:** No incumbent combines **real-time discovery + social profiles + integrated payments + currency-aware transactions** globally

## Business Model

| Stream | Mechanism |
|---|---|
| **Tipping Fees** | Small % fee on monetary tips (Stripe payment intents) |
| **Crowdfunding Fee** | % fee on party crowdfunding campaigns |
| **Promoted Parties** | Paid placement in swipe queue (future) |
| **Ad Revenue** | Google AdMob interstitials and rewarded ads |
| **Premium Hosting** | Subscription tier for power hosts with analytics and promo tools (future) |

## Traction & Milestones

- ✅ Fully functional MVP — swipe, chat, create, tip, crowdfund
- ✅ Cross-platform: **iOS (Capacitor)** and **Android (Capacitor)** builds via CI
- ✅ **Stripe Connect & Payment Intents** integrated end-to-end
- ✅ Multi-currency support with **automatic GPS-based detection**
- ✅ Session-based auth with WebSocket real-time communication
- ✅ Edge-hosted database (Turso/libSQL) — globally low-latency
- ✅ GitHub Actions CI producing signed APK/AAB + iOS simulator builds

## Technology Stack

| Layer | Technology |
|---|---|
| **Runtime** | Bun (run, bundle, test) |
| **Frontend** | React 19 + TypeScript + Tailwind CSS v4 |
| **Mobile** | Capacitor 8 (iOS + Android) |
| **Backend** | Hono 4 (Bun-native HTTP + WebSocket) |
| **Database** | Turso (libSQL — edge-distributed SQLite) |
| **Payments** | Stripe (PaymentIntents + Connect) |
| **Auth** | Session-based (httpOnly cookies) |
| **CI/CD** | GitHub Actions |
| **Animations** | Motion (framer-motion) |

## Team & Ask

WaterParty was built by a lean, execution-focused team under **Water Enterprises** — the social utility arm of the **Stellarium Foundation** (founded by John Victor). The Foundation's mission is the **"Elevation to Eden"** — leveraging technology for global prosperity and human advancement. WaterParty sits alongside **Water AI** (the unified AI Supermodel / AGI platform), humanoid robotics, and decentralized compute initiatives under the same umbrella.

We are currently seeking **early-stage investment** to:

1. **Scale user acquisition** — targeted campus and nightlife marketing
2. **Expand feature set** — host analytics, in-app ticketing, event discovery algorithms
3. **Grow to new cities** — localization for international markets with multi-currency support already built in

**Let's talk.**

📧 water.enterprises.org@gmail.com  
🔗 waterparty.app

Reach out to discuss how WaterParty can redefine spontaneous social discovery.

---

*Built with React 19 · Bun · Turso · Stripe · Capacitor · Deployed globally*

*WaterParty is a product of **Water Enterprises** — Stellarium Foundation*
