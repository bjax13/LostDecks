# Lost Tales Marketplace verification map

This directory is the maintained source for verifying user-facing behavior of Lost Tales Marketplace. Read this index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- Launch with `node .cursor/skills/verify-lost-tales-marketplace/scripts/verify-lost-tales.mjs launch`.
- App URL is `http://127.0.0.1:5173` against Firebase emulators (Auth 9099, Firestore 8080, Functions 5001).
- Seed users exist: `collector.one@example.com` and `collector.two@example.com` with password `replace-me-local-only`.
- Browser session starts signed out. `login` / `logout` drive the real auth UI.
- Run `doctor` and require `ok=true` before the first command.
- Never drive an instance this run did not start. Do not attach to a shared Vite or emulator session.

## Driving conventions

- Harness: `VERIFY="node .cursor/skills/verify-lost-tales-marketplace/scripts/verify-lost-tales.mjs"` then `$VERIFY drive …`.
- Start every recipe from the baseline (signed out, seeded backend) unless the feature lists other preconditions.
- Prefer `--role` / `--label` / `--scope nav` over CSS, test ids, and coordinates.
- Treat every command as literal. Keep quoted names and flags unchanged.
- After a mutation, restore baseline (`logout`, and `$VERIFY seed` if collection data changed) so the next feature starts clean.
- Do not delete `/tmp/lost-tales-verify/artifacts/` during cleanup.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof includes an ARIA snapshot and a screenshot with the heading and primary nav visible.
- Mutation proof includes a second user-facing view of the stored value (Collection, Matches, or nav session).
- Record the feature ID and entry point with every artifact.
- Report an unreachable path with the attempted command and the unmet precondition.
- Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with verify-lost-tales` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands, and observable proof.

## Features

- [Home](./home.md) covers the landing page, primary nav, catalog tiles, and getting-started CTAs.
- [Collectibles](./collectibles.md) covers catalog search, filters, grid/table, and collectible detail.
- [Sign in](./auth.md) covers login, register, the quick-sign-in modal, and auth-gated redirects.
- [Collection](./collection.md) covers the signed-in collection, getting-started save, and bulk tools.
- [Matches](./matches.md) covers reciprocal trade matches and the Account matching opt-out.
