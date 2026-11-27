# Public trade list

A signed-in collector can publish a public trade list from the ISO/UFT post dialog. Anyone with the link can open `/t/<shareId>` and read that collector's ISO and UFT lines without signing in. An unknown or revoked id says the list is no longer shared.

## Sub-features

- `trade-list-missing` shows `This list isn't shared anymore` for an unknown or revoked id.
- `trade-list-publish` turns on `Share a public trade list link` in the ISO/UFT post dialog and puts a `/t/<shareId>` URL in the preview.
- `trade-list-public` shows `<display name>'s trade list` with ISO and UFT sections to a signed-out visitor.

## How to get to it (user POV)

- Open `/t/<shareId>` directly, signed in or signed out.
- Signed in, open Collection, choose `Copy ISO/UFT post`, then check `Share a public trade list link (/t/…)`. The preview link uses the production host. On this stack, open the `/t/<shareId>` path at `http://127.0.0.1:5173`.

## Driving it with verify-lost-tales

Preconditions:

- ShardStash is healthy at `http://127.0.0.1:5173`.
- Seed user `collector.one@example.com` / `replace-me-local-only` still has the example collection (Elsecaller #01 quantity 2, Elsecaller #03 quantity 1).
- `doctor` reports `ok=true`.

- **Unknown id.** Open a share id that was never published. Run `$VERIFY drive goto --path /t/not-a-real-share`. The heading `This list isn't shared anymore` is visible, with link `Start your own collection on ShardStash`. Capture `$VERIFY drive screenshot --path /tmp/lost-tales-verify/artifacts/trade-list/missing.png --full-page` and `$VERIFY drive snapshot --path /tmp/lost-tales-verify/artifacts/trade-list/missing.aria.txt`.
- **Publish.** Sign in as Collector One and open the post dialog. Run `$VERIFY drive login --email collector.one@example.com --password replace-me-local-only`, `$VERIFY drive click --role link --name Collection --scope nav`, and `$VERIFY drive click --role button --name "Copy ISO/UFT post"`. Dialog `ISO/UFT post preview` is visible.
- **Enable the link.** If checkbox `Share a public trade list link` is not checked, run `$VERIFY drive click --role checkbox --name "Share a public trade list link"`. Wait until the dialog text includes `https://shardstash.web.app/t/`. Read the id from that URL (the path segment before `?`). Do not click the checkbox again. Capture `$VERIFY drive snapshot --path /tmp/lost-tales-verify/artifacts/trade-list/modal.aria.txt`.
- **Open the list.** Run `$VERIFY drive goto --path /t/<shareId>` using the id from the preview. Heading `Collector One's trade list` is visible, with headings `ISO (looking for)` and `UFT (up for trade)`. For the seed collection, UFT includes `Elsecaller #01` and ISO includes `Elsecaller #02`. Link `See if you can trade — add your cards or pins` is visible. Capture `$VERIFY drive screenshot --path /tmp/lost-tales-verify/artifacts/trade-list/shared.png --full-page` and `$VERIFY drive snapshot --path /tmp/lost-tales-verify/artifacts/trade-list/shared.aria.txt`.
- **Signed-out reader.** Sign out and open the same path. Run `$VERIFY drive logout` and `$VERIFY drive goto --path /t/<shareId>`. The same trade-list heading remains, and primary nav shows `Sign in`. Capture `$VERIFY drive snapshot --path /tmp/lost-tales-verify/artifacts/trade-list/shared-signed-out.aria.txt`.

## Gotchas

- The share id is new each time the box is turned on. Do not reuse an id from an older run.
- The preview URL host is `shardstash.web.app`. Local proof uses only the `/t/<shareId>` path on `http://127.0.0.1:5173`.
- The checkbox toggles. Clicking it while it is already checked revokes the link, and the next visit shows `This list isn't shared anymore`.
- The checkbox can be disabled while the write finishes. Wait for `/t/` in the preview before navigating.
- The dialog preview follows the `Include in post` checkboxes. Story Dun under UFT starts unchecked, so the preview can omit extras the public page still lists. Prove the public page, not the preview paragraph.
- `$VERIFY seed` does not delete `shares` documents. Revoke from the checkbox when a later recipe needs the missing-list state for that id.
