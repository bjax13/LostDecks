import { useCallback, useMemo, useState } from 'react';
import { collectiblesIndex, datasetMeta, datasetStories } from '../../../data/collectibles';
import { categoryLabels } from '../constants';

const allCollectibles = collectiblesIndex;

const defaultSortState = {
  field: 'number',
  direction: 'asc',
};

export function useCollectiblesExplorer() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [storyFilter, setStoryFilter] = useState('all');
  const [rarityFilter, setRarityFilter] = useState('all');
  const [sortField, setSortField] = useState(defaultSortState.field);
  const [sortDirection, setSortDirection] = useState(defaultSortState.direction);

  const rarityOptions = useMemo(() => {
    const rarities = new Set();
    allCollectibles.forEach((c) => {
      if (c.rarity) rarities.add(c.rarity);
    });
    return Array.from(rarities).sort();
  }, []);

  const stories = useMemo(() => datasetStories, []);

  const filteredCollectibles = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    let items = allCollectibles.filter((c) => {
      if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;
      if (storyFilter !== 'all') {
        if (storyFilter === 'heralds') {
          if (c.category !== 'herald') return false;
        } else if (c.story !== storyFilter) {
          return false;
        }
      }
      if (rarityFilter !== 'all') {
        if (rarityFilter === 'none') {
          if (c.rarity) return false;
        } else if (!c.rarity || c.rarity !== rarityFilter) {
          return false;
        }
      }
      if (!term) return true;
      return c.searchTokens.includes(term);
    });

    items = items.sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      if (sortField === 'number') {
        const numA = a.number ?? Number.MAX_SAFE_INTEGER;
        const numB = b.number ?? Number.MAX_SAFE_INTEGER;
        if (numA === numB) return a.id.localeCompare(b.id) * direction;
        return (numA - numB) * direction;
      }
      if (sortField === 'id') return a.id.localeCompare(b.id) * direction;
      if (sortField === 'category') {
        const labelA = categoryLabels[a.category];
        const labelB = categoryLabels[b.category];
        const compare = labelA.localeCompare(labelB);
        return (compare === 0 ? a.id.localeCompare(b.id) : compare) * direction;
      }
      if (sortField === 'story') {
        const storyA = (a.storyTitle ?? '').toLowerCase();
        const storyB = (b.storyTitle ?? '').toLowerCase();
        const compare = storyA.localeCompare(storyB);
        return (compare === 0 ? a.id.localeCompare(b.id) : compare) * direction;
      }
      if (sortField === 'rarity') {
        const rarityA = (a.rarity ?? 'zzz').toLowerCase();
        const rarityB = (b.rarity ?? 'zzz').toLowerCase();
        const compare = rarityA.localeCompare(rarityB);
        return (compare === 0 ? a.id.localeCompare(b.id) : compare) * direction;
      }
      return a.id.localeCompare(b.id) * direction;
    });

    return items;
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
    collectibles: filteredCollectibles,
    totalCollectibles: allCollectibles.length,
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
    resetFilters,
  };
}
