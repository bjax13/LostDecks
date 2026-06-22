import { collectionProgressTargets, datasetMeta, getSkuRecord } from "../../data/collectibles";
import { categoryLabels } from "../Collectibles/constants";
import { formatDate, normalizeQuantity, resolveTimestamp } from "./collectionPresentation.jsx";

export function decorateCollectionEntries(entries, dateFormatter) {
  const formatted = entries
    .filter((entry) => entry.skuId)
    .map((entry) => {
      const skuInfo = getSkuRecord(entry.skuId);
      const cardInfo = skuInfo?.card ?? null;
      const quantity = Math.max(0, normalizeQuantity(entry));
      const timestamp = resolveTimestamp(entry);
      const updatedAtLabel = formatDate(timestamp, dateFormatter);
      const notes =
        typeof entry.notes === "string" && entry.notes.trim().length > 0
          ? entry.notes.trim()
          : null;
      const binderLabel = cardInfo?.binder
        ? `Binder · Page ${cardInfo.binder.page}, Slot ${cardInfo.binder.position}`
        : null;

      return {
        ...entry,
        quantity,
        finish: skuInfo?.finish ?? null,
        skuId: entry.skuId,
        cardId: cardInfo?.id ?? skuInfo?.cardId ?? null,
        displayName: cardInfo?.displayName ?? entry.skuId ?? "Uncatalogued",
        detail: cardInfo?.detail ?? null,
        category: cardInfo?.category ?? null,
        categoryLabel: cardInfo?.category
          ? (categoryLabels[cardInfo.category] ?? cardInfo.category)
          : "—",
        storyTitle: cardInfo?.storyTitle ?? null,
        storyCode: cardInfo?.story ?? null,
        binderLabel,
        updatedAtLabel,
        notes,
      };
    });

  return formatted.sort((a, b) => {
    const nameCompare = a.displayName.localeCompare(b.displayName);
    if (nameCompare !== 0) return nameCompare;
    return (a.skuId ?? "").localeCompare(b.skuId ?? "");
  });
}

export function buildCollectionSummary(decoratedEntries) {
  const uniqueCardIds = new Set();
  const uniqueSkuIds = new Set();
  const finishCounts = {};
  const categoryCounts = {};
  let totalQuantity = 0;

  const storyProgress = collectionProgressTargets.stories.reduce((acc, story) => {
    acc[story.code] = {
      storyCards: new Set(),
      storyDunSkus: new Set(),
      storyFoilSkus: new Set(),
      nonsenseDunSkus: new Set(),
      nonsenseFoilSkus: new Set(),
    };
    return acc;
  }, {});

  const heraldProgress = {
    dunSkus: new Set(),
    foilSkus: new Set(),
  };

  decoratedEntries.forEach((entry) => {
    if (entry.quantity <= 0) {
      return;
    }

    totalQuantity += entry.quantity;

    if (entry.cardId) {
      uniqueCardIds.add(entry.cardId);
    }
    if (entry.skuId) {
      uniqueSkuIds.add(entry.skuId);
    }
    if (entry.finish) {
      finishCounts[entry.finish] = (finishCounts[entry.finish] ?? 0) + entry.quantity;
    }
    if (entry.category) {
      categoryCounts[entry.category] = (categoryCounts[entry.category] ?? 0) + entry.quantity;
    }

    const normalizedFinish = entry.finish ? entry.finish.toUpperCase() : null;
    const storySet = entry.storyCode ? storyProgress[entry.storyCode] : null;
    const finishIdentifier = entry.skuId ?? null;

    if (entry.category === "story" && storySet) {
      if (entry.cardId) {
        storySet.storyCards.add(entry.cardId);
      }
      if (normalizedFinish === "DUN" && finishIdentifier) {
        storySet.storyDunSkus.add(finishIdentifier);
      } else if (normalizedFinish === "FOIL" && finishIdentifier) {
        storySet.storyFoilSkus.add(finishIdentifier);
      }
    } else if (entry.category === "nonsense" && storySet) {
      if (normalizedFinish === "DUN" && finishIdentifier) {
        storySet.nonsenseDunSkus.add(finishIdentifier);
      } else if (normalizedFinish === "FOIL" && finishIdentifier) {
        storySet.nonsenseFoilSkus.add(finishIdentifier);
      }
    } else if (entry.category === "herald" && normalizedFinish && finishIdentifier) {
      if (normalizedFinish === "DUN") {
        heraldProgress.dunSkus.add(finishIdentifier);
      } else if (normalizedFinish === "FOIL") {
        heraldProgress.foilSkus.add(finishIdentifier);
      }
    }
  });

  const completionRate = datasetMeta?.totalUniqueCards
    ? Math.min(1, uniqueCardIds.size / datasetMeta.totalUniqueCards)
    : 0;

  const storyBreakdowns = collectionProgressTargets.stories.map((story) => {
    const owned = storyProgress[story.code] ?? {
      storyCards: new Set(),
      storyDunSkus: new Set(),
      storyFoilSkus: new Set(),
      nonsenseDunSkus: new Set(),
      nonsenseFoilSkus: new Set(),
    };
    const totals = story.totals;
    const items = [
      {
        key: "storyCards",
        label: "Story cards",
        owned: owned.storyCards.size,
        total: totals.storyCards,
      },
      {
        key: "storyDunSkus",
        label: "Dun finish",
        owned: owned.storyDunSkus.size,
        total: totals.storyDunSkus,
      },
      {
        key: "storyFoilSkus",
        label: "Foil finish",
        owned: owned.storyFoilSkus.size,
        total: totals.storyFoilSkus,
      },
      {
        key: "nonsenseDunSkus",
        label: "Nonsense",
        owned: owned.nonsenseDunSkus.size,
        total: totals.nonsenseDunSkus,
      },
      {
        key: "nonsenseFoilSkus",
        label: "Nonsense foil",
        owned: owned.nonsenseFoilSkus.size,
        total: totals.nonsenseFoilSkus,
      },
    ].map((item) => ({
      ...item,
      percent: item.total > 0 ? Math.min(100, Math.round((item.owned / item.total) * 100)) : 0,
    }));

    return {
      code: story.code,
      title: story.title,
      items,
    };
  });

  const heraldTotals = collectionProgressTargets.heralds.totals ?? { dunSkus: 0, foilSkus: 0 };
  const heraldBreakdown = [
    {
      key: "dunSkus",
      label: "Herald dun",
      owned: heraldProgress.dunSkus.size,
      total: heraldTotals.dunSkus,
    },
    {
      key: "foilSkus",
      label: "Herald foil",
      owned: heraldProgress.foilSkus.size,
      total: heraldTotals.foilSkus,
    },
  ].map((item) => ({
    ...item,
    percent: item.total > 0 ? Math.min(100, Math.round((item.owned / item.total) * 100)) : 0,
  }));

  return {
    uniqueCardCount: uniqueCardIds.size,
    uniqueSkuCount: uniqueSkuIds.size,
    totalQuantity,
    finishCounts,
    categoryCounts,
    completionRate,
    progressBreakdowns: {
      stories: storyBreakdowns,
      heralds: heraldBreakdown,
    },
  };
}
