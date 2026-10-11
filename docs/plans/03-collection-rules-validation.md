# 03 – Validate `collections` writes in Firestore rules

**Branch:** `security/collection-rules-validation` · **PR title:** `Validate collection entry shape in firestore.rules (+ first rules tests)`

## Goal
Server-side validation of every client write to `collections/{entryId}`: allowed keys only, sane types and bounds, real SKU format, owner can't be changed.

## Why
Today a signed-in user can write any fields, any size, any `quantity` (negative, float, 1e9, string) and any `skuId` into their own docs. `getTradeMatches` reads *every* collection doc, so junk docs cost money and can poison matches for others.

## Current state
`firestore.rules`:
```
match /collections/{entryId} {
  allow read: if signedIn() && request.auth.uid == resource.data.ownerUid;
  allow create: if signedIn() && request.auth.uid == request.resource.data.ownerUid;
  allow update: if signedIn()
    && request.auth.uid == resource.data.ownerUid
    && request.auth.uid == request.resource.data.ownerUid;
  allow delete: if signedIn() && request.auth.uid == resource.data.ownerUid;
}
```
Every client write path sends exactly `{ ownerUid, skuId, quantity, updatedAt: serverTimestamp() }` plus optional `notes`:
- `frontend/src/pages/Collection/utils/bulkImport.js` (`applyBulkCollectionUpdate`, `batch.set(ref, payload, { merge: true })`, quantity = `Math.max(0, Math.round(n))`, notes trimmed, from CSV only).
- `frontend/src/pages/Collectibles/hooks/useCollectionQuantityMutations.js` (`addDoc` create; `updateDoc` with `{ quantity, updatedAt[, notes] }`; `decrementFromCollection` can write `quantity: 0` when `deleteWhenZero` is false — "soft zero", cleaned by `usePurgeSoftZeroEntriesOnMount.js`).
- `functions/seed-local.js` uses the Admin SDK (bypasses rules).
SKU formats (all 435 SKUs in `frontend/src/storyData/storydeck-lt24-with-skus.json` + `chasmfriends-pins.json`, max length 28):
- Story/Herald: `LT24-ELS-01-DUN`, `LT24-HLD-09-FOIL` (stories `ELS`, `LOP`, `CHM`; heralds `HLD`)
- Nonsense: `LT24-NS-ELS-02-DUN`, variants `LT24-NS-ELS-24-FOIL-DANCE`
- Pins: `PIN-CF-01` … `PIN-CF-05`
No app-wide max quantity exists (no `max=` on quantity inputs). No notes length cap. **No rules tests exist.**

## Changes

### 1. `firestore.rules`
Add helpers above `match /collections/{entryId}`:
```
    function validSkuId(v) {
      return v is string && v.size() <= 64
        && v.matches('^(LT[0-9]{2}-(ELS|LOP|CHM|HLD)-[0-9]{2}-(DUN|FOIL)|LT[0-9]{2}-NS-(ELS|LOP|CHM)-[0-9]{2}-(DUN|FOIL)(-[A-Z]+)?|PIN-[A-Z]{2}-[0-9]{2})$');
    }
    function validQuantity(v) { return v is int && v >= 0 && v <= 999; }
    function validNotes(d) { return !("notes" in d) || (d.notes is string && d.notes.size() <= 500); }
    function validCollectionEntry(d) {
      return d.keys().hasOnly(["ownerUid", "skuId", "quantity", "updatedAt", "notes"])
        && d.keys().hasAll(["ownerUid", "skuId", "quantity", "updatedAt"])
        && d.ownerUid is string
        && validSkuId(d.skuId)
        && validQuantity(d.quantity)
        && d.updatedAt is timestamp
        && validNotes(d);
    }
```
Then:
```
      allow create: if signedIn()
        && request.auth.uid == request.resource.data.ownerUid
        && validCollectionEntry(request.resource.data);
      allow update: if signedIn()
        && request.auth.uid == resource.data.ownerUid
        && request.resource.data.ownerUid == resource.data.ownerUid
        && request.resource.data.skuId == resource.data.skuId
        && request.resource.data.diff(resource.data).affectedKeys()
             .hasOnly(["quantity", "updatedAt", "notes", "skuId", "ownerUid"])
        && validQuantity(request.resource.data.quantity)
        && request.resource.data.updatedAt is timestamp
        && validNotes(request.resource.data);
```
Why updates use `affectedKeys()` instead of full `validCollectionEntry`: production docs written before this PR might carry extra/legacy fields; a full-doc `hasOnly` would block every update to them. (Bryan can tighten to full validation after the data check in Manual steps.)
Keep the 0..999 cap generous; `0` must stay allowed (soft-zero path). Note `quantity` must be an **int**: all client paths already floor/round, so this is safe.

### 2. Client guardrails (so users see friendly errors, not permission-denied)
- `bulkImport.js`: clamp/skip rows with quantity > 999 and report them like other invalid rows (follow the existing invalid-row reporting pattern in that file); truncate `notes` to 500 chars. Add cases in `bulkImport.test.js`.
- `useCollectionQuantityMutations.js` `addToCollection`: if `nextQuantity > 999` throw a user-facing error before writing. Add a test in `useCollectionQuantityMutations.test.js`.
- Export `MAX_COLLECTION_QUANTITY = 999` and `MAX_COLLECTION_NOTES_LENGTH = 500` from a shared module (e.g. new `frontend/src/lib/collectionLimits.js`) and use it in both.

### 3. SKU-pattern drift test (runs in existing CI job "Deploy helper tests")
New `scripts/firestoreRulesSkuPattern.test.js` (node:test, CommonJS like the other `scripts/*.test.js` — check their style first): read `firestore.rules`, extract the regex inside `validSkuId`, read both catalog JSONs, assert every `skuId` matches and that `"LT24-ELS-01"`, `"pin-cf-01"`, `"X".repeat(65)` do not. This catches catalog additions that the rules would reject.

### 4. Rules unit tests (new, emulator-based)
- New folder `firestore-tests/` with `package.json` (`"test": "node --test"`, devDeps `@firebase/rules-unit-testing`, `firebase`) and `collections.rules.test.js` using `initializeTestEnvironment({ projectId: "storydeck-16", firestore: { rules: readFileSync("../firestore.rules","utf8") } })`.
- Cases: owner create valid ✓; create with extra field ✗; negative / float / string / 1000 quantity ✗; bad skuId ✗; notes 501 chars ✗; create for other uid ✗; update quantity ✓; update changing ownerUid or skuId ✗; update adding unknown key ✗; read other user's doc ✗; `userPreferences` existing behavior still ✓ (one smoke case).
- Root `package.json` script: `"test:rules": "firebase emulators:exec --only firestore --project storydeck-16 \"npm test --prefix firestore-tests\""` (use `npx firebase-tools` if the CLI isn't global; requires Java 11+).
- `biome.json` lints the whole repo (only the VCS ignore file excludes paths), so new files must pass `npm run check`. `firestore-tests/node_modules` is already ignored by the root `.gitignore` entry `node_modules/`.
- Optional CI job `rules-test` in `.github/workflows/frontend-tests.yml` (setup-java 17 + `npm ci` in `firestore-tests` + `npm run test:rules`) and add it to `ci-success` `needs`. If that's too heavy, leave it local-only and say so in the PR.

## Manual steps for Bryan
1. Before deploying rules, check production data for unexpected fields/values: Firestore console → `collections` → spot-check, or run a one-off Admin script locally (do not commit) that counts docs with keys outside the allowed set, non-int quantity, or quantity > 999.
2. Deploy rules only: `npx firebase-tools deploy --only firestore:rules --project storydeck-16`, then test add/remove/bulk import/getting-started save on the live site.
3. Rollback if needed: Firebase console → Firestore → Rules → history → restore previous version.

## Tests / verification
`npm run check`; `npm run test:scripts`; `cd frontend && npm run test:coverage`; `npm run test:rules` (emulator). Manually in emulators: getting-started save, +/- on Collectibles, CSV bulk import, ISO/UFT still work.

## Done criteria
Rules reject malformed collection writes; all existing UI write paths still succeed; SKU drift test + rules tests pass.

## Out of scope
`userPreferences` rules (already validated), rate-limiting writes (count-based limits aren't expressible in rules), server-side migration of legacy docs.
