import { useMemo } from 'react';
import AuthGuard from '../../components/Auth/AuthGuard';
import { useAuth } from '../../contexts/AuthContext';
import { categoryLabels } from '../Cards/constants';
import { datasetMeta, getCardRecord, getSkuRecord } from '../../data/cards';
import { useUserCollection } from './hooks/useUserCollection';
import './Collection.css';

function normalizeQuantity(entry) {
  const candidates = [entry.quantity, entry.count, entry.copies, entry.total];
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return 1;
}

function resolveTimestamp(entry) {
  const possible = entry.updatedAt ?? entry.acquiredAt ?? entry.createdAt ?? null;
  if (!possible) {
    return null;
  }

  if (typeof possible.toDate === 'function') {
    try {
      return possible.toDate();
    } catch (err) {
      console.warn('Failed to convert Firestore timestamp', err);
    }
  }

  if (possible instanceof Date) {
    return possible;
  }

  const date = new Date(possible);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date, formatter) {
  if (!date) {
    return null;
  }
  try {
    return formatter.format(date);
  } catch (err) {
    console.warn('Failed to format date', err);
    return date.toISOString();
  }
}

function SummaryStat({ label, value, sublabel }) {
  return (
    <div className="collection-summary__stat">
      <span className="collection-summary__stat-label">{label}</span>
      <span className="collection-summary__stat-value">{value}</span>
      {sublabel ? <span className="collection-summary__stat-sub">{sublabel}</span> : null}
    </div>
  );
}

function CollectionSummary({ summary }) {
  const completionPercent = Math.round(summary.completionRate * 100);

  const finishEntries = Object.entries(summary.finishCounts).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const categoryEntries = Object.entries(summary.categoryCounts).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return (
    <section className="collection-summary" aria-label="Collection summary">
      <div className="collection-summary__grid">
        <SummaryStat
          label="Unique Cards"
          value={`${summary.uniqueCardCount} / ${datasetMeta.totalUniqueCards}`}
          sublabel="Tracked in your set"
        />
        <SummaryStat
          label="Total Copies"
          value={summary.totalQuantity}
          sublabel="Across all finishes"
        />
        <SummaryStat
          label="Distinct SKUs"
          value={summary.uniqueSkuCount}
          sublabel="Unique printings tracked"
        />
      </div>

      <div className="collection-summary__progress">
        <div className="collection-summary__progress-track">
          <div
            className="collection-summary__progress-bar"
            style={{ width: `${completionPercent}%` }}
          />
        </div>
        <span className="collection-summary__progress-label">
          {completionPercent}% of the Stormlight Lost Tales set catalogued
        </span>
      </div>

      {(finishEntries.length > 0 || categoryEntries.length > 0) && (
        <div className="collection-summary__breakdowns">
          {finishEntries.length > 0 && (
            <div className="collection-summary__list">
              <span className="collection-summary__list-title">Finishes</span>
              {finishEntries.map(([finish, count]) => (
                <span key={finish} className="collection-summary__chip">
                  <span>{finish}</span>
                  <span className="collection-summary__chip-count">{count}</span>
                </span>
              ))}
            </div>
          )}
          {categoryEntries.length > 0 && (
            <div className="collection-summary__list">
              <span className="collection-summary__list-title">Categories</span>
              {categoryEntries.map(([category, count]) => (
                <span key={category} className="collection-summary__chip">
                  <span>{categoryLabels[category] ?? category}</span>
                  <span className="collection-summary__chip-count">{count}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function CollectionTable({ entries }) {
  return (
    <div className="collection-table__wrapper">
      <table className="collection-table">
        <thead>
          <tr>
            <th scope="col">Card</th>
            <th scope="col">Category</th>
            <th scope="col">Finish</th>
            <th scope="col">Quantity</th>
            <th scope="col">Last Updated</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td>
                <div className="collection-table__card">
                  <span className="collection-table__card-name">{entry.displayName}</span>
                  <div className="collection-table__card-meta">
                    {entry.cardId ? <span>{entry.cardId}</span> : null}
                    {entry.storyTitle ? <span>{entry.storyTitle}</span> : null}
                    {entry.binderLabel ? <span>{entry.binderLabel}</span> : null}
                  </div>
                  {entry.detail ? (
                    <span className="collection-table__card-detail">{entry.detail}</span>
                  ) : null}
                </div>
              </td>
              <td>
                <span className="collection-table__badge">{entry.categoryLabel}</span>
              </td>
              <td>
                <div className="collection-table__finish">
                  {entry.finish ? (
                    <span className="collection-table__finish-chip">{entry.finish}</span>
                  ) : (
                    <span>—</span>
                  )}
                  {entry.skuId ? <span className="collection-table__sku">{entry.skuId}</span> : null}
                </div>
              </td>
              <td>
                <span className="collection-table__quantity">{entry.quantity}</span>
              </td>
              <td>
                <div className="collection-table__updated">
                  <span>{entry.updatedAtLabel ?? '—'}</span>
                  {entry.notes ? (
                    <span className="collection-table__notes">{entry.notes}</span>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CollectionContent() {
  const { user } = useAuth();
  const ownerUid = user?.uid ?? null;
  const { entries, loading, error } = useUserCollection(ownerUid);
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }),
    [],
  );

  const decoratedEntries = useMemo(() => {
    const formatted = entries.map((entry) => {
      const skuInfo = entry.skuId ? getSkuRecord(entry.skuId) : null;
      const cardInfo = skuInfo?.card ?? (entry.cardId ? getCardRecord(entry.cardId) : null);
      const finish = typeof entry.finish === 'string' && entry.finish.trim().length > 0
        ? entry.finish.toUpperCase()
        : skuInfo?.finish ?? null;
      const quantity = Math.max(0, normalizeQuantity(entry));
      const timestamp = resolveTimestamp(entry);
      const updatedAtLabel = formatDate(timestamp, dateFormatter);
      const notes = typeof entry.notes === 'string' && entry.notes.trim().length > 0
        ? entry.notes.trim()
        : null;
      const binderLabel = cardInfo?.binder
        ? `Binder · Page ${cardInfo.binder.page}, Slot ${cardInfo.binder.position}`
        : null;

      return {
        ...entry,
        quantity,
        finish,
        skuId: entry.skuId ?? skuInfo?.skuId ?? null,
        cardId: cardInfo?.id ?? entry.cardId ?? skuInfo?.cardId ?? null,
        displayName:
          cardInfo?.displayName ??
          entry.displayName ??
          entry.cardId ??
          entry.skuId ??
          'Uncatalogued card',
        detail: cardInfo?.detail ?? null,
        category: cardInfo?.category ?? null,
        categoryLabel: cardInfo?.category
          ? categoryLabels[cardInfo.category] ?? cardInfo.category
          : '—',
        storyTitle: cardInfo?.storyTitle ?? null,
        binderLabel,
        updatedAtLabel,
        notes
      };
    });

    return formatted
      .sort((a, b) => {
        const nameCompare = a.displayName.localeCompare(b.displayName);
        if (nameCompare !== 0) {
          return nameCompare;
        }
        if (a.cardId && b.cardId) {
          return a.cardId.localeCompare(b.cardId);
        }
        return (a.skuId ?? '').localeCompare(b.skuId ?? '');
      });
  }, [entries, dateFormatter]);

  const summary = useMemo(() => {
    const uniqueCardIds = new Set();
    const uniqueSkuIds = new Set();
    const finishCounts = {};
    const categoryCounts = {};
    let totalQuantity = 0;

    decoratedEntries.forEach((entry) => {
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
    });

    const completionRate = datasetMeta?.totalUniqueCards
      ? Math.min(1, uniqueCardIds.size / datasetMeta.totalUniqueCards)
      : 0;

    return {
      uniqueCardCount: uniqueCardIds.size,
      uniqueSkuCount: uniqueSkuIds.size,
      totalQuantity,
      finishCounts,
      categoryCounts,
      completionRate
    };
  }, [decoratedEntries]);

  return (
    <section className="collection-page">
      <header className="collection-page__header">
        <h1>Your Collection</h1>
        <p>
          Track progress across the Stormlight Lost Tales deck. Your saved entries update
          in real-time as you add cards from Firebase.
        </p>
      </header>

      {error ? (
        <div className="collection-page__error">
          Failed to load your collection. {error.message ?? 'Please try again in a moment.'}
        </div>
      ) : null}

      <div className="collection-page__body">
        {loading ? (
          <div className="collection-page__loading">
            <div className="collection-page__loading-spinner" aria-hidden="true" />
            <p>Fetching your cards…</p>
          </div>
        ) : decoratedEntries.length === 0 ? (
          <div className="collection-page__empty">
            <strong>No cards catalogued yet</strong>
            <span>
              Create documents in the <code>collections</code> Firestore collection with fields like
              <code>ownerUid</code>, <code>cardId</code>, <code>skuId</code>, and <code>quantity</code>
              to see them appear here.
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
