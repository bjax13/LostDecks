# Matches

Matches shows reciprocal extras between collectors, grouped as a person card with dun, foil, and pin lanes. Account Settings controls whether that collector is included in discovery and which lanes they trade in.

## Sub-features

- `matches-gate` redirects signed-out visitors to login.
- `matches-seeded` lists Collector Two as a counterparty for Collector One.
- `matches-empty` shows `No reciprocal matches yet` when the signed-in user has no matches.
- `matches-opt-out` honors Account `Include me in Matches` and shows matching-disabled copy.
- `account-match-lanes` shows Dun cards, Foil cards, and Pins checkboxes under that control; they are disabled while matching is excluded.
- `account-match-contact` chooses how a match sees you: `My true email`, `My trading email`, or `My Discord information`.
- `account-profile` shows display name and Primary email on Account Settings.

## How to get to it (user POV)

- Choose `Matches` in the primary navigation.
- Open `/matches` directly.
- Choose `Account` in the primary navigation, then toggle `Include me in Matches`, the Dun cards, Foil cards, and Pins lane checkboxes, or the match contact radios.
- Open `/account` directly.

## Driving it with verify-lost-tales

Preconditions:

- Lost Tales Marketplace is healthy at `http://127.0.0.1:5173`.
- Seed data is the example pair: Collector One owns extra `LT24-ELS-01-DUN`; Collector Two owns extra `LT24-ELS-02-DUN`; both have `matchingOptOut: false`.
- `doctor` reports `ok=true`.

- **Signed-out gate.** Open Matches signed out. Run `$VERIFY drive logout` then `$VERIFY drive click --role link --name Matches --scope nav`. The login heading is visible.
- **Seeded matches.** Sign in as Collector One and open Matches. Run `$VERIFY drive login --email collector.one@example.com --password replace-me-local-only` then `$VERIFY drive click --role link --name Matches --scope nav`. After `Finding possible matches…` disappears, heading `Matches` is visible and a heading `Collector Two` shows a Dun cards lane with piles `They can send you` and `You can send them`.
- **Person contact.** Contact for Collector Two is visible on the expanded card. Run `$VERIFY drive expect --role button --name "Copy email"` and `$VERIFY drive expect --role link --name Email`.
- **Account profile.** Open Account. Run `$VERIFY drive click --role link --name Account --scope nav`. Headings `Account Settings` and `Profile overview` show display name `Collector One` (`$VERIFY drive expect --text "Collector One" --exact`) and `Primary email` `collector.one@example.com` (the address also appears under `My true email`; use `--nth 0` or the `Primary email` label).
- **Match lanes.** On Account, checkboxes `Dun cards`, `Foil cards`, and `Pins` sit under `Include me in Matches` and are checked. Run `$VERIFY drive expect --role checkbox --name "Dun cards"`, `$VERIFY drive expect --role checkbox --name "Foil cards"`, and `$VERIFY drive expect --role checkbox --name "Pins"`.
- **Match contact.** Radios `My true email`, `My trading email`, and `My Discord information` sit under `When something I have matches someone else, share with them…`.
- **Opt out.** Uncheck matching. Run `$VERIFY drive uncheck --role checkbox --name "Include me in Matches"` then `$VERIFY drive expect --role checkbox --name "Dun cards" --disabled`. Open Matches. The driver reuses one browser context, and Matches caches results for 30s, so Collector Two may still be listed. Wait with `$VERIFY drive expect --role button --name Refresh --enabled --timeout 35000` then `$VERIFY drive click --role button --name Refresh`. Heading `Matching is disabled for your account` is then visible.
- **Restore opt-in.** Return to Account, `$VERIFY drive check --role checkbox --name "Include me in Matches"`, then `$VERIFY drive expect --role checkbox --name "Dun cards" --enabled`. Open Matches, wait for Refresh `--enabled --timeout 35000`, click Refresh, then expect `Collector Two`. `$VERIFY seed` also restores seed opt-in if you would rather wipe than wait.
- **Proof.** Capture Collector One's matches before any opt-out. Run `$VERIFY drive screenshot --path /tmp/lost-tales-verify/artifacts/matches/collector-one.png --full-page` and `$VERIFY drive snapshot --path /tmp/lost-tales-verify/artifacts/matches/collector-one.aria.txt` while `Collector Two` is visible. Artifacts show Matches, the counterparty heading, dun piles, and signed-in nav.

## Gotchas

- Matches load through a callable function. Wait for `Finding possible matches…` to disappear; do not snapshot the loading sentence as success or failure.
- A freshness line `As of N seconds ago. Can refresh in N seconds.` can appear, then `You may now refresh.` Matches caches results for 30 seconds in this browser session. After an Account preference change, wait for Refresh `--enabled --timeout 35000` and click it; do not treat a stale Collector Two card as a failed opt-out.
- Opt-out is a negative checkbox (`Include me in Matches` checked means participating). Prefer `uncheck` / `check` over `click` so the recipe does not toggle the wrong way. After `uncheck`, assert `--disabled` on a lane checkbox before opening Matches.
- If launch used a custom `functions/seed.local.json`, counterparties and SKUs may differ. Read that file before asserting `Collector Two`.
- `$VERIFY seed` after an opt-out restores `matchingOptOut: false` and all three match lanes enabled for seed users.
- Google-only accounts are out of scope here; prove with the seeded email user.
- Empty lanes are omitted. Seeded Collector One vs Two has a dun lane only.
