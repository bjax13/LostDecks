import { categoryLabels, sortOptions } from "../Collectibles/constants";

export { categoryLabels, sortOptions };

/** Matches-only scope: bypasses category/story/rarity filters. */
export const MATCH_SCOPE_ANY = "any";

export const DEFAULT_MATCH_PAGE_SIZE = 20;

export const matchSortOptions = [
  { value: "displayName", label: "Collector name" },
  { value: "pairCount", label: "Trade count" },
  ...sortOptions,
];
