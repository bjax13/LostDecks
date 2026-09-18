# Home

Home is the signed-out landing page: a hero that sends collectors into getting started or the catalog, tiles for supported sets, “What You Can Do Today” cards into Collection, and a snapshot that stays empty until sign-in.

## Sub-features

- `home-load` shows the hero heading and primary navigation.
- `home-nav` reaches Collectibles, Collection, Matches, Account, and Sign in from the primary nav.
- `home-hero-cta` opens Getting Started, the collectibles catalog, and the Sign In modal from the hero.
- `home-supported` opens the catalog from Story Deck and ChasmFriends pin tiles.
- `home-today` opens Collection (auth-gated) from Track What You Own and See What's Missing.
- `home-snapshot-signed-out` shows Collection Snapshot values as placeholders with Sign in hints.
- `home-footer-cta` repeats Getting Started and Browse Items under Start tracking your collection.

## How to get to it (user POV)

- Open `http://127.0.0.1:5173/` directly.
- Choose the `Home` link in the primary navigation from any other route.
- Follow `Back to home` on Getting Started or `Back to Home` on the not-found page.

## Driving it with verify-lost-tales

Preconditions:

- ShardStash is healthy at `http://127.0.0.1:5173`.
- The browser session is signed out.
- `doctor` reports `ok=true`.

- **Direct load.** Open home. Run `$VERIFY drive goto --path /`. The heading `Track your collectibles in one place.` is visible, the primary nav shows the `ShardStash` brand, and the document title is `ShardStash`. Headings `Supported Collections`, `What You Can Do Today`, `Collection Snapshot`, and `Start tracking your collection` are visible.
- **Primary nav.** Confirm nav targets. Run `$VERIFY drive expect --role navigation --name Primary` then `$VERIFY drive click --role link --name Collectibles --scope nav`. The heading `Collectibles` is visible. Return with `$VERIFY drive click --role link --name Home --scope nav`.
- **Hero getting started.** From home, choose the first Getting Started control. Run `$VERIFY drive click --role link --name "Getting Started" --nth 0`. The heading `Build your collection without entering every card.` is visible.
- **Hero catalog.** Return home, then choose View Collectibles. Run `$VERIFY drive goto --path /` and `$VERIFY drive click --role link --name "View Collectibles"`. The heading `Collectibles` is visible.
- **Supported collections.** Return home and choose Browse catalog. Run `$VERIFY drive goto --path /` and `$VERIFY drive click --role link --name "Browse catalog"`. The heading `Collectibles` is visible and the page still shows all categories.
- **Pin tile.** Return home and choose Browse pins. Run `$VERIFY drive goto --path /` and `$VERIFY drive click --role link --name "Browse pins"`. Capture a snapshot: Category shows option `Pins` selected (the catalog heading remains `Collectibles`). Do not `$VERIFY drive expect --text Pins` — that name is not unique.
- **Today tiles.** Return home and choose Track What You Own. Run `$VERIFY drive goto --path /` and `$VERIFY drive click --role link --name "Track What You Own"`. Signed out, the login heading `Sign in to ShardStash` is visible.
- **Footer catalog.** Return home and choose Browse Items. Run `$VERIFY drive goto --path /` and `$VERIFY drive click --role link --name "Browse Items"`. The heading `Collectibles` is visible.
- **Signed-out snapshot.** Return home. Run `$VERIFY drive goto --path /` and `$VERIFY drive expect --role heading --name "Collection Snapshot"`. The snapshot ARIA text includes `Sign in` hints rather than owned counts.
- **Proof.** Capture home signed-out. Run `$VERIFY drive screenshot --path /tmp/lost-tales-verify/artifacts/home/signed-out.png --full-page` and `$VERIFY drive snapshot --path /tmp/lost-tales-verify/artifacts/home/signed-out.aria.txt`. Artifacts show the hero heading, Supported Collections, What You Can Do Today, Collection Snapshot Sign in hints, and primary nav Sign in.

## Gotchas

- `Getting Started` appears in the hero and again in the footer. Use `--nth 0` for the hero and do not assume a single link.
- `Collection`, `Matches`, and `Account` in the nav are visible while signed out; following them redirects to `/auth/login`. That redirect is auth-gate behavior, not a broken home link. The same gate applies to Track What You Own and See What's Missing.
- Hero `Sign In` and nav `Quick sign in` open the modal instead of `/auth/login`. Expect the modal heading with `$VERIFY drive expect --role heading --name "Sign In" --exact`.
- `$VERIFY drive expect --text "Sign in"` is unsafe: nav Sign in, Quick sign in, hero Sign In, and five snapshot hints all match.
- Collection Snapshot loading skeletons disappear; wait for the `Collection Snapshot` heading and snapshot ARIA `Sign in` hints, not a fixed sleep.
