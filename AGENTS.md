# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

ShardStash is a single-product Vite + React 18 SPA (`frontend/`) backed by Firebase (Auth, Firestore, Cloud Functions in `functions/`). There is no custom backend server; all server-side logic runs as Firebase callable Cloud Functions.

### Repository layout

| Path | Role |
|------|------|
| `frontend/` | Vite + React app; run dev server and frontend tests here |
| `functions/` | Cloud Functions (`firebase-functions` + `firebase-admin`); emulator loads this code |
| `firebase.json`, `.firebaserc` | Hosting target `shardstash` (`frontend/dist` → https://shardstash.web.app), emulators, Firestore, Functions; default Firebase project `storydeck-16` |
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
- **Deploy helper tests**: `npm run test:scripts` from the repo root (`scripts/*.test.js`).
- **End-to-end tests**: Playwright (`cd frontend && npm run test:e2e`). Locally the config builds then previews the production bundle on port 4173. In CI, the workflow builds once and sets `PLAYWRIGHT_SKIP_BUILD=1` so Playwright only runs preview. Specs live under `frontend/e2e/`.
- **Build**: `cd frontend && npm run build` — runs `vite build`.
- **Production deploy (local CLI)**: `npm run deploy:firebase` (or `deploy:hosting`) from the repo root. These commands run `scripts/deploy-production.js`, which fetches live Firebase Web SDK config (`apps:sdkconfig`) from project `storydeck-16`, injects `VITE_FIREBASE_*` at build time, creates Hosting site `shardstash` if it is missing, adds Auth authorized domains for that site, and deploys Hosting to target `shardstash` (https://shardstash.web.app). Production builds set `VITE_FIREBASE_AUTH_DOMAIN` to the public Hosting host (`shardstash.web.app`), not the sdkconfig default `storydeck-16.firebaseapp.com`, so Google's account chooser shows the public host. Override with `FIREBASE_AUTH_DOMAIN` if you need a different host. Emulator runs (`VITE_USE_EMULATORS=true`) are unchanged. Requires `firebase login` or `GOOGLE_APPLICATION_CREDENTIALS`. The GCP/Firebase project id stays `storydeck-16`. Optional `VITE_POSTHOG_KEY` / `VITE_POSTHOG_HOST` from the environment (or `frontend/.env` via Vite) enable product analytics in the Hosting bundle.
- **Raw deploy scripts** (only for controlled CI/debug): `npm run deploy:firebase:raw` and `npm run deploy:hosting:raw` use whatever `VITE_FIREBASE_*` values are already present in the environment and deploy Hosting to `hosting:shardstash`. They do not create the site or update Auth authorized domains; prefer the safe commands above for normal use.

### Production deployment

1. **Firebase console (one-time per project)**  
   - Enable **Authentication** providers you ship (see `frontend/README.md`).  
   - Production Hosting is the named site `shardstash` at https://shardstash.web.app. Deploy scripts try to add Auth authorized domains `shardstash.web.app` and `shardstash.firebaseapp.com` via the Identity Toolkit API using `GOOGLE_APPLICATION_CREDENTIALS`.  
   - If that step fails (missing token or 403), add the domains by hand: Firebase console → project `storydeck-16` → Authentication → Settings → Authorized domains → Add domain. Google sign-in on the new host will fail until those domains are listed. Grant the GitHub Actions service account **Identity Toolkit Admin** (`roles/identitytoolkit.admin`) or **Editor** if you want CI to update them.  
   - Google's account chooser "continue to" host comes from `authDomain`. Production injects `shardstash.web.app`. If Google sign-in then fails with `redirect_uri_mismatch`, add these on the Firebase-created OAuth 2.0 **Web client** (Google Cloud Console → project `storydeck-16` → APIs & Services → Credentials): Authorized JavaScript origins `https://shardstash.web.app`; Authorized redirect URIs `https://shardstash.web.app/__/auth/handler`. Do not rename the GCP/Firebase project id.  
   - Open **Hosting** in the console if you have not used Hosting before. The default site `storydeck-16` (`https://storydeck-16.web.app`) is left in place and may go stale; new releases go only to `shardstash`.

2. **GitHub Actions (optional automation)**  
   Workflows (manual **Run workflow** only). Pick the branch in the GitHub Actions UI (use the PR branch to poke a pre-merge deploy):
   - `Front end only deploy` (`.github/workflows/deploy-frontend.yml`) → `npm run deploy:hosting` (creates site `shardstash` if missing, then deploys Hosting)
   - `Full project deploy` (`.github/workflows/deploy-firebase.yml`) → `npm run deploy:firebase` (same Hosting target, plus Firestore and Functions)

   Configure these **repository secrets**:

   | Secret | Purpose |
   |--------|---------|
   | `FIREBASE_SERVICE_ACCOUNT_JSON` | Full JSON for a service account that can deploy Hosting, Firestore rules/indexes, and Cloud Functions (Firebase recommends a dedicated CI account with the right IAM roles). Site create needs `firebasehosting.sites.create`. Authorized-domain updates need `firebaseauth.configs.update` (Identity Toolkit Admin or Editor). |
   | `VITE_POSTHOG_KEY` | Optional PostHog project API key (`phc_…`). When set, Hosting builds include product analytics. |
   | `VITE_POSTHOG_HOST` | Optional PostHog API host (default in app/scripts: `https://us.i.posthog.com`). |

   Both workflows use the safe repo scripts (`npm run deploy:firebase` / `npm run deploy:hosting`), which fetch Firebase Web SDK config (`apps:sdkconfig`) from project `storydeck-16` at deploy time and forward `VITE_POSTHOG_*` from the environment when present. `VITE_FIREBASE_*` repo secrets are no longer required.

3. **What gets deployed**  
   `firebase deploy --only hosting:shardstash,firestore,functions` publishes the Vite build from `frontend/dist` to https://shardstash.web.app, plus Firestore rules/indexes and Cloud Functions. It does not deploy other Google Cloud resources, and it does not overwrite the default `storydeck-16` Hosting site. If site id `shardstash` is taken globally, the deploy helper tries `shard-stash` then `shardstash-app`.

4. **After deploy**  
   Consider **App Check**, error/monitoring dashboards, and Firestore **backup** policy for your risk tolerance.

### Gotchas

- The `functions/` `package.json` declares `"node": "24"` in engines, but Node 22 works fine for local emulation; the Firebase CLI logs a warning and uses the host Node version.
- Card metadata is a static JSON file bundled with the frontend (`frontend/src/data/storydeck-lt24-with-skus.json`), not stored in Firestore.
- Firestore emulator data is ephemeral — it resets on every emulator restart. Registered users and listings disappear.
- The `firebase emulators:start` command prints an "Unable to look up project number" warning when not authenticated; this is harmless for local development.
