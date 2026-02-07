function formatMoney(priceCents, currency = 'USD') {
  const amount = typeof priceCents === 'number' ? priceCents / 100 : 0;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${(amount || 0).toFixed(2)}`;
  }
}

function ListingRow({ listing, onAccept, canAccept, canCancel, onCancel }) {
  const label = listing.type === 'BID' ? 'Bid' : 'Ask';

  return (
    <li className="market-listing">
      <div className="market-listing__main">
        <div className="market-listing__type">{label}</div>
        <div className="market-listing__price">{formatMoney(listing.priceCents, listing.currency)}</div>
        <div className="market-listing__meta">
          <span className="muted">Card:</span> {listing.cardId}
          {' · '}
          <span className="muted">By:</span> {listing.createdByDisplayName || 'Anonymous'}
        </div>
      </div>
      <div className="market-listing__actions">
        {canCancel ? (
          <button type="button" onClick={() => onCancel?.(listing)}>
            Cancel
          </button>
        ) : (
          <button type="button" onClick={() => onAccept?.(listing)} disabled={!canAccept}>
            Accept
          </button>
        )}
      </div>
    </li>
  );
}

export default ListingRow;
