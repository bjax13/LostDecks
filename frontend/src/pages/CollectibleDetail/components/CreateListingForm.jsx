import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { createListing } from '../../../lib/marketplace/listings';

function dollarsToCents(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

export default function CreateListingForm({ collectibleId, cardId }) {
  const id = collectibleId ?? cardId;
  const navigate = useNavigate();
  const { user } = useAuth();

  const [type, setType] = useState('BID');
  const [price, setPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const priceCents = useMemo(() => dollarsToCents(price), [price]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (!user) {
      navigate('/auth/login', { state: { from: { pathname: `/collectibles/${id}` } } });
      return;
    }

    if (!priceCents) {
      setError('Enter a valid price.');
      return;
    }

    setSubmitting(true);
    try {
      await createListing({
        type,
        cardId: id,
        priceCents,
        currency: 'USD',
        quantity: 1,
        createdByUid: user.uid,
        createdByDisplayName: user.displayName || user.email,
      });
      setPrice('');
    } catch (err) {
      console.error('Failed to create listing', err);
      setError('Failed to create listing.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="create-listing">
      <div className="create-listing__row">
        <label className="create-listing__label">
          Type
          <select value={type} onChange={(e) => setType(e.target.value)} disabled={submitting}>
            <option value="BID">Buy (Bid)</option>
            <option value="ASK">Sell (Ask)</option>
          </select>
        </label>

        <label className="create-listing__label">
          Price (USD)
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="10.00"
            disabled={submitting}
          />
        </label>
      </div>

      {error && <p className="muted">{error}</p>}

      <button type="submit" disabled={submitting}>
        {user ? 'Create listing' : 'Sign in to create listing'}
      </button>

      <p className="muted" style={{ marginTop: '0.75rem' }}>
        Quantity is fixed to 1 for now. We can add multi-quantity listings later.
      </p>
    </form>
  );
}
