# Collection

Collection is the signed-in inventory: quantities already saved for the collector, getting-started setup that writes those quantities, and bulk CSV / ISO-UFT tools.

## Sub-features

- `collection-empty-gate` redirects signed-out visitors to login.
- `collection-seeded` shows Collector One's seeded rows and summary stats.
- `collection-getting-started-type` chooses ChasmFriends Pins, Story Deck Cards, or Both before a storage profile.
- `collection-getting-started-manual` reviews cards or pins and saves quantities.
- `collection-getting-started-spreadsheet` points a spreadsheet collector at bulk import (Story Deck / Both only).
- `collection-bulk` exposes Empty template, Full-set template, My collection, Upload filled template, and Copy ISO/UFT post.

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
- **Seeded inventory.** Sign in as Collector One, then open Collection. Run `$VERIFY drive login --email collector.one@example.com --password replace-me-local-only`, then `$VERIFY drive click --role link --name Collection --scope nav`. Heading `Your Collection` is visible (`--exact`). Summary includes `Unique Cards` and the table lists Elsecaller cards from the seed (`Elsecaller #01` / `Elsecaller #03`). Empty copy `No collectibles catalogued yet` is absent. Prefer `$VERIFY drive expect --text "Elsecaller #01"` or `$VERIFY drive expect --text "LT24-ELS-01" --exact` — without `--exact`, `LT24-ELS-01` also matches `LT24-ELS-01-DUN`.
- **Bulk tools.** Confirm the bulk region. Run `$VERIFY drive expect --role heading --name "Bulk update your collection"`. Buttons `Empty template (all 0s)`, `Full-set template (all 1s)`, `My collection (current)`, and `Copy ISO/UFT post` are enabled, and `Upload filled template` is visible. There is no button named `Download template`.
- **Getting started profile.** Sign out so save stays `Sign in and save`, then open the wizard. Run `$VERIFY drive logout` then `$VERIFY drive goto --path /getting-started`. The eyebrow `ShardStash setup` and heading `Build your collection without entering every card.` and `What best describes you?` are visible. Radios `ChasmFriends Pins`, `Story Deck Cards`, and `Both` are visible. Continue is disabled until a type and a storage profile are chosen. Storage radios are hidden until a type is selected.
- **Pins branch.** Choose pins. Run `$VERIFY drive click --role radio --name "ChasmFriends Pins"` then `$VERIFY drive click --role button --name Continue`. Pins auto-selects the manual profile; the spreadsheet radio is visible but disabled. Heading `Review your pins` is visible with a tree named `Pins to review`. The primary action is `Sign in and save`.
- **Manual branch.** Go back and choose both plus not-spreadsheet. Run `$VERIFY drive click --role button --name Back --exact`, `$VERIFY drive click --role radio --name "Both"`, `$VERIFY drive click --role radio --name "My collection is not in a spreadsheet"`, `$VERIFY drive click --role button --name Continue`. Heading `Review your collection` is visible with a tree named `Cards to review`.
- **Spreadsheet branch.** Go back and choose Story Deck plus spreadsheet. Run `$VERIFY drive click --role button --name Back --exact`, `$VERIFY drive click --role radio --name "Story Deck Cards"`, `$VERIFY drive click --role radio --name "My collection is in a spreadsheet"`, `$VERIFY drive click --role button --name Continue`. Heading `Prepare your collection for bulk import.` is visible. Signed in, `Go to bulk import` is a link to the collection bulk section.
- **Save requires session.** On the manual or pins review while signed out, the primary action is `Sign in and save` (opens the auth modal) rather than `Save collection`.
- **Proof.** Capture Collector One's collection. Run `$VERIFY drive login --email collector.one@example.com --password replace-me-local-only`, `$VERIFY drive click --role link --name Collection --scope nav`, `$VERIFY drive screenshot --path /tmp/lost-tales-verify/artifacts/collection/collector-one.png --full-page`, and `$VERIFY drive snapshot --path /tmp/lost-tales-verify/artifacts/collection/collector-one.aria.txt`. Artifacts show `Your Collection`, seeded Elsecaller rows, the three CSV download buttons, and `Hi, Collector One`.

## Gotchas

- Direct `/auth/login` (no `?redirect=` and no `state.from`) lands on `/` after success. Open Collection from the nav to prove the gated page.
- `$VERIFY seed` uses `--wipe` for seed users. Do not seed while proving an in-progress getting-started save you have not captured yet.
- Getting Started `Continue` stays disabled until a collectible-type radio and (when shown) a storage-profile radio are chosen. Clicking `My collection is not in a spreadsheet` first fails because that radio is not on the page yet.
- Pins auto-selects manual and disables spreadsheet copy (`Spreadsheet import is for Story Deck cards only.`). Review heading is `Review your pins` / tree `Pins to review`, not the cards wording.
- Radio clicks overlay the input with visible label text. The harness force-clicks `--role radio` so `$VERIFY drive click --role radio --name "ChasmFriends Pins"` reaches the control.
- `$VERIFY drive click --role button --name Back` without `--exact` also matches footer `Feedback` (Playwright treats “back” as a substring of “Feedback”). Always use `--exact` for Getting Started Back.
- Choosing coverage `None` on a group can open a dialog `Set all cards to zero?` with `Set to none` / `Cancel`.
- Bulk upload mutates Firestore. After uploading a CSV, re-check the collection table, then `$VERIFY seed` before Matches recipes that depend on the original quantities.
- CSV downloads are `lost-tales-collection-empty.csv`, `lost-tales-collection-full-set.csv`, and `lost-tales-collection-current.csv`. Assert the click does not error; capturing the file is optional proof.
