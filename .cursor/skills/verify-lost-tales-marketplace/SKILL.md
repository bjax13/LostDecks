---
name: verify-lost-tales-marketplace
description: Verify ShardStash (Vite + React SPA) through the real browser UI with the Playwright harness. Use when proving a user-facing change, before merging UI/auth/collection/matches work, or when asked to drive the running app the way a collector would.
---

# Verify ShardStash

ShardStash is a Vite + React 18 SPA in `frontend/` backed by Firebase Auth, Firestore, and callable Cloud Functions in `functions/`. The user-facing surface is the web UI at `http://127.0.0.1:5173`. Card catalog data is static JSON bundled with the frontend; collection, matches, and account state live in Firestore.

Drive that UI. Do not treat Vitest, Playwright specs under `frontend/e2e/`, or Cloud Function unit tests as proof of a user-facing change.

Harness entry (from the repo root):

```bash
VERIFY="node .cursor/skills/verify-lost-tales-marketplace/scripts/verify-lost-tales.mjs"
```

## Launch

The stack is two long-lived processes plus a Playwright driver:

1. Firebase Emulator Suite — Auth `9099`, Firestore `8080`, Functions `5001`, Emulator UI `4000`
2. Vite dev server — `http://127.0.0.1:5173`
3. Headless Chromium driver — `http://127.0.0.1:17331` (verification only; not part of the product)

Start all three, wipe-and-seed emulator users, and wait until the UI answers:

```bash
$VERIFY launch
```

Ready when stdout includes `ok=true` and `url=http://127.0.0.1:5173`. `launch` also writes `/tmp/lost-tales-verify/run.json` with the PIDs it started.

Launch injects emulator Firebase config through the Vite process environment (`VITE_USE_EMULATORS=true` plus placeholder `VITE_FIREBASE_*`). It does not create or overwrite `frontend/.env`.

Seeded email/password (from `functions/seed.local.example.json`, unless a gitignored `functions/seed.local.json` exists):

- `collector.one@example.com` / `replace-me-local-only` (display name Collector One)
- `collector.two@example.com` / `replace-me-local-only` (display name Collector Two)

Teardown is `cleanup` (below). Leave the instance up while driving; do not start a second copy.

## Doctor

Run this before the first drive, after any failed drive, and whenever the UI looks off:

```bash
$VERIFY doctor
```

Require `ok=true`. Doctor checks, read-only:

- `/tmp/lost-tales-verify/run.json` exists and its emulator, Vite, and driver PIDs are alive
- `GET http://127.0.0.1:5173` is HTTP 200 and the HTML includes `ShardStash`
- Auth emulator answers on `127.0.0.1:9099`
- Playwright driver `GET http://127.0.0.1:17331/health` returns `ok`

If doctor fails, run `cleanup` then `launch`. Do not drive an instance you did not start.

## Drive

The driver keeps one browser context for the life of the run. Each command is one user action (or the documented `login` / `logout` sequences, which fill the real `/auth/login` form and press the real Sign out control).

```bash
$VERIFY drive goto --path /collectibles
$VERIFY drive click --role link --name Collectibles --scope nav
$VERIFY drive fill --label Search --value Elsecaller
$VERIFY drive select --label Category --value "Story cards"
$VERIFY drive expect --role heading --name Collectibles
$VERIFY drive expect-url --path /collectibles
$VERIFY drive screenshot --path /tmp/lost-tales-verify/artifacts/collectibles/grid.png --full-page
$VERIFY drive snapshot --path /tmp/lost-tales-verify/artifacts/collectibles/grid.aria.txt
$VERIFY drive login --email collector.one@example.com --password replace-me-local-only
$VERIFY drive logout
```

Locator flags:

| Flag | Meaning |
|------|---------|
| `--testid` | `getByTestId` — preferred for hooks listed below |
| `--role` + `--name` | `getByRole` (heading, link, button, navigation, searchbox, textbox, status, radio, checkbox, region) |
| `--label` | `getByLabel` (Search, Email, Password, Category, Story, Rarity) |
| `--placeholder` | `getByPlaceholder` |
| `--text` | `getByText` |
| `--scope nav` | Restrict to `primary-nav` test id |
| `--nth N` | 0-based match when several elements share a name |
| `--exact` | Exact accessible name when role/name would substring-match another control |
| `--force` | Playwright force-click (test id and radio clicks already force-click) |

Stable `data-testid` hooks (product code owns these; verification map and Playwright should target them):

| Test id | Use |
|---------|-----|
| `primary-nav`, `nav-sign-in`, `nav-sign-out` | Primary navigation session |
| `home-sign-in` | Home hero opens auth modal |
| `auth-modal`, `auth-modal-close`, `auth-modal-submit` | In-page auth modal |
| `login-submit` | `/auth/login` form submit |
| `collectibles-page-heading`, `collectibles-grid`, `collectibles-table` | Catalog layout |
| `collectible-tile-<id>`, `collectible-detail-link-<id>` | Grid expand then navigate to detail |
| `collectible-detail-back` | Detail page back control |
| `collection-page-heading`, `collection-bulk-tools` | Signed-in collection |
| `bulk-download-zeros`, `bulk-download-ones`, `bulk-download-current` | Story Deck CSV downloads |
| `getting-started-type-pins`, `getting-started-type-cards`, `getting-started-type-both` | Collectible type step |
| `getting-started-profile-manual`, `getting-started-profile-spreadsheet` | Storage profile radios |
| `getting-started-continue`, `getting-started-review-back`, `getting-started-spreadsheet-back` | Wizard navigation |
| `site-footer`, `site-feedback-open`, `site-feedback-dialog` | Footer and feedback modal |

Accessible names still used where no test id exists:

- Home h1: `Track your collectibles in one place.`
- Collectibles: search label `Search`; filters `Category`, `Story`, `Rarity`; buttons `Grid view`, `Table view`, `Reset filters`
- Login h1: `Sign in to ShardStash`; Register h1: `Create your ShardStash account`
- Matches h1: `Matches`; Account h1: `Account Settings`

Read `features/README.md` and the matching feature file before driving. A proof that uses one convenient entry point is incomplete when the map lists others.

## Evidence

Write proof under `/tmp/lost-tales-verify/artifacts/<feature-id>/`. Cleanup must not delete that directory.

Every proof:

1. Exercises a real user path from the feature map (click, type, submit, navigate). Do not call Firestore, callable functions, or Auth REST as a stand-in for the UI.
2. Captures the action and the resulting state: screenshot plus ARIA snapshot, and `drive text` / `drive expect` output in the same directory (`doctor.txt`, `commands.log` as needed).
3. For mutations (sign-in, add-to-collection, save getting-started, match opt-out), confirm a second user-facing view (nav session text, Collection table, Matches empty/opt-out copy).
4. Names the feature ID and entry point in the artifact filenames or a sibling `proof.txt`.

Mocks: none on the UI path. Emulators are the production boundary for Auth/Firestore/Functions. Google sign-in is not verifiable against emulators without a real OAuth popup; use email/password.

## Cleanup

```bash
$VERIFY cleanup
```

Sends SIGTERM (then SIGKILL) to the emulator, Vite, and driver process groups recorded in `run.json`. It never kills by process name. It deletes `run.json` and leaves `/tmp/lost-tales-verify/artifacts/` in place.

After cleanup, confirm evidence still exists:

```bash
ls /tmp/lost-tales-verify/artifacts
```

## Isolate

Auth/Firestore/Functions/UI/Vite ports are the repo defaults and cannot host two stacks at once. If doctor or launch reports a port owned by a PID this run did not start, stop. Do not attach the driver to a developer's already-running `npm run dev` or `firebase emulators:start` — seeding wipes seed-user collection docs.

## Helpers

| Command | What it does |
|---------|----------------|
| `$VERIFY launch` | Install frontend/functions deps if needed, install Chromium, start emulators + Vite + driver, seed |
| `$VERIFY doctor` | Read-only health check; exit 1 when the instance is not worth driving |
| `$VERIFY seed` | Re-run `functions/seed-local.js --wipe` |
| `$VERIFY drive …` | One Playwright action against the live UI |
| `$VERIFY cleanup` | Stop PIDs from `run.json`; keep artifacts |

Scripts live in `.cursor/skills/verify-lost-tales-marketplace/scripts/` and are executable. `driver-server.mjs` is started by `launch`; do not run it directly.

## Feature map

[features/README.md](features/README.md)

## Maintenance

Use `/maintain-verification-skill` to keep this map honest. The committed weekly prompt is `.cursor/automations/maintain-verification-skill/PROMPT.md` (Friday 8:00 AM America/Denver once the Cursor Automation is enabled).
