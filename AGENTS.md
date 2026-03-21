# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Lost Tales Marketplace is a single-product Vite + React 18 SPA (`frontend/`) backed by Firebase (Auth, Firestore, Cloud Functions in `functions/`). There is no custom backend server; all server-side logic runs as Firebase callable Cloud Functions.

### Running locally

Two processes are needed for full local development:

1. **Firebase Emulators** (Auth on 9099, Firestore on 8080, Functions on 5001, UI on 4000):
   ```
   firebase emulators:start --project storydeck-16
   ```
   Requires Java 11+ (pre-installed in the VM). The emulators take ~10-15 s to start; wait for the "All emulators ready" banner before interacting.

2. **Vite Dev Server** (port 5173):
   ```
   cd frontend && npm run dev -- --host 0.0.0.0
   ```

The frontend `.env` must have `VITE_USE_EMULATORS=true` and dummy `VITE_FIREBASE_*` values so the Firebase SDK initializes and connects to the local emulators. A working `.env` is created during setup; if it is missing, copy `frontend/.env.emulator.example` to `frontend/.env` and add placeholder values for the required `VITE_FIREBASE_*` keys (any non-empty string works with emulators).

### Lint / Test / Build

- **Unit & integration tests**: Vitest + Testing Library (`cd frontend && npm run test`). Tests live next to source as `*.test.{js,jsx}`; setup is `frontend/src/test/setup.js`. Prefer queries from [Testing Library priority](https://testing-library.com/docs/queries/about#priority) (role, label, placeholder, text) and `userEvent` over `fireEvent` where it reflects real interaction.
- **End-to-end tests**: Playwright (`cd frontend && npm run test:e2e`). The config builds and serves the production bundle on port 4173; smoke coverage lives under `frontend/e2e/`.
- **Build**: `cd frontend && npm run build` — runs `vite build`.

### Gotchas

- The `functions/` `package.json` declares `"node": "24"` in engines, but Node 22 works fine for local emulation; the Firebase CLI logs a warning and uses the host Node version.
- Card metadata is a static JSON file bundled with the frontend (`frontend/src/data/storydeck-lt24-with-skus.json`), not stored in Firestore.
- Firestore emulator data is ephemeral — it resets on every emulator restart. Registered users and listings disappear.
- The `firebase emulators:start` command prints an "Unable to look up project number" warning when not authenticated; this is harmless for local development.
