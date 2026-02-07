import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import useOpenListings from './hooks/useOpenListings';
import ListingRow from './components/ListingRow';
import './Market.css';

function MarketPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { listings, loading, error } = useOpenListings();

  const handleAccept = (listing) => {
    if (!user) {
      navigate('/auth/login', { state: { from: { pathname: '/market' } } });
      return;
    }

    // Accept flow (trades + atomic update) comes in the next PR.
    alert('Accept flow coming next. For now you can create and view listings.');
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
