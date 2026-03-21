---
name: run-and-test-marketplace
description: Run the Lost Tales Marketplace Vite app, configure Firebase and emulators, sign in, and manually verify collection, market, and Cloud Functions. Use when bootstrapping a Cloud agent session, fixing env issues, or testing without an automated framework.
---

# Run and test this codebase (Cloud agent starter)

This repository has **no automated test runner yet** (no Jest/Vitest/pytest in `package.json`). Validation is **manual**: start the app, use Firebase (real project or emulators), and exercise routes and callable functions.

## Prerequisites

- **Node.js**: use **18+** for `frontend/` (see `frontend/README.md`). `functions/` declares **Node 24** in `engines` for deployment; local edits can use a compatible Node if the Functions runtime matches your Firebase project.
- **npm**: install dependencies per package (`frontend`, `functions`).
- **Firebase CLI** (for emulators and deploys): install globally or invoke with `npx firebase-tools` (not pinned in this repo).

## Quick start: run the UI

```bash
cd frontend
npm install
npm run dev
```

- Default Vite URL is printed in the terminal (typically `http://localhost:5173`).
- **Production-like bundle** (optional sanity check): `npm run build` then `npm run preview`.

## Environment variables (`frontend/`)

1. Copy `frontend/.env.example` → `frontend/.env` (or `.env.local`; Vite loads `.env`, `.env.local`, and mode-specific files).
2. Set **all** `VITE_FIREBASE_*` keys from the Firebase console (Project settings). If any value is missing, `src/lib/firebase.js` treats Firebase as **unconfigured**: the app still loads, but **auth and Firestore/Functions are disabled** (`auth`, `db`, `functions` are `null`).
3. **Emulators**: set `VITE_USE_EMULATORS=true` and point host/port vars as in `.env.example`. See `frontend/.env.emulator.example`; if you use a custom filename like `.env.emulator`, start Vite with an explicit mode, e.g. `npm run dev -- --mode emulator` (per comment in that file).

Emulator ports match `firebase.json`: Auth **9099**, Firestore **8080**, Functions **5001**, Emulator UI **4000**.

### Start Firebase Emulator Suite (from repo root)

```bash
cd /workspace   # or repository root
npx firebase-tools emulators:start
```

Start emulators **before** or **with** the frontend when `VITE_USE_EMULATORS=true`. Keep **the same `projectId`** in `.env` as in `.firebaserc` so callable names and config stay consistent.

## Feature flags and toggles

There is **no feature-flag system** (no Remote Config / LaunchDarkly-style usage) in the codebase today. The only runtime switches are **Vite env vars** read via `import.meta.env` (see `src/lib/firebase.js` for `VITE_USE_EMULATORS` and emulator endpoints).

**How to mock or branch behavior until flags exist:**

- Prefer **`VITE_*` variables** and read them in the feature you are testing (then document the variable in `.env.example` when you add it).
- For quick UI-only checks, use **React state**, **query params**, or **localStorage** in dev only—do not rely on these for production behavior without a deliberate design.

To discover existing env usage: search for `import.meta.env` and `VITE_` under `frontend/src/`.

## Sign-in and session testing

1. Configure a Firebase project with **Email/Password**, **Google**, and **GitHub** providers (see `frontend/README.md`).
2. Routes: **`/auth/login`**, **`/auth/register`**, **`/auth/forgot`**.
3. **Quick sign-in** modal is available from the nav when logged out (`AuthModalContext`).
4. With **Auth emulator**, create users from the Emulator UI (port **4000**) or sign up through the app; sessions use `browserLocalPersistence` (`firebase.js`).

**Protected surfaces** (wrapped with `AuthGuard` in page components): **`/collections`** (Collection), **`/account`**. Unauthenticated visitors are redirected to **`/auth/login`**.

Note: `frontend/src/pages/Offers/` exists but is **not mounted** in `App.jsx` routes yet—do not assume `/offers` works until a route is added.

## Workflows by codebase area

### Root: Firebase project metadata

| Goal | Steps |
|------|--------|
| Confirm default Firebase project | Read `.firebaserc` (`default` project id). |
| Emulator layout | Read `firebase.json` (`firestore`, `functions`, `emulators`). |
| Rules / indexes | Edit `firestore.rules`, `firestore.indexes.json`; validate with emulators or `firebase deploy --only firestore` when credentials exist. |

### `frontend/` — shell, routing, static pages

| Goal | Steps |
|------|--------|
| Smoke test navigation | Run `npm run dev`, click nav links in `App.jsx` (`/`, `/collectibles`, `/collections`, `/market`, `/account`, auth routes). |
| 404 | Visit an unknown path; expect `NotFound`. |
| Build health | `npm run build` (catches compile errors). |

### `frontend/src/data/` and Collectibles UI

| Goal | Steps |
|------|--------|
| Browse catalog | Open **`/collectibles`**; data comes from bundled story data (`collectibles.js` / JSON), not Firestore. |
| Detail URLs | Use `/collectibles/:collectibleId` and optional `/:skuId` (see routes in `App.jsx`). |

### `frontend/` — user Collection (Firestore)

| Goal | Steps |
|------|--------|
| Requires | Firebase configured, user signed in; Firestore rules in `firestore.rules` (`collections/{entryId}` keyed by `ownerUid`). |
| Manual test | Sign in → **`/collections`**. Add/edit entries; confirm reads/writes only for the signed-in user (try two accounts in two browser profiles or emulator). |

### `frontend/` — Market (listings + callables)

| Goal | Steps |
|------|--------|
| Listings | **`/market`** subscribes to `listings` with `status == 'OPEN'` (`lib/marketplace/listings.js`). Create/cancel listings use **client Firestore**; rules enforce shape and creator. |
| Accept listing | Calls callable **`acceptListing`** (`httpsCallable(functions, 'acceptListing')`). Requires **Cloud Functions** (production or **Functions emulator**). Use **two users**: one creates an OPEN listing, the other accepts. |
| Verify trade row | After accept, **`/account`** loads trades for the current user (participants). |

### `frontend/` — Account / trades

| Goal | Steps |
|------|--------|
| See trades | Sign in as buyer or seller → **`/account`**. |
| Update trade status | UI calls callable **`updateTradeStatus`** (`lib/marketplace/tradesClient.js`). Only **PENDING** trades; status **COMPLETED** or **CANCELLED** (see `functions/index.js`). |

### `functions/` — Cloud Functions (callable)

| Goal | Steps |
|------|--------|
| Local run | From repo root: `npx firebase-tools emulators:start` (includes Functions on **5001**). Ensure `frontend` has `VITE_USE_EMULATORS=true` and functions emulator host/port set. |
| Inspect logic | Read `functions/index.js` (`acceptListing`, `updateTradeStatus`) for validation and Firestore transaction behavior. |
| Isolated reasoning | There is no test harness here yet; use emulator + frontend, or add a small Node script with the Firebase Admin SDK **only if** you also wire security rules / emulator data appropriately. |

### `firestore.rules`

| Goal | Steps |
|------|--------|
| Rules behavior | With emulators, attempt forbidden writes from the app or Firebase console in the Emulator UI to confirm denials. |
| Listings | Public read; create/update constrained to documented fields (see comments in rules for cancel vs accept path). |
| Trades | Client **cannot** create/update trades directly—only via callables. |

## When you discover a new runbook step

Keep this skill **minimal but accurate**:

1. **Add or adjust a row** in the workflow table for the area you touched (`frontend`, `functions`, Firebase config, etc.).
2. If you introduced a **new env var** or **port**, document it in **one line** and update **`frontend/.env.example`** in the same change when possible.
3. Remove or flag **stale** instructions (e.g. a route that no longer exists) so the next agent does not follow dead paths.
4. Prefer **concrete commands and paths** over abstract advice; link behavior to **files** (e.g. `App.jsx`, `functions/index.js`) when it saves rediscovery time.
