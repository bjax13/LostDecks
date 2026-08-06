import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import AuthGuard from "../../components/Auth/AuthGuard";
import { useAuth } from "../../contexts/AuthContext";
import { useCollectionQuantityMutations } from "../Collectibles/hooks/useCollectionQuantityMutations";
import { usePurgeSoftZeroEntriesOnMount } from "../Collectibles/hooks/usePurgeSoftZeroEntriesOnMount";
import { CollectionSummary, CollectionTable } from "./collectionPresentation.jsx";
import { buildCollectionSummary, decorateCollectionEntries } from "./collectionSummary";
import BulkCollectionTools from "./components/BulkCollectionTools";
import { useUserCollection } from "./hooks/useUserCollection";
import "./Collection.css";

function entryToCard(entry) {
  if (!entry?.cardId) return null;
  return {
    id: entry.cardId,
    collectibleType: entry.collectibleType ?? null,
    category: entry.category ?? null,
  };
}

function CollectionContent() {
  const { user } = useAuth();
  const location = useLocation();
  const ownerUid = user?.uid ?? null;
  const { entries, loading, error } = useUserCollection(ownerUid);
  const { addToCollection, decrementFromCollection } = useCollectionQuantityMutations();
  const [busySkuId, setBusySkuId] = useState(null);
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }),
    [],
  );

  // Soft-zero rows linger for this visit; purge quantity-0 docs once on remount/refresh.
  usePurgeSoftZeroEntriesOnMount(ownerUid, entries, loading);

  const decoratedEntries = useMemo(
    () => decorateCollectionEntries(entries, dateFormatter),
    [entries, dateFormatter],
  );

  const summary = useMemo(() => buildCollectionSummary(decoratedEntries), [decoratedEntries]);

  const runRowMutation = async (entry, mutate) => {
    const card = entryToCard(entry);
    if (!card || !entry.skuId || busySkuId) {
      return;
    }

    setBusySkuId(entry.skuId);
    try {
      await mutate(card);
    } catch (err) {
      console.error("Failed to update collection quantity", err);
    } finally {
      setBusySkuId(null);
    }
  };

  const handleIncrement = (entry) =>
    runRowMutation(entry, (card) =>
      addToCollection({
        card,
        finish: entry.finish ?? null,
        quantity: 1,
      }),
    );

  const handleDecrement = (entry) =>
    runRowMutation(entry, (card) =>
      decrementFromCollection({
        card,
        finish: entry.finish ?? null,
        quantity: 1,
        deleteWhenZero: false,
      }),
    );

  return (
    <section className="collection-page">
      <header className="collection-page__header">
        <h1>Your Collection</h1>
        <p>
          Track progress across the Stormlight Lost Tales deck. Your saved entries update in
          real-time as you add collectibles from Firebase.
        </p>
      </header>

      {location.state?.onboardingComplete ? (
        <div className="collection-page__success" role="status">
          Collection setup complete. Your updated quantities are shown below.
        </div>
      ) : null}

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
              Browse the Collectibles page and add cards you own to start building your collection.
            </span>
            <span>Your additions will show up here right away.</span>
          </div>
        ) : (
          <>
            <CollectionSummary summary={summary} />
            <CollectionTable
              entries={decoratedEntries}
              onIncrement={handleIncrement}
              onDecrement={handleDecrement}
              busySkuId={busySkuId}
            />
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
