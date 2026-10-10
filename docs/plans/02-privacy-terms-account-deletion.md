# 02 – Privacy policy, terms, sign-up consent, account deletion

**Branch:** `legal/privacy-terms-account-deletion` · **PR title:** `Add privacy policy, terms, sign-up consent, and self-serve account deletion`

## Goal
Public `/privacy` and `/terms` pages linked from the footer and sign-up, a consent line on every sign-up surface, and a "Delete my account" button that removes all of the user's data server-side.

## Why
ShardStash shares a matched user's email (or trading email / Discord handle) with other users, sends users' email + name to PostHog, and has no way to delete an account. That must be disclosed and deletable before any growth push (plans 07/08).

## Current state
- Routes in `frontend/src/App.jsx` (`<Routes>`): `/`, `/about`, `/collectibles`, `/collectibles/:collectibleId`, `/collectibles/:collectibleId/:skuId`, `/collections`, `/getting-started`, `/matches`, `/account`, `/auth/login`, `/auth/register`, `/auth/forgot`, `*` → `NotFound`. Footer = `frontend/src/components/SiteFeedback.jsx` (`<footer className="site-footer">` with an `/about` link and a Feedback button).
- Sign-up surfaces: `frontend/src/pages/Auth/Register.jsx`, the REGISTER mode of `frontend/src/components/Auth/AuthModal.jsx`, and Google popup via `frontend/src/components/Auth/SocialLoginButtons.jsx` (also creates accounts).
- Data per user: `collections/{autoId}` docs with `ownerUid == uid`; `userPreferences/{uid}`; after plan 01, `rateLimits/{uid}`; after plan 08, `publicTradeLists/*` with `ownerUid`.
- Match contact: `functions/matches.js` `resolveMatchContact({ preferences, trueEmail })` → by default (`matchContactSharing: "trueEmail"`, `DEFAULT_USER_PREFERENCES` in `frontend/src/lib/userPreferences.js`) the **account email** is shown to matched users. `matchingOptOut` defaults to `false`, so new users are matchable immediately.
- PostHog: `frontend/src/analytics/posthog.js` `syncPostHogUser` calls `posthog.identify(uid, { email, name })`; feedback survey via `openPostHogFeedbackSurvey`.
- No account deletion anywhere (`grep -ri deleteUser frontend/src` → nothing).

## Changes
1. **Pages** – new `frontend/src/pages/Legal/PrivacyPolicy.jsx`, `frontend/src/pages/Legal/Terms.jsx`, shared `frontend/src/pages/Legal/Legal.css`. Static JSX content, `<h1>`, "Last updated: <date>", a visible banner comment in source `{/* TEMPLATE – Bryan must review before launch */}`. Use `SITE_NAME` from `frontend/src/brand.js`.
2. **Routes** – `App.jsx`: add `<Route path="/privacy" element={<PrivacyPolicy />} />` and `<Route path="/terms" element={<Terms />} />` before `*`.
3. **Footer** – `SiteFeedback.jsx`: add `<Link to="/privacy" className="site-footer__link">Privacy</Link>` and `Terms`, same style as the About link. Update `SiteFeedback.test.jsx`.
4. **Consent line** – new `frontend/src/components/Auth/SignupConsent.jsx`: "By creating an account you agree to the [Terms] and [Privacy Policy]. If you match with another collector, they'll see your contact (your email by default; change it in Account)." Render it in `Register.jsx` above the submit button, in `AuthModal.jsx` when `mode === modes.REGISTER`, and under `SocialLoginButtons` on Register/modal register mode. Links open in the same tab via `<Link>` (in the modal, call `onClose` on click). Tests in `Register.test.jsx` / `AuthModal.test.jsx` assert the links exist.
5. **Callable `deleteMyAccount`** – `functions/index.js` (or new `functions/deleteAccount.js` required from index):
   ```js
   exports.deleteMyAccount = onCall({ maxInstances: 2 }, async (request) => {
     const uid = uidOrEmpty(request.auth?.uid);
     if (!uid) throw new HttpsError("unauthenticated", "You must be signed in.");
     if (request.data?.confirm !== "DELETE") throw new HttpsError("invalid-argument", "Confirmation required.");
     const db = admin.firestore();
     await deleteQueryInBatches(db.collection("collections").where("ownerUid", "==", uid));
     // after plan 08 lands: await deleteQueryInBatches(db.collection("publicTradeLists").where("ownerUid", "==", uid));
     await db.collection("userPreferences").doc(uid).delete();
     await db.collection("rateLimits").doc(uid).delete(); // harmless if missing
     await admin.auth().deleteUser(uid);
     return { deleted: true };
   });
   ```
   `deleteQueryInBatches(query, size = 400)`: loop `query.limit(size).get()` → `db.batch()` deletes → commit until empty. Export it via `exports.__test` and unit test with a fake db object in `functions/deleteAccount.test.js`.
   Also pass `enforceAppCheck` the same way as plan 01 if plan 01 is merged.
6. **Account UI** – `frontend/src/pages/Account/index.jsx`: add a "Danger zone" `account-section` at the bottom: "Delete my account" button → confirm dialog requiring typing `DELETE` → `httpsCallable(functions, "deleteMyAccount")({ confirm: "DELETE" })` → on success call `posthog.reset()` via a new `resetPostHogUser()` export in `analytics/posthog.js`, `logout()` (ignore errors, the user is gone), navigate to `/` with a "Your account was deleted" message. Show errors inline. Test in `Account/index.test.jsx` with the callable mocked.
7. **PostHog considerations** (document in the privacy page + PR): we identify by uid and attach email/name; PostHog person deletion is not automatic. Either (a) drop `email`/`name` from `identify` (recommended; uid is enough for funnels — coordinate with plan 06), or (b) list PostHog as a processor and handle deletion requests manually in PostHog → Persons. The agent should implement (a) only if Bryan approves in the PR; otherwise leave a TODO.

## Facts the privacy policy must disclose (template content)
- Who: ShardStash (operator Bryan Jackson), contact = the email/Discord already shown in the footer feedback modal (`frontend/src/siteFeedback.js`).
- Data collected: account email, display name, Google profile name if using Google sign-in, password handled by Firebase Auth (never seen by us), collection quantities/notes, match preferences (trading email, Discord handle/channel, lanes, keep counts).
- **Sharing with other users:** when matched, other users see your display name and your chosen contact – your **account email by default**, or trading email / Discord handle. You can opt out of matching in Account.
- Processors: Google Firebase (Auth, Firestore, Cloud Functions, Hosting at shardstash.web.app; Google reCAPTCHA if plan 01 shipped), PostHog (US cloud by default: page views, events, identify with uid + email + name, surveys, possibly session data if enabled).
- No sale of data; no ads. Cookies/local storage: Firebase auth persistence (`browserLocalPersistence`), PostHog cookies/localStorage, and (plan 07) pending picks in localStorage.
- Retention + deletion: self-serve delete in Account removes Firestore data and the Auth account; backups (plan 04) may retain data up to the retention window (state it, e.g. 7 days).
- Children: not directed at under-13s.
- Terms: unofficial fan project, not affiliated with Dragonsteel; trades happen between users at their own risk; no warranty; we can remove accounts for abuse.

## Manual steps for Bryan
- Review/edit both texts (they are templates, not legal advice). Fill in the operator name/contact and backup retention period.
- Decide on the PostHog email/name question (item 7).
- After deploy, delete a throwaway account in production and confirm in Firebase console that Auth user + Firestore docs are gone.

## Tests / verification
- `npm run check`; `cd functions && npm test`; `cd frontend && npm run test:coverage`.
- Add to `frontend/e2e/public-routes.spec.js`: `/privacy` and `/terms` render their `<h1>`; footer has both links.
- Emulator: create user, add items, delete account → Emulator UI shows no `collections` with that `ownerUid`, no `userPreferences/{uid}`, Auth user gone.

## Done criteria
Pages routed and linked; consent line on all three sign-up paths; deletion callable with auth + confirm checks and tests; Account UI works end to end in emulators.

## Out of scope
Cookie banner, data export (CSV backup already exists: `CollectionBackupDownload.jsx`), GDPR DSAR tooling.
