# ShardStash implementation plans

Grounded in `bjax13/LostDecks` at `main` = `37e07e0` ("Add per-lane keep counts for Matches (#149)").
Each file is one self-contained task: **one branch + one PR per file**, in this order.

| # | File | One line | Size |
|---|------|----------|------|
| 01 | `01-protect-the-bill.md` | App Check + `enforceAppCheck`/`maxInstances` + per-user cooldown on `getTradeMatches`; budget alert (manual) | M |
| 02 | `02-privacy-terms-account-deletion.md` | `/privacy` + `/terms` pages, footer links, sign-up consent line, `deleteMyAccount` callable + Account UI | S–M |
| 03 | `03-collection-rules-validation.md` | Field/type/size validation for `collections` writes in `firestore.rules` + rules tests | S |
| 04 | `04-backups-and-restore-test.md` | Mostly manual: PITR + scheduled backups, one test restore, `docs/ops/backups.md` | M (manual) |
| 05 | `05-error-tracking-and-error-page.md` | Top-level error boundary + friendly crash page, PostHog exception capture, favicon/robots.txt | S |
| 06 | `06-analytics-funnel-fix.md` | Stop `posthog.reset()` on every signed-out load; add funnel events | S |
| 07 | `07-qr-have-need-onboarding.md` | Growth: QR → fast have/need picker → sign-up → auto-save → Matches | M |
| 08 | `08-share-iso-uft-links.md` | Growth: link-back + shorthand in ISO/UFT post; opt-in public trade list `/t/:shareId` | S → M |

Recommended: 01, 02, 03, 06 first (06 is a prerequisite for measuring 07/08). 04 is console work Bryan can do any time. 07 should land before Dragonsteel Nexus (Dec 3–5, 2026).

## How to use in Cursor (Auto mode)

1. `git checkout main && git pull`
2. `git checkout -b <branch name from the plan>`
3. In Cursor chat: **"Implement @docs/plans/NN-....md. Follow AGENTS.md. Run the checks listed in the plan and fix failures before finishing."**
4. Do the **Manual steps for Bryan** section yourself (console work is never done by the agent).
5. Run the full local check (below), commit, push, open the PR with the plan's suggested title. Link the plan file in the PR body.
6. Don't start the next plan until the previous PR is merged (several plans touch the same files: `App.jsx`, `firestore.rules`, `functions/index.js`, `analytics/posthog.js`).

## Repo conventions (from AGENTS.md and `.github/workflows/frontend-tests.yml`)

- Layout: `frontend/` = Vite + React 19 SPA (React Router 7); `functions/` = Firebase Functions v2 (`firebase-functions` 7, `firebase-admin` 13, CommonJS, Node 24 engines); rules in `firestore.rules`; Firebase project `storydeck-16`; Hosting target `shardstash` → https://shardstash.web.app.
- Installs: `npm install` (root: Biome, Husky, lint-staged), `cd frontend && npm install`, `cd functions && npm install`.
- **Before every commit:** `npm run check` from repo root (Biome format + lint + import sort, writes fixes). CI runs `npm run ci` (`biome ci .`, read-only).
- CI jobs (all must pass; branch protection uses "CI success"):
  - **Biome**: `npm run ci`
  - **Deploy helper tests**: `npm run test:scripts` (`scripts/*.test.js`)
  - **Frontend unit & coverage**: `cd frontend && npm run test:coverage` (Vitest + Testing Library; tests sit next to source as `*.test.{js,jsx}`; setup `frontend/src/test/setup.js`). Prefer role/label queries and `userEvent`.
  - **Cloud Functions tests**: `cd functions && npm test` (Node built-in runner, `*.test.js` next to source, e.g. `functions/matches.test.js`).
  - **E2E**: `cd frontend && npm run test:e2e` (Playwright, builds + previews on :4173; specs in `frontend/e2e/`). CI builds **without** Firebase config, so E2E only covers public/signed-out UI.
- Local full stack: `firebase emulators:start --project storydeck-16` (Auth 9099, Firestore 8080, Functions 5001, UI 4000) + `cd frontend && npm run dev -- --host 0.0.0.0`; `frontend/.env` with `VITE_USE_EMULATORS=true` (copy `frontend/.env.emulator.example`). Seed: `npm run seed:local`. Shortcut: `npm run dev:local`.
- Deploys are manual only: `npm run deploy:hosting` / `npm run deploy:firebase` (`scripts/deploy-production.js` forwards `process.env` into the Vite build). Any new `VITE_*` var must also be added to the deploy step `env:` in `.github/workflows/deploy-firebase.yml` and `deploy-frontend.yml` (like `VITE_POSTHOG_KEY`).
- Note: AGENTS.md says `test:coverage` enforces 90% thresholds, but `frontend/vite.config.js` at 37e07e0 has no `thresholds` block. Still add tests for new modules.
- There are **no Firestore rules tests** in the repo today; plan 03 adds the first ones.

## Per-PR checklist (paste into the PR)

- [ ] `npm run check` (root) clean
- [ ] `cd frontend && npm run test:coverage`
- [ ] `cd functions && npm test` (if `functions/` touched)
- [ ] `cd frontend && npm run test:e2e` (if routes/UI touched)
- [ ] Manual steps from the plan done or listed as follow-ups in the PR body
