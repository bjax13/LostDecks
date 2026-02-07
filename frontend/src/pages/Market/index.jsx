import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import useOpenListings from './hooks/useOpenListings';
import ListingRow from './components/ListingRow';
import { acceptListing } from '../../lib/marketplace/listings';
import './Market.css';

function MarketPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { listings, loading, error } = useOpenListings();

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
              onCancel={async (l) => {
                // Cancel flow will be added next; for now keep UI minimal.
                alert('Cancel coming next.');
              }}
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
