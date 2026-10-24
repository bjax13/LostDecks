# 08 – Shareable ISO/UFT posts that link back to ShardStash

**Branches / PRs (one per step):**
- A: `growth/iso-uft-link-shorthand` · `ISO/UFT post: tracked ShardStash link + optional community shorthand`
- Pre-req (can ride with A): `seo/og-meta-image` · `Add description, Open Graph/Twitter meta and 1200x630 share image`
- B: `growth/public-trade-list` · `Opt-in public trade list page /t/:shareId`
- C (later): `growth/dynamic-og-trade-list` · `Dynamic OG preview for /t/* via Hosting rewrite`

## Goal
Every ISO/UFT post a user pastes into Discord, Facebook groups, Reddit or texts carries a link that brings new collectors into ShardStash, ideally to a public view of that user's list with a one-tap "enter your own" CTA (plan 07 flow).

## Current state (37e07e0)
- UI: `frontend/src/pages/Collection/components/IsoUftPostModal.jsx` (opened from `BulkCollectionTools.jsx`, `onCopied={handlePostCopied}`): checkbox tree of sections, preview, `handleCopy` → `copyTextToClipboard(previewText)` (`navigator.clipboard.writeText` with fallback).
- Logic: `frontend/src/pages/Collection/utils/isoUftPost.js`: `buildIsoUftPostTree(entries)` → modes `iso`/`uft`; sections Story Foils, Story Dun, Heralds (Foil/Dun), Nonsense (Dun/Foil), **ChasmFriends Pins**; `DEFAULT_EXCLUDED_SECTION_IDS = ["uft:story-dun"]`; `formatIsoUftPost(tree, excludedIds)` emits `ISO:` / `UFT:` headers then lines like `Elsecaller Foils: 1, 2, 40`. UFT = owned count **> 1** (hard-coded; ignores per-lane `matchKeep` from #149). ISO = SKUs not owned in any finish, only for stories already "started". Heralds render `"{n} {name}"`, Nonsense `"{baseNumber} {variant}"`, pins by name.
- No link, no image, no public page. Rules: catch-all deny; only own `collections`/`userPreferences` readable.
- `frontend/index.html` has `og:title`, `og:site_name`, `og:url`, canonical — **no** description, `og:image`, or `twitter:*`. No `frontend/public/` dir (plan 05 creates it).
- Catalog codes (`storydeck-lt24-with-skus.json` `stories`): `ELS` Elsecaller, `LOP` King Lopen the First of Alethkar, `CHM` The Chasmfriends get a Pet!; heralds `HLD-01..09`; nonsense `NS-{story}-{nn}` with variants (e.g. `LT24-NS-ELS-24-FOIL-DANCE`). Card records (`frontend/src/data/collectibles.js`) expose `story`, `number` (nonsense: `baseNumber`), `detail` (variant label).

## Prerequisite: static OG/Twitter meta
- `frontend/index.html`: add `<meta name="description" content="Track your Lost Tales Story Deck cards and ChasmFriends pins, and find collectors to trade with.">`, `og:description`, `og:type=website`, `og:image=https://shardstash.web.app/og-image.png`, `og:image:width=1200`, `og:image:height=630`, `twitter:card=summary_large_image`, `twitter:title`, `twitter:description`, `twitter:image`.
- `frontend/public/og-image.png` 1200×630 (<300 KB). Agent may generate a simple branded placeholder (e.g. SVG → PNG via a script); Bryan should replace with real art.
- E2E: assert the meta tags exist in `/` HTML. Manual: check with opengraph.xyz / Discord after deploy.

## Step A (small): tracked link + shorthand
1. `isoUftPost.js`: `formatIsoUftPost(tree, excludedIds, { format = "classic", footerUrl = null } = {})` (keep old signature working).
   - `footerUrl` → append `""` then `Trade with me on ShardStash: ${footerUrl}`.
   - New `buildShareUrl({ shareId, campaign = "iso_uft" })` → `https://shardstash.web.app/` + (`t/${shareId}` if given, else `getting-started`) + `?utm_source=share&utm_medium=iso_uft&utm_campaign=${campaign}`. Add `export const SITE_URL = "https://shardstash.web.app";` to `frontend/src/brand.js` (it only exports `SITE_NAME` today) and update `brand.test.js`.
   - `format: "shorthand"`: story items `E40` / `L40` / `C24` (story code first letter: ELS→E, LOP→L, CHM→C), heralds `H2`, nonsense `C24N` (+ `-Dance` style variant suffix), pins by name. Section headers stay ("Story Foils:"), so foil vs dun is marked by section; additionally offer `F` suffix? → **open question**. Put the code→letter map in one exported constant `SHORTHAND_STORY_PREFIX`.
   - Tests in `isoUftPost.test.js`: classic output unchanged when no options; footer line appended; shorthand for each category incl. a nonsense variant and pins.
2. `IsoUftPostModal.jsx`: checkbox "Include link to ShardStash" (default **on**) and a "Format: Classic / Shorthand" toggle; persist both in `localStorage` (`isoUftPostPrefs`). Preview reflects options. If plan 06 merged, `captureEvent("iso_uft_copied", { format, includeLink })`.

## Step B (medium): opt-in public trade list
1. **Data** `publicTradeLists/{shareId}` (shareId = 12-char random base62 via `crypto.getRandomValues`, not the uid/username): `{ ownerUid, displayName (≤60), discordHandle? (≤100), region? (≤60), iso: [skuId] (≤500), uft: [{ skuId, quantity }] (≤500), updatedAt: timestamp, version: 1 }`. **No email.**
2. **Rules** (`firestore.rules`): `allow read: if true;` create/update only if `request.auth.uid == request.resource.data.ownerUid`, keys `hasOnly` the list above, sizes bounded, `ownerUid` unchanged on update; delete if `resource.data.ownerUid == request.auth.uid`. Add `publicShareId` (string ≤ 32) to `validUserPreferences` so the owner can find their doc. Add rules tests (plan 03 harness).
3. **Snapshot builder**: export `buildIsoUftSkuLists(entries)` from `isoUftPost.js` reusing the same ISO/UFT selection as `buildSectionStories` (refactor so both text and lists share one selector); unit test.
4. **Owner UI** (`IsoUftPostModal.jsx` or a small `PublicTradeListToggle.jsx` in Collection): "Make my trade list public" toggle → create doc, save `publicShareId` in `userPreferences`, link uses `/t/{shareId}`; "Update public list" refreshes snapshot (also refresh on each copy); "Stop sharing" → `deleteDoc` + remove `publicShareId`. Show last updated time.
5. **Public page** route `/t/:shareId` → new `frontend/src/pages/PublicTradeList/index.jsx`: `getDoc` (works signed out); render UFT/ISO lists using catalog names (and the selected format), "Last updated …", contact = Discord handle if provided, CTA **"See if you can trade — add your cards or pins"** → `/getting-started?collect=pins&utm_source=share&ref={shareId}` (plan 07). Missing doc → friendly "This list isn't shared anymore" + CTA. Lists older than 30 days show a stale badge.
6. Account deletion (plan 02) must also delete the user's `publicTradeLists` docs — update `deleteMyAccount`.

## Step C (later): dynamic previews
`firebase.json` Hosting rewrite `{ "source": "/t/**", "function": "renderTradeListMeta" }` placed **before** the `**` rewrite; function reads the doc, returns `index.html` with injected `og:title` ("{name}'s trade list on ShardStash"), `og:description` (counts), optional generated image. Must set `maxInstances` and cache headers. Plan separately.

## Manual steps for Bryan
Provide final OG art; after deploy, test a link in Discord, Facebook (Sharing Debugger → scrape again), X, iMessage. Decide open questions below.

## Tests / verification
`npm run check`; frontend unit + coverage; E2E: `/t/does-not-exist` shows the unavailable state signed out; meta tags present; rules tests for public read / owner-only write. Emulator: toggle on → open `/t/{id}` in a private window → CTA leads to the picker.

## Done criteria
A: copied post ends with tracked link; shorthand option works. B: public page readable signed out, owner can stop sharing, no email in the doc.

## Open questions (Bryan)
1. Shorthand default or opt-in? How should foil be marked (section header only vs `F` suffix vs `*`)?
2. Public page shows display name + optional Discord handle only — OK?
3. Image version of the list for Facebook groups, or text + link first?
4. Should UFT respect the per-lane keep counts (#149) instead of the hard-coded `> 1`?

## Out of scope
Image generation, reputation/trade confirmations, indexing public lists for search.
