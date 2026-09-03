# Matches

Matches shows reciprocal extras between collectors, grouped as a person card with dun, foil, and pin lanes. Account Settings controls whether that collector is included in discovery and which lanes they trade in.

## Sub-features

- `matches-gate` redirects signed-out visitors to login.
- `matches-seeded` lists Collector Two as a counterparty for Collector One.
- `matches-empty` shows `No reciprocal matches yet` when the signed-in user has no matches.
- `matches-opt-out` honors Account `Include me in Matches` and shows matching-disabled copy.
- `account-match-lanes` shows Dun cards, Foil cards, and Pins checkboxes under that control; they are disabled while matching is excluded.
- `account-profile` shows display name and email on Account Settings.

## How to get to it (user POV)

- Choose `Matches` in the primary navigation.
- Open `/matches` directly.
- Choose `Account` in the primary navigation, then toggle `Include me in Matches` or the Dun cards, Foil cards, and Pins lane checkboxes.
- Open `/account` directly.

## Driving it with verify-lost-tales

Preconditions:

- Lost Tales Marketplace is healthy at `http://127.0.0.1:5173`.
- Seed data is the example pair: Collector One owns extra `LT24-ELS-01-DUN`; Collector Two owns extra `LT24-ELS-02-DUN`; both have `matchingOptOut: false`.
- `doctor` reports `ok=true`.

- **Signed-out gate.** Open Matches signed out. Run `$VERIFY drive logout` then `$VERIFY drive click --role link --name Matches --scope nav`. The login heading is visible.
- **Seeded matches.** Sign in as Collector One and open Matches. Run `$VERIFY drive login --email collector.one@example.com --password replace-me-local-only` then `$VERIFY drive click --role link --name Matches --scope nav`. After `Finding possible matches…` disappears, heading `Matches` is visible and a heading `Collector Two` shows a Dun cards lane.
- **Person contact.** Contact for Collector Two is visible on the expanded card. Run `$VERIFY drive expect --role button --name "Copy email"` and `$VERIFY drive expect --role link --name Email`.
- **Account profile.** Open Account. Run `$VERIFY drive click --role link --name Account --scope nav`. Headings `Account Settings` and `Profile overview` show display name `Collector One` and email `collector.one@example.com`.
- **Match lanes.** On Account, checkboxes `Dun cards`, `Foil cards`, and `Pins` sit under `Include me in Matches` and are checked. Run `$VERIFY drive expect --role checkbox --name "Dun cards"`, `$VERIFY drive expect --role checkbox --name "Foil cards"`, and `$VERIFY drive expect --role checkbox --name "Pins"`.
- **Opt out.** Uncheck matching. Run `$VERIFY drive click --role checkbox --name "Include me in Matches"`. Wait until `Saving preference…` is gone. The three lane checkboxes are disabled. Open Matches again. Run `$VERIFY drive click --role link --name Matches --scope nav`. Heading `Matching is disabled for your account` is visible and Collector Two is not listed.
- **Restore opt-in.** Return to Account, check `Include me in Matches` again, and wait until saving finishes so later runs keep the seed behavior.
- **Proof.** Capture Collector One's matches before any opt-out. Run `$VERIFY drive screenshot --path /tmp/lost-tales-verify/artifacts/matches/collector-one.png --full-page` and `$VERIFY drive snapshot --path /tmp/lost-tales-verify/artifacts/matches/collector-one.aria.txt` while `Collector Two` is visible. Artifacts show Matches, the counterparty heading, dun piles, and signed-in nav.

## Gotchas

- Matches load through a callable function. Wait for `Finding possible matches…` to disappear; do not snapshot the loading sentence as success or failure.
- A freshness line `As of N seconds ago` with `Refresh` can appear. Refresh is disabled while `Can refresh in N seconds` is shown.
- Opt-out is a negative checkbox (`Include me in Matches` checked means participating). After toggling, wait for `Saving preference…` to clear before changing routes.
- If launch used a custom `functions/seed.local.json`, counterparties and SKUs may differ. Read that file before asserting `Collector Two`.
- `$VERIFY seed` after an opt-out restores `matchingOptOut: false` and all three match lanes enabled for seed users.
- Google-only accounts are out of scope here; prove with the seeded email user.
- Empty lanes are omitted. Seeded Collector One vs Two has a dun lane only.
