import dataset from '../storyData/storydeck-lt24-with-skus.json';

const storyTitleByCode = dataset.stories.reduce((acc, story) => {
  acc[story.code] = story.title;
  return acc;
}, {});

const finishesByCardId = dataset.skus.reduce((acc, sku) => {
  const normalizedFinish = sku.finish.toUpperCase();
  if (!acc[sku.cardId]) {
    acc[sku.cardId] = new Set();
  }
  acc[sku.cardId].add(normalizedFinish);
  return acc;
}, {});

function toFinishList(cardId) {
  const finishSet = finishesByCardId[cardId];
  if (!finishSet) {
    return [];
  }
  return Array.from(finishSet).sort();
}

/**
 * Build hyphen-only SKU from cardId and finish.
 * Story/Herald: LT24-ELS-01 + DUN -> LT24-ELS-01-DUN
 * Nonsense with variant: LT24-NS-ELS-24-DANCE + DUN -> LT24-NS-ELS-24-DUN-DANCE
 */
export function toSkuId(cardId, finish) {
  if (!cardId || !finish) return null;
  const finishUpper = String(finish).toUpperCase();
  const parts = String(cardId).split('-');
  if (parts[1] === 'NS' && parts.length >= 5) {
    const lastPart = parts[parts.length - 1];
    if (/^[A-Z]+$/i.test(lastPart)) {
      const base = parts.slice(0, -1).join('-');
      return `${base}-${finishUpper}-${lastPart}`;
    }
  }
  return `${cardId}-${finishUpper}`;
}

function formatStoryCard(card) {
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
    searchTokens: [card.id, card.story, storyTitle, displayName].join(' ').toLowerCase(),
  };
}

function formatHeraldCard(card) {
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
    searchTokens: [card.id, displayName, 'Herald', card.rarityTier ?? ''].join(' ').toLowerCase(),
  };
}

function formatNonsenseCard(card) {
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
      .toLowerCase(),
  };
}

const collectibleRecords = [
  ...dataset.storyCards.map(formatStoryCard),
  ...dataset.heralds.map(formatHeraldCard),
  ...dataset.nonsense.knownCards.map(formatNonsenseCard),
];

const collectiblesById = collectibleRecords.reduce((acc, rec) => {
  acc[rec.id] = rec;
  return acc;
}, {});

const storyProgressSets = dataset.stories.reduce((acc, story) => {
  acc[story.code] = {
    title: story.title,
    storyCards: new Set(),
    storyDunSkus: new Set(),
    storyFoilSkus: new Set(),
    nonsenseDunSkus: new Set(),
    nonsenseFoilSkus: new Set(),
  };
  return acc;
}, {});

const heraldProgressSets = {
  title: 'Heralds',
  dunSkus: new Set(),
  foilSkus: new Set(),
};

collectibleRecords.forEach((rec) => {
  if (!rec.story || !storyProgressSets[rec.story]) return;
  if (rec.category === 'story') {
    storyProgressSets[rec.story].storyCards.add(rec.id);
  }
});

dataset.skus.forEach((sku) => {
  const normalizedFinish = sku.finish.toUpperCase();
  const rec = collectiblesById[sku.cardId];
  if (!rec) return;

  if (rec.category === 'story' && rec.story && storyProgressSets[rec.story]) {
    if (normalizedFinish === 'DUN') storyProgressSets[rec.story].storyDunSkus.add(sku.skuId);
    else if (normalizedFinish === 'FOIL') storyProgressSets[rec.story].storyFoilSkus.add(sku.skuId);
    return;
  }
  if (rec.category === 'nonsense' && rec.story && storyProgressSets[rec.story]) {
    if (normalizedFinish === 'DUN') storyProgressSets[rec.story].nonsenseDunSkus.add(sku.skuId);
    else if (normalizedFinish === 'FOIL')
      storyProgressSets[rec.story].nonsenseFoilSkus.add(sku.skuId);
    return;
  }
  if (rec.category === 'herald') {
    if (normalizedFinish === 'DUN') heraldProgressSets.dunSkus.add(sku.skuId);
    else if (normalizedFinish === 'FOIL') heraldProgressSets.foilSkus.add(sku.skuId);
  }
});

const storyProgressTargets = Object.entries(storyProgressSets).map(([code, sets]) => ({
  code,
  title: sets.title,
  totals: {
    storyCards: sets.storyCards.size,
    storyDunSkus: sets.storyDunSkus.size,
    storyFoilSkus: sets.storyFoilSkus.size,
    nonsenseDunSkus: sets.nonsenseDunSkus.size,
    nonsenseFoilSkus: sets.nonsenseFoilSkus.size,
  },
}));

const storyProgressByCode = storyProgressTargets.reduce((acc, entry) => {
  acc[entry.code] = entry;
  return acc;
}, {});

const skusById = dataset.skus.reduce((acc, sku) => {
  acc[sku.skuId] = {
    skuId: sku.skuId,
    cardId: sku.cardId,
    finish: sku.finish.toUpperCase(),
  };
  return acc;
}, {});

const storiesByCode = { ...storyTitleByCode };

export const datasetMeta = dataset.meta;
export const datasetStories = dataset.stories;
export const datasetSkus = dataset.skus;
export const collectiblesIndex = collectibleRecords;
export const collectionProgressTargets = {
  stories: storyProgressTargets,
  storiesByCode: storyProgressByCode,
  heralds: {
    totals: {
      dunSkus: heraldProgressSets.dunSkus.size,
      foilSkus: heraldProgressSets.foilSkus.size,
    },
  },
};

export function getCollectibleRecord(cardId) {
  return collectiblesById[cardId] ?? null;
}

export function getSkuRecord(skuId) {
  const sku = skusById[skuId];
  if (!sku) return null;
  return {
    ...sku,
    card: getCollectibleRecord(sku.cardId) ?? null,
  };
}

export function getStoryTitle(storyCode) {
  return storiesByCode[storyCode] ?? storyCode ?? null;
}

export function getFinishesForCard(cardId) {
  return toFinishList(cardId);
}

/** @deprecated Use getCollectibleRecord */
export const getCardRecord = getCollectibleRecord;

/** @deprecated Use collectiblesIndex */
export const cardsIndex = collectibleRecords;

export default dataset;
