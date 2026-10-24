# 05 – Error tracking + friendly crash page + favicon/robots

**Branch:** `reliability/error-tracking-error-page` · **PR title:** `Add app-wide error boundary, PostHog exception capture, favicon and robots.txt`

## Goal
A render crash shows a friendly "Something broke" page instead of a blank screen; frontend exceptions are reported to PostHog; Cloud Function errors alert Bryan; `/favicon.ico` and `/robots.txt` return real files.

## Why
Today an uncaught render error unmounts the whole React tree (blank page) and nobody is told. Hosting rewrites `**` → `/index.html`, so `/favicon.ico` and `/robots.txt` return the SPA HTML.

## Current state
- `frontend/src/main.jsx`:
  ```jsx
  initPostHog();
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode><AuthProvider><AuthModalProvider><App /></AuthModalProvider></AuthProvider></React.StrictMode>,
  );
  ```
  No error boundary anywhere (`grep -r componentDidCatch frontend/src` → none). React is 19.2.
- `frontend/src/analytics/posthog.js` `initPostHog()` calls `posthog.init(key, { api_host, capture_pageview: false, capture_pageleave: true, person_profiles: "identified_only", disable_surveys_automatic_display: true, advanced_enable_surveys: true })`; no-op when `VITE_POSTHOG_KEY` is empty. `posthog-js` is `1.374.2`.
- 404 page exists: `frontend/src/pages/NotFound/index.jsx` + `NotFound.css` (`.not-found-page` card style) — reuse its look.
- `frontend/public/` **does not exist**; `frontend/index.html` has no `<link rel="icon">`.
- `firebase.json` Hosting: `public: frontend/dist`, rewrite `**` → `/index.html` (real files in dist win over rewrites).
- `functions/index.js` has no logging; uncaught errors in `onCall` already return a generic `internal` error to clients (no stack leak).

## Changes
1. **Exception reporting helper** – `frontend/src/analytics/posthog.js`:
   - Add `capture_exceptions: true` to the `posthog.init` options (posthog-js exception autocapture: window.onerror + unhandledrejection). Verify the option name against the installed version's types (`node_modules/posthog-js/dist/*.d.ts`); if absent, skip and rely on step 2.
   - Export `capturePostHogException(error, properties = {})` → `if (!initialized) return; posthog.captureException(error, properties);`.
   - Tests in `posthog.test.js` (mock `posthog-js` like the existing tests do).
2. **React root error hooks** – `main.jsx`: pass React 19 root options:
   ```js
   ReactDOM.createRoot(el, {
     onUncaughtError: (error, info) => capturePostHogException(error, { componentStack: info?.componentStack, source: "react-uncaught" }),
     onCaughtError: (error, info) => capturePostHogException(error, { componentStack: info?.componentStack, source: "react-boundary" }),
   })
   ```
   (`main.test.jsx` exists — update it.)
3. **Error boundary** – new `frontend/src/components/AppErrorBoundary.jsx` (class component; `getDerivedStateFromError`, `componentDidCatch` → `console.error`), fallback `frontend/src/pages/ServerError/index.jsx` + `ServerError.css` (copy `.not-found-page` styling):
   - Heading "Something went wrong", text "This page hit an error. Your collection is safe. Try reloading, or head home.", buttons **Reload** (`window.location.reload()`) and **Back to Home** (plain `<a href="/">` — the boundary may sit outside the router), plus "Tell us what happened" using `SITE_FEEDBACK_MAILTO` from `frontend/src/siteFeedback.js`.
   - Never render `error.message` or stacks in production; show `error.message` only when `import.meta.env.DEV`.
   - Wrap in `main.jsx`: `<React.StrictMode><AppErrorBoundary><AuthProvider>…</AuthProvider></AppErrorBoundary></React.StrictMode>`.
   - Optional second boundary inside `App.jsx` around `<Routes>` keyed by `location.pathname` so nav stays usable and navigating away resets the error (needs a small wrapper component that reads `useLocation`).
   - Tests `AppErrorBoundary.test.jsx`: child that throws → fallback heading shown; reload button calls `window.location.reload` (stub).
4. **Static files** – create `frontend/public/` (Vite copies it to `dist/`):
   - `favicon.svg` (simple ShardStash glyph; any small SVG) and `favicon.ico` (32×32; generate from the SVG, or omit `.ico` and accept that browsers fall back — locate a tool; don't block the PR on it).
   - `robots.txt`:
     ```
     User-agent: *
     Allow: /
     Disallow: /account
     Disallow: /collections
     Disallow: /matches
     Disallow: /auth/
     ```
   - `frontend/index.html`: `<link rel="icon" href="/favicon.svg" type="image/svg+xml">` and `<link rel="icon" href="/favicon.ico" sizes="32x32">`.
   - E2E: add to `frontend/e2e/public-routes.spec.js`: `request.get("/robots.txt")` body contains `User-agent`, and `/favicon.svg` content-type is `image/svg+xml` (works on `vite preview`).
5. **Function error logging** – `functions/index.js`: wrap the body of `getTradeMatches` in `try { … } catch (err) { if (err instanceof HttpsError) throw err; logger.error("getTradeMatches failed", { uid: callerUid, err }); throw new HttpsError("internal", "Could not load matches. Please try again."); }` with `const { logger } = require("firebase-functions");`. Same pattern for `deleteMyAccount` if plan 02 merged. Keep messages generic.

## Manual steps for Bryan
1. **PostHog:** Project settings → Error tracking → enable exception autocapture (if the project toggle exists), then Error tracking → create an alert (email/Slack) on new issues.
2. **Cloud Functions alerting:** Google Cloud console → Error Reporting (project `storydeck-16`) → turn on notifications for new errors (bell icon / "Configure notifications" → your email). Alternatively Monitoring → Alerting → create policy from log-based metric `severity>=ERROR AND resource.type="cloud_run_revision"` (gen2 functions run on Cloud Run).
3. After deploy, open `https://shardstash.web.app/robots.txt` and `/favicon.svg` to confirm they're not HTML.

## Tests / verification
`npm run check`; `cd frontend && npm run test:coverage && npm run test:e2e`; `cd functions && npm test`. Manually: temporarily throw inside a page in dev → friendly page; with a PostHog key set, the exception appears in PostHog.

## Done criteria
No blank-screen crashes; exceptions reach PostHog when configured; favicon + robots served as real files; function errors logged via `logger.error` with generic client messages.

## Out of scope
Sentry (PostHog already integrated, so recommended over adding Sentry), source-map upload, performance monitoring.
