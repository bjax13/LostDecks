import { useMemo, useState } from "react";
import AuthGuard from "../../components/Auth/AuthGuard";
import { useAuth } from "../../contexts/AuthContext";
import { getSkuRecord } from "../../data/collectibles";
import { useTradeMatches } from "./hooks/useTradeMatches";
import "./Matches.css";

function formatSkuLabel(skuId) {
  const sku = getSkuRecord(skuId);
  if (!sku) {
    return skuId;
  }

  const cardName = sku.card?.displayName || sku.cardId;
  const finishLabel = sku.finish ? ` (${sku.finish})` : "";
  return `${cardName}${finishLabel}`;
}

function formatFreshnessMessage(cacheAgeSeconds, refreshAvailableInSeconds) {
  if (cacheAgeSeconds == null) {
    return null;
  }

  const ageLabel = cacheAgeSeconds === 1 ? "1 second" : `${cacheAgeSeconds} seconds`;
  if (refreshAvailableInSeconds > 0) {
    const refreshLabel =
      refreshAvailableInSeconds === 1 ? "1 second" : `${refreshAvailableInSeconds} seconds`;
    return `As of ${ageLabel} ago. Can refresh in ${refreshLabel}.`;
  }

  return `As of ${ageLabel} ago.`;
}

function MatchesContent() {
  const { user } = useAuth();
  const [activeRow, setActiveRow] = useState("");
  const {
    cacheAgeSeconds,
    callerOptedOut,
    error,
    isUsingCachedResult,
    loading,
    matches,
    refreshAvailableInSeconds,
    reload,
  } = useTradeMatches(user?.uid);

  const matchRows = useMemo(
    () =>
      matches.map((counterparty) => ({
        ...counterparty,
        pairs: counterparty.pairs.map((pair) => ({
          ...pair,
          rowId: `${counterparty.userId}:${pair.theirSkuId}:${pair.yourSkuId}`,
          theirLabel: formatSkuLabel(pair.theirSkuId),
          yourLabel: formatSkuLabel(pair.yourSkuId),
        })),
      })),
    [matches],
  );

  const freshnessMessage = formatFreshnessMessage(cacheAgeSeconds, refreshAvailableInSeconds);
  const refreshDisabled = refreshAvailableInSeconds > 0;

  return (
    <section className="matches-page">
      <header className="matches-header">
        <h1>Matches</h1>
        <p className="matches-hint">
          Find collectors with reciprocal duplicates so you can complete your set together.
        </p>
      </header>

      {loading ? <p>Finding possible matches…</p> : null}
      {error ? (
        <section className="matches-panel">
          <p className="matches-error">Could not load matches right now.</p>
          <button type="button" onClick={reload} disabled={refreshDisabled}>
            Retry
          </button>
        </section>
      ) : null}

      {!loading && !error && freshnessMessage ? (
        <div className="matches-freshness" data-cached={isUsingCachedResult ? "true" : "false"}>
          <p className="matches-freshness-text">{freshnessMessage}</p>
          <button type="button" onClick={reload} disabled={refreshDisabled}>
            Refresh
          </button>
        </div>
      ) : null}

      {!loading && !error && callerOptedOut ? (
        <section className="matches-panel">
          <h2>Matching is disabled for your account</h2>
          <p>Enable matching in Account Settings to see trade opportunities.</p>
        </section>
      ) : null}

      {!loading && !error && !callerOptedOut && matchRows.length === 0 ? (
        <section className="matches-panel">
          <h2>No reciprocal matches yet</h2>
          <p>Keep collecting duplicates and check back as more collectors join.</p>
        </section>
      ) : null}

      {!loading && !error && !callerOptedOut
        ? matchRows.map((counterparty) => (
            <section className="matches-panel" key={counterparty.userId}>
              <h2>{counterparty.displayName}</h2>
              <ul className="matches-list">
                {counterparty.pairs.map((pair) => (
                  <li key={pair.rowId}>
                    <button
                      type="button"
                      className="matches-row"
                      onClick={() =>
                        setActiveRow((current) => (current === pair.rowId ? "" : pair.rowId))
                      }
                    >
                      <span>{pair.theirLabel}</span>
                      <span>is available for trade for your</span>
                      <span>{pair.yourLabel}.</span>
                    </button>
                    {activeRow === pair.rowId ? (
                      <p className="matches-contact">
                        Contact {counterparty.displayName}. Direct messaging is coming soon.
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))
        : null}
    </section>
  );
}

function MatchesPage() {
  return (
    <AuthGuard fallback={<p>Loading matches…</p>}>
      <MatchesContent />
    </AuthGuard>
  );
}

export default MatchesPage;
