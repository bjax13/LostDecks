import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collectiblesIndex,
  datasetMeta,
  datasetStories,
  pinSeriesOptions,
  resolveSkuId,
} from "../../../data/collectibles";
import { entryMatchesTradeStatus, normalizeTradeFlag } from "../../../lib/tradeFlag.js";
import { defaultSort } from "../constants";
import { compareCollectibles } from "../utils/compareCollectibles";

const allCollectibles = collectiblesIndex;

function pinSeriesMatches(collectible, seriesFilter) {
  const series = collectible.series ?? collectible.storyTitle;
  return series === seriesFilter;
}

function collectibleTradeFlags(collectible, tradeFlagBySkuId) {
  const finishes = collectible?.finishes ?? [];
  const skuIds = finishes.length
    ? finishes.map((finish) => resolveSkuId(collectible, finish))
    : [resolveSkuId(collectible, null)];
  return skuIds.map((skuId) => normalizeTradeFlag(tradeFlagBySkuId?.[skuId])).filter(Boolean);
}

export function useCollectiblesExplorer({
  initialCategoryFilter = "all",
  tradeFlagBySkuId = {},
} = {}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilterState] = useState(initialCategoryFilter);
  const [storyFilter, setStoryFilter] = useState("all");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [tradeStatusFilter, setTradeStatusFilter] = useState("all");
  const [sortField, setSortField] = useState(defaultSort.field);
  const [sortDirection, setSortDirection] = useState(defaultSort.direction);

  const rarityOptions = useMemo(() => {
    const rarities = new Set();
    allCollectibles.forEach((c) => {
      if (c.rarity) rarities.add(c.rarity);
    });
    return Array.from(rarities).sort();
  }, []);

  const isPinSubCategory = categoryFilter === "pin";
  /** Heralds: Sub Category stays visible but disabled (NA); ignore any stale filter. */
  const subCategoryDisabled = categoryFilter === "herald";

  /** Sub Category options for the active Category (all subcategories when Category is All). */
  const stories = useMemo(() => {
    if (categoryFilter === "pin") return pinSeriesOptions;
    if (categoryFilter === "herald") return [];
    if (categoryFilter === "all") {
      const seen = new Set();
      const combined = [];
      for (const story of datasetStories) {
        seen.add(story.code);
        combined.push(story);
      }
      for (const series of pinSeriesOptions) {
        if (seen.has(series.code)) continue;
        seen.add(series.code);
        combined.push(series);
      }
      return combined;
    }
    // Story cards / Nonsense variants: story titles only.
    return datasetStories;
  }, [categoryFilter]);

  const setCategoryFilter = useCallback((nextCategory) => {
    setCategoryFilterState((prev) => {
      if (prev === nextCategory) return prev;
      return nextCategory;
    });
  }, []);

  // Cascade Sub Category / rarity / sort cleanup only when Category actually changes.
  // Kept out of setCategoryFilter so URL re-sync with the same value is a no-op (no flicker).
  const previousCategoryRef = useRef(categoryFilter);
  useEffect(() => {
    if (previousCategoryRef.current === categoryFilter) return;
    previousCategoryRef.current = categoryFilter;
    setStoryFilter("all");
    if (categoryFilter === "pin") {
      setRarityFilter("all");
      setSortField((current) => (current === "rarity" ? defaultSort.field : current));
    }
  }, [categoryFilter]);

  const filteredCollectibles = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    let items = allCollectibles.filter((c) => {
      if (categoryFilter !== "all" && c.category !== categoryFilter) return false;
      if (!subCategoryDisabled && storyFilter !== "all") {
        if (storyFilter === "heralds") {
          if (c.category !== "herald") return false;
        } else if (c.category === "pin") {
          if (!pinSeriesMatches(c, storyFilter)) return false;
        } else if (c.story !== storyFilter) {
          return false;
        }
      }
      if (!isPinSubCategory && rarityFilter !== "all") {
        if (rarityFilter === "none") {
          if (c.rarity) return false;
        } else if (!c.rarity || c.rarity !== rarityFilter) {
          return false;
        }
      }
      if (
        !collectibleTradeFlags(c, tradeFlagBySkuId).some((flag) =>
          entryMatchesTradeStatus(flag, tradeStatusFilter),
        ) &&
        tradeStatusFilter !== "all"
      ) {
        return false;
      }
      if (!term) return true;
      return c.searchTokens.includes(term);
    });

    items = items.sort((a, b) => compareCollectibles(a, b, sortField, sortDirection));

    return items;
  }, [
    searchTerm,
    categoryFilter,
    storyFilter,
    rarityFilter,
    tradeStatusFilter,
    tradeFlagBySkuId,
    sortField,
    sortDirection,
    isPinSubCategory,
    subCategoryDisabled,
  ]);

  const resetFilters = useCallback(() => {
    setSearchTerm("");
    setCategoryFilterState("all");
    setStoryFilter("all");
    setRarityFilter("all");
    setTradeStatusFilter("all");
    setSortField(defaultSort.field);
    setSortDirection(defaultSort.direction);
  }, []);

  return {
    collectibles: filteredCollectibles,
    totalCollectibles: allCollectibles.length,
    datasetMeta,
    rarityOptions,
    stories,
    isPinSubCategory,
    subCategoryDisabled,
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    storyFilter,
    setStoryFilter,
    rarityFilter,
    setRarityFilter,
    tradeStatusFilter,
    setTradeStatusFilter,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    resetFilters,
  };
}
