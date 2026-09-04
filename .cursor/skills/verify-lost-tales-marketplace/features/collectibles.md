# Collectibles

Collectibles is the public catalog: search, filter, and sort Stormlight Lost Tales cards and ChasmFriends pins, switch grid/table, and open a collectible detail page.

## Sub-features

- `collectibles-open` shows the catalog heading, set name, and result counts.
- `collectibles-search` narrows results by ID, story, or variant without changing data.
- `collectibles-filter` applies Category, Story, and Rarity and resets them.
- `collectibles-view` switches Grid view and Table view.
- `collectibles-detail` opens a collectible and returns with Back.
- `collectibles-add-signed-out` opens the sign-in modal instead of writing a collection entry.

## How to get to it (user POV)

- Choose `Collectibles` in the primary navigation.
- Choose `View Collectibles` or `Browse Items` on Home.
- Choose `Browse catalog` or `Browse pins` under Supported Collections.
- Open `/collectibles` directly.
- Open `/collectibles/<collectibleId>` from a grid tile (the tile is a link whose accessible name includes the card title, for example `Elsecaller #01`).

## Driving it with verify-lost-tales

Preconditions:

- Lost Tales Marketplace is healthy at `http://127.0.0.1:5173`.
- The browser session is signed out.
- `doctor` reports `ok=true`.

- **Nav entry.** Choose Collectibles. Run `$VERIFY drive click --role link --name Collectibles --scope nav`. The heading `Collectibles` is visible and the page text includes `Set: Stormlight Lost Tales — Story Deck`.
- **Search match.** Type Elsecaller into Search. Run `$VERIFY drive fill --label Search --value Elsecaller`. The toolbar still reads a non-zero `Showing` count and a heading `Elsecaller #01` is visible. A heading `King Lopen the First of Alethkar #01` is not.
- **Open detail.** Choose the Elsecaller #01 tile. Run `$VERIFY drive click --role heading --name "Elsecaller #01"`. The detail heading is `Elsecaller #01` and Details includes story `Elsecaller`.
- **Back to catalog.** Choose Back. Run `$VERIFY drive click --role button --name "← Back"`. The catalog heading `Collectibles` returns; Search may still contain `Elsecaller`.
- **Reset search.** Clear filters. Run `$VERIFY drive click --role button --name "Reset filters"`. Search is empty and `Showing` matches the full catalog count.
- **Category filter.** Restrict to story cards. Run `$VERIFY drive select --label Category --value "Story cards"`. Result rows are story cards; pin-only names are absent.
- **Story filter.** Restrict to Elsecaller. Run `$VERIFY drive select --label Story --value Elsecaller`. Visible titles are Elsecaller cards.
- **Table view.** Switch layout. Run `$VERIFY drive click --role button --name "Table view"`. A table named `Collectibles table` is visible with column `Name / Detail`.
- **Grid view.** Switch back. Run `$VERIFY drive click --role button --name "Grid view"` and `$VERIFY drive click --role button --name "Reset filters"`.
- **Signed-out add.** On a story card, choose Add Dun. Run `$VERIFY drive click --role button --name "Add Dun" --nth 0`. A heading `Sign In` appears (auth modal). Close it with `$VERIFY drive click --role button --name ×`.
- **Proof.** Search Elsecaller in grid view and capture. Run `$VERIFY drive fill --label Search --value Elsecaller`, `$VERIFY drive screenshot --path /tmp/lost-tales-verify/artifacts/collectibles/search-elsecaller.png --full-page`, and `$VERIFY drive snapshot --path /tmp/lost-tales-verify/artifacts/collectibles/search-elsecaller.aria.txt`. Artifacts identify Collectibles, the Search value, and `Elsecaller #01`.

## Gotchas

- Catalog data is static JSON. Search proving a miss (`volcano`) should still show `Showing 0 of <total>`; it is not a network failure.
- Add Dun / Add Foil on a tile are inside the tile link. The driver clicks the button; do not also click the heading in the same step.
- Detail `← Back` uses history. If you opened `/collectibles/LT24-ELS-01` directly, Back may leave the catalog. Prefer opening detail from the grid during this recipe.
- `Browse pins` arrives with Category already set to Pins via router state. Reset filters before proving an All-categories search.
- Signed-out add must not leave a collection row. Confirm by signing in later only if the recipe is collection, not here.
