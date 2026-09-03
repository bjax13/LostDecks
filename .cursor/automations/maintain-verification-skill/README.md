# Weekly verification-skill maintenance

Cursor Automation that runs `/maintain-verification-skill` against Lost Tales Marketplace every Friday morning.

This directory is the committed prompt the live automation should read. It is not a slash skill.

## Dashboard settings

Create (or paste these into) one automation at [cursor.com/automations](https://cursor.com/automations). Cron triggers default to **no repository**; this run must clone code and may open a PR, so set the repo explicitly.

| Field | Value |
|-------|--------|
| Name | `weekly-verify-skill-maintenance` |
| Trigger | Scheduled. Custom cron `0 8 * * 5` in **America/Denver** (Friday 8:00 AM Mountain). If the editor only accepts UTC, use `0 14 * * 5` while daylight time is in effect, or `0 15 * * 5` during standard time. |
| Repository | `https://github.com/bjax13/LostDecks` |
| Starting branch | `main` |
| Tools | Pull request creation on. Computer use on. Memories optional. |
| Instructions | The contents of [PROMPT.md](./PROMPT.md) |

Do not enable the automation until this directory, `.cursor/settings.json` (pstack), and `.cursor/skills/verify-lost-tales-marketplace/` are on the starting branch.

## Why pstack is enabled

`.cursor/settings.json` turns on the pstack plugin so a fresh cloud agent can resolve `maintain-verification-skill`. The live prompt still points at the committed files in this repo, not a plugin cache path.
