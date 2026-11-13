# Admin

Admin is a signed-in directory of every collector's saved collection. Seeded collectors are not admins, so they see a denial instead of that directory.

## Sub-features

- `admin-gate` sends signed-out visitors to login.
- `admin-denied` shows `You are not authorized to view collector collections.` for a signed-in non-admin.
- `admin-directory` lists collectors and opens a read-only collection. It requires an admin custom claim.

## How to get to it (user POV)

- Open `/admin` directly.
- Choose `Admin` in the primary navigation. That link is rendered only when the signed-in account is an admin, so Collector One does not see it.

## Driving it with verify-lost-tales

Preconditions:

- ShardStash is healthy at `http://127.0.0.1:5173`.
- Seed user `collector.one@example.com` / `replace-me-local-only` exists and does not have an admin claim.
- `doctor` reports `ok=true`.

- **Signed-out gate.** Open Admin signed out. Run `$VERIFY drive logout` then `$VERIFY drive goto --path /admin`. The heading `Sign in to ShardStash` is visible.
- **Non-admin denial.** Sign in as Collector One and open Admin. Run `$VERIFY drive login --email collector.one@example.com --password replace-me-local-only` then `$VERIFY drive goto --path /admin`. Heading `Admin` is visible and the page shows `You are not authorized to view collector collections.` The primary nav does not include an `Admin` link.
- **Proof.** Capture the denial. Run `$VERIFY drive screenshot --path /tmp/lost-tales-verify/artifacts/admin/denied.png --full-page` and `$VERIFY drive snapshot --path /tmp/lost-tales-verify/artifacts/admin/denied.aria.txt`. Artifacts show `Admin`, the denial sentence, and `Hi, Collector One`.

## Gotchas

- `admin-directory` is unreachable with the seeded users. Do not describe the denial paragraph as the collector list. Reaching the directory needs an Auth custom claim this harness does not grant.
- Opening `/admin/:uid` while signed in as Collector One still shows the denial. It does not load that person's collection.
