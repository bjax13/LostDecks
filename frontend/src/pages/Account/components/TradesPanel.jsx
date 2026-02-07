import useMyTrades from '../hooks/useMyTrades';

function formatMoney(priceCents, currency = 'USD') {
  const amount = typeof priceCents === 'number' ? priceCents / 100 : 0;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${(amount || 0).toFixed(2)}`;
  }
}

export default function TradesPanel({ user }) {
  const uid = user?.uid;
  const { trades, loading, error } = useMyTrades(uid);

  return (
    <section className="account-section">
      <h2>My Trades</h2>
      <p className="account-hint">Trades are created when you accept a market listing (status starts as PENDING).</p>

      {error ? <p className="muted">Failed to load trades.</p> : null}
      {loading ? <p>Loading trades…</p> : null}

      {!loading && trades.length === 0 ? <p className="muted">No trades yet.</p> : null}

      {!loading && trades.length > 0 ? (
        <ul className="account-summary" style={{ listStyle: 'none', paddingLeft: 0 }}>
          {trades.map((t) => {
            const isBuyer = t.buyerUid === uid;
            const role = isBuyer ? 'Buyer' : 'Seller';
            const counterpartyName = isBuyer ? t.sellerDisplayName : t.buyerDisplayName;
            return (
              <li key={t.id} style={{ padding: '0.5rem 0' }}>
                <div style={{ display: 'grid', gap: '0.25rem' }}>
                  <div>
                    <strong>{role}</strong> · {formatMoney(t.priceCents, t.currency)} · {t.type}
                  </div>
                  <div className="muted">
                    Card: {t.cardDisplayName ? `${t.cardDisplayName} (${t.cardId})` : t.cardId} · With:{' '}
                    {counterpartyName || 'Anonymous'} · Status: {t.status}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
