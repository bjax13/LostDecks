import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import useOpenListings from './hooks/useOpenListings';
import ListingRow from './components/ListingRow';
import { acceptListing, cancelListing } from '../../lib/marketplace/listings';
import { createTrade } from '../../lib/marketplace/trades';
import { getCardRecord } from '../../data/cards';
import './Market.css';

function MarketPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { listings, loading, error } = useOpenListings();
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [queryText, setQueryText] = useState('');

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

  const emptyMessage = listings.length === 0 ? 'No open listings yet.' : 'No open listings found.';

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
      await acceptListing({
        listingId: listing.id,
        acceptedByUid: user.uid,
        acceptedByDisplayName: user.displayName || user.email,
      });

      // Create a Trade record (not strictly enforced atomically by rules yet).
      const listingType = listing.type;
      const creatorUid = listing.createdByUid;
      const creatorName = listing.createdByDisplayName || 'Anonymous';
      const acceptorUid = user.uid;
      const acceptorName = user.displayName || user.email;

      const buyerUid = listingType === 'ASK' ? acceptorUid : creatorUid;
      const buyerDisplayName = listingType === 'ASK' ? acceptorName : creatorName;
      const sellerUid = listingType === 'ASK' ? creatorUid : acceptorUid;
      const sellerDisplayName = listingType === 'ASK' ? creatorName : acceptorName;

      await createTrade({
        listingId: listing.id,
        cardId: listing.cardId,
        type: listingType,
        priceCents: listing.priceCents,
        currency: listing.currency,
        quantity: listing.quantity || 1,
        buyerUid,
        buyerDisplayName,
        sellerUid,
        sellerDisplayName,
      });
    } catch (err) {
      console.error('Failed to accept listing', err);
      alert(err?.message || 'Failed to accept listing');
    }
  };

  return (
    <section>
      <h1>Market</h1>
      <p>Browse active buy (bid) and sell (ask) listings for Lost Tales cards.</p>

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
            placeholder="Search cards…"
          />
        </label>
      </div>

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
                canAccept={Boolean(user) && listing.createdByUid !== user.uid}
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

      <p className="muted" style={{ marginTop: '0.75rem' }}>
        Tip: create listings from a specific card’s page (Cards → select a card).
      </p>
    </section>
  );
}

export default MarketPage;
