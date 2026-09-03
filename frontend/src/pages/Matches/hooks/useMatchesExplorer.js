import { useCallback, useMemo, useState } from "react";
import { collectiblesIndex, datasetStories, getSkuRecord } from "../../../data/collectibles";
import { categoryLabels, MATCH_SCOPE_ANY } from "../constants";

const defaultSortState = {
  field: "displayName",
  direction: "asc",
};

function getCardForSku(skuId) {
  return getSkuRecord(skuId)?.card ?? null;
}

function cardMatchesCategory(card, categoryFilter) {
  if (!card) return false;
  return card.category === categoryFilter;
}

function cardMatchesStory(card, storyFilter) {
  if (!card) return false;
  if (storyFilter === "heralds") {
    return card.category === "herald";
  }
  return card.story === storyFilter;
}

function cardMatchesRarity(card, rarityFilter) {
  if (!card) return false;
  if (rarityFilter === "none") {
    return !card.rarity;
  }
  return card.rarity === rarityFilter;
}

function cardMatchesSearch(card, term, skuId) {
  if (!term) return true;
  if (typeof skuId === "string" && skuId.toLowerCase().includes(term)) {
    return true;
  }
  if (!card) return false;
  if (typeof card.searchTokens === "string" && card.searchTokens.includes(term)) {
    return true;
  }
  if (typeof card.id === "string" && card.id.toLowerCase().includes(term)) {
    return true;
  }
  if (typeof card.displayName === "string" && card.displayName.toLowerCase().includes(term)) {
    return true;
  }
  return false;
}

function pairMatchesAttributeFilters(pair, { categoryFilter, storyFilter, rarityFilter }) {
  const theirCard = getCardForSku(pair.theirSkuId);
  const yourCard = getCardForSku(pair.yourSkuId);
  const sides = [theirCard, yourCard];

  if (categoryFilter !== "all" && categoryFilter !== MATCH_SCOPE_ANY) {
    if (!sides.some((card) => cardMatchesCategory(card, categoryFilter))) {
      return false;
    }
  }

  if (storyFilter !== "all") {
    if (!sides.some((card) => cardMatchesStory(card, storyFilter))) {
      return false;
    }
  }

  if (rarityFilter !== "all") {
    if (!sides.some((card) => cardMatchesRarity(card, rarityFilter))) {
      return false;
    }
  }

  return true;
}

function pairMatchesSearch(pair, term) {
  if (!term) return true;
  const theirCard = getCardForSku(pair.theirSkuId);
  const yourCard = getCardForSku(pair.yourSkuId);
  return (
    cardMatchesSearch(theirCard, term, pair.theirSkuId) ||
    cardMatchesSearch(yourCard, term, pair.yourSkuId)
  );
}

function getSortCard(counterparty) {
  const firstPair = counterparty.pairs[0];
  if (!firstPair) return null;
  return getCardForSku(firstPair.theirSkuId) || getCardForSku(firstPair.yourSkuId);
}

function compareCounterparties(a, b, sortField, sortDirection) {
  const direction = sortDirection === "asc" ? 1 : -1;

  if (sortField === "displayName") {
    const compare = a.displayName.localeCompare(b.displayName);
    return (compare === 0 ? a.userId.localeCompare(b.userId) : compare) * direction;
  }

  if (sortField === "pairCount") {
    const compare = a.pairs.length - b.pairs.length;
    return (compare === 0 ? a.displayName.localeCompare(b.displayName) : compare) * direction;
  }

  const cardA = getSortCard(a);
  const cardB = getSortCard(b);

  if (sortField === "number") {
    const numA = cardA?.number ?? Number.MAX_SAFE_INTEGER;
    const numB = cardB?.number ?? Number.MAX_SAFE_INTEGER;
    if (numA === numB) {
      return a.displayName.localeCompare(b.displayName) * direction;
    }
    return (numA - numB) * direction;
  }

  if (sortField === "id") {
    const idA = cardA?.id ?? "";
    const idB = cardB?.id ?? "";
    const compare = idA.localeCompare(idB);
    return (compare === 0 ? a.displayName.localeCompare(b.displayName) : compare) * direction;
  }

  if (sortField === "category") {
    const labelA = categoryLabels[cardA?.category] ?? "";
    const labelB = categoryLabels[cardB?.category] ?? "";
    const compare = labelA.localeCompare(labelB);
    return (compare === 0 ? a.displayName.localeCompare(b.displayName) : compare) * direction;
  }

  if (sortField === "story") {
    const storyA = (cardA?.storyTitle ?? "").toLowerCase();
    const storyB = (cardB?.storyTitle ?? "").toLowerCase();
    const compare = storyA.localeCompare(storyB);
    return (compare === 0 ? a.displayName.localeCompare(b.displayName) : compare) * direction;
  }

  if (sortField === "rarity") {
    const rarityA = (cardA?.rarity ?? "zzz").toLowerCase();
    const rarityB = (cardB?.rarity ?? "zzz").toLowerCase();
    const compare = rarityA.localeCompare(rarityB);
    return (compare === 0 ? a.displayName.localeCompare(b.displayName) : compare) * direction;
  }

  return a.displayName.localeCompare(b.displayName) * direction;
}

/**
 * Client-side search/filter/sort over a page of trade match counterparties.
 * Attribute filters match if either side of a trade pair qualifies.
 * `categoryFilter === "any"` ("Show any valid trade") bypasses attribute filters.
 */
export function useMatchesExplorer({ matches = [] } = {}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(MATCH_SCOPE_ANY);
  const [storyFilter, setStoryFilter] = useState("all");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [sortField, setSortField] = useState(defaultSortState.field);
  const [sortDirection, setSortDirection] = useState(defaultSortState.direction);

  const rarityOptions = useMemo(() => {
    const rarities = new Set();
    collectiblesIndex.forEach((collectible) => {
      if (collectible.rarity) rarities.add(collectible.rarity);
    });
    return Array.from(rarities).sort();
  }, []);

  const stories = useMemo(() => datasetStories, []);

  const filteredMatches = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const bypassAttributeFilters = categoryFilter === MATCH_SCOPE_ANY;

    const items = matches
      .map((counterparty) => {
        const pairs = (counterparty.pairs || []).filter((pair) => {
          if (!bypassAttributeFilters) {
            if (
              !pairMatchesAttributeFilters(pair, {
                categoryFilter,
                storyFilter,
                rarityFilter,
              })
            ) {
              return false;
            }
          }
          return pairMatchesSearch(pair, term);
        });

        if (pairs.length === 0 && term) {
          // Allow searching by collector name even when pair text does not match.
          if (!counterparty.displayName?.toLowerCase().includes(term)) {
            return null;
          }
          // Keep all pairs that still pass attribute filters when name matches.
          const nameMatchPairs = (counterparty.pairs || []).filter((pair) =>
            bypassAttributeFilters
              ? true
              : pairMatchesAttributeFilters(pair, {
                  categoryFilter,
                  storyFilter,
                  rarityFilter,
                }),
          );
          if (nameMatchPairs.length === 0) {
            return null;
          }
          return { ...counterparty, pairs: nameMatchPairs };
        }

        if (pairs.length === 0) {
          return null;
        }

        return { ...counterparty, pairs };
      })
      .filter(Boolean);

    return items.sort((a, b) => compareCounterparties(a, b, sortField, sortDirection));
  }, [matches, searchTerm, categoryFilter, storyFilter, rarityFilter, sortField, sortDirection]);

  const resetFilters = useCallback(() => {
    setSearchTerm("");
    setCategoryFilter(MATCH_SCOPE_ANY);
    setStoryFilter("all");
    setRarityFilter("all");
    setSortField(defaultSortState.field);
    setSortDirection(defaultSortState.direction);
  }, []);

  return {
    matches: filteredMatches,
    totalMatches: matches.length,
    rarityOptions,
    stories,
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
