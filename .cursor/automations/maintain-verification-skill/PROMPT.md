Run the pstack skill `maintain-verification-skill` against this repository.

Target: `.cursor/skills/verify-lost-tales-marketplace/` (SKILL.md, features/, and scripts/ only).

Read `.cursor/skills/verify-lost-tales-marketplace/SKILL.md` and `features/README.md` before driving. Follow that skill's own launch, doctor, drive, evidence, and cleanup model. Do not invent a second harness.

## Outcomes

Pick exactly one and say which in the final message:

- **clean** — every feature got source and live coverage; nothing worth shipping. No branch, no PR.
- **changed** — one PR of proven doc, harness, or map corrections.
- **blocked** — coverage could not finish or a proven fix could not ship safely. Say exactly what blocked it.

## Edit scope

Only edit `.cursor/skills/verify-lost-tales-marketplace/`. Never edit product code. A behavior the map describes that the app no longer does is either doc drift (fix the map) or a product regression (report it; do not paper over it in docs).

## Pass

0. Confirm the target skill exists. If it is missing, stop and report that `/create-verification-skill` is needed. Do not invent a replacement.

1. Index hygiene: read `features/README.md` and glob sibling feature files. Fix missing, extra, duplicate, or dead entries.

2. Source wave: one read-only subagent per feature file, launched concurrently. Each returns: feature summary / source entry points / likely drift or none / one live recipe. Children never drive the app and never edit files.

3. Reconcile those summaries. Spot-check cited drift. Sweep recent user-facing surfaces and add a map file only when a concrete source path proves one is missing.

4. Live pass, required even when source looks clean. Launch once with the verification skill, doctor before the first drive, exercise every feature at least once, doctor after any failed drive, keep evidence at `/tmp/lost-tales-verify/artifacts/`, and clean up processes this run started. Cleanup must not delete evidence.

5. Triage: wrong user-POV copy → fix the map. Working UI the harness cannot drive → fix the harness (keep scripts executable and documented in SKILL.md). Broken product behavior → report it, keep it out of this PR.

6. Ship or stop. For **changed**, one PR of proven corrections off `main`, re-read every changed file first. For **clean** or **blocked**, no PR.

Keep run notes in scratch space. Do not commit them.

Start from `main`. Open a PR only for proven skill/map/harness corrections.
