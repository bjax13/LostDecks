# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Lost Tales Marketplace is a single-product Vite + React 18 SPA (`frontend/`) backed by Firebase (Auth, Firestore, Cloud Functions in `functions/`). There is no custom backend server; all server-side logic runs as Firebase callable Cloud Functions.

### Repository layout

| Path | Role |
|------|------|
| `frontend/` | Vite + React app; run dev server and frontend tests here |
| `functions/` | Cloud Functions (`firebase-functions` + `firebase-admin`); emulator loads this code |
| `firebase.json`, `.firebaserc` | Emulator ports, Firestore rules path, default Firebase project (`storydeck-16`) |
| `firestore.rules`, `firestore.indexes.json` | Firestore security rules and composite indexes |

### Setup

1. **Repo root** (Biome + Husky): `npm install` — installs Biome, Husky, and lint-staged; enables the pre-commit hook that runs Biome on staged files. Skipping root install means hooks and `npm run ci` are unavailable.
2. **Frontend**: `cd frontend && npm install`
3. **Functions** (if you change or debug callable code with the emulator): `cd functions && npm install`

Before `git commit`, run `npm run check` from the repo root (same as `biome check --write .`). That mirrors the local pre-commit hook intent without relying on Husky in the VM.

Default Firebase project id matches `.firebaserc`: `storydeck-16`.

### Running locally

Two processes are needed for full local development:

1. **Firebase Emulators** (Auth on 9099, Firestore on 8080, Functions on 5001, UI on 4000):

   ```bash
   firebase emulators:start --project storydeck-16
   ```

   If the Firebase CLI is not installed globally, use:

   ```bash
   npx firebase-tools emulators:start --project storydeck-16
   ```

   Requires Java 11+ (pre-installed in the VM). The emulators take ~10–15 s to start; wait for the "All emulators ready" banner before interacting.

2. **Vite Dev Server** (port 5173):

   ```bash
   cd frontend && npm run dev -- --host 0.0.0.0
   ```

The frontend `.env` must have `VITE_USE_EMULATORS=true` and dummy `VITE_FIREBASE_*` values so the Firebase SDK initializes and connects to the local emulators. A working `.env` is created during setup; if it is missing, copy `frontend/.env.emulator.example` to `frontend/.env` and add placeholder values for the required `VITE_FIREBASE_*` keys (any non-empty string works with emulators). For production-shaped config, start from `frontend/.env.example`.

### Lint / Test / Build

- **Biome** (format, lint, import organization) runs from the repo root after `npm install`:
  - `npm run format` — write formatting
  - `npm run lint` — lint only (no write)
  - `npm run check` — format, lint, and organize imports (writes fixes)
  - `npm run ci` — read-only check for CI (`biome ci .`)
- **Unit & integration tests**: Vitest + Testing Library (`cd frontend && npm run test`, or `npm run test` from the repo root). Tests live next to source as `*.test.{js,jsx}`; setup is `frontend/src/test/setup.js`. Prefer queries from [Testing Library priority](https://testing-library.com/docs/queries/about#priority) (role, label, placeholder, text) and `userEvent` over `fireEvent` where it reflects real interaction.
- **Coverage**: `cd frontend && npm run test:coverage` enforces branch/function/line thresholds (90%) for files included in the coverage report; several Firebase-heavy and page-level modules are excluded in `frontend/vite.config.js` (see the comment there). GitHub Actions runs this after `npm run build`.
- **Cloud Functions tests**: `cd functions && npm test` — Node’s built-in test runner (`*.test.js` next to source).
- **End-to-end tests**: Playwright (`cd frontend && npm run test:e2e`). Locally the config builds then previews the production bundle on port 4173. In CI, the workflow builds once and sets `PLAYWRIGHT_SKIP_BUILD=1` so Playwright only runs preview. Specs live under `frontend/e2e/`.
- **Build**: `cd frontend && npm run build` — runs `vite build`.

### Gotchas

- The `functions/` `package.json` declares `"node": "24"` in engines, but Node 22 works fine for local emulation; the Firebase CLI logs a warning and uses the host Node version.
- Card metadata is a static JSON file bundled with the frontend (`frontend/src/data/storydeck-lt24-with-skus.json`), not stored in Firestore.
- Firestore emulator data is ephemeral — it resets on every emulator restart. Registered users and listings disappear.
- The `firebase emulators:start` command prints an "Unable to look up project number" warning when not authenticated; this is harmless for local development.
