import { useMemo } from "react";
import AuthGuard from "../../components/Auth/AuthGuard";
import { useAuth } from "../../contexts/AuthContext";
import { collectionProgressTargets, datasetMeta, getSkuRecord } from "../../data/collectibles";
import { categoryLabels } from "../Collectibles/constants";
import {
  CollectionSummary,
  CollectionTable,
  formatDate,
  normalizeQuantity,
  resolveTimestamp,
} from "./collectionPresentation.jsx";
import BulkCollectionTools from "./components/BulkCollectionTools";
import { useUserCollection } from "./hooks/useUserCollection";
import "./Collection.css";

function CollectionContent() {
  const { user } = useAuth();
  const ownerUid = user?.uid ?? null;
  const { entries, loading, error } = useUserCollection(ownerUid);
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }),
    [],
  );

  const decoratedEntries = useMemo(() => {
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
  }, [entries, dateFormatter]);

  const summary = useMemo(() => {
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
  }, [decoratedEntries]);

  return (
    <section className="collection-page">
      <header className="collection-page__header">
        <h1>Your Collection</h1>
        <p>
          Track progress across the Stormlight Lost Tales deck. Your saved entries update in
          real-time as you add collectibles from Firebase.
        </p>
      </header>

      {error ? (
        <div className="collection-page__error">
          Failed to load your collection. {error.message ?? "Please try again in a moment."}
        </div>
      ) : null}

      <div className="collection-page__body">
        <BulkCollectionTools ownerUid={ownerUid} entries={entries} disabled={loading} />
        {loading ? (
          <div className="collection-page__loading">
            <div className="collection-page__loading-spinner" aria-hidden="true" />
            <p>Fetching your collectibles…</p>
          </div>
        ) : decoratedEntries.length === 0 ? (
          <div className="collection-page__empty">
            <strong>No collectibles catalogued yet</strong>
            <span>
              Add items from the Collectibles page, or create documents in the{" "}
              <code>collections</code> Firestore collection with <code>ownerUid</code>,{" "}
              <code>skuId</code>, and <code>quantity</code>.
            </span>
            <span>Entries update instantly once they are saved to Firestore.</span>
          </div>
        ) : (
          <>
            <CollectionSummary summary={summary} />
            <CollectionTable entries={decoratedEntries} />
          </>
        )}
      </div>
    </section>
  );
}

function CollectionPage() {
  return (
    <AuthGuard fallback={<p>Loading collection…</p>}>
      <CollectionContent />
    </AuthGuard>
  );
}

export default CollectionPage;
