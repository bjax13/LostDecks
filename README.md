# ShardStash

This repository contains a web application that
facilitates trading of Brandon Sanderson "Lost Tales" collectible story
cards. The project is still in the planning phase, but a simple
wireframe has been created to outline navigation and page structure.

## Getting Started

### One-command local stack (recommended)

From the **repo / worktree root** (the directory that contains this `README.md`
and `package.json` — Cursor worktrees are often under
`~/.cursor/worktrees/LostDecks/<name>`):

```bash
# Fresh worktree: install deps in root, frontend/, and functions/
npm install && npm install --prefix frontend && npm install --prefix functions

# Starts Firebase emulators, waits for "All emulators ready", then Vite
npm run dev:local
```

`npm run dev:local` prints the absolute worktree path, creates or repairs
`frontend/.env` from `frontend/.env.emulator.example`, installs missing
`node_modules` when needed, waits for emulators, then starts Vite on
http://localhost:5173/ (Emulator UI: http://127.0.0.1:4000/).

You can also run each side independently:

```bash
npm run dev:local:emulators   # wait for "All emulators ready" before the next steps
npm run dev:local:frontend
```

#### `frontend/.env` for emulators (common Auth pitfall)

Sign-in fails with
`Authentication is not configured. Set VITE_FIREBASE_*…` when `.env` is
incomplete. Emulator **host flags alone are not enough** — Auth init requires
**all seven** non-empty `VITE_FIREBASE_*` SDK keys (including
`VITE_FIREBASE_MEASUREMENT_ID`; an empty string blocks init the same way) plus
`VITE_USE_EMULATORS=true`. Copy the **full** example (it now ships those SDK
placeholders):

```bash
cp frontend/.env.emulator.example frontend/.env
```

Vite only reads `.env` at process start: **restart Vite** after writing or
editing it. Prefer `frontend/.env.example` only for real/production-shaped
Firebase config.

### Local emulator seed data (Matches testing)

With emulators running:

```bash
# from repo root
npm run seed:local:wipe
```

Credentials come from `functions/seed.local.json` (gitignored), or
`functions/seed.local.example.json` when that file is missing. Example:

- `collector.one@example.com` / `replace-me-local-only`
- `collector.two@example.com` / `replace-me-local-only`

**Matches cooldown smoke:** sign in, open `/matches` so `getTradeMatches` succeeds,
then refresh Matches again quickly — not a refresh on the login page.

### Frontend only (no emulators)

```bash
cd frontend
npm install
npm run dev
```

#### Firebase configuration (production-shaped)

Copy `frontend/.env.example` to `frontend/.env` and fill in your Firebase
project credentials:

```bash
cd frontend
cp .env.example .env
```

> Note: The app can still render without Firebase configured, but auth-related
> features will be unavailable.

### Production deploy (safe default)

The public site is https://shardstash.web.app (Firebase Hosting site `shardstash`
on project `storydeck-16`). Use repo-root deploy scripts so production builds
always use live Firebase Web SDK config from that project:

```bash
npm run deploy:firebase
```

This command fetches `apps:sdkconfig`, injects `VITE_FIREBASE_*` for the build,
creates the `shardstash` Hosting site if it is missing, and deploys Hosting to
that site. The default `storydeck-16.web.app` site is not deleted and may go
stale.

### Planning docs

See `docs/plan.md` for a high-level plan of the pages and features considered
for the minimum viable product.
