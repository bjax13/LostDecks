import { useCallback, useMemo, useState } from "react";
import {
  collectiblesIndex,
  datasetMeta,
  datasetStories,
  pinSeriesOptions,
} from "../../../data/collectibles";
import { defaultSort } from "../constants";
import { compareCollectibles } from "../utils/compareCollectibles";

const allCollectibles = collectiblesIndex;

function pinSeriesMatches(collectible, seriesFilter) {
  const series = collectible.series ?? collectible.storyTitle;
  return series === seriesFilter;
}

export function useCollectiblesExplorer({ initialCategoryFilter = "all" } = {}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilterState] = useState(initialCategoryFilter);
  const [storyFilter, setStoryFilter] = useState("all");
  const [rarityFilter, setRarityFilter] = useState("all");
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
  /** Heralds have no subcategory; hide the control and ignore any stale filter. */
  const showSubCategory = categoryFilter !== "herald";

  const stories = useMemo(
    () => (isPinSubCategory ? pinSeriesOptions : datasetStories),
    [isPinSubCategory],
  );

  const setCategoryFilter = useCallback((nextCategory) => {
    setCategoryFilterState(nextCategory);
    // Clear stale Sub Category whenever Category changes (esp. → Heralds / Pins).
    setStoryFilter("all");
  }, []);

  const filteredCollectibles = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    let items = allCollectibles.filter((c) => {
      if (categoryFilter !== "all" && c.category !== categoryFilter) return false;
      if (showSubCategory && storyFilter !== "all") {
        if (isPinSubCategory) {
          if (!pinSeriesMatches(c, storyFilter)) return false;
        } else if (storyFilter === "heralds") {
          if (c.category !== "herald") return false;
        } else if (c.story !== storyFilter) {
          return false;
        }
      }
      if (rarityFilter !== "all") {
        if (rarityFilter === "none") {
          if (c.rarity) return false;
        } else if (!c.rarity || c.rarity !== rarityFilter) {
          return false;
        }
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
    sortField,
    sortDirection,
    isPinSubCategory,
    showSubCategory,
  ]);

  const resetFilters = useCallback(() => {
    setSearchTerm("");
    setCategoryFilterState("all");
    setStoryFilter("all");
    setRarityFilter("all");
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
    showSubCategory,
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    storyFilter,
    setStoryFilter,
    rarityFilter,
    setRarityFilter,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    resetFilters,
  };
}
