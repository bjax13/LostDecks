import { useCallback, useMemo, useState } from 'react';
import dataset from '../../../storyData/storydeck-lt24-with-skus.json';
import { categoryLabels } from '../constants';

function buildCardRecords() {
  const storyTitleByCode = dataset.stories.reduce((acc, story) => {
    acc[story.code] = story.title;
    return acc;
  }, {});

  const finishesByCardId = dataset.skus.reduce((acc, sku) => {
    const finish = sku.finish.toUpperCase();
    if (!acc[sku.cardId]) {
      acc[sku.cardId] = new Set();
    }
    acc[sku.cardId].add(finish);
    return acc;
  }, {});

  const toFinishList = (cardId) => {
    const finishSet = finishesByCardId[cardId];
    if (!finishSet) {
      return [];
    }
    return Array.from(finishSet).sort();
  };

  const storyCards = dataset.storyCards.map((card) => {
    const storyTitle = storyTitleByCode[card.story] ?? card.story;
    const displayName = `${storyTitle} #${card.number.toString().padStart(2, '0')}`;
    return {
      id: card.id,
      category: card.category,
      story: card.story,
      storyTitle,
      number: card.number,
      rarity: card.rarityTier,
      binder: card.mosaic,
      displayName,
      detail: 'Story card',
      finishes: toFinishList(card.id),
      searchTokens: [card.id, card.story, storyTitle, displayName].join(' ').toLowerCase()
    };
  });

  const heraldCards = dataset.heralds.map((card) => {
    const displayName = card.heraldName;
    const storyTitle = 'Heraldic Order';
    return {
      id: card.id,
      category: card.category,
      story: null,
      storyTitle,
      number: card.number,
      rarity: card.rarityTier,
      binder: null,
      displayName,
      detail: 'Herald of the Almighty',
      finishes: toFinishList(card.id),
      searchTokens: [card.id, displayName, 'Herald', card.rarityTier ?? ''].join(' ').toLowerCase()
    };
  });

  const nonsenseCards = dataset.nonsense.knownCards.map((card) => {
    const storyTitle = storyTitleByCode[card.story] ?? card.story;
    const variantLabel = card.variantName ? `Variant: ${card.variantName}` : 'Standard Variant';
    const displayName = `${storyTitle} Nonsense #${card.baseNumber.toString().padStart(2, '0')}`;
    return {
      id: card.id,
      category: card.category,
      story: card.story,
      storyTitle,
      number: card.baseNumber,
      rarity: null,
      binder: null,
      displayName,
      detail: variantLabel,
      finishes: toFinishList(card.id),
      searchTokens: [card.id, card.story, storyTitle, variantLabel, displayName]
        .join(' ')
        .toLowerCase()
    };
  });

  return [...storyCards, ...heraldCards, ...nonsenseCards];
}

const allCards = buildCardRecords();

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

  const stories = useMemo(() => dataset.stories, []);

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
    datasetMeta: dataset.meta,
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
