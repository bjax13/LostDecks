import { datasetSkus, datasetStories, getCollectibleRecord } from "../../../data/collectibles";

const SECTIONS = [
  {
    title: "Story Foils",
    slug: "story-foils",
    groupSuffix: "Foils",
    predicate: ({ card, finish }) => card.category === "story" && finish === "FOIL",
  },
  {
    title: "Story Dun",
    slug: "story-dun",
    groupSuffix: "Dun",
    predicate: ({ card, finish }) => card.category === "story" && finish === "DUN",
  },
  {
    title: "Heralds (Foil)",
    slug: "heralds-foil",
    groupSuffix: "Heralds",
    predicate: ({ card, finish }) => card.category === "herald" && finish === "FOIL",
  },
  {
    title: "Heralds (Dun)",
    slug: "heralds-dun",
    groupSuffix: "Heralds",
    predicate: ({ card, finish }) => card.category === "herald" && finish === "DUN",
  },
  {
    title: "Nonsense (Dun)",
    slug: "nonsense-dun",
    groupSuffix: "Nonsense",
    predicate: ({ card, finish }) => card.category === "nonsense" && finish === "DUN",
  },
  {
    title: "Nonsense (Foil)",
    slug: "nonsense-foil",
    groupSuffix: "Nonsense",
    predicate: ({ card, finish }) => card.category === "nonsense" && finish === "FOIL",
  },
  {
    title: "Chasmfriends Pins",
    slug: "pins",
    groupSuffix: "Pins",
    predicate: ({ card }) => card.collectibleType === "pin" || card.category === "pin",
  },
];

/** Section node IDs excluded from the post preview when the modal first opens. */
export const DEFAULT_EXCLUDED_SECTION_IDS = ["uft:story-dun"];

export function getDefaultExcludedIds() {
  return new Set(DEFAULT_EXCLUDED_SECTION_IDS);
}

function normalizeQuantity(entry) {
  const candidates = [entry.quantity, entry.count, entry.copies, entry.total];
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return 1;
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

function formatTradeItem(card) {
  if (!card) {
    return null;
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

function buildOwnedSkuCounts(entries) {
  const ownedSkuCounts = new Map();
  let skippedEntries = 0;

  entries.forEach((entry) => {
    const quantity = Math.max(0, normalizeQuantity(entry));
    if (!quantity) return;

    const skuId = entry.skuId ? String(entry.skuId).trim() : null;
    if (!skuId) {
      skippedEntries += 1;
      return;
    }
    ownedSkuCounts.set(skuId, (ownedSkuCounts.get(skuId) ?? 0) + quantity);
  });

  return { ownedSkuCounts, skippedEntries };
}

function buildSectionStories({ predicate, groupSuffix }, mode, ownedSkuCounts, storyRank) {
  const groups = new Map();

  datasetSkus.forEach((sku) => {
    const ownedCount = ownedSkuCounts.get(sku.skuId) ?? 0;
    if (mode === "iso" ? ownedCount > 0 : ownedCount <= 1) {
      return;
    }

    const finish = sku.finish ? sku.finish.toUpperCase() : null;
    const card = getCollectibleRecord(sku.cardId);
    if (!card || !predicate({ card, finish })) {
      return;
    }

    const item = formatTradeItem(card);
    if (!item) {
      return;
    }

    const storyTitle = card.storyTitle ?? "Other";
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

  return stories;
}

export function buildIsoUftPostTree(entries) {
  const { ownedSkuCounts, skippedEntries } = buildOwnedSkuCounts(entries);

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
      const stories = buildSectionStories(section, mode, ownedSkuCounts, storyRank);
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

export function formatIsoUftPost(tree, excludedIds = new Set()) {
  const lines = [];

  for (const modeNode of tree) {
    if (excludedIds.has(modeNode.id)) {
      continue;
    }

    const modeLines = [`${modeNode.label}:`, ""];

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
      modeLines.push(`${section.label}:`);
      for (const leaf of visibleLeaves) {
        modeLines.push(leaf.line);
      }
      modeLines.push("");
    }

    if (!hasVisibleContent) {
      modeLines.push(modeNode.id === "iso" ? "None needed yet." : "None available yet.");
      modeLines.push("");
    }

    lines.push(...modeLines);
  }

  while (lines.length > 0 && lines.at(-1) === "") {
    lines.pop();
  }

  return lines.join("\n");
}

export function buildIsoUftPost(entries, { excludedIds = new Set() } = {}) {
  const { tree, skippedEntries } = buildIsoUftPostTree(entries);
  const text = formatIsoUftPost(tree, excludedIds);
  return { text, skippedEntries };
}
