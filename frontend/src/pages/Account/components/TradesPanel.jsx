import { updateTradeStatus } from "../../../lib/marketplace/tradesClient";
import useMyTrades from "../hooks/useMyTrades";

function formatMoney(priceCents, currency = "USD") {
  const amount = typeof priceCents === "number" ? priceCents / 100 : 0;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${(amount || 0).toFixed(2)}`;
  }
}

export default function TradesPanel({ user }) {
  const uid = user?.uid;
  const { trades, loading, error } = useMyTrades(uid);

  const handleUpdateStatus = async (trade, nextStatus) => {
    try {
      await updateTradeStatus({ tradeId: trade.id, status: nextStatus });
    } catch (err) {
      console.error("Failed to update trade status", err);
      alert(err?.message || "Failed to update trade status");
    }
  };

  return (
    <section className="account-section">
      <h2>My Trades</h2>
      <p className="account-hint">
        Trades are created when you accept a market listing (status starts as PENDING).
      </p>

      {error ? <p className="muted">Failed to load trades.</p> : null}
      {loading ? <p>Loading trades…</p> : null}

      {!loading && trades.length === 0 ? <p className="muted">No trades yet.</p> : null}

      {!loading && trades.length > 0 ? (
        <ul className="account-summary trade-list">
          {trades.map((t) => {
            const isBuyer = t.buyerUid === uid;
            const role = isBuyer ? "Buyer" : "Seller";
            const counterpartyName = isBuyer ? t.sellerDisplayName : t.buyerDisplayName;
            return (
              <li key={t.id} className="trade-item">
                <div className="trade-item__body">
                  <div className="trade-item__line">
                    <strong>{role}</strong> · {formatMoney(t.priceCents, t.currency)} · {t.type}
                  </div>
                  <div className="trade-item__meta muted">
                    Card: {t.cardDisplayName ? `${t.cardDisplayName} (${t.cardId})` : t.cardId} ·
                    With: {counterpartyName || "Anonymous"} · Status: {t.status}
                  </div>

                  {t.status === "PENDING" ? (
                    <div className="trade-item__actions">
                      <button type="button" onClick={() => handleUpdateStatus(t, "COMPLETED")}>
                        Mark completed
                      </button>
                      <button type="button" onClick={() => handleUpdateStatus(t, "CANCELLED")}>
                        Cancel trade
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
