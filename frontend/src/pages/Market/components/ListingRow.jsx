function formatMoney(priceCents, currency = 'USD') {
  const amount = typeof priceCents === 'number' ? priceCents / 100 : 0;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${(amount || 0).toFixed(2)}`;
  }
}

function ListingRow({
  listing,
  onAccept,
  canAccept,
  canCancel,
  onCancel,
  cardLabel,
  acceptLabel = 'Accept',
  acceptDisabledReason,
}) {
  const label = listing.type === 'BID' ? 'Bid' : 'Ask';
  const listingKindClass = listing.type === 'BID' ? 'market-listing--bid' : 'market-listing--ask';

  return (
    <li className={`market-listing ${listingKindClass}`}>
      <div className="market-listing__main">
        <div className="market-listing__type">{label}</div>
        <div className="market-listing__headline">
          <div className="market-listing__price">{formatMoney(listing.priceCents, listing.currency)}</div>
          <div className="market-listing__card">{cardLabel || listing.cardId}</div>
        </div>
        <div className="market-listing__meta">
          <span className="muted">By:</span> {listing.createdByDisplayName || 'Anonymous'}
        </div>
      </div>
      <div className="market-listing__actions">
        {canCancel ? (
          <button type="button" onClick={() => onCancel?.(listing)}>
            Cancel
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onAccept?.(listing)}
            disabled={!canAccept}
            title={!canAccept ? acceptDisabledReason : undefined}
          >
            {acceptLabel}
          </button>
        )}
      </div>
    </li>
  );
}

export default ListingRow;
