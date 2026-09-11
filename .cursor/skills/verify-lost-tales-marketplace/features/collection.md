# Collection

Collection is the signed-in inventory: quantities already saved for the collector, getting-started setup that writes those quantities, and bulk CSV / ISO-UFT tools.

## Sub-features

- `collection-empty-gate` redirects signed-out visitors to login.
- `collection-seeded` shows Collector One's seeded rows and summary stats.
- `collection-getting-started-manual` reviews cards and saves quantities.
- `collection-getting-started-spreadsheet` points a spreadsheet collector at bulk import.
- `collection-bulk` exposes Empty template (all 0s), Full-set template (all 1s), My collection (current), Upload filled template, and Copy ISO/UFT post.
- `collection-quantity` increments and decrements a row with `+1` / `−1` (`Increase quantity for …` / `Decrease quantity for …`).

## How to get to it (user POV)

- Choose `Collection` in the primary navigation.
- After login, accept the default redirect to `/collections`.
- Choose `Track What You Own` or `See What's Missing` on Home (both go to `/collections`).
- Choose `Getting Started` from Home, complete the wizard, and save.
- Open `/collections` or `/getting-started` directly.
- From the spreadsheet branch of Getting Started, choose `Go to bulk import` (signed in) which lands on `/collections#bulk-import`.

## Driving it with verify-lost-tales

Preconditions:

- Lost Tales Marketplace is healthy at `http://127.0.0.1:5173`.
- Seed data has not been overwritten since launch (or `$VERIFY seed` was just run).
- `doctor` reports `ok=true`.

- **Signed-out gate.** Open Collection signed out. Run `$VERIFY drive logout` then `$VERIFY drive click --role link --name Collection --scope nav`. The heading `Sign in to Lost Tales Marketplace` is visible.
- **Seeded inventory.** Sign in as Collector One. Run `$VERIFY drive login --email collector.one@example.com --password replace-me-local-only`. `$VERIFY drive expect --role heading --name "Your Collection" --exact`. Summary includes `Unique Cards` and the table lists Elsecaller seed SKUs `LT24-ELS-01-DUN` / `LT24-ELS-03-DUN`. Empty copy `No collectibles catalogued yet` is absent.
- **Row quantity.** Seeded Elsecaller #01 Dun is 2. Run `$VERIFY drive expect --role button --name "Increase quantity for Elsecaller #01"` and `$VERIFY drive expect --role button --name "Decrease quantity for Elsecaller #01"`.
- **Bulk tools.** Confirm the bulk region. Run `$VERIFY drive expect --role heading --name "Bulk update your collection"`. Buttons `Empty template (all 0s)`, `Full-set template (all 1s)`, `My collection (current)`, and `Copy ISO/UFT post` are enabled, and `Upload filled template` is visible.
- **Getting started profile.** Open the wizard. Run `$VERIFY drive goto --path /getting-started`. Heading `Build your collection without entering every card.` and `What best describes you?` are visible.
- **Manual branch.** Choose the non-spreadsheet profile (the radio is visually clipped; click the visible title). Run `$VERIFY drive click --text "My collection is not in a spreadsheet"` then `$VERIFY drive click --role button --name Continue`. Heading `Review your collection` is visible with a tree named `Cards to review`. `$VERIFY drive click --role radio --name "My collection is not in a spreadsheet" --force` also selects it.
- **Spreadsheet branch.** Go back and choose spreadsheet. Run `$VERIFY drive click --role button --name Back`, `$VERIFY drive click --text "My collection is in a spreadsheet"`, `$VERIFY drive click --role button --name Continue`. Heading `Prepare your collection for bulk import.` is visible. Signed in, `Go to bulk import` is a link to the collection bulk section.
- **Save requires session.** On the manual branch while signed out, the primary action is `Sign in and save` (opens the auth modal) rather than `Save collection`.
- **Proof.** Capture Collector One's collection. Run `$VERIFY drive login --email collector.one@example.com --password replace-me-local-only`, `$VERIFY drive screenshot --path /tmp/lost-tales-verify/artifacts/collection/collector-one.png --full-page`, and `$VERIFY drive snapshot --path /tmp/lost-tales-verify/artifacts/collection/collector-one.aria.txt`. Artifacts show `Your Collection`, seeded Elsecaller rows, and `Hi, Collector One`.

## Gotchas

- Login lands on `/collections` by default, so a successful `drive login` already proves the gated page if you assert `Your Collection` with `--exact`.
- `$VERIFY seed` uses `--wipe` for seed users. Do not seed while proving an in-progress getting-started save you have not captured yet.
- Getting Started `Continue` stays disabled until a profile option is chosen. The radios are clipped; `$VERIFY drive click --role radio` times out unless you pass `--force` or click `--text` on the visible title.
- Choosing coverage `None` on a group can open a dialog `Set all cards to zero?` with `Set to none` / `Cancel`.
- Bulk upload mutates Firestore. After uploading a CSV, re-check the collection table, then `$VERIFY seed` before Matches recipes that depend on the original quantities.
- Download buttons write `lost-tales-collection-empty.csv`, `lost-tales-collection-full-set.csv`, or `lost-tales-collection-current.csv`. Assert the click does not error; capturing the file is optional proof.
