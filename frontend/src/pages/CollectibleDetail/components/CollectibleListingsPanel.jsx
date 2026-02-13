import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import useOpenListings from '../../Market/hooks/useOpenListings';
import ListingRow from '../../Market/components/ListingRow';
import { acceptListing, cancelListing } from '../../../lib/marketplace/listings';
import { getCollectibleRecord } from '../../../data/collectibles';

export default function CollectibleListingsPanel({ collectibleId }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { listings, loading, error } = useOpenListings({ cardId: collectibleId });

  const handleCancel = async (listing) => {
    if (!user) {
      navigate('/auth/login', { state: { from: { pathname: `/collectibles/${collectibleId}` } } });
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
      navigate('/auth/login', { state: { from: { pathname: `/collectibles/${collectibleId}` } } });
      return;
    }

    try {
      await acceptListing({ listingId: listing.id });
    } catch (err) {
      console.error('Failed to accept listing', err);
      alert(err?.message || 'Failed to accept listing');
    }
  };

  if (loading) {
    return <p>Loading listings…</p>;
  }

  if (error) {
    return <p className="muted">Failed to load listings.</p>;
  }

  if (listings.length === 0) {
    return <p className="muted">No open listings for this collectible yet.</p>;
  }

  const collectible = getCollectibleRecord(collectibleId);
  const collectibleLabel = collectible?.displayName
    ? `${collectible.displayName} (${collectibleId})`
    : undefined;

  return (
    <ul className="market-list">
      {listings.map((listing) => (
        <ListingRow
          key={listing.id}
          listing={listing}
          cardLabel={collectibleLabel}
          onAccept={handleAccept}
          canAccept={Boolean(user) && listing.createdByUid !== user.uid}
          canCancel={Boolean(user) && listing.createdByUid === user.uid}
          onCancel={handleCancel}
        />
      ))}
    </ul>
  );
}
