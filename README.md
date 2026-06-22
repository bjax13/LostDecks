# Lost Tales Marketplace

This repository contains an early prototype for a web application that
facilitates trading of Brandon Sanderson "Lost Tales" collectible story
cards. The project is still in the planning phase, but a simple
wireframe has been created to outline navigation and page structure.

## Getting Started

### Frontend (Vite + React)

The `frontend` directory contains a Vite-powered React application.

```bash
cd frontend
npm install
npm run dev
```

#### Firebase configuration

The frontend expects Firebase configuration via Vite environment variables.
Copy `frontend/.env.example` to `frontend/.env` and fill in your Firebase
project credentials:

```bash
cd frontend
cp .env.example .env
```

> Note: The app can still render without Firebase configured, but auth-related
> features will be unavailable.

### Local emulator seed data (Matches testing)

You can seed local Auth + Firestore data for manual Matches testing.

```bash
# from repo root
npm run seed:local:wipe
```

This runs `functions/seed-local.js`, which:
- upserts local emulator auth users
- writes `collections` entries
- writes `userPreferences/{uid}.matchingOptOut`

Local seed credentials are read from `functions/seed.local.json` (gitignored).
If that file is missing, the script falls back to `functions/seed.local.example.json`.

### One-command local startup

From the repo root:

```bash
npm run dev:local
```

This starts Firebase emulators and then the Vite frontend once emulators are ready.
If Java is not already configured in your PATH, the script attempts common local JDK
install paths automatically.

You can also run each side independently:

```bash
npm run dev:local:emulators
npm run dev:local:frontend
```

### Planning docs

See `docs/plan.md` for a high-level plan of the pages and features considered
for the minimum viable product.
