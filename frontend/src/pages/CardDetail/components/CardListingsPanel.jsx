import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import useOpenListings from '../../Market/hooks/useOpenListings';
import ListingRow from '../../Market/components/ListingRow';
import { acceptListing, cancelListing } from '../../../lib/marketplace/listings';
import { createTrade } from '../../../lib/marketplace/trades';
import { getCardRecord } from '../../../data/cards';

export default function CardListingsPanel({ cardId }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { listings, loading, error } = useOpenListings({ cardId });

  const handleCancel = async (listing) => {
    if (!user) {
      navigate('/auth/login', { state: { from: { pathname: `/cards/${cardId}` } } });
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
      navigate('/auth/login', { state: { from: { pathname: `/cards/${cardId}` } } });
      return;
    }

    try {
      await acceptListing({
        listingId: listing.id,
        acceptedByUid: user.uid,
        acceptedByDisplayName: user.displayName || user.email,
      });

      const listingType = listing.type;
      const creatorUid = listing.createdByUid;
      const creatorName = listing.createdByDisplayName || 'Anonymous';
      const acceptorUid = user.uid;
      const acceptorName = user.displayName || user.email;

      const buyerUid = listingType === 'ASK' ? acceptorUid : creatorUid;
      const buyerDisplayName = listingType === 'ASK' ? acceptorName : creatorName;
      const sellerUid = listingType === 'ASK' ? creatorUid : acceptorUid;
      const sellerDisplayName = listingType === 'ASK' ? creatorName : acceptorName;

      const card = getCardRecord(listing.cardId);

      await createTrade({
        listingId: listing.id,
        cardId: listing.cardId,
        cardDisplayName: card?.displayName,
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

  if (loading) {
    return <p>Loading listings…</p>;
  }

  if (error) {
    return <p className="muted">Failed to load listings.</p>;
  }

  if (listings.length === 0) {
    return <p className="muted">No open listings for this card yet.</p>;
  }

  const card = getCardRecord(cardId);
  const cardLabel = card?.displayName ? `${card.displayName} (${cardId})` : undefined;

  return (
    <ul className="market-list">
      {listings.map((listing) => (
        <ListingRow
          key={listing.id}
          listing={listing}
          cardLabel={cardLabel}
          onAccept={handleAccept}
          canAccept={Boolean(user) && listing.createdByUid !== user.uid}
          canCancel={Boolean(user) && listing.createdByUid === user.uid}
          onCancel={handleCancel}
        />
      ))}
    </ul>
  );
}
