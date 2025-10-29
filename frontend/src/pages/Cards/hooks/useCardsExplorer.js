import { useCallback, useMemo, useState } from 'react';
import { cardsIndex, datasetMeta, datasetStories } from '../../../data/cards';
import { categoryLabels } from '../constants';
const allCards = cardsIndex;

const defaultSortState = {
  field: 'number',
  direction: 'asc'
};

export function useCardsExplorer() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [storyFilter, setStoryFilter] = useState('all');
  const [rarityFilter, setRarityFilter] = useState('all');
  const [sortField, setSortField] = useState(defaultSortState.field);
  const [sortDirection, setSortDirection] = useState(defaultSortState.direction);

  const rarityOptions = useMemo(() => {
    const rarities = new Set();
    allCards.forEach((card) => {
      if (card.rarity) {
        rarities.add(card.rarity);
      }
    });
    return Array.from(rarities).sort();
  }, []);

  const stories = useMemo(() => datasetStories, []);

  const filteredCards = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    let cards = allCards.filter((card) => {
      if (categoryFilter !== 'all' && card.category !== categoryFilter) {
        return false;
      }

      if (storyFilter !== 'all') {
        if (storyFilter === 'heralds') {
          if (card.category !== 'herald') {
            return false;
          }
        } else if (card.story !== storyFilter) {
          return false;
        }
      }

      if (rarityFilter !== 'all') {
        if (rarityFilter === 'none') {
          if (card.rarity) {
            return false;
          }
        } else if (!card.rarity || card.rarity !== rarityFilter) {
          return false;
        }
      }

      if (!term) {
        return true;
      }

      return card.searchTokens.includes(term);
    });

    cards = cards.sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;

      if (sortField === 'number') {
        const numA = a.number ?? Number.MAX_SAFE_INTEGER;
        const numB = b.number ?? Number.MAX_SAFE_INTEGER;
        if (numA === numB) {
          return a.id.localeCompare(b.id) * direction;
        }
        return (numA - numB) * direction;
      }

      if (sortField === 'id') {
        return a.id.localeCompare(b.id) * direction;
      }

      if (sortField === 'category') {
        const labelA = categoryLabels[a.category];
        const labelB = categoryLabels[b.category];
        const compare = labelA.localeCompare(labelB);
        if (compare === 0) {
          return a.id.localeCompare(b.id) * direction;
        }
        return compare * direction;
      }

      if (sortField === 'story') {
        const storyA = (a.storyTitle ?? '').toLowerCase();
        const storyB = (b.storyTitle ?? '').toLowerCase();
        const compare = storyA.localeCompare(storyB);
        if (compare === 0) {
          return a.id.localeCompare(b.id) * direction;
        }
        return compare * direction;
      }

      if (sortField === 'rarity') {
        const rarityA = (a.rarity ?? 'zzz').toLowerCase();
        const rarityB = (b.rarity ?? 'zzz').toLowerCase();
        const compare = rarityA.localeCompare(rarityB);
        if (compare === 0) {
          return a.id.localeCompare(b.id) * direction;
        }
        return compare * direction;
      }

      return a.id.localeCompare(b.id) * direction;
    });

    return cards;
  }, [searchTerm, categoryFilter, storyFilter, rarityFilter, sortField, sortDirection]);

  const resetFilters = useCallback(() => {
    setSearchTerm('');
    setCategoryFilter('all');
    setStoryFilter('all');
    setRarityFilter('all');
    setSortField(defaultSortState.field);
    setSortDirection(defaultSortState.direction);
  }, []);

  return {
    cards: filteredCards,
    totalCards: allCards.length,
    datasetMeta,
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
    resetFilters
  };
}
