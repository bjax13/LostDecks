# Collection

Collection is the signed-in inventory: quantities already saved for the collector, getting-started setup that writes those quantities, and bulk CSV / ISO-UFT tools.

## Sub-features

- `collection-empty-gate` redirects signed-out visitors to login.
- `collection-seeded` shows Collector One's seeded rows and summary stats.
- `collection-getting-started-manual` picks a collectible type, reviews that set, and saves quantities.
- `collection-getting-started-spreadsheet` points a spreadsheet collector at bulk import.
- `collection-quick-pins` opens the QR pin picker from `?collect=pins`.
- `collection-bulk` exposes the three CSV downloads, Upload filled template, Copy ISO/UFT post, Open visual editor, and Download my collection.

## How to get to it (user POV)

- Choose `Collection` in the primary navigation.
- Choose `Track What You Own` or `See What's Missing` on Home (both go to `/collections`).
- Choose `Getting Started` from Home, complete the wizard, and save.
- Open `/collections` or `/getting-started` directly.
- From the spreadsheet branch of Getting Started, choose `Go to bulk import` (signed in) which lands on `/collections#bulk-import`.
- Open `/getting-started?collect=pins` (the QR quick pin picker).

## Driving it with verify-lost-tales

Preconditions:

- ShardStash is healthy at `http://127.0.0.1:5173`.
- Seed data has not been overwritten since launch (or `$VERIFY seed` was just run).
- `doctor` reports `ok=true`.

- **Signed-out gate.** Open Collection signed out. Run `$VERIFY drive logout` then `$VERIFY drive click --role link --name Collection --scope nav`. The heading `Sign in to ShardStash` is visible.
- **Seeded inventory.** Sign in as Collector One, then open Collection. Run `$VERIFY drive login --email collector.one@example.com --password replace-me-local-only`, then `$VERIFY drive click --role link --name Collection --scope nav`. Run `$VERIFY drive expect --role heading --name "Your Collection" --exact`. Summary includes `Unique Cards`. The table lists Elsecaller #01 and #03 with card ids `LT24-ELS-01` and `LT24-ELS-03` and dun SKUs `LT24-ELS-01-DUN` (quantity 2) and `LT24-ELS-03-DUN` (quantity 1). Empty copy `No collectibles catalogued yet` is absent.
- **Bulk tools.** Confirm the bulk region. Run `$VERIFY drive expect --role heading --name "Bulk update your collection"`. Buttons `Empty template (all 0s)`, `Full-set template (all 1s)`, `Story Deck quantities (current)`, `Copy ISO/UFT post`, and `Open visual editor` are visible, as is `Upload filled template`. Heading `Download my collection` is below the table.
- **Getting started profile.** Open the wizard. Run `$VERIFY drive goto --path /getting-started`. The eyebrow `ShardStash setup` and heading `Build your collection without entering every card.` and `What best describes you?` are visible.
- **Manual branch.** Choose Story Deck cards and the non-spreadsheet profile. Run `$VERIFY drive click --role radio --name "Story Deck Cards"`, `$VERIFY drive click --role radio --name "My collection is not in a spreadsheet"`, then `$VERIFY drive click --role button --name Continue`. Heading `Review your cards` is visible with a tree named `Cards to review`.
- **Spreadsheet branch.** Go back, keep Story Deck cards, and choose spreadsheet. Run `$VERIFY drive click --role button --name Back --exact`, `$VERIFY drive click --role radio --name "My collection is in a spreadsheet"`, `$VERIFY drive click --role button --name Continue`. Heading `Prepare your collection for bulk import.` is visible. Signed in, `Go to bulk import` is a link to the collection bulk section.
- **Save requires session.** On the manual branch while signed out, the primary action is `Sign in and save` (opens the auth modal) rather than `Save collection`. Reach that step with the same Story Deck Cards and non-spreadsheet radios before checking the button.
- **Quick pins.** Open the QR picker. Run `$VERIFY drive goto --path "/getting-started?collect=pins"`. Heading `Mark what you have, then find trades.` is visible, with `Which pins do you have?`.
- **Proof.** Capture Collector One's collection. Run `$VERIFY drive login --email collector.one@example.com --password replace-me-local-only`, `$VERIFY drive click --role link --name Collection --scope nav`, `$VERIFY drive screenshot --path /tmp/lost-tales-verify/artifacts/collection/collector-one.png --full-page`, and `$VERIFY drive snapshot --path /tmp/lost-tales-verify/artifacts/collection/collector-one.aria.txt`. Artifacts show `Your Collection`, seeded Elsecaller rows, and `Hi, Collector One`.

## Gotchas

- Direct `/auth/login` (no `?redirect=` and no `state.from`) lands on `/` after success. Open Collection from the nav to prove the gated page.
- `$VERIFY seed` uses `--wipe` for seed users. Do not seed while proving an in-progress getting-started save you have not captured yet.
- Getting Started `Continue` stays disabled until both a collectible type (`Pins`, `Story Deck Cards`, or `Both`) and a profile radio are chosen. The profile radios are not on the page until a type is chosen. Spreadsheet is disabled for Pins.
- The review `Back` button needs `--exact`. A substring match also hits the footer `Feedback` button.
- The review heading follows the type: `Review your cards` (Story Deck Cards), `Review your pins` (Pins), `Review your collection` (Both).
- Choosing coverage `None` on a group can open a dialog `Set all cards to zero?` with `Set to none` / `Cancel`.
- Bulk upload mutates Firestore. After uploading a CSV, re-check the collection table, then `$VERIFY seed` before Matches recipes that depend on the original quantities.
- The CSV downloads are `lost-tales-collection-empty.csv`, `lost-tales-collection-full-set.csv`, and `lost-tales-collection-current.csv`. There is no `Download template` button and no `lost-tales-collection-template.csv`.
- `?collect=pins` skips the profile step and shows the quick pin picker. Its heading is `Mark what you have, then find trades.`, not the default getting-started heading.
