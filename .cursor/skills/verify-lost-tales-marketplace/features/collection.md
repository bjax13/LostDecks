# Collection

Collection is the signed-in inventory: quantities already saved for the collector, getting-started setup that writes those quantities, and bulk CSV / ISO-UFT tools.

## Sub-features

- `collection-empty-gate` redirects signed-out visitors to login.
- `collection-seeded` shows Collector One's seeded rows and summary stats.
- `collection-getting-started-type` chooses ChasmFriends Pins, Story Deck Cards, or Both before a storage profile.
- `collection-getting-started-manual` reviews cards or pins and saves quantities.
- `collection-getting-started-spreadsheet` points a spreadsheet collector at bulk import (Story Deck / Both only).
- `collection-bulk` exposes empty template, full-set template, Story Deck quantities (current), upload, and Copy ISO/UFT post.

## How to get to it (user POV)

- Choose `Collection` in the primary navigation.
- Choose `Track What You Own` or `See What's Missing` on Home (both go to `/collections`).
- Choose `Getting Started` from Home, complete the wizard, and save.
- Open `/collections` or `/getting-started` directly.
- From the spreadsheet branch of Getting Started, choose `Go to bulk import` (signed in) which lands on `/collections#bulk-import`.

## Driving it with verify-lost-tales

Preconditions:

- ShardStash is healthy at `http://127.0.0.1:5173`.
- Seed data has not been overwritten since launch (or `$VERIFY seed` was just run).
- `doctor` reports `ok=true`.

- **Signed-out gate.** Open Collection signed out. Run `$VERIFY drive logout` then `$VERIFY drive click --role link --name Collection --scope nav`. The heading `Sign in to ShardStash` is visible.
- **Seeded inventory.** Sign in as Collector One, then open Collection. Run `$VERIFY drive login --email collector.one@example.com --password replace-me-local-only`, then `$VERIFY drive click --role link --name Collection --scope nav`. Run `$VERIFY drive expect --testid collection-page-heading`. Summary includes `Unique Cards` and the table lists Elsecaller cards from the seed (`LT24-ELS-01` / `LT24-ELS-03` quantities). Empty copy `No collectibles catalogued yet` is absent.
- **Bulk tools.** Confirm the bulk region and download hooks. Run `$VERIFY drive expect --testid collection-bulk-tools`. Buttons `Empty template (all 0s)`, `Full-set template (all 1s)`, and `Story Deck quantities (current)` (`bulk-download-zeros`, `bulk-download-ones`, `bulk-download-current`) are enabled, and `Copy ISO/UFT post` is visible.
- **Getting started profile.** Open the wizard. Run `$VERIFY drive goto --path /getting-started`. The eyebrow `ShardStash setup` and heading `Build your collection without entering every card.` and `What best describes you?` are visible.
- **Manual branch.** Choose Story Deck and the non-spreadsheet profile. Run `$VERIFY drive click --testid getting-started-type-cards`, `$VERIFY drive click --testid getting-started-profile-manual`, then `$VERIFY drive click --testid getting-started-continue`. Heading `Review your collection` is visible with a tree named `Cards to review`.
- **Spreadsheet branch.** Go back and choose spreadsheet. Run `$VERIFY drive click --testid getting-started-review-back`, `$VERIFY drive click --testid getting-started-type-cards`, `$VERIFY drive click --testid getting-started-profile-spreadsheet`, `$VERIFY drive click --testid getting-started-continue`. Heading `Prepare your collection for bulk import.` is visible. Signed in, `Go to bulk import` is a link to the collection bulk section.
- **Save requires session.** On the manual branch while signed out, the primary action is `Sign in and save` (opens the auth modal) rather than `Save collection`.
- **Proof.** Capture Collector One's collection. Run `$VERIFY drive login --email collector.one@example.com --password replace-me-local-only`, `$VERIFY drive click --role link --name Collection --scope nav`, `$VERIFY drive screenshot --path /tmp/lost-tales-verify/artifacts/collection/collector-one.png --full-page`, and `$VERIFY drive snapshot --path /tmp/lost-tales-verify/artifacts/collection/collector-one.aria.txt`. Artifacts show `Your Collection`, seeded Elsecaller rows, and `Hi, Collector One`.

## Gotchas

- Direct `/auth/login` (no `?redirect=` and no `state.from`) lands on `/` after success. Open Collection from the nav to prove the gated page.
- `$VERIFY seed` uses `--wipe` for seed users. Do not seed while proving an in-progress getting-started save you have not captured yet.
- Getting Started `getting-started-continue` stays disabled until a collectible type and profile radio are chosen.
- Use `getting-started-review-back` or `getting-started-spreadsheet-back` for wizard Back controls. Do not match footer `Feedback` with a loose `Back` name.
- Choosing coverage `None` on a group can open a dialog `Set all cards to zero?` with `Set to none` / `Cancel`.
- Bulk upload mutates Firestore. After uploading a CSV, re-check the collection table, then `$VERIFY seed` before Matches recipes that depend on the original quantities.
- CSV download buttons trigger a browser download. Assert the click does not error; capturing the file is optional proof.
