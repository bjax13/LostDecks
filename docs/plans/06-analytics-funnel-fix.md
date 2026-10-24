# 06 – Fix PostHog identity reset + add funnel events

**Branch:** `analytics/funnel-events` · **PR title:** `PostHog: reset only on sign-out, add onboarding funnel events`

## Goal
Keep one PostHog identity from first anonymous visit (incl. QR/UTM landing) through sign-up, and capture the handful of events needed to see where people drop off.

## Why
`syncPostHogUser(null)` runs `posthog.reset()` whenever `user` is null — including on **every signed-out page load** (AuthContext's initial `user` state is `null`, and `onAuthStateChanged` reports `null` for visitors). That wipes the anonymous distinct id, so "landed from QR → signed up" can never be linked. Only `$pageview` (+ `$pageleave`) is captured today, so there is no funnel.

## Current state
- `frontend/src/analytics/posthog.js`:
  ```js
  export function syncPostHogUser(firebaseUser) {
    if (!initialized) return;
    if (firebaseUser?.uid) {
      posthog.identify(firebaseUser.uid, { email: firebaseUser.email ?? undefined, name: firebaseUser.displayName ?? undefined });
    } else {
      posthog.reset();
    }
  }
  ```
  `capturePostHogPageView()` sends `$pageview` with `$current_url: window.location.href` (so `utm_*` query params are already included — PostHog derives UTM/`$initial_utm_*` from it; keep this).
- `frontend/src/contexts/AuthContext.jsx`: `useEffect(() => { syncPostHogUser(user); }, [user]);`, `register()` (email/password + `updateProfile`), `signInWithProvider()` uses `signInWithPopup` and discards the result, `logout()` calls `signOut(auth)`.
- `frontend/src/analytics/PostHogPageviews.jsx` fires on `location.pathname`/`location.search` changes.
- Tests: `frontend/src/analytics/posthog.test.js` ("identifies or resets the user after init") mocks `identify`/`reset`.

## Changes
1. **`analytics/posthog.js`**
   - `syncPostHogUser(user)`: if no uid → **return** (no reset). If uid → identify (keep current props unless plan 02 decided to drop email/name). Guard against account switching: remember the last identified uid in `localStorage` key `shardstash.posthogUid`; if it exists and differs from the new uid, call `posthog.reset()` before `identify`.
   - New `resetPostHogUser()` → `posthog.reset()` + remove `shardstash.posthogUid`.
   - New `captureEvent(name, properties = {})` → no-op if not initialized; else `posthog.capture(name, properties)`.
   - New `frontend/src/analytics/events.js` exporting constants so names never drift:
     `SIGNUP_COMPLETED = "signup_completed"`, `LOGIN_COMPLETED = "login_completed"`, `GETTING_STARTED_STEP = "getting_started_step_viewed"`, `GETTING_STARTED_SAVED = "getting_started_saved"`, `ITEM_ADDED = "item_added"`, `BULK_IMPORT_APPLIED = "bulk_import_applied"`, `MATCHES_VIEWED = "matches_viewed"`, `ISO_UFT_COPIED = "iso_uft_copied"`, `SIGN_IN_PROMPTED = "sign_in_prompted"`.
2. **`contexts/AuthContext.jsx`**
   - `logout`: after `signOut(auth)` succeeds call `resetPostHogUser()`.
   - `register` success → `captureEvent(SIGNUP_COMPLETED, { method: "password" })`.
   - `login` success → `captureEvent(LOGIN_COMPLETED, { method: "password" })`.
   - `signInWithProvider`: keep the `signInWithPopup` result; `getAdditionalUserInfo(result)?.isNewUser` → `SIGNUP_COMPLETED` else `LOGIN_COMPLETED`, `{ method: provider.providerId }`.
   - Note: identify runs from the `[user]` effect, which may fire after the event; that's fine (PostHog merges the anonymous id on identify). If ordering matters, capture after a microtask.
3. **Event call sites** (no PII in properties; ids/counts only):
   - `pages/GettingStarted/index.jsx`: on step change (`setStep`) → `GETTING_STARTED_STEP { step, collectibleType }`; in `handleSave` when `!user` → `SIGN_IN_PROMPTED { reason: "getting-started-save" }`; after `applyBulkCollectionUpdate` resolves → `GETTING_STARTED_SAVED { collectibleType, created, updated, deleted }` (use the counts it returns).
   - `pages/Collectibles/hooks/useCollectionQuantityMutations.js` `addToCollection` success → `ITEM_ADDED { skuId, quantity: addQuantity, source: "collectibles" }`.
   - `pages/Collection/components/BulkCollectionTools.jsx`: after a successful bulk/CSV apply → `BULK_IMPORT_APPLIED { created, updated, deleted }` (locate the apply handler in that file); in `handlePostCopied` → `ISO_UFT_COPIED { skippedEntries }` (pass section ids if easy).
   - `pages/Matches/index.jsx` (`MatchesContent`): once per successful fresh load (not cached) → `MATCHES_VIEWED { matchCount: matches.length, callerOptedOut, pageIndex }`. Use a ref to avoid double-firing under StrictMode.
4. **Tests**
   - `posthog.test.js`: replace the reset expectation — `syncPostHogUser(null)` must **not** call reset; `resetPostHogUser()` does; switching uid triggers reset then identify; `captureEvent` no-ops before init.
   - `AuthContext.test.jsx`: logout calls `resetPostHogUser` (mock `../analytics/posthog.js`); new Google user fires `signup_completed`.
   - Add/extend tests for GettingStarted save and `useCollectionQuantityMutations` to assert `captureEvent` calls (mock the module).

## Manual steps for Bryan (PostHog UI)
1. Insights → Funnel: `$pageview` (URL contains `utm_source=qr` or path `/getting-started`) → `getting_started_saved` or `signup_completed` → `matches_viewed`; breakdown by `$initial_utm_source` / `utm_campaign`.
2. Second funnel for share links once plan 08 ships: `iso_uft_copied` → `$pageview` on `/t/*` → `signup_completed`.
3. Optional: Data management → add event descriptions so names stay consistent.

## Tests / verification
`npm run check`; `cd frontend && npm run test:coverage && npm run test:e2e`. With a real/dev PostHog key: load site signed-out twice → same distinct id in PostHog's Live events; sign up → events attach to the same person; sign out → new anonymous id.

## Done criteria
No reset on anonymous loads; reset on sign-out and account switch; the listed events fire once each with non-PII properties; tests updated.

## Out of scope
Session replay, feature flags, server-side events from Cloud Functions, cookie consent.
