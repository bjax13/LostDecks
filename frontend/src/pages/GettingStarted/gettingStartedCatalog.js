import { datasetSkus, datasetStories, getCollectibleRecord } from "../../data/collectibles";

export const DEFAULT_MANUAL_QUANTITY = 0;

const SECTION_DEFINITIONS = [
  {
    id: "story-foils",
    label: "Story Foils",
    includes: (card, finish) => card.category === "story" && finish === "FOIL",
  },
  {
    id: "story-dun",
    label: "Story Dun",
    includes: (card, finish) => card.category === "story" && finish === "DUN",
  },
  {
    id: "heralds-foil",
    label: "Heralds (Foil)",
    includes: (card, finish) => card.category === "herald" && finish === "FOIL",
  },
  {
    id: "heralds-dun",
    label: "Heralds (Dun)",
    includes: (card, finish) => card.category === "herald" && finish === "DUN",
  },
  {
    id: "nonsense-dun",
    label: "Nonsense (Dun)",
    includes: (card, finish) => card.category === "nonsense" && finish === "DUN",
  },
  {
    id: "nonsense-foil",
    label: "Nonsense (Foil)",
    includes: (card, finish) => card.category === "nonsense" && finish === "FOIL",
  },
];

const storyOrder = new Map(datasetStories.map((story, index) => [story.title, index]));

function compareCards(a, b) {
  if (a.card.number !== b.card.number) {
    return (a.card.number ?? Number.MAX_SAFE_INTEGER) - (b.card.number ?? Number.MAX_SAFE_INTEGER);
  }
  return a.card.displayName.localeCompare(b.card.displayName);
}

function compareGroups(a, b) {
  const rankA = storyOrder.get(a.label) ?? Number.MAX_SAFE_INTEGER;
  const rankB = storyOrder.get(b.label) ?? Number.MAX_SAFE_INTEGER;
  if (rankA !== rankB) return rankA - rankB;
  return a.label.localeCompare(b.label);
}

function buildGettingStartedTree() {
  return SECTION_DEFINITIONS.map((section) => {
    const groups = new Map();

    for (const sku of datasetSkus) {
      const card = getCollectibleRecord(sku.cardId);
      const finish = sku.finish?.toUpperCase() ?? null;
      if (!card || card.collectibleType === "pin" || !section.includes(card, finish)) {
        continue;
      }

      const groupLabel = card.category === "herald" ? "Heraldic Order" : card.storyTitle;
      if (!groups.has(groupLabel)) groups.set(groupLabel, []);
      groups.get(groupLabel).push({
        skuId: sku.skuId,
        cardId: card.id,
        label: card.displayName,
        finish,
        card,
      });
    }

    const children = Array.from(groups.entries())
      .map(([label, skus]) => ({
        id: `${section.id}:${label}`,
        label,
        skus: skus.sort(compareCards),
      }))
      .sort(compareGroups);

    return { id: section.id, label: section.label, children };
  });
}

export const gettingStartedTree = buildGettingStartedTree();

export function createCoverageState(defaultStatus) {
  return Object.fromEntries(
    gettingStartedTree.flatMap((section) =>
      section.children.map((group) => [group.id, defaultStatus]),
    ),
  );
}

function needsNonsenseDisambiguation(sku, groupSkus) {
  const number = sku.card?.number;
  if (number == null || !groupSkus || sku.card?.category !== "nonsense") {
    return false;
  }
  return groupSkus.filter((entry) => entry.card?.number === number).length > 1;
}

export function formatSkuNumberLabel(sku) {
  const number = sku.card?.number;
  if (number == null) {
    return sku.label;
  }
  return `#${number}`;
}

export function getSkuVariantLabel(sku, groupSkus = null) {
  if (!needsNonsenseDisambiguation(sku, groupSkus)) {
    return null;
  }
  const variantName = sku.card?.variantName;
  return variantName ? variantName.toLowerCase() : null;
}

/** Target column counts for the condensed SKU grid (wide / narrow viewports). */
export const CONDENSED_SKU_COLUMNS = 5;
export const CONDENSED_SKU_COLUMNS_NARROW = 2;

/**
 * Row/column CSS variables for a column-major condensed SKU grid.
 * Items fill down each column before starting the next.
 */
export function getCondensedSkuListStyle(
  itemCount,
  columnCount = CONDENSED_SKU_COLUMNS,
  narrowColumnCount = CONDENSED_SKU_COLUMNS_NARROW,
) {
  const gridVars = (count, maxColumns) => {
    const safeCount = Math.max(0, count);
    if (safeCount === 0) {
      return { rows: 1, cols: 1 };
    }
    const rows = Math.ceil(safeCount / maxColumns);
    const cols = Math.ceil(safeCount / rows);
    return { rows, cols };
  };

  const wide = gridVars(itemCount, columnCount);
  const narrow = gridVars(itemCount, narrowColumnCount);

  return {
    "--sku-rows": String(wide.rows),
    "--sku-cols": String(wide.cols),
    "--sku-rows-narrow": String(narrow.rows),
    "--sku-cols-narrow": String(narrow.cols),
  };
}

export function formatSkuQuantityAriaLabel({
  groupTitle,
  finishLabel = null,
  numberLabel,
  variantLabel = null,
}) {
  const variantPart = variantLabel
    ? ` ${variantLabel.charAt(0).toUpperCase()}${variantLabel.slice(1)}`
    : "";
  const finishPart = finishLabel ? ` ${finishLabel}` : "";
  return `${groupTitle}${finishPart}${variantPart} ${numberLabel} quantity`;
}

export function getSkuFinishLabel(sku) {
  const finish = String(sku.finish ?? "").toUpperCase();
  if (finish === "FOIL") return "Foil";
  if (finish === "DUN") return "Dun";
  return finish || "Finish";
}

export function formatReviewGroupLabel(group, section) {
  return `${group.label} ${section.label}`;
}

export function getDefaultExpandedReviewIds(coverage) {
  const expanded = new Set(gettingStartedTree.map((section) => section.id));
  for (const section of gettingStartedTree) {
    for (const group of section.children) {
      if (coverage[group.id] === "some") {
        expanded.add(group.id);
      }
    }
  }
  return expanded;
}

function getGroupCoverageDefault(groupCoverage, defaultQuantity) {
  if (groupCoverage === "all") return 1;
  if (groupCoverage === "none") return 0;
  return defaultQuantity;
}

function parseSkuQuantity(raw, fallback) {
  const parsed = Number(raw);
  if (raw === "" || raw == null || !Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

/**
 * Resolve a SKU quantity from an explicit map entry, else coverage defaults.
 * Map entry present → parse (invalid → coverage fallback); else all→1, none→0, some→defaultQuantity.
 */
export function resolveSkuQuantity(
  skuId,
  groupCoverage,
  quantities,
  defaultQuantity = DEFAULT_MANUAL_QUANTITY,
) {
  const fallback = getGroupCoverageDefault(groupCoverage, defaultQuantity);
  return Object.hasOwn(quantities, skuId)
    ? parseSkuQuantity(quantities[skuId], fallback)
    : fallback;
}

export function getGroupQuantityStats(
  group,
  coverage,
  quantities,
  defaultQuantity = DEFAULT_MANUAL_QUANTITY,
) {
  const groupCoverage = coverage[group.id];

  const stats = group.skus.reduce(
    (stats, sku) => {
      const quantity = resolveSkuQuantity(sku.skuId, groupCoverage, quantities, defaultQuantity);
      return {
        total: stats.total + quantity,
        unique: stats.unique + (quantity > 0 ? 1 : 0),
      };
    },
    { total: 0, unique: 0 },
  );
  return { ...stats, possible: group.skus.length };
}

export function getSectionQuantityStats(
  section,
  coverage,
  quantities,
  defaultQuantity = DEFAULT_MANUAL_QUANTITY,
) {
  return section.children.reduce(
    (stats, group) => {
      const groupStats = getGroupQuantityStats(group, coverage, quantities, defaultQuantity);
      return {
        total: stats.total + groupStats.total,
        unique: stats.unique + groupStats.unique,
        possible: stats.possible + groupStats.possible,
      };
    },
    { total: 0, unique: 0, possible: 0 },
  );
}

export function formatQuantitySummary({ total, unique, possible }) {
  return `${total} total ${unique}/${possible} unique`;
}

export function formatGroupQuantitySummary(
  group,
  coverage,
  quantities,
  defaultQuantity = DEFAULT_MANUAL_QUANTITY,
) {
  return formatQuantitySummary(getGroupQuantityStats(group, coverage, quantities, defaultQuantity));
}

export function getCollectionQuantityStats(
  tree,
  coverage,
  quantities,
  defaultQuantity = DEFAULT_MANUAL_QUANTITY,
) {
  return tree.reduce(
    (stats, section) => {
      const sectionStats = getSectionQuantityStats(section, coverage, quantities, defaultQuantity);
      return {
        total: stats.total + sectionStats.total,
        unique: stats.unique + sectionStats.unique,
        possible: stats.possible + sectionStats.possible,
      };
    },
    { total: 0, unique: 0, possible: 0 },
  );
}

export function formatCollectionQuantitySummary(
  tree,
  coverage,
  quantities,
  defaultQuantity = DEFAULT_MANUAL_QUANTITY,
) {
  return `${formatQuantitySummary(
    getCollectionQuantityStats(tree, coverage, quantities, defaultQuantity),
  )} cards`;
}

export function buildCollectionRows(
  coverage,
  quantities,
  defaultQuantity = DEFAULT_MANUAL_QUANTITY,
) {
  return gettingStartedTree.flatMap((section) =>
    section.children.flatMap((group) => {
      const status = coverage[group.id];
      return group.skus.map((sku, index) => ({
        skuId: sku.skuId,
        quantity: String(resolveSkuQuantity(sku.skuId, status, quantities, defaultQuantity)),
        __lineNumber: index + 2,
      }));
    }),
  );
}
