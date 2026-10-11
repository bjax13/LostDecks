# 07 – QR acquisition flow: fast have/need picker → sign-up → Matches

**Branch:** `growth/qr-have-need-onboarding` · **PR title:** `QR onboarding: quick have/need picker, picks survive sign-up, land on Matches`

## Goal
One QR code on a sign/flyer (first target: Dragonsteel Nexus, Dec 3–5 2026, Salt Palace) opens a one-screen picker; new users mark which ChasmFriends pins they **Need / Have / Have spares**, sign up, and land on `/matches` with their picks already saved — no re-entry, no second Save click.

## Why
Today a scanner lands on `/getting-started`, must answer step 1, review groups, hits a sign-in modal on Save, then must click Save **again**; anything chosen before signing in is page state only. Matches only pairs users who each have **spares** (quantity above keep count) the other needs, so asking about spares is essential.
Pins ship to backers ~Q1 2027 (BackerKit add-on, per earlier research), so at Nexus most people trade **cards**: support `collect=cards` too (routes into the existing card review, see step 3).

## Current state (37e07e0)
- Route `/getting-started` → `frontend/src/pages/GettingStarted/index.jsx`. Step state `"profile" | "manual" | "spreadsheet"`; `collectibleType` from `COLLECTIBLE_TYPE_PINS/CARDS/BOTH` (`gettingStartedCatalog.js`). Choosing pins forces `profile = "manual"`. No URL params are read.
- `handleSave`: if `!user` → `openAuthModal({ reason: "getting-started-save" })` and returns. Otherwise `applyBulkCollectionUpdate({ ownerUid, rows: buildCollectionRows(...), existingEntries: entries, allowPins: includesPins(collectibleType) })` then `navigate("/collections", { state: { onboardingComplete: true } })`.
- `applyBulkCollectionUpdate` (`pages/Collection/utils/bulkImport.js`): a row with quantity **0 deletes** existing docs for that SKU; >0 sets the quantity (overwrites, not adds).
- `AuthModalContext.jsx` stores `context` from `openAuthModal(options)` but `<AuthModal isOpen onClose />` never receives it; `AuthModal.jsx` just closes on success. Social buttons: `SocialLoginButtons onSuccess={handleClose}`.
- `pages/Auth/Login.jsx` "Need an account? Sign up" is `<Link to="/auth/register">` (drops `?redirect=` and `state.from`); `Register.jsx` "Already have an account?" likewise. `lib/postAuthRedirect.js` `resolvePostAuthPath` honors `?redirect=` then `state.from`.
- Pin catalog `frontend/src/storyData/chasmfriends-pins.json`: `PIN-CF-01` "Shreadad", `-02` "Howlerina", `-03` "Burp Slurper", `-04` "Darren", `-05` "Cleverclaws".
- Match lanes: `DEFAULT_MATCH_LANES = { dun: true, foil: true, pins: true }` in **both** `frontend/src/lib/userPreferences.js` and `functions/matches.js` → **pins lane is already on by default** for users without a prefs doc (the earlier "opt-in" concern is not true at this commit). Keep count default `DEFAULT_MATCH_KEEP = 1` (range 1–3, per-lane since #149).
- `pages/Matches/index.jsx` empty state: "No reciprocal matches yet — Collect copies above what you keep, then check back as more collectors join."

## Changes
1. **Pin names** – `chasmfriends-pins.json`: "Shreadad" → "Shredhead", "Burp Slurper" → "Burpslurper" (SKU ids unchanged, so no data migration). Update `gettingStartedCatalog.js` comment (line ~143) and tests: `gettingStartedCatalog.test.js`, `GettingStarted/index.test.jsx` (~line 867), `collectionBackupCsv.test.js`. ⚠ Bryan: confirm spelling on the official Dragonsteel listing before merge.
2. **Pending picks store** – new `frontend/src/lib/pendingPicks.js` (+ test):
   - Key `pendingPinPicks`; value `{ version: 1, savedAt: Date.now(), source: { utm_source, utm_campaign }, quantities: { [skuId]: number } }`.
   - `savePendingPicks(quantities, source)`, `loadPendingPicks({ now })` (returns null if missing, malformed, or older than 7 days → also clears), `clearPendingPicks()`. Wrap all `localStorage` access in try/catch (private mode) and return a boolean so the caller can fall back.
   - `mergePickRows(picks, existingEntries)` → rows only for SKUs where `picked > existingQty` (never emits 0 / never lowers a quantity). Pure, unit-tested.
3. **URL entry** – `GettingStarted/index.jsx`: read `useSearchParams()`; `collect=pins|cards|both`. On mount with a valid value: set `collectibleType`, `profile="manual"`. For `pins` render the new quick picker (step 4) instead of `StepIndicator`/review; for `cards`/`both` call existing `beginManualReview(type)` so step 1 is skipped. Preserve `utm_*` (PostHog pageview already includes the full URL).
4. **Quick picker** – new `frontend/src/pages/GettingStarted/QuickPinPicker.jsx` (+ CSS, + test):
   - Title "Which ChasmFriends do you have?" One tile per pin (from `gettingStartedTree` pins section or `pinDataset.pins`), three toggle buttons (`aria-pressed`): **Need it** (qty 0, default), **Have it** (1), **Have spares** (shows −/+ stepper, spares default 1 → qty = 1 + spares, max 20).
   - Footer button "Find my trades". Signed in → save via `applyBulkCollectionUpdate` with `mergePickRows` rows, `allowPins: true` → `navigate("/matches?welcome=1")`. Signed out → `savePendingPicks(...)` then `openAuthModal({ reason: "qr-picks", initialMode: "register" })`.
   - Signed-in returning user: prefill tiles from `useUserCollection` entries (qty 0 → Need, 1 → Have, >1 → spares = qty−1).
   - Copy under the button: "You'll create a free account so other collectors can trade with you." + the consent line from plan 02 if merged.
5. **Apply picks after auth (global)** – new hook `frontend/src/hooks/useApplyPendingPicks.js`, mounted once in `App.jsx` (inside the router, e.g. a tiny `<PendingPicksApplier />`): when `user` becomes non-null and `loadPendingPicks()` returns data, wait for `useUserCollection(user.uid)` `loading === false`, then `applyBulkCollectionUpdate` with merged rows, `clearPendingPicks()`, and `navigate("/matches?welcome=1")`. Guard with a ref so it runs once. This covers modal email sign-up, Google popup, `/auth/register`, and existing-account sign-in (merge never decreases).
6. **Auth modal fixes** – `AuthModalContext.jsx`: pass `context` to `<AuthModal context={context} />`. `AuthModal.jsx`: start in `context?.initialMode` when opening (`register`), call `context?.onSuccess?.()` after successful login/register/social before closing. In `GettingStarted/index.jsx` `handleSave`, pass `onSuccess` that sets a `pendingSaveRef`, and add an effect that runs `handleSave()` when `user` becomes set and the ref is true (fixes the double-Save for the normal flow too).
7. **Keep redirect across login↔register** – `Login.jsx`/`Register.jsx`: switch links to `<Link to={{ pathname: "/auth/register", search: location.search }} state={location.state}>` (and the reverse). Add tests.
8. **Matches welcome state** – `pages/Matches/index.jsx`: when `?welcome=1` (or matches empty and user has no spares), show "You're in! We'll match you with collectors who have spares of what you need. You'll get more matches if you mark spares." + links "Add spares" (`/getting-started?collect=pins`) and "Share your list" (plan 08). Don't change match logic.
9. **Match lanes** – no write needed (pins default true). Do **not** flip a returning user's explicit `matchLanes.pins === false`; instead show a notice on Matches "Pin matching is off in Account".

## Manual steps for Bryan
- Generate the QR (any generator) for `https://shardstash.web.app/getting-started?collect=pins&utm_source=qr&utm_medium=print&utm_campaign=nexus-2026` (and a `collect=cards` variant if desired). Test-scan on iOS + Android before printing.
- Confirm pin spellings (step 1).

## Tests / verification
Unit tests for `pendingPicks.js`, `QuickPinPicker`, the hook, AuthModal context, Login/Register links. E2E (signed-out only, CI has no Firebase): `/getting-started?collect=pins` shows the picker heading and 5 tiles; clicking "Find my trades" opens the Create Account modal. Emulator manual run: scan URL → pick → sign up (email and Google) → land on `/matches?welcome=1`, collection has the picks; repeat as existing user with higher quantities → nothing decreases.
`npm run check`, `cd frontend && npm run test:coverage && npm run test:e2e`.

## Done criteria
URL skips step 1; picks survive sign-up and auto-save exactly once; quantities never decrease on merge; user lands on Matches with welcome copy; normal getting-started no longer needs a second Save.

## Open questions (Bryan)
1. QR placement and per-event codes (one `utm_campaign` per sign/table?).
2. Do people need a "Don't care" option, or is untouched = Need OK?
3. Make Google the one-tap default on the sign-up modal for this flow?
4. Teaser before sign-up ("3 collectors have spares you need") needs a public function — v2?

## Out of scope
Card quick-picker tiles (215 cards — reuse existing review), public teaser counts, Matches algorithm changes.
