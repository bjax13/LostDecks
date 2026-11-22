import { SITE_URL } from "../../../brand.js";
import { datasetSkus, datasetStories, getCollectibleRecord } from "../../../data/collectibles";
import { normalizeTradeFlag } from "../../../lib/tradeFlag.js";
import { DEFAULT_MATCH_KEEP_BY_LANE } from "../../../lib/userPreferences.js";
import { ownedQuantityFromEntry, resolveCollectionEntrySkuId } from "./collectionEntrySku.js";

/** Story deck codes → single-letter shorthand prefix (ELS→E, LOP→L, CHM→C). */
export const SHORTHAND_STORY_PREFIX = Object.freeze({
  ELS: "E",
  LOP: "L",
  CHM: "C",
});

const SECTIONS = [
  {
    title: "Story Foils",
    slug: "story-foils",
    groupSuffix: "Foils",
    lane: "foil",
    predicate: ({ card, finish }) => card.category === "story" && finish === "FOIL",
  },
  {
    title: "Story Dun",
    slug: "story-dun",
    groupSuffix: "Dun",
    lane: "dun",
    predicate: ({ card, finish }) => card.category === "story" && finish === "DUN",
  },
  {
    title: "Heralds (Foil)",
    slug: "heralds-foil",
    groupSuffix: "Heralds",
    lane: "foil",
    predicate: ({ card, finish }) => card.category === "herald" && finish === "FOIL",
  },
  {
    title: "Heralds (Dun)",
    slug: "heralds-dun",
    groupSuffix: "Heralds",
    lane: "dun",
    predicate: ({ card, finish }) => card.category === "herald" && finish === "DUN",
  },
  {
    title: "Nonsense (Dun)",
    slug: "nonsense-dun",
    groupSuffix: "Nonsense",
    lane: "dun",
    predicate: ({ card, finish }) => card.category === "nonsense" && finish === "DUN",
  },
  {
    title: "Nonsense (Foil)",
    slug: "nonsense-foil",
    groupSuffix: "Nonsense",
    lane: "foil",
    predicate: ({ card, finish }) => card.category === "nonsense" && finish === "FOIL",
  },
  {
    title: "Pins",
    slug: "pins",
    groupSuffix: "Pins",
    lane: "pins",
    predicate: ({ card }) => card.collectibleType === "pin" || card.category === "pin",
  },
];

/** Section node IDs excluded from the post preview when the modal first opens. */
export const DEFAULT_EXCLUDED_SECTION_IDS = ["uft:story-dun"];

export function getDefaultExcludedIds() {
  return new Set(DEFAULT_EXCLUDED_SECTION_IDS);
}

export function buildShareUrl({ shareId = null, campaign = "iso_uft" } = {}) {
  const path = shareId ? `t/${encodeURIComponent(shareId)}` : "getting-started";
  const params = new URLSearchParams({
    utm_source: "share",
    utm_medium: "iso_uft",
    utm_campaign: campaign,
  });
  return `${SITE_URL}/${path}?${params.toString()}`;
}

function skuKey(skuId) {
  return String(skuId).trim().toUpperCase();
}

function getVariantLabel(detail) {
  if (!detail) {
    return null;
  }
  const trimmed = detail.trim();
  if (trimmed.toLowerCase() === "standard variant") {
    return null;
  }
  if (trimmed.toLowerCase().startsWith("variant:")) {
    return trimmed.slice("variant:".length).trim();
  }
  return trimmed;
}

function storyShorthandPrefix(card) {
  const code = card.story ? String(card.story).trim().toUpperCase() : "";
  if (code && SHORTHAND_STORY_PREFIX[code]) {
    return SHORTHAND_STORY_PREFIX[code];
  }
  if (code) {
    return code.charAt(0);
  }
  return "?";
}

function variantShorthandSuffix(card) {
  const variant = getVariantLabel(card.detail) ?? card.variantName?.trim();
  if (!variant) {
    return "";
  }
  const compact = variant.replace(/\s+/g, "");
  return compact ? `-${compact}` : "";
}

function formatTradeItem(card, format = "classic") {
  if (!card) {
    return null;
  }
  if (format === "shorthand") {
    if (card.category === "story") {
      const text = `${storyShorthandPrefix(card)}${card.number}`;
      return { text, sortKey: [card.number, ""] };
    }
    if (card.category === "herald") {
      const number = Number.isFinite(card.number) ? card.number : 0;
      return { text: `H${number}`, sortKey: [number, ""] };
    }
    if (card.category === "nonsense") {
      const text = `${storyShorthandPrefix(card)}${card.number}N${variantShorthandSuffix(card)}`;
      return { text, sortKey: [card.number, variantShorthandSuffix(card)] };
    }
  }

  if (card.category === "story") {
    return { text: `${card.number}`, sortKey: [card.number, ""] };
  }
  if (card.category === "herald") {
    const label = card.displayName ?? "Unknown Herald";
    const number = Number.isFinite(card.number) ? card.number : 0;
    return { text: `${number} ${label}`, sortKey: [number, label] };
  }
  if (card.category === "nonsense") {
    const variant = getVariantLabel(card.detail);
    return {
      text: variant ? `${card.number} ${variant}` : `${card.number}`,
      sortKey: [card.number, variant ?? ""],
    };
  }
  if (card.category === "pin" || card.collectibleType === "pin") {
    const label = card.displayName ?? card.id ?? "Unknown Pin";
    const number = Number.isFinite(card.number) ? card.number : 0;
    return { text: label, sortKey: [number, label] };
  }
  return { text: card.displayName ?? card.id ?? "Unknown", sortKey: [card.displayName ?? "", ""] };
}

function getStoryTitle(card) {
  return card.storyTitle ?? "Other";
}

function matchSectionSku(sku, predicate) {
  const finish = sku.finish ? sku.finish.toUpperCase() : null;
  const card = getCollectibleRecord(sku.cardId);
  if (!card || !predicate({ card, finish })) {
    return null;
  }
  return card;
}

function buildTradeFlagsBySku(entries) {
  const flags = new Map();
  if (!Array.isArray(entries)) return flags;
  for (const entry of entries) {
    const skuId = resolveCollectionEntrySkuId(entry);
    const flag = normalizeTradeFlag(entry?.tradeFlag);
    if (!skuId || !flag) continue;
    flags.set(skuId, flag);
  }
  return flags;
}

function buildOwnedSkuCounts(entries) {
  const ownedSkuCounts = new Map();
  let skippedEntries = 0;

  entries.forEach((entry) => {
    const quantity = ownedQuantityFromEntry(entry);
    if (!quantity) return;

    const skuId = resolveCollectionEntrySkuId(entry);
    if (!skuId) {
      skippedEntries += 1;
      return;
    }
    ownedSkuCounts.set(skuId, (ownedSkuCounts.get(skuId) ?? 0) + quantity);
  });

  return { ownedSkuCounts, skippedEntries };
}

function ownedCountForSku(ownedSkuCounts, sku) {
  return ownedSkuCounts.get(skuKey(sku.skuId)) ?? 0;
}

function buildOwnedCardIds(ownedSkuCounts) {
  const ownedCardIds = new Set();
  datasetSkus.forEach((sku) => {
    if (ownedCountForSku(ownedSkuCounts, sku) <= 0 || !sku.cardId) {
      return;
    }
    ownedCardIds.add(sku.cardId);
  });
  return ownedCardIds;
}

function normalizeMatchKeep(matchKeep) {
  return {
    dun: matchKeep?.dun ?? DEFAULT_MATCH_KEEP_BY_LANE.dun,
    foil: matchKeep?.foil ?? DEFAULT_MATCH_KEEP_BY_LANE.foil,
    pins: matchKeep?.pins ?? DEFAULT_MATCH_KEEP_BY_LANE.pins,
  };
}

/** ISO only fills gaps in story groups already started for this finish/section. */
function buildStartedStoryTitles(predicate, ownedSkuCounts) {
  const started = new Set();
  datasetSkus.forEach((sku) => {
    if (ownedCountForSku(ownedSkuCounts, sku) <= 0) {
      return;
    }
    const card = matchSectionSku(sku, predicate);
    if (!card) {
      return;
    }
    started.add(getStoryTitle(card));
  });
  return started;
}

function collectSectionTradeRows(
  section,
  mode,
  ownedSkuCounts,
  ownedCardIds,
  storyRank,
  format,
  matchKeep,
  tradeFlags = new Map(),
) {
  const { predicate, groupSuffix, lane } = section;
  const keepThreshold = normalizeMatchKeep(matchKeep)[lane] ?? 1;
  const groups = new Map();
  const skuRows = [];
  const seenSkuIds = new Set();
  const startedStories = mode === "iso" ? buildStartedStoryTitles(predicate, ownedSkuCounts) : null;

  datasetSkus.forEach((sku) => {
    const skuId = skuKey(sku.skuId);
    if (seenSkuIds.has(skuId)) {
      return;
    }
    const ownedCount = ownedCountForSku(ownedSkuCounts, sku);
    const flag = tradeFlags.get(skuId) || null;
    const flaggedForMode =
      (mode === "iso" && flag === "iso") || (mode === "uft" && flag === "uft" && ownedCount >= 1);
    if (mode === "iso") {
      if (!flaggedForMode && (ownedCount > 0 || ownedCardIds.has(sku.cardId))) {
        return;
      }
    } else if (!flaggedForMode && ownedCount <= keepThreshold) {
      return;
    }

    const card = matchSectionSku(sku, predicate);
    if (!card) {
      return;
    }

    const storyTitle = getStoryTitle(card);
    if (mode === "iso" && !flaggedForMode && !startedStories.has(storyTitle)) {
      return;
    }

    const item = formatTradeItem(card, format);
    if (!item) {
      return;
    }

    seenSkuIds.add(skuId);
    if (mode === "iso") {
      skuRows.push({ skuId, quantity: 1 });
    } else {
      const normalExtras = ownedCount - keepThreshold;
      skuRows.push({
        skuId,
        quantity: flag === "uft" ? Math.max(1, normalExtras) : normalExtras,
      });
    }

    if (!groups.has(storyTitle)) {
      groups.set(storyTitle, []);
    }
    groups.get(storyTitle).push(item);
  });

  const orderedGroups = Array.from(groups.entries()).sort(([titleA], [titleB]) => {
    const rankA = storyRank(titleA);
    const rankB = storyRank(titleB);
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    return titleA.localeCompare(titleB);
  });

  const stories = [];
  orderedGroups.forEach(([storyTitle, items]) => {
    items.sort((a, b) => {
      if (a.sortKey[0] !== b.sortKey[0]) {
        return a.sortKey[0] - b.sortKey[0];
      }
      return String(a.sortKey[1]).localeCompare(String(b.sortKey[1]));
    });
    stories.push({
      storyTitle,
      line: `${storyTitle} ${groupSuffix}: ${items.map((item) => item.text).join(", ")}`,
    });
  });

  return { stories, skuRows };
}

export function buildIsoUftPostTree(
  entries,
  { matchKeep = DEFAULT_MATCH_KEEP_BY_LANE, format = "classic" } = {},
) {
  const { ownedSkuCounts, skippedEntries } = buildOwnedSkuCounts(entries);
  const tradeFlags = buildTradeFlagsBySku(entries);
  const ownedCardIds = buildOwnedCardIds(ownedSkuCounts);

  const storyOrder = datasetStories.map((story) => story.title);
  const storyRank = (title) => {
    const index = storyOrder.indexOf(title);
    return index === -1 ? Number.POSITIVE_INFINITY : index;
  };

  const modes = [
    { id: "iso", label: "ISO", mode: "iso" },
    { id: "uft", label: "UFT", mode: "uft" },
  ];

  const tree = modes.map(({ id, label, mode }) => {
    const children = SECTIONS.map((section) => {
      const { stories } = collectSectionTradeRows(
        section,
        mode,
        ownedSkuCounts,
        ownedCardIds,
        storyRank,
        format,
        matchKeep,
        tradeFlags,
      );
      if (stories.length === 0) {
        return null;
      }

      return {
        id: `${id}:${section.slug}`,
        label: section.title,
        children: stories.map(({ storyTitle, line }) => ({
          id: `${id}:${section.slug}:${storyTitle}`,
          label: storyTitle,
          line,
        })),
      };
    }).filter(Boolean);

    return { id, label, children };
  });

  return { tree, skippedEntries };
}

export function buildIsoUftSkuLists(entries, { matchKeep = DEFAULT_MATCH_KEEP_BY_LANE } = {}) {
  const { ownedSkuCounts, skippedEntries } = buildOwnedSkuCounts(entries);
  const tradeFlags = buildTradeFlagsBySku(entries);
  const ownedCardIds = buildOwnedCardIds(ownedSkuCounts);

  const storyOrder = datasetStories.map((story) => story.title);
  const storyRank = (title) => {
    const index = storyOrder.indexOf(title);
    return index === -1 ? Number.POSITIVE_INFINITY : index;
  };

  const iso = [];
  const uft = [];

  for (const section of SECTIONS) {
    for (const mode of ["iso", "uft"]) {
      const { skuRows } = collectSectionTradeRows(
        section,
        mode,
        ownedSkuCounts,
        ownedCardIds,
        storyRank,
        "classic",
        matchKeep,
        tradeFlags,
      );
      if (mode === "iso") {
        for (const row of skuRows) {
          iso.push(row.skuId);
        }
      } else {
        for (const row of skuRows) {
          uft.push({ skuId: row.skuId, quantity: row.quantity });
        }
      }
    }
  }

  return { iso, uft, skippedEntries };
}

/** Discord standard message character limit (4,000 with Nitro — we target the default). */
export const DISCORD_MESSAGE_CHAR_LIMIT = 2000;

const DISCORD_MARKDOWN_ESCAPE_PATTERN = /[*_~`|>#\\[\]]/g;

/** Escape catalog copy for Discord markdown (Discord output only). */
export function escapeDiscordMarkdownContent(text) {
  return String(text).replace(DISCORD_MARKDOWN_ESCAPE_PATTERN, "\\$&");
}

const ISO_MODE_SUBTITLE = "(looking for)";
const UFT_MODE_SUBTITLE = "(up for trade)";

export const DEFAULT_DISCORD_HEADING = "My ShardStash trade list";

function collectVisiblePostContent(tree, excludedIds) {
  const modes = [];

  for (const modeNode of tree) {
    if (excludedIds.has(modeNode.id)) {
      continue;
    }

    const sections = [];
    let hasVisibleContent = false;

    for (const section of modeNode.children) {
      if (excludedIds.has(section.id)) {
        continue;
      }

      const visibleLeaves = section.children.filter(
        (leaf) => leaf.line && !excludedIds.has(leaf.id),
      );

      if (visibleLeaves.length === 0) {
        continue;
      }

      hasVisibleContent = true;
      sections.push({
        label: section.label,
        items: visibleLeaves.map((leaf) => leaf.line),
      });
    }

    modes.push({
      id: modeNode.id,
      label: modeNode.label,
      subtitle: modeNode.id === "iso" ? ISO_MODE_SUBTITLE : UFT_MODE_SUBTITLE,
      sections,
      emptyFallback: modeNode.id === "iso" ? "None needed yet." : "None available yet.",
      hasVisibleContent,
    });
  }

  return modes;
}

function formatPlainIsoUftPost(modes, { footerUrl = null } = {}) {
  const lines = [];

  for (const mode of modes) {
    lines.push(`${mode.label}:`, "");

    if (!mode.hasVisibleContent) {
      lines.push(mode.emptyFallback, "");
      continue;
    }

    for (const section of mode.sections) {
      lines.push(`${section.label}:`);
      for (const item of section.items) {
        lines.push(item);
      }
      lines.push("");
    }
  }

  while (lines.length > 0 && lines.at(-1) === "") {
    lines.pop();
  }

  if (footerUrl) {
    lines.push("");
    lines.push(`Trade with me on ShardStash: ${footerUrl}`);
  }

  return lines.join("\n");
}

function formatDiscordFooterLine(footerUrl) {
  if (!footerUrl) {
    return null;
  }
  const updated = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `-# Updated ${updated} · [ShardStash](${footerUrl})`;
}

function discordBulletsForMode(mode) {
  if (!mode.hasVisibleContent) {
    return [{ modeId: mode.id, text: `- ${mode.emptyFallback}` }];
  }

  const bullets = [];
  for (const section of mode.sections) {
    for (const item of section.items) {
      bullets.push({ modeId: mode.id, text: `- ${escapeDiscordMarkdownContent(item)}` });
    }
  }
  return bullets;
}

function buildDiscordPostSegments(
  modes,
  { footerUrl = null, heading = DEFAULT_DISCORD_HEADING } = {},
) {
  const segments = [{ kind: "heading", text: `## ${heading}` }];

  for (const mode of modes) {
    segments.push({
      kind: "modeHeader",
      modeId: mode.id,
      text: `**${mode.label}** ${mode.subtitle}`,
    });
    for (const bullet of discordBulletsForMode(mode)) {
      segments.push({ kind: "bullet", modeId: bullet.modeId, text: bullet.text });
    }
    segments.push({ kind: "spacer" });
  }

  while (segments.length > 0 && segments.at(-1).kind === "spacer") {
    segments.pop();
  }

  const footerLine = formatDiscordFooterLine(footerUrl);
  if (footerLine) {
    segments.push({ kind: "footer", text: footerLine });
  }

  return segments;
}

function renderDiscordSegments(segments) {
  const lines = [];
  for (const segment of segments) {
    if (segment.kind === "spacer") {
      lines.push("");
    } else {
      lines.push(segment.text);
    }
  }
  return lines.join("\n");
}

function formatDiscordIsoUftPost(
  modes,
  { footerUrl = null, heading = DEFAULT_DISCORD_HEADING } = {},
) {
  return renderDiscordSegments(buildDiscordPostSegments(modes, { footerUrl, heading }));
}

function renderChunkFromUnits(
  units,
  { partIndex, partCount, headingBase, footerLine, headerByMode = null },
) {
  const lines = [];
  const numberedHeading =
    partCount > 1 ? `${headingBase} (${partIndex}/${partCount})` : headingBase;
  lines.push(numberedHeading, "");

  let lastModeId = null;
  for (const unit of units) {
    if (unit.kind === "modeHeader") {
      if (lastModeId !== null) {
        lines.push("");
      }
      lines.push(unit.text);
      lastModeId = unit.modeId;
      continue;
    }

    if (unit.kind !== "bullet") {
      continue;
    }

    if (lastModeId !== unit.modeId) {
      const header =
        headerByMode?.get(unit.modeId) ??
        units.find(
          (candidate) => candidate.kind === "modeHeader" && candidate.modeId === unit.modeId,
        );
      if (header) {
        if (lines.length > 2) {
          lines.push("");
        }
        lines.push(header.text);
      }
      lastModeId = unit.modeId;
    }
    lines.push(unit.text);
  }

  if (footerLine) {
    lines.push("", footerLine);
  }

  return lines.join("\n");
}

function measureChunkSize(
  units,
  { partIndex, partCount, headingBase, footerLine, headerByMode, limit },
) {
  const chunkText = renderChunkFromUnits(units, {
    partIndex,
    partCount,
    headingBase,
    footerLine,
    headerByMode,
  });
  return { chunkText, fits: chunkText.length <= limit };
}

function splitDiscordBulletUnits(bullets, { limit, headingBase, footerLine, headerByMode }) {
  if (bullets.length === 0) {
    const fallback = renderChunkFromUnits([], {
      partIndex: 1,
      partCount: 1,
      headingBase,
      footerLine,
      headerByMode,
    });
    const chunk = fallback.length > 0 ? fallback : headingBase;
    return {
      chunks: [chunk],
      exceedsLimit: true,
      hasOversizedChunk: chunk.length > limit,
    };
  }

  const greedyChunks = [];
  let index = 0;
  while (index < bullets.length) {
    let end = index;
    let lastFittingEnd = index;

    while (end < bullets.length) {
      const units = bullets.slice(index, end + 1);
      const tentativeParts = greedyChunks.length + 1;
      const { fits } = measureChunkSize(units, {
        partIndex: tentativeParts,
        partCount: tentativeParts,
        headingBase,
        footerLine: null,
        headerByMode,
        limit,
      });
      if (fits) {
        lastFittingEnd = end + 1;
        end += 1;
        continue;
      }
      if (end === index) {
        lastFittingEnd = index + 1;
      }
      break;
    }

    if (lastFittingEnd <= index) {
      lastFittingEnd = index + 1;
    }
    greedyChunks.push(bullets.slice(index, lastFittingEnd));
    index = lastFittingEnd;
  }

  const rebalanceFooterOverflow = () => {
    if (!footerLine || greedyChunks.length === 0) {
      return;
    }
    const partCount = greedyChunks.length;
    const chunks = greedyChunks.map((units, idx) =>
      renderChunkFromUnits(units, {
        partIndex: idx + 1,
        partCount,
        headingBase,
        footerLine: idx === partCount - 1 ? footerLine : null,
        headerByMode,
      }),
    );
    const last = chunks[chunks.length - 1];
    if (last.length <= limit) {
      return;
    }
    const lastUnits = greedyChunks[greedyChunks.length - 1];
    if (lastUnits.length <= 1) {
      return;
    }
    const splitPoint = Math.max(1, lastUnits.length - 1);
    const headUnits = lastUnits.slice(0, splitPoint);
    const tailUnits = lastUnits.slice(splitPoint);
    greedyChunks.splice(greedyChunks.length - 1, 1, headUnits, tailUnits);
  };

  rebalanceFooterOverflow();

  let partCount = greedyChunks.length;
  let chunks = greedyChunks.map((units, idx) =>
    renderChunkFromUnits(units, {
      partIndex: idx + 1,
      partCount,
      headingBase,
      footerLine: idx === partCount - 1 ? footerLine : null,
      headerByMode,
    }),
  );

  for (let i = 0; i < 8; i += 1) {
    const oversized = chunks.findIndex((chunk) => chunk.length > limit);
    if (oversized === -1) {
      break;
    }
    const units = greedyChunks[oversized];
    if (units.length <= 1) {
      break;
    }
    const mid = Math.ceil(units.length / 2);
    greedyChunks.splice(oversized, 1, units.slice(0, mid), units.slice(mid));
    partCount = greedyChunks.length;
    chunks = greedyChunks.map((unitList, idx) =>
      renderChunkFromUnits(unitList, {
        partIndex: idx + 1,
        partCount,
        headingBase,
        footerLine: idx === partCount - 1 ? footerLine : null,
        headerByMode,
      }),
    );
  }

  const hasOversizedChunk = chunks.some((chunk) => chunk.length > limit);
  return {
    chunks: chunks.length > 0 ? chunks : [headingBase],
    exceedsLimit: true,
    hasOversizedChunk,
  };
}

/**
 * Splits a Discord-formatted post into numbered chunks under `limit` characters.
 * Splits only at item bullet boundaries.
 */
export function splitDiscordIsoUftPost(
  text,
  { limit = DISCORD_MESSAGE_CHAR_LIMIT, heading = DEFAULT_DISCORD_HEADING } = {},
) {
  if (text.length <= limit) {
    return { chunks: [text], exceedsLimit: false, hasOversizedChunk: false };
  }

  const lines = text.split("\n");
  const footerLine = lines.find((line) => line.startsWith("-# ")) ?? null;
  const headingBase =
    (lines[0] ?? `## ${heading}`).replace(/\s*\(\d+\/\d+\)\s*$/, "") || `## ${heading}`;

  const modeHeaders = new Map();
  const bullets = [];
  let activeModeId = "iso";

  for (const line of lines) {
    if (line.startsWith("**ISO**") || line.startsWith("**UFT**")) {
      activeModeId = line.startsWith("**ISO**") ? "iso" : "uft";
      modeHeaders.set(activeModeId, { kind: "modeHeader", modeId: activeModeId, text: line });
    } else if (line.startsWith("- ")) {
      bullets.push({ kind: "bullet", modeId: activeModeId, text: line });
    }
  }

  if (bullets.length === 0) {
    return {
      chunks: [text],
      exceedsLimit: true,
      hasOversizedChunk: text.length > limit,
    };
  }

  return splitDiscordBulletUnits(bullets, {
    limit,
    headingBase,
    footerLine,
    headerByMode: modeHeaders,
  });
}

export function splitDiscordPostSegments(
  segments,
  { limit = DISCORD_MESSAGE_CHAR_LIMIT, heading = DEFAULT_DISCORD_HEADING } = {},
) {
  const fullText = renderDiscordSegments(segments);
  if (fullText.length <= limit) {
    return { chunks: [fullText], exceedsLimit: false, hasOversizedChunk: false };
  }

  const headingBase = `## ${heading}`;
  const footerSegment = segments.find((segment) => segment.kind === "footer");
  const footerLine = footerSegment?.text ?? null;
  const modeHeaders = segments.filter((segment) => segment.kind === "modeHeader");
  const bullets = segments.filter((segment) => segment.kind === "bullet");

  const headerByMode = new Map(modeHeaders.map((segment) => [segment.modeId, segment]));

  if (bullets.length === 0) {
    return {
      chunks: [fullText],
      exceedsLimit: true,
      hasOversizedChunk: fullText.length > limit,
    };
  }

  return splitDiscordBulletUnits(bullets, {
    limit,
    headingBase,
    footerLine,
    headerByMode,
  });
}

export function formatIsoUftPost(
  tree,
  excludedIds = new Set(),
  {
    format: _itemDisplayFormat = "classic",
    footerUrl = null,
    outputFormat = "plain",
    heading = DEFAULT_DISCORD_HEADING,
  } = {},
) {
  void _itemDisplayFormat;
  const modes = collectVisiblePostContent(tree, excludedIds);

  if (outputFormat === "discord") {
    return formatDiscordIsoUftPost(modes, { footerUrl, heading });
  }

  return formatPlainIsoUftPost(modes, { footerUrl });
}

export function formatIsoUftPostWithDiscordChunks(tree, excludedIds = new Set(), options = {}) {
  const heading = options.heading ?? DEFAULT_DISCORD_HEADING;
  const modes = collectVisiblePostContent(tree, excludedIds);
  const segments = buildDiscordPostSegments(modes, {
    footerUrl: options.footerUrl ?? null,
    heading,
  });
  const text = renderDiscordSegments(segments);
  const { chunks, exceedsLimit, hasOversizedChunk } = splitDiscordPostSegments(segments, {
    heading,
  });
  return { text, chunks, exceedsLimit, hasOversizedChunk };
}

export function buildIsoUftPost(
  entries,
  {
    excludedIds = new Set(),
    matchKeep = DEFAULT_MATCH_KEEP_BY_LANE,
    format = "classic",
    footerUrl = null,
  } = {},
) {
  const { tree, skippedEntries } = buildIsoUftPostTree(entries, { matchKeep, format });
  const text = formatIsoUftPost(tree, excludedIds, { format, footerUrl });
  return { text, skippedEntries };
}
