import { useParams, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { getCardRecord, getSkuRecord } from '../../data/cards';
import { useAuth } from '../../contexts/AuthContext';
import { useCardCollectionEntry } from './hooks/useCardCollectionEntry';
import CategoryPill from '../Cards/components/CategoryPill';
import FinishPills from '../Cards/components/FinishPills';
import BinderInfo from '../Cards/components/BinderInfo';
import AddToCollectionButton from '../Cards/components/AddToCollectionButton';
import { categoryLabels } from '../Cards/constants';
import CreateListingForm from './components/CreateListingForm';
import CardListingsPanel from './components/CardListingsPanel';
import '../Market/Market.css';
import './CardDetail.css';

function normalizeQuantity(entry) {
  if (!entry) return 0;
  const candidates = [entry.quantity, entry.count, entry.copies, entry.total];
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return 0;
}

function resolveTimestamp(entry) {
  if (!entry) return null;
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

function formatDate(date) {
  if (!date) {
    return null;
  }
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  } catch (err) {
    console.warn('Failed to format date', err);
    return date.toISOString();
  }
}

export default function CardDetail() {
  const { cardId, skuId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const ownerUid = user?.uid ?? null;

  // Fetch card and SKU data
  const cardRecord = useMemo(() => (cardId ? getCardRecord(cardId) : null), [cardId]);
  const skuRecord = useMemo(() => (skuId ? getSkuRecord(skuId) : null), [skuId]);
  
  // Use card from SKU if available, otherwise use cardId
  const card = skuRecord?.card ?? cardRecord;
  
  // Fetch collection entry
  const { entry: collectionEntry, loading: collectionLoading } = useCardCollectionEntry(
    ownerUid,
    cardId,
    skuId
  );

  const quantity = useMemo(() => normalizeQuantity(collectionEntry), [collectionEntry]);
  const notes = useMemo(() => {
    if (!collectionEntry) return null;
    return typeof collectionEntry.notes === 'string' && collectionEntry.notes.trim().length > 0
      ? collectionEntry.notes.trim()
      : null;
  }, [collectionEntry]);
  
  const updatedAt = useMemo(() => resolveTimestamp(collectionEntry), [collectionEntry]);
  const updatedAtLabel = useMemo(() => formatDate(updatedAt), [updatedAt]);

  const finish = useMemo(() => {
    if (collectionEntry?.finish) {
      return typeof collectionEntry.finish === 'string' && collectionEntry.finish.trim().length > 0
        ? collectionEntry.finish.toUpperCase()
        : null;
    }
    return skuRecord?.finish ?? null;
  }, [collectionEntry, skuRecord]);

  if (!card) {
    return (
      <div className="card-detail-page">
        <div className="card-detail__error">
          <h1>Card Not Found</h1>
          <p>The card you're looking for doesn't exist.</p>
          <button type="button" onClick={() => navigate('/cards')} className="card-detail__back-button">
            Back to Cards
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card-detail-page">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="card-detail__back-button"
      >
        ← Back
      </button>

      <div className="card-detail__header">
        <div className="card-detail__header-main">
          <div className="card-detail__header-top">
            <CategoryPill category={card.category} />
            <span className="card-detail__id mono">{card.id}</span>
          </div>
          <h1 className="card-detail__title">{card.displayName}</h1>
          <p className="card-detail__subtitle">{card.detail}</p>
        </div>
      </div>

      <div className="card-detail__content">
        <section className="card-detail__info">
          <h2 className="card-detail__section-title">Card Information</h2>
          
          <dl className="card-detail__stats">
            <div>
              <dt>Category</dt>
              <dd>
                <CategoryPill category={card.category} label={categoryLabels[card.category]} />
              </dd>
            </div>
            <div>
              <dt>Story</dt>
              <dd>{card.storyTitle ?? '—'}</dd>
            </div>
            <div>
              <dt>Number</dt>
              <dd>{card.number ?? '—'}</dd>
            </div>
            <div>
              <dt>Rarity</dt>
              <dd>{card.rarity ?? '—'}</dd>
            </div>
            <div>
              <dt>Finishes</dt>
              <dd>
                <FinishPills
                  finishes={card.finishes}
                  empty={<span className="muted">No finishes recorded</span>}
                />
              </dd>
            </div>
            <div>
              <dt>Binder Location</dt>
              <dd>
                <BinderInfo binder={card.binder} layout="grid" />
              </dd>
            </div>
            {skuId && (
              <div>
                <dt>SKU</dt>
                <dd className="mono">{skuId}</dd>
              </div>
            )}
            {finish && (
              <div>
                <dt>Finish (Current)</dt>
                <dd>
                  <span className="finish-pill">{finish}</span>
                </dd>
              </div>
            )}
          </dl>
        </section>

        {user && (
          <section className="card-detail__collection">
            <h2 className="card-detail__section-title">Your Collection</h2>
            
            {collectionLoading ? (
              <div className="card-detail__loading">Loading collection data…</div>
            ) : collectionEntry ? (
              <dl className="card-detail__collection-stats">
                <div>
                  <dt>Quantity Owned</dt>
                  <dd>{quantity}</dd>
                </div>
                {finish && (
                  <div>
                    <dt>Finish</dt>
                    <dd>
                      <span className="finish-pill">{finish}</span>
                    </dd>
                  </div>
                )}
                {updatedAtLabel && (
                  <div>
                    <dt>Last Updated</dt>
                    <dd>{updatedAtLabel}</dd>
                  </div>
                )}
                {notes && (
                  <div className="card-detail__notes-section">
                    <dt>Notes</dt>
                    <dd className="card-detail__notes">{notes}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="card-detail__not-in-collection">Not in your collection</p>
            )}

            <div className="card-detail__collection-actions">
              <AddToCollectionButton card={card} variant="card" />
            </div>
          </section>
        )}

        <section className="card-detail__offers">
          <h2 className="card-detail__section-title">Market</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Create a buy (bid) or sell (ask) listing for this card.
          </p>
          <CreateListingForm cardId={cardId} />

          <h3 style={{ marginTop: '1.5rem' }}>Open listings</h3>
          <CardListingsPanel cardId={cardId} />
        </section>
      </div>
    </div>
  );
}

