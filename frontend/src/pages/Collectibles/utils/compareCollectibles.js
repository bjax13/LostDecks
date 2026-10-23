import { categoryLabels } from "../constants";

const GROUPED_CATEGORY_ORDER = ["story", "herald", "nonsense", "pin"];

function groupedCategoryRank(category) {
  const index = GROUPED_CATEGORY_ORDER.indexOf(category);
  return index === -1 ? GROUPED_CATEGORY_ORDER.length : index;
}

function compareGrouped(a, b) {
  const rankA = groupedCategoryRank(a.category);
  const rankB = groupedCategoryRank(b.category);
  if (rankA !== rankB) return rankA - rankB;

  if (rankA === GROUPED_CATEGORY_ORDER.length) {
    const labelA = (categoryLabels[a.category] ?? a.category ?? "").toLowerCase();
    const labelB = (categoryLabels[b.category] ?? b.category ?? "").toLowerCase();
    const labelCompare = labelA.localeCompare(labelB);
    if (labelCompare !== 0) return labelCompare;
  }

  const storyA = (a.storyTitle ?? "").toLowerCase();
  const storyB = (b.storyTitle ?? "").toLowerCase();
  const storyCompare = storyA.localeCompare(storyB);
  if (storyCompare !== 0) return storyCompare;

  const numA = a.number ?? Number.MAX_SAFE_INTEGER;
  const numB = b.number ?? Number.MAX_SAFE_INTEGER;
  if (numA !== numB) return numA - numB;

  return a.id.localeCompare(b.id);
}

export function compareCollectibles(a, b, sortField, sortDirection) {
  const direction = sortDirection === "asc" ? 1 : -1;

  if (sortField === "grouped") return compareGrouped(a, b) * direction;

  if (sortField === "number") {
    const numA = a.number ?? Number.MAX_SAFE_INTEGER;
    const numB = b.number ?? Number.MAX_SAFE_INTEGER;
    if (numA === numB) return a.id.localeCompare(b.id) * direction;
    return (numA - numB) * direction;
  }
  if (sortField === "id") return a.id.localeCompare(b.id) * direction;
  if (sortField === "category") {
    const labelA = categoryLabels[a.category];
    const labelB = categoryLabels[b.category];
    const compare = labelA.localeCompare(labelB);
    return (compare === 0 ? a.id.localeCompare(b.id) : compare) * direction;
  }
  if (sortField === "story") {
    const storyA = (a.storyTitle ?? "").toLowerCase();
    const storyB = (b.storyTitle ?? "").toLowerCase();
    const compare = storyA.localeCompare(storyB);
    return (compare === 0 ? a.id.localeCompare(b.id) : compare) * direction;
  }
  if (sortField === "rarity") {
    const rarityA = (a.rarity ?? "zzz").toLowerCase();
    const rarityB = (b.rarity ?? "zzz").toLowerCase();
    const compare = rarityA.localeCompare(rarityB);
    return (compare === 0 ? a.id.localeCompare(b.id) : compare) * direction;
  }
  return a.id.localeCompare(b.id) * direction;
}
