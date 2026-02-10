import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import useOpenListings from './hooks/useOpenListings';
import ListingRow from './components/ListingRow';
import { acceptListing, cancelListing, createListing } from '../../lib/marketplace/listings';
import { cardsIndex, getCardRecord } from '../../data/cards';
import './Market.css';

function dollarsToCents(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

function resolveCardIdFromInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (getCardRecord(raw)) return raw;

  const upper = raw.toUpperCase();
  if (getCardRecord(upper)) return upper;

  const caseInsensitive = cardsIndex.find((card) => card.id.toLowerCase() === raw.toLowerCase());
  return caseInsensitive?.id || '';
}

function MarketPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { listings, loading, error } = useOpenListings();
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [queryText, setQueryText] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createSearchText, setCreateSearchText] = useState('');
  const [selectedCreateCardId, setSelectedCreateCardId] = useState('');
  const [createType, setCreateType] = useState('BID');
  const [createPrice, setCreatePrice] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [createSuccess, setCreateSuccess] = useState('');
  const [isCardPickerOpen, setIsCardPickerOpen] = useState(false);
  const [activeResultIndex, setActiveResultIndex] = useState(-1);
  const [suppressNextCardFocusOpen, setSuppressNextCardFocusOpen] = useState(false);
  const cardPickerRef = useRef(null);

  const filteredListings = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    return listings.filter((l) => {
      if (typeFilter !== 'ALL' && l.type !== typeFilter) return false;
      if (!q) return true;
      const card = getCardRecord(l.cardId);
      const haystack = `${l.cardId} ${card?.displayName || ''} ${card?.detail || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [listings, typeFilter, queryText]);

  const searchedCard = useMemo(() => {
    const q = queryText.trim();
    if (!q) return null;
    const exact = getCardRecord(q);
    return exact || null;
  }, [queryText]);

  const emptyMessage = listings.length === 0 ? 'No open listings yet.' : 'No open listings found.';
  const selectableCards = useMemo(
    () =>
      [...cardsIndex].sort((a, b) => {
        const byName = a.displayName.localeCompare(b.displayName);
        if (byName !== 0) {
          return byName;
        }
        return a.id.localeCompare(b.id);
      }),
    [],
  );
  const createResults = useMemo(() => {
    const q = createSearchText.trim().toLowerCase();
    if (q.length < 2) {
      return [];
    }
    return selectableCards
      .filter((card) =>
        `${card.id} ${card.displayName} ${card.detail || ''} ${card.storyTitle || ''}`
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 12);
  }, [selectableCards, createSearchText]);
  const shouldShowCardResults = isCardPickerOpen && createSearchText.trim().length >= 2;
  const activeResultId =
    shouldShowCardResults && activeResultIndex >= 0 && activeResultIndex < createResults.length
      ? `market-card-option-${createResults[activeResultIndex].id}`
      : undefined;

  useEffect(() => {
    if (!isCreateModalOpen) return undefined;

    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        setIsCreateModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isCreateModalOpen]);

  useEffect(() => {
    if (!isCreateModalOpen || !isCardPickerOpen) return undefined;

    const handleOutsideClick = (event) => {
      if (!cardPickerRef.current?.contains(event.target)) {
        setIsCardPickerOpen(false);
      }
    };

    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [isCreateModalOpen, isCardPickerOpen]);

  useEffect(() => {
    if (!shouldShowCardResults || createResults.length === 0) {
      setActiveResultIndex(-1);
      return;
    }

    setActiveResultIndex((prev) => {
      if (prev < 0) return 0;
      if (prev >= createResults.length) return createResults.length - 1;
      return prev;
    });
  }, [shouldShowCardResults, createResults]);

  const handleCancel = async (listing) => {
    if (!user) {
      navigate('/auth/login', { state: { from: { pathname: '/market' } } });
      return;
    }

    try {
      await cancelListing({ listingId: listing.id, cancelledByUid: user.uid });
    } catch (err) {
      console.error('Failed to cancel listing', err);
      alert(err?.message || 'Failed to cancel listing');
    }
  };

  const handleAccept = async (listing) => {
    if (!user) {
      navigate('/auth/login', { state: { from: { pathname: '/market' } } });
      return;
    }

    try {
      await acceptListing({ listingId: listing.id });
    } catch (err) {
      console.error('Failed to accept listing', err);
      alert(err?.message || 'Failed to accept listing');
    }
  };

  const openCreateModal = () => {
    const initialCard = searchedCard?.id || '';
    setSelectedCreateCardId(initialCard);
    setCreateSearchText(initialCard);
    setCreateType('BID');
    setCreatePrice('');
    setCreateError(null);
    setCreateSuccess('');
    setIsCardPickerOpen(false);
    setActiveResultIndex(-1);
    setSuppressNextCardFocusOpen(true);
    setIsCreateModalOpen(true);
  };

  const selectCreateCard = (card) => {
    setSelectedCreateCardId(card.id);
    setCreateSearchText(card.id);
    setCreateSuccess('');
    setIsCardPickerOpen(false);
    setActiveResultIndex(-1);
  };

  const handleCardSearchKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setIsCardPickerOpen(false);
      setActiveResultIndex(-1);
      return;
    }

    if (!shouldShowCardResults || createResults.length === 0) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        setIsCardPickerOpen(true);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveResultIndex((prev) => (prev + 1) % createResults.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveResultIndex((prev) => (prev <= 0 ? createResults.length - 1 : prev - 1));
      return;
    }

    if (event.key === 'Enter' && activeResultIndex >= 0) {
      event.preventDefault();
      selectCreateCard(createResults[activeResultIndex]);
    }
  };

  const handleCreateListingSubmit = async (event) => {
    event.preventDefault();
    setCreateError(null);
    setCreateSuccess('');

    if (!user) {
      navigate('/auth/login', { state: { from: { pathname: '/market' } } });
      return;
    }

    const cardIdToCreate = selectedCreateCardId || resolveCardIdFromInput(createSearchText);
    if (!cardIdToCreate) {
      setCreateError('Select a card first.');
      return;
    }

    const priceCents = dollarsToCents(createPrice);
    if (!priceCents) {
      setCreateError('Enter a valid price.');
      return;
    }

    setCreateSubmitting(true);
    try {
      await createListing({
        type: createType,
        cardId: cardIdToCreate,
        priceCents,
        currency: 'USD',
        quantity: 1,
        createdByUid: user.uid,
        createdByDisplayName: user.displayName || user.email,
      });
      setCreatePrice('');
      setCreateSuccess('Listing created.');
    } catch (err) {
      console.error('Failed to create listing', err);
      setCreateError('Failed to create listing.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  return (
    <section>
      <div className="market-header">
        <div>
          <h1>Market</h1>
          <p>Browse active buy (bid) and sell (ask) listings for Lost Tales cards.</p>
        </div>
        <div className="market-header__actions">
          <button type="button" className="market-pill-button" onClick={openCreateModal}>
            Create listing
          </button>
          <button type="button" className="market-pill-button" onClick={() => navigate('/cards')}>
            Browse cards
          </button>
        </div>
      </div>

      {error && <p className="muted">Failed to load listings.</p>}

      <div className="market-controls">
        <label className="market-controls__field">
          Type
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="ALL">All</option>
            <option value="BID">Bids</option>
            <option value="ASK">Asks</option>
          </select>
        </label>

        <label className="market-controls__field">
          Search
          <input
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Search cards… (or paste a card id)"
          />
        </label>
      </div>

      {searchedCard ? (
        <div className="market-cta">
          <div>
            <strong>{searchedCard.displayName}</strong>
            <div className="muted">Matched card id: {searchedCard.id}</div>
          </div>
          <button type="button" className="market-pill-button" onClick={openCreateModal}>
            Create listing for this card
          </button>
        </div>
      ) : null}

      {loading ? (
        <p>Loading listings…</p>
      ) : filteredListings.length === 0 ? (
        <p className="muted">{emptyMessage}</p>
      ) : (
        <ul className="market-list">
          {filteredListings.map((listing) => {
            const card = getCardRecord(listing.cardId);
            const cardLabel = card?.displayName ? `${card.displayName} (${listing.cardId})` : undefined;
            return (
              <ListingRow
                key={listing.id}
                listing={listing}
                cardLabel={cardLabel}
                onAccept={handleAccept}
                canAccept={!user || listing.createdByUid !== user.uid}
                canCancel={Boolean(user) && listing.createdByUid === user.uid}
                onCancel={handleCancel}
              />
            );
          })}
        </ul>
      )}

      {!user && (
        <p className="muted" style={{ marginTop: '1rem' }}>
          Sign in to create listings or accept an existing listing.
        </p>
      )}

      {isCreateModalOpen ? (
        <div className="market-create-modal__backdrop" onClick={() => setIsCreateModalOpen(false)}>
          <div
            className="market-create-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Create listing for a card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="market-create-modal__header">
              <h2>Create listing</h2>
              <button
                type="button"
                className="market-create-modal__close"
                onClick={() => setIsCreateModalOpen(false)}
              >
                ×
              </button>
            </div>
            <p className="muted">Pick a card, set type and price, then create your listing here.</p>

            <form className="market-create-form" onSubmit={handleCreateListingSubmit}>
              <div className="market-card-picker" ref={cardPickerRef}>
                <label className="market-controls__field">
                  Card
                  <input
                    value={createSearchText}
                    onFocus={() => {
                      if (suppressNextCardFocusOpen) {
                        setSuppressNextCardFocusOpen(false);
                        return;
                      }
                      setIsCardPickerOpen(true);
                    }}
                    onKeyDown={handleCardSearchKeyDown}
                    onChange={(event) => {
                      setCreateSearchText(event.target.value);
                      setSelectedCreateCardId('');
                      setCreateSuccess('');
                      setIsCardPickerOpen(true);
                      setActiveResultIndex(-1);
                    }}
                    placeholder="Search by card name or id"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={shouldShowCardResults}
                    aria-controls="market-card-options"
                    aria-activedescendant={activeResultId}
                    autoFocus
                  />
                </label>

                {shouldShowCardResults ? (
                  <ul className="market-create-modal__results" role="listbox" id="market-card-options">
                    {createResults.map((card, index) => (
                      <li
                        key={card.id}
                        id={`market-card-option-${card.id}`}
                        role="option"
                        aria-selected={selectedCreateCardId === card.id || activeResultIndex === index}
                        onMouseEnter={() => setActiveResultIndex(index)}
                      >
                        <button
                          type="button"
                          className={`market-create-modal__result ${
                            selectedCreateCardId === card.id ? 'is-selected' : ''
                          } ${activeResultIndex === index ? 'is-active' : ''}`}
                          onClick={() => selectCreateCard(card)}
                        >
                          <span>{card.displayName}</span>
                          <span className="muted">{card.id}</span>
                        </button>
                      </li>
                    ))}
                    {createResults.length === 0 ? <li className="muted">No matching cards found.</li> : null}
                  </ul>
                ) : null}
              </div>

              <div className="market-create-form__row">
                <label className="market-controls__field">
                  Type
                  <select
                    value={createType}
                    onChange={(event) => {
                      setCreateType(event.target.value);
                      setCreateSuccess('');
                    }}
                    disabled={createSubmitting}
                  >
                    <option value="BID">Buy (Bid)</option>
                    <option value="ASK">Sell (Ask)</option>
                  </select>
                </label>

                <label className="market-controls__field">
                  Price (USD)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={createPrice}
                    onChange={(event) => {
                      setCreatePrice(event.target.value);
                      setCreateSuccess('');
                    }}
                    placeholder="10.00"
                    disabled={createSubmitting}
                  />
                </label>
              </div>

              {createError ? <p className="muted">{createError}</p> : null}
              {createSuccess ? <p className="muted">{createSuccess}</p> : null}

              <div className="market-create-modal__actions">
                <button
                  type="button"
                  className="market-pill-button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={createSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="market-pill-button" disabled={createSubmitting}>
                  {user ? (createSubmitting ? 'Creating…' : 'Create listing') : 'Sign in to create listing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default MarketPage;
