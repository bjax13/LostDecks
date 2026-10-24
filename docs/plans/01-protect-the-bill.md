# 01 – Protect the bill (App Check, instance cap, per-user cooldown, budget alert)

**Branch:** `security/protect-the-bill` · **PR title:** `Protect getTradeMatches: App Check, maxInstances, per-user cooldown`

## Goal
Make it expensive/impossible for one user or a script to run up the Firebase bill through `getTradeMatches`, and get an email before costs surprise Bryan.

## Why
`getTradeMatches` reads the **entire** `collections` collection plus `userPreferences` and Auth profiles on every call. Any signed-in user (or a script using the public Firebase web config) can call it in a loop. There is no App Check, no rate limit, and no instance cap.

## Current state
- `functions/index.js`:
  ```js
  const { HttpsError, onCall } = require("firebase-functions/v2/https");
  exports.getTradeMatches = onCall(async (request) => {
    const callerUid = uidOrEmpty(request.auth?.uid);
    if (!callerUid) throw new HttpsError("unauthenticated", ...);
    ...
    const [collectionsSnapshot, optedOutSnapshot] = await Promise.all([
      db.collection("collections").get(),
      db.collection("userPreferences").where("matchingOptOut", "==", true).get(),
    ]);
  ```
  No options object is passed to `onCall`.
- `frontend/src/lib/firebase.js` initializes `app`, `auth`, `db`, `functions` (only when every `VITE_FIREBASE_*` var is set) and connects emulators when `VITE_USE_EMULATORS=true`. No App Check.
- Caller: `frontend/src/pages/Matches/hooks/useTradeMatches.js` → `httpsCallable(functions, "getTradeMatches")`. It already has a **client-only** 30 s localStorage cache (`MATCHES_CACHE_TTL_MS = 30_000`, refresh countdown), but each page (`cursor`) is a separate call and nothing stops a script from calling the function directly. The server limiter must allow normal Next/Previous paging (hence a short 2–3 s interval, not 30 s).
- `firestore.rules` ends with a catch-all `match /{document=**} { allow read, write: if false; }`.
- Env plumbing: `scripts/deploy-production.js` spreads `...process.env` into the build; deploy workflows list `VITE_POSTHOG_*` under the deploy step `env:`.

## Changes

### 1. Frontend App Check – `frontend/src/lib/firebase.js`
1. `import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";`
2. Read `const appCheckSiteKey = import.meta.env.VITE_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY?.trim() ?? "";`
3. After `app` is created and **before** `getFunctions/getFirestore` are used for calls:
   - If `useEmulators` is true: set `self.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true;` before `initializeAppCheck` (only in emulator/dev mode, never in production builds).
   - If `app && (appCheckSiteKey || useEmulators)`: `initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey || "debug"), isTokenAutoRefreshEnabled: true })` inside try/catch with `console.warn`.
   - If no site key and not emulators: skip App Check (keeps CI/E2E and unconfigured builds working).
   - Note: `useEmulators` is currently computed *after* app creation; move the `const useEmulators = ...` line above the App Check block.
4. Export `appCheck` (or `null`) for tests.
5. `frontend/.env.example` + `frontend/.env.emulator.example`: document `VITE_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY=` and optional `VITE_APPCHECK_DEBUG_TOKEN=`.
6. `.github/workflows/deploy-firebase.yml` and `deploy-frontend.yml`: add `VITE_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY: ${{ secrets.VITE_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY }}` next to the PostHog vars.
7. Update `frontend/src/lib/firebase.test.js` to mock `firebase/app-check` and cover: no key → not initialized; key → initialized with provider; emulator → debug token set.

### 2. Function options – `functions/index.js`
```js
const RUNNING_IN_EMULATOR = process.env.FUNCTIONS_EMULATOR === "true";
const ENFORCE_APP_CHECK = process.env.ENFORCE_APP_CHECK === "true" && !RUNNING_IN_EMULATOR;
exports.getTradeMatches = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK, maxInstances: 5, timeoutSeconds: 60 },
  // Do not add `concurrency` > 1 without also setting cpu >= 1 (gen2 rejects it on small instances).
  async (request) => { ... }
);
```
- Keep the existing unauthenticated check as the first line.
- Ship in two steps to avoid locking users out: `ENFORCE_APP_CHECK` defaults to **false** (unset). Log `request.app ? "appcheck:ok" : "appcheck:missing"`; flip to true once console metrics show ~100% verified (see Manual steps). Document this in the PR.

### 3. Per-user cooldown – new `functions/rateLimit.js`
```js
// Server-only: rateLimits/{uid} = { lastCallAt: Timestamp, windowStart: Timestamp, windowCount: number }
async function enforceCallCooldown(db, uid, { minIntervalMs = 3000, windowMs = 3600000, maxPerWindow = 120, now = Date.now() } = {})
```
- Run in `db.runTransaction`: read `rateLimits/{uid}`; if `now - lastCallAt < minIntervalMs` or `windowCount >= maxPerWindow` within window → throw `new HttpsError("resource-exhausted", "Too many requests. Please wait a moment and try again.")`; otherwise write updated values.
- Export a pure helper `evaluateRateLimit(state, now, opts)` → `{ allowed, nextState }` so it is unit-testable without Firestore.
- Call `await enforceCallCooldown(db, callerUid)` in `getTradeMatches` right after the auth check (before the expensive reads).
- New `functions/rateLimit.test.js` (node:test) for `evaluateRateLimit`: first call allowed, call within interval blocked, window reset, cap reached.

### 4. Frontend handling of `resource-exhausted`
- `frontend/src/pages/Matches/hooks/useTradeMatches.js`: when the callable error `code` is `functions/resource-exhausted`, set a friendly error ("You're refreshing too fast, try again in a few seconds") instead of a generic failure. Add a test in `useTradeMatches.test.jsx`.

### 5. Rules – `firestore.rules`
Add above the catch-all (documentation + explicit deny):
```
    // Server-only (Admin SDK). Clients never read or write rate-limit state.
    match /rateLimits/{userId} {
      allow read, write: if false;
    }
```

## Manual steps for Bryan (console – not done by the agent)
1. **Budget alert:** Google Cloud console → Billing → Budgets & alerts → Create budget, project `storydeck-16`, amount e.g. $10/month, alerts at 50/90/100% (actual) and 100% (forecasted), email billing admins. Note: budgets alert, they don't cap spend.
2. **reCAPTCHA Enterprise key:** Cloud console → Security → reCAPTCHA → Create key (Website), domains `shardstash.web.app`, `shardstash.firebaseapp.com`, `localhost`. Copy the site key.
3. **Register App Check:** Firebase console → App Check → Apps → web app → reCAPTCHA Enterprise → paste site key. Don't enforce Firestore/Functions there yet.
4. Add the site key as GitHub secret `VITE_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY` and to local `frontend/.env` for local prod deploys.
5. **Debug token for local dev:** run the app with emulators, copy the debug token printed in the browser console, add it in Firebase console → App Check → Apps → ⋮ → Manage debug tokens (only needed when testing against real backend).
6. Deploy (`npm run deploy:firebase`). After ~1 week, check App Check → Metrics. When verified requests ≈ 100%, set `ENFORCE_APP_CHECK=true` in `functions/.env.storydeck-16` (Firebase loads it at deploy; options are read at load time — verify, or switch to a `defineBoolean` param) and redeploy; optionally enforce App Check for Firestore in the console.

## Tests / verification
- `npm run check`; `cd functions && npm test`; `cd frontend && npm run test:coverage`; `npm run test:e2e`.
- Emulator: open `/matches` signed in, click refresh repeatedly → second call within 3 s shows the friendly cooldown message; Emulator UI shows `rateLimits/{uid}` doc.
- Client SDK in browser console cannot read `rateLimits/{uid}` (permission-denied).

## Done criteria
- `getTradeMatches` has `maxInstances` set and calls `enforceCallCooldown` before reading collections.
- App Check initializes when a site key is configured; builds without a key still work (E2E passes).
- `rateLimits` is explicitly denied in rules. Unit tests cover the limiter.

## Out of scope
Rewriting Matches to avoid full collection scans (worth a separate plan), Firestore App Check enforcement flip, per-IP limits.
