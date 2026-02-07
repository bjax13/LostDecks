import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import useOpenListings from './hooks/useOpenListings';
import ListingRow from './components/ListingRow';
import { acceptListing, cancelListing } from '../../lib/marketplace/listings';
import { createTrade } from '../../lib/marketplace/trades';
import './Market.css';

function MarketPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { listings, loading, error } = useOpenListings();

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

      {loading ? (
        <p>Loading listings…</p>
      ) : listings.length === 0 ? (
        <p className="muted">No open listings yet.</p>
      ) : (
        <ul className="market-list">
          {listings.map((listing) => (
            <ListingRow
              key={listing.id}
              listing={listing}
              onAccept={handleAccept}
              canAccept={Boolean(user) && listing.createdByUid !== user.uid}
              canCancel={Boolean(user) && listing.createdByUid === user.uid}
              onCancel={handleCancel}
            />
          ))}
        </ul>
      )}

      {!user && (
        <p className="muted" style={{ marginTop: '1rem' }}>
          Sign in to create listings or accept an existing listing.
        </p>
      )}
    </section>
  );
}

export default MarketPage;
