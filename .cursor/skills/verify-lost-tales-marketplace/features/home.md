# Home

Home is the signed-out landing page: a hero that sends collectors into getting started or the catalog, tiles for supported sets, and a snapshot that stays empty until sign-in.

## Sub-features

- `home-load` shows the marketplace heading and primary navigation.
- `home-nav` reaches Collectibles, Collection, Matches, Account, and Sign in from the primary nav.
- `home-hero-cta` opens Getting Started and the collectibles catalog from the hero.
- `home-supported` opens the catalog from Story Deck and ChasmFriends pin tiles.
- `home-snapshot-signed-out` shows Collection Snapshot values as placeholders with Sign in hints.

## How to get to it (user POV)

- Open `http://127.0.0.1:5173/` directly.
- Choose the `Home` link in the primary navigation from any other route.
- Follow `Back to home` on Getting Started or `Back to Home` on the not-found page.

## Driving it with verify-lost-tales

Preconditions:

- Lost Tales Marketplace is healthy at `http://127.0.0.1:5173`.
- The browser session is signed out.
- `doctor` reports `ok=true`.

- **Direct load.** Open home. Run `$VERIFY drive goto --path /`. The heading `Track your collectibles in one place.` is visible and the document title is `Lost Tales Marketplace`.
- **Primary nav.** Confirm nav targets. Run `$VERIFY drive expect --role navigation --name Primary` then `$VERIFY drive click --role link --name Collectibles --scope nav`. The heading `Collectibles` is visible. Return with `$VERIFY drive click --role link --name Home --scope nav`.
- **Hero getting started.** From home, choose the first Getting Started control. Run `$VERIFY drive click --role link --name "Getting Started" --nth 0`. The heading `Build your collection without entering every card.` is visible.
- **Hero catalog.** Return home, then choose View Collectibles. Run `$VERIFY drive goto --path /` and `$VERIFY drive click --role link --name "View Collectibles"`. The heading `Collectibles` is visible.
- **Supported collections.** Return home and choose Browse catalog. Run `$VERIFY drive goto --path /` and `$VERIFY drive click --role link --name "Browse catalog"`. The heading `Collectibles` is visible and the page still shows all categories.
- **Pin tile.** Return home and choose Browse pins. Run `$VERIFY drive goto --path /` and `$VERIFY drive click --role link --name "Browse pins"`. The Category filter is `Pins` (the catalog heading remains `Collectibles`).
- **Signed-out snapshot.** Return home. Run `$VERIFY drive goto --path /` and `$VERIFY drive expect --role heading --name "Collection Snapshot"`. Snapshot stats include the hint `Sign in` rather than owned counts.
- **Proof.** Capture home signed-out. Run `$VERIFY drive screenshot --path /tmp/lost-tales-verify/artifacts/home/signed-out.png --full-page` and `$VERIFY drive snapshot --path /tmp/lost-tales-verify/artifacts/home/signed-out.aria.txt`. Artifacts show the hero heading, Supported Collections, and primary nav Sign in.

## Gotchas

- `Getting Started` appears in the hero and again in the footer. Use `--nth 0` for the hero and do not assume a single link.
- `Collection`, `Matches`, and `Account` in the nav are visible while signed out; following them redirects to `/auth/login`. That redirect is auth-gate behavior, not a broken home link.
- `Quick sign in` opens the modal instead of `/auth/login`. Do not treat the modal heading `Sign In` as the login page heading.
- Collection Snapshot loading skeletons disappear; wait for the `Collection Snapshot` heading and the `Sign in` hints, not a fixed sleep.
