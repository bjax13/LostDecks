# Collectibles

Collectibles is the public catalog: search, filter, and sort Stormlight Lost Tales cards and ChasmFriends pins, switch grid/table, and open a collectible detail page. A pin without a photo shows an empty slot, and a pin's detail page can include a Dragonsteel or archived store link.

## Sub-features

- `collectibles-open` shows the catalog heading, set name, and result counts.
- `collectibles-search` narrows results by ID, story, series, or variant without changing data.
- `collectibles-filter` applies Category, Sub Category, and Rarity and resets them. Rarity is absent while Category is Pins.
- `collectibles-view` switches Grid view and Table view.
- `collectibles-detail` opens a collectible from the visible details link or from the id link inside an expanded tile, then returns with Back.
- `collectibles-pin-photo` shows `no photo yet` on a pin tile that has no photo, and `No photo yet. Have this pin?` with `Send us a photo.` on that detail page.
- `collectibles-pin-store` shows a Dragonsteel store link or an archived store link on pin detail when that pin has one.
- `collectibles-add-signed-out` opens the sign-in modal instead of writing a collection entry.

## How to get to it (user POV)

- Choose `Collectibles` in the primary navigation.
- Choose `View Collectibles` or `Browse Items` on Home.
- Choose `Browse catalog` or `Browse pins` under Supported Collections.
- Open `/collectibles` directly.
- Open `/collectibles/<collectibleId>` from a grid tile in either way: choose the visible `details ›` link (accessible name `View details for <title>`, for example `View details for Elsecaller #01`), or expand the title heading and choose the link named with the collectible id (`LT24-ELS-01`). In table view, choose the row or that same details link.

## Driving it with verify-lost-tales

Preconditions:

- ShardStash is healthy at `http://127.0.0.1:5173`.
- The browser session is signed out.
- `doctor` reports `ok=true`.

- **Nav entry.** Choose Collectibles. Run `$VERIFY drive click --role link --name Collectibles --scope nav`. The heading `Collectibles` is visible and the page text includes `Set: Stormlight Lost Tales — Story Deck`.
- **Search match.** Type Elsecaller into Search. Run `$VERIFY drive fill --label Search --value Elsecaller`. The toolbar still reads a non-zero `Showing` count and a heading `Elsecaller #01` is visible. A heading `King Lopen the First of Alethkar #01` is not.
- **Open detail.** Expand the Elsecaller #01 tile, then open its id link. Run `$VERIFY drive click --role heading --name "Elsecaller #01"` and `$VERIFY drive click --role link --name "LT24-ELS-01"`. The detail heading is `Elsecaller #01` and Details includes story `Elsecaller`.
- **Back to catalog.** Choose Back. Run `$VERIFY drive click --role button --name "← Back"`. The catalog heading `Collectibles` returns; Search may still contain `Elsecaller`.
- **Visible details link.** Search Elsecaller again if needed, and open the details link without expanding the tile. Run `$VERIFY drive fill --label Search --value Elsecaller` and `$VERIFY drive click --role link --name "View details for Elsecaller #01" --exact`. The detail heading is `Elsecaller #01`. Return with `$VERIFY drive click --role button --name "← Back"`.
- **Reset search.** Clear filters. Run `$VERIFY drive click --role button --name "Reset filters"`. Search is empty and `Showing` matches the full catalog count.
- **Category filter.** Restrict to story cards. Run `$VERIFY drive select --label Category --value "Story cards" --exact`. Result rows are story cards; pin-only names are absent.
- **Sub Category filter.** Restrict to Elsecaller. Run `$VERIFY drive select --label "Sub Category" --value Elsecaller`. Visible titles are Elsecaller cards.
- **Table view.** Switch layout. Run `$VERIFY drive click --role button --name "Table view"`. A region named `Collectibles table` is visible with column `Name / Detail`.
- **Grid view.** Switch back. Run `$VERIFY drive click --role button --name "Grid view"` and `$VERIFY drive click --role button --name "Reset filters"`.
- **Signed-out add.** On a story card, choose Add Dun. Run `$VERIFY drive click --role button --name "Add Dun" --nth 0`. A heading `Sign In` appears (auth modal). Close it with `$VERIFY drive click --role button --name ×`. Pin tiles use `Add to collection` instead of `Add Dun`; that button opens the same modal while signed out.
- **Pin store link.** Open a pin that is still sold. Run `$VERIFY drive goto --path /`, `$VERIFY drive click --role link --name "Browse pins"`, `$VERIFY drive fill --label Search --value Brandon`, and `$VERIFY drive click --role link --name "View details for Brandon" --exact`. The heading `Brandon` is visible, Category is `Pins`, Rarity is not on the page, and a link `Dragonsteel store` is visible. Capture `$VERIFY drive screenshot --path /tmp/lost-tales-verify/artifacts/collectibles/pin-brandon-store.png --full-page`.
- **Archived store link.** Open a pin whose store page is archived. Run `$VERIFY drive goto --path /collectibles`, `$VERIFY drive select --label Category --value Pins --exact`, `$VERIFY drive fill --label Search --value M-Bot`, and `$VERIFY drive click --role link --name "View details for M-Bot" --exact`. A link `Archived Dragonsteel store page (Wayback Machine, May 2022)` is visible.
- **No photo.** Open a pin with an empty photo slot. Run `$VERIFY drive goto --path /collectibles`, `$VERIFY drive select --label Category --value Pins --exact`, `$VERIFY drive fill --label Search --value Shredhead`, and `$VERIFY drive expect --role img --name "no photo yet"`. Then `$VERIFY drive click --role link --name "View details for Shredhead" --exact`. The page shows `No photo yet. Have this pin?` and a link `Send us a photo.` Capture `$VERIFY drive screenshot --path /tmp/lost-tales-verify/artifacts/collectibles/pin-shredhead-nophoto.png --full-page`.
- **Proof.** Search Elsecaller in grid view and capture. Run `$VERIFY drive fill --label Search --value Elsecaller`, `$VERIFY drive screenshot --path /tmp/lost-tales-verify/artifacts/collectibles/search-elsecaller.png --full-page`, and `$VERIFY drive snapshot --path /tmp/lost-tales-verify/artifacts/collectibles/search-elsecaller.aria.txt`. Artifacts identify Collectibles, the Search value, and `Elsecaller #01`.

## Gotchas

- Catalog data is static JSON. Search proving a miss (`volcano`) should still show `Showing 0 of <total>`; it is not a network failure.
- Add Dun / Add Foil sit on the tile beside the expandable heading. Click the button on its own; do not also click the heading in the same step.
- Detail `← Back` uses history. If you opened `/collectibles/LT24-ELS-01` directly, Back may leave the catalog. Prefer opening detail from the grid during this recipe.
- `Browse pins` arrives with Category already set to Pins. The Rarity filter is not shown for that category, and Sub Category lists series (`All series`) instead of stories. Reset filters before proving an All-categories search.
- `select --label Category` without `--exact` also matches `Sub Category`. Pass `--exact`.
- The grid heading click expands the tile. It does not open the detail page. Use the visible `details ›` link, the id link after expanding, or a table row.
- `View details for <title>` is a prefix match. `View details for M-Bot` also matches `M-Bot Drone`, `M-Bot Mini`, and `M-Bot (Dutch)`. Pass `--exact`.
- The search field's placeholder is `Search by ID, story, series, or variant`. The accessible name used by `fill` is the label `Search`.
- Signed-out add must not leave a collection row. Confirm by signing in later only if the recipe is collection, not here.
