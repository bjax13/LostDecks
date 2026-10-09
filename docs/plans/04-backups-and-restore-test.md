# 04 – Firestore backups + one tested restore (mostly manual)

**Branch:** `ops/backups-runbook` · **PR title:** `Add Firestore backup & restore runbook (docs/ops/backups.md)`

## Goal
Turn on point-in-time recovery and daily scheduled backups for the `(default)` Firestore database in project `storydeck-16`, prove a restore works once, and write it down.

## Why
All user data (collections, preferences) lives only in Firestore. Nothing in the repo configures backups (AGENTS.md "After deploy" only says "Consider … Firestore backup policy"). A bad rules deploy, buggy bulk import (`applyBulkCollectionUpdate` deletes rows set to 0) or account-deletion bug could wipe data with no way back.

## Current state
- `firebase.json` → `"firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" }`; single `(default)` database assumed (locate: confirm with `gcloud firestore databases list --project storydeck-16`).
- Users can download their own CSV (`frontend/src/pages/Collection/components/CollectionBackupDownload.jsx`), which is not a system backup.
- Firestore location is **unknown from the repo** — get it from `gcloud firestore databases describe`.
- Scheduled backups and PITR require the Blaze plan (Cloud Functions already require Blaze, so it's likely on).

## Changes (repo — the only thing the agent does)
1. Create `docs/ops/backups.md` containing the runbook below (commands filled with `storydeck-16`, `(default)`), a "Last restore test" table (date, backup id, doc counts compared, who), and the retention numbers chosen.
2. Link it from `AGENTS.md` "After deploy" bullet ("Firestore backup policy → see docs/ops/backups.md").
3. No code changes. `npm run check` must still pass (Biome ignores markdown, but run it anyway).

## Manual steps for Bryan (run in a terminal with `gcloud auth login`, project owner)
```bash
gcloud config set project storydeck-16
gcloud firestore databases describe --database="(default)"      # note locationId, pointInTimeRecoveryEnablement

# 1) Point-in-time recovery: 7 days of per-minute versions (small extra storage cost)
gcloud firestore databases update --database="(default)" --enable-pitr

# 2) Daily scheduled backup kept 14 days (+ optional weekly kept ~13 weeks)
gcloud firestore backups schedules create --database="(default)" --recurrence=daily --retention=14d
gcloud firestore backups schedules create --database="(default)" --recurrence=weekly --day-of-week=SUN --retention=13w
gcloud firestore backups schedules list --database="(default)"

# 3) Next day: list backups (LOCATION = locationId from step 0, e.g. nam5 or us-central1)
gcloud firestore backups list --format="table(name, database, state, snapshotTime)"

# 4) Test restore into a scratch database in the same project (never over (default))
gcloud firestore databases restore \
  --source-backup=projects/storydeck-16/locations/LOCATION/backups/BACKUP_ID \
  --destination-database=restore-test-YYYYMMDD
# Wait until the operation finishes:
gcloud firestore operations list --database=restore-test-YYYYMMDD
```
5. **Verify the restore:** Firebase console → Firestore → database dropdown → `restore-test-YYYYMMDD`: confirm `collections` and `userPreferences` exist; compare doc counts with `(default)` (console count query, or `gcloud firestore` export metadata). Record results in `docs/ops/backups.md`.
6. **Clean up:** `gcloud firestore databases delete --database=restore-test-YYYYMMDD` (restored DBs are billed like real ones).
7. **PITR drill (optional):** read a doc as of 1 hour ago with `gcloud firestore export gs://BUCKET/pitr-test --snapshot-time=<RFC3339 within last 7d>` (needs a GCS bucket) — or skip and rely on the backup restore test.
8. **How a real restore would work** (document in runbook): restore backup/PITR snapshot into a new DB → inspect → either point the app at it (not supported without code changes — the web SDK uses `(default)`) or copy specific docs back into `(default)` with an Admin script. Simplest path for a total loss: delete and recreate `(default)` from backup is **not** possible in place; plan on per-collection copy. Note this limitation clearly.
9. Repeat the restore test quarterly; add a calendar reminder.

## Tests / verification
- `gcloud firestore backups schedules list` shows both schedules; `databases describe` shows `POINT_IN_TIME_RECOVERY_ENABLED`.
- One successful restore recorded in `docs/ops/backups.md`.

## Done criteria
PITR on, daily backups scheduled, one restore tested and documented, runbook merged.

## Out of scope
Firebase Auth user backup (Auth accounts are not in Firestore; export with `firebase auth:export users.json --project storydeck-16` if desired, and store it securely — it contains password hashes), cross-region DR, automated restore scripts.
