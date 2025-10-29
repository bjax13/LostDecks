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
    searchTokens: [card.id, card.story, storyTitle, displayName].join(' ').toLowerCase()
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
    searchTokens: [card.id, displayName, 'Herald', card.rarityTier ?? ''].join(' ').toLowerCase()
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
      .toLowerCase()
  };
}

const cardRecords = [
  ...dataset.storyCards.map(formatStoryCard),
  ...dataset.heralds.map(formatHeraldCard),
  ...dataset.nonsense.knownCards.map(formatNonsenseCard)
];

const cardsById = cardRecords.reduce((acc, card) => {
  acc[card.id] = card;
  return acc;
}, {});

const storyProgressSets = dataset.stories.reduce((acc, story) => {
  acc[story.code] = {
    title: story.title,
    storyCards: new Set(),
    storyDunSkus: new Set(),
    storyFoilSkus: new Set(),
    nonsenseDunSkus: new Set(),
    nonsenseFoilSkus: new Set()
  };
  return acc;
}, {});

const heraldProgressSets = {
  title: 'Heralds',
  dunSkus: new Set(),
  foilSkus: new Set()
};

cardRecords.forEach((card) => {
  if (!card.story || !storyProgressSets[card.story]) {
    return;
  }

  if (card.category === 'story') {
    storyProgressSets[card.story].storyCards.add(card.id);
  }
});

dataset.skus.forEach((sku) => {
  const normalizedFinish = sku.finish.toUpperCase();
  const card = cardsById[sku.cardId];
  if (!card) {
    return;
  }

  if (card.category === 'story' && card.story && storyProgressSets[card.story]) {
    if (normalizedFinish === 'DUN') {
      storyProgressSets[card.story].storyDunSkus.add(sku.skuId);
    } else if (normalizedFinish === 'FOIL') {
      storyProgressSets[card.story].storyFoilSkus.add(sku.skuId);
    }
    return;
  }

  if (card.category === 'nonsense' && card.story && storyProgressSets[card.story]) {
    if (normalizedFinish === 'DUN') {
      storyProgressSets[card.story].nonsenseDunSkus.add(sku.skuId);
    } else if (normalizedFinish === 'FOIL') {
      storyProgressSets[card.story].nonsenseFoilSkus.add(sku.skuId);
    }
    return;
  }

  if (card.category === 'herald') {
    if (normalizedFinish === 'DUN') {
      heraldProgressSets.dunSkus.add(sku.skuId);
    } else if (normalizedFinish === 'FOIL') {
      heraldProgressSets.foilSkus.add(sku.skuId);
    }
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
    nonsenseFoilSkus: sets.nonsenseFoilSkus.size
  }
}));

const storyProgressByCode = storyProgressTargets.reduce((acc, entry) => {
  acc[entry.code] = entry;
  return acc;
}, {});

const skusById = dataset.skus.reduce((acc, sku) => {
  const normalizedFinish = sku.finish.toUpperCase();
  acc[sku.skuId] = {
    skuId: sku.skuId,
    cardId: sku.cardId,
    finish: normalizedFinish
  };
  return acc;
}, {});

const storiesByCode = { ...storyTitleByCode };

export const datasetMeta = dataset.meta;
export const datasetStories = dataset.stories;
export const datasetSkus = dataset.skus;
export const cardsIndex = cardRecords;
export const collectionProgressTargets = {
  stories: storyProgressTargets,
  storiesByCode: storyProgressByCode,
  heralds: {
    totals: {
      dunSkus: heraldProgressSets.dunSkus.size,
      foilSkus: heraldProgressSets.foilSkus.size
    }
  }
};

export function getCardRecord(cardId) {
  return cardsById[cardId] ?? null;
}

export function getSkuRecord(skuId) {
  const sku = skusById[skuId];
  if (!sku) {
    return null;
  }
  return {
    ...sku,
    card: getCardRecord(sku.cardId) ?? null
  };
}

export function getStoryTitle(storyCode) {
  return storiesByCode[storyCode] ?? storyCode ?? null;
}

export function getFinishesForCard(cardId) {
  return toFinishList(cardId);
}

export default dataset;
