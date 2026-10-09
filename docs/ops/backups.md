# Firestore backups & restore (storydeck-16)

Runbook for the `(default)` Firestore database in Firebase project **`storydeck-16`**. All ShardStash user data (collections, preferences) lives only here. Per-user CSV download in the app is **not** a system backup.

Nothing in this repo enables backups. Turn them on in Google Cloud / Firebase (Blaze required), prove a restore once, then keep this file current.

## Retention (chosen)

| Mechanism | Retention | Notes |
|-----------|-----------|--------|
| Point-in-time recovery (PITR) | **7 days** | Per-minute versions; small extra storage cost |
| Daily scheduled backup | **14 days** | Recurrence `daily` |
| Weekly scheduled backup | **13 weeks** | Recurrence `weekly`, day-of-week `SUN` |

Update this table if you change schedules.

## Prerequisites

- Project on **Blaze** (Cloud Functions already imply this).
- `gcloud` CLI authenticated as a project owner (or equivalent): `gcloud auth login`
- Project set: `gcloud config set project storydeck-16`

Confirm the database and note **`locationId`** (needed for backup paths; not stored in this repo):

```bash
gcloud firestore databases list --project storydeck-16
gcloud firestore databases describe --database="(default)" --project storydeck-16
```

Record here after first run:

| Field | Value |
|-------|--------|
| `locationId` | _fill from `databases describe` (e.g. `nam5`, `us-central1`)_ |
| PITR | _`POINT_IN_TIME_RECOVERY_ENABLED` after step 1_ |

## Enable PITR

```bash
gcloud firestore databases update --database="(default)" --enable-pitr --project storydeck-16
gcloud firestore databases describe --database="(default)" --project storydeck-16
# Expect pointInTimeRecoveryEnablement: POINT_IN_TIME_RECOVERY_ENABLED
```

## Create scheduled backups

```bash
gcloud firestore backups schedules create \
  --database="(default)" \
  --recurrence=daily \
  --retention=14d \
  --project storydeck-16

gcloud firestore backups schedules create \
  --database="(default)" \
  --recurrence=weekly \
  --day-of-week=SUN \
  --retention=13w \
  --project storydeck-16

gcloud firestore backups schedules list --database="(default)" --project storydeck-16
```

## List backups

Replace `LOCATION` with `locationId` from above.

```bash
gcloud firestore backups list \
  --format="table(name, database, state, snapshotTime)" \
  --project storydeck-16
```

Daily schedule produces a usable backup after the first successful run (typically the next day).

## Test restore (never onto `(default)`)

Restore into a **scratch** database in the same project. Restored databases are billed like production — delete when done.

```bash
# BACKUP_ID from backups list; LOCATION = locationId
gcloud firestore databases restore \
  --source-backup=projects/storydeck-16/locations/LOCATION/backups/BACKUP_ID \
  --destination-database=restore-test-YYYYMMDD \
  --project storydeck-16

gcloud firestore operations list --database=restore-test-YYYYMMDD --project storydeck-16
```

### Verify

1. Firebase console → Firestore → database dropdown → `restore-test-YYYYMMDD`
2. Confirm top-level collections include at least `collections` and `userPreferences`
3. Compare approximate doc counts with `(default)` (console, or export metadata)
4. Fill the **Last restore test** table below

### Clean up

```bash
gcloud firestore databases delete --database=restore-test-YYYYMMDD --project storydeck-16
```

## How a real (production) restore would work

**Limitation:** the web SDK and this app use the `(default)` database. You cannot “point the app” at a restored DB without code/config changes. You also **cannot** restore a backup in place over `(default)` in one click.

Practical paths:

1. **Scratch restore + selective copy** — restore backup (or PITR export) into a new DB, inspect, then copy needed documents back into `(default)` with an Admin SDK script (per-collection / per-doc). Prefer this for partial loss (bad rules deploy, buggy bulk import, bad account deletion).
2. **Total loss of `(default)`** — still restore to a new database first; plan a careful Admin copy into a recreated `(default)`. Do not assume in-place overwrite is available.
3. **PITR export (optional drill)** — if you need a point-in-time snapshot into GCS:

   ```bash
   # Needs a GCS bucket you control; snapshot-time within the last 7 days (RFC3339)
   gcloud firestore export gs://BUCKET/pitr-test \
     --snapshot-time=<RFC3339> \
     --project storydeck-16
   ```

   Optional; the scheduled-backup restore test is enough for the first pass.

## Out of scope (for this runbook)

- **Firebase Auth** users are not in Firestore. Optional: `firebase auth:export users.json --project storydeck-16` (contains password hashes — store securely).
- Cross-region disaster recovery.
- Automated restore scripts in this repo.

## Cadence

- After enabling schedules: complete **one** restore test and record it below.
- Repeat the restore test **quarterly**; set a calendar reminder.

## Last restore test

| Date | Backup id | Doc counts compared (`collections` / `userPreferences`) | Who | Notes |
|------|-----------|----------------------------------------------------------|-----|-------|
| _pending_ | | | | Enable schedules, wait for first backup, then restore to `restore-test-YYYYMMDD` |

## Bryan checklist (console / gcloud)

Do these yourself (agent does not run them):

1. [ ] `gcloud auth login` and `gcloud config set project storydeck-16`
2. [ ] `databases describe` — record `locationId` in the table above
3. [ ] Enable PITR (`--enable-pitr`); confirm `POINT_IN_TIME_RECOVERY_ENABLED`
4. [ ] Create daily (14d) and weekly Sunday (13w) backup schedules; confirm with `schedules list`
5. [ ] After first backup exists: restore to `restore-test-YYYYMMDD` (never onto `(default)`)
6. [ ] Verify `collections` + `userPreferences` and compare counts with `(default)`
7. [ ] Fill **Last restore test** in this file (follow-up commit or PR)
8. [ ] Delete `restore-test-YYYYMMDD`
9. [ ] Add a quarterly calendar reminder for the next restore drill
10. [ ] (Optional) PITR export drill to a GCS bucket

## See also

- Plan: `docs/plans/04-backups-and-restore-test.md` (when that tree is on the branch)
- User CSV export UI: `frontend/src/pages/Collection/components/CollectionBackupDownload.jsx`
