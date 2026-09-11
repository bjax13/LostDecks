# Collectibles

Collectibles is the public catalog: search, filter, and sort Stormlight Lost Tales cards and ChasmFriends pins, switch grid/table, and open a collectible detail page.

## Sub-features

- `collectibles-open` shows the catalog heading, set name, and result counts.
- `collectibles-search` narrows results by ID, story, or variant without changing data.
- `collectibles-filter` applies Category, Story, and Rarity and resets them.
- `collectibles-view` switches Grid view and Table view.
- `collectibles-detail` opens a collectible from the id link and returns with Back.
- `collectibles-add-signed-out` opens the sign-in modal instead of writing a collection entry.
- `collectibles-quantity-signed-in` replaces Add Dun / Add Foil with Increase / Decrease steppers once that finish is owned.

## How to get to it (user POV)

- Choose `Collectibles` in the primary navigation.
- Choose `View Collectibles` or `Browse Items` on Home.
- Choose `Browse catalog` or `Browse pins` under Supported Collections.
- Open `/collectibles` directly.
- Open `/collectibles/<collectibleId>` from a grid tile: expand the heading (for example `Elsecaller #01`), then choose the collectible id link (`LT24-ELS-01`).

## Driving it with verify-lost-tales

Preconditions:

- Lost Tales Marketplace is healthy at `http://127.0.0.1:5173`.
- The browser session is signed out.
- `doctor` reports `ok=true`.

- **Nav entry.** Choose Collectibles. Run `$VERIFY drive click --role link --name Collectibles --scope nav`. The heading `Collectibles` is visible and the page text includes `Set: Stormlight Lost Tales — Story Deck`.
- **Search match.** Type Elsecaller into Search. Run `$VERIFY drive fill --label Search --value Elsecaller`. The toolbar still reads a non-zero `Showing` count and a heading `Elsecaller #01` is visible. A heading `King Lopen the First of Alethkar #01` is not.
- **Expand glance.** Choose the Elsecaller #01 heading. Run `$VERIFY drive click --role heading --name "Elsecaller #01"`. The catalog URL stays `/collectibles` and the glance shows the id link `LT24-ELS-01`.
- **Open detail.** Choose the id link. Run `$VERIFY drive click --role link --name LT24-ELS-01`. The URL is `/collectibles/LT24-ELS-01`, the detail heading is `Elsecaller #01`, and Details includes story `Elsecaller`.
- **Back to catalog.** Choose Back. Run `$VERIFY drive click --role button --name "← Back"`. The catalog heading `Collectibles` returns; Search may still contain `Elsecaller`.
- **Reset search.** Clear filters. Run `$VERIFY drive click --role button --name "Reset filters"`. Search is empty and `Showing` matches the full catalog count.
- **Category filter.** Restrict to story cards. Run `$VERIFY drive select --label Category --value "Story cards"`. Result rows are story cards; pin-only names are absent.
- **Story filter.** Restrict to Elsecaller. Run `$VERIFY drive select --label Story --value Elsecaller`. Visible titles are Elsecaller cards.
- **Table view.** Switch layout. Run `$VERIFY drive click --role button --name "Table view"`. A region named `Collectibles table` is visible with column `Name / Detail`. Run `$VERIFY drive expect --role region --name "Collectibles table"`.
- **Grid view.** Switch back. Run `$VERIFY drive click --role button --name "Grid view"` and `$VERIFY drive click --role button --name "Reset filters"`.
- **Signed-out add.** On a story card, choose Add Dun. Run `$VERIFY drive click --role button --name "Add Dun" --nth 0`. A heading `Sign In` appears (auth modal). Close it with `$VERIFY drive click --role button --name ×`.
- **Signed-in quantity.** After `$VERIFY drive login --email collector.one@example.com --password replace-me-local-only`, search Elsecaller and expand `Elsecaller #01`. Dun shows steppers `Decrease Dun · x2` and `Increase Dun · x2` instead of `Add Dun` (seed quantity 2).
- **Proof.** Search Elsecaller in grid view and capture. Run `$VERIFY drive fill --label Search --value Elsecaller`, `$VERIFY drive screenshot --path /tmp/lost-tales-verify/artifacts/collectibles/search-elsecaller.png --full-page`, and `$VERIFY drive snapshot --path /tmp/lost-tales-verify/artifacts/collectibles/search-elsecaller.aria.txt`. Artifacts identify Collectibles, the Search value, and `Elsecaller #01`.

## Gotchas

- Catalog data is static JSON. Search proving a miss (`volcano`) should still show `Showing 0 of <total>`; it is not a network failure.
- The grid heading expands the tile glance; it does not navigate. Open detail with the id link (`LT24-ELS-01`).
- Add Dun / Add Foil sit beside the tile glance, not inside a link. The driver clicks the button; do not also click the heading in the same step.
- Detail `← Back` uses history. If you opened `/collectibles/LT24-ELS-01` directly, Back may leave the catalog. Prefer opening detail from the grid during this recipe.
- `Browse pins` arrives with Category already set to Pins via router state. Reset filters before proving an All-categories search.
- Signed-out add must not leave a collection row. Confirm by signing in later only if the recipe is collection, not here.
