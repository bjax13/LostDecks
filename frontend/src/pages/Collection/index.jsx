import { useMemo } from "react";
import AuthGuard from "../../components/Auth/AuthGuard";
import { useAuth } from "../../contexts/AuthContext";
import { CollectionSummary, CollectionTable } from "./collectionPresentation.jsx";
import { buildCollectionSummary, decorateCollectionEntries } from "./collectionSummary";
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

  const decoratedEntries = useMemo(
    () => decorateCollectionEntries(entries, dateFormatter),
    [entries, dateFormatter],
  );

  const summary = useMemo(() => buildCollectionSummary(decoratedEntries), [decoratedEntries]);

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
