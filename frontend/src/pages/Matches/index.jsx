import { useEffect, useMemo, useState } from "react";
import AuthGuard from "../../components/Auth/AuthGuard";
import { useAuth } from "../../contexts/AuthContext";
import { getSkuRecord } from "../../data/collectibles";
import { MATCH_CONTACT_SHARING } from "../../lib/userPreferences";
import MatchesToolbar from "./components/MatchesToolbar";
import { useMatchesExplorer } from "./hooks/useMatchesExplorer";
import { useTradeMatches } from "./hooks/useTradeMatches";
import "./Matches.css";

const MAY_REFRESH_MESSAGE_MS = 3_000;

function formatContactDetails(contact) {
  if (!contact) {
    return "Contact details are unavailable.";
  }

  if (contact.method === MATCH_CONTACT_SHARING.DISCORD && contact.discordHandle) {
    return `Discord: ${contact.discordHandle} in ${contact.discordChannel || "Sanderson Collectors Guild"}`;
  }

  if (contact.email) {
    const emailLabel =
      contact.method === MATCH_CONTACT_SHARING.TRADING_EMAIL ? "Trading email" : "Email";
    return `${emailLabel}: ${contact.email}`;
  }

  return "Contact details are unavailable.";
}

function formatSkuLabel(skuId) {
  const sku = getSkuRecord(skuId);
  if (!sku) {
    return skuId.trim();
  }

  const displayName = sku.card?.displayName?.trim();
  const cardId = sku.cardId?.trim();
  const fallbackSkuId = sku.skuId?.trim() || skuId.trim();
  const cardName = displayName || cardId || fallbackSkuId;
  const finish = sku.finish?.trim();
  const finishLabel = finish ? ` (${finish})` : "";
  return `${cardName}${finishLabel}`;
}

function formatFreshnessMessage({
  cacheAgeSeconds,
  refreshAvailableInSeconds,
  showMayRefreshMessage,
  showRefreshCountdown,
}) {
  if (cacheAgeSeconds == null) {
    return null;
  }

  if (refreshAvailableInSeconds > 0) {
    if (!showRefreshCountdown) {
      return null;
    }

    const ageLabel = cacheAgeSeconds === 1 ? "1 second" : `${cacheAgeSeconds} seconds`;
    const refreshLabel =
      refreshAvailableInSeconds === 1 ? "1 second" : `${refreshAvailableInSeconds} seconds`;
    return `As of ${ageLabel} ago. Can refresh in ${refreshLabel}.`;
  }

  if (showMayRefreshMessage) {
    return "You may now refresh.";
  }

  return null;
}

function MatchesContent() {
  const { user } = useAuth();
  const [activeRow, setActiveRow] = useState("");
  const [showMayRefreshMessage, setShowMayRefreshMessage] = useState(false);
  const {
    cacheAgeSeconds,
    callerOptedOut,
    canGoNext,
    canGoPrevious,
    error,
    goToNextPage,
    goToPreviousPage,
    isUsingCachedResult,
    loading,
    matches,
    pageIndex,
    pageSize,
    refreshAvailableInSeconds,
    reload,
    showRefreshCountdown,
    totalOnPage,
  } = useTradeMatches(user?.uid);

  const {
    matches: filteredMatches,
    totalMatches,
    rarityOptions,
    stories,
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    storyFilter,
    setStoryFilter,
    rarityFilter,
    setRarityFilter,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    resetFilters,
  } = useMatchesExplorer({ matches });

  const matchRows = useMemo(
    () =>
      filteredMatches.map((counterparty) => ({
        ...counterparty,
        pairs: counterparty.pairs.map((pair) => ({
          ...pair,
          rowId: `${counterparty.userId}:${pair.theirSkuId}:${pair.yourSkuId}`,
          theirLabel: formatSkuLabel(pair.theirSkuId),
          yourLabel: formatSkuLabel(pair.yourSkuId),
        })),
      })),
    [filteredMatches],
  );

  useEffect(() => {
    if (loading || error || cacheAgeSeconds == null || refreshAvailableInSeconds > 0) {
      setShowMayRefreshMessage(false);
      return undefined;
    }

    setShowMayRefreshMessage(true);
    const timeoutId = window.setTimeout(() => {
      setShowMayRefreshMessage(false);
    }, MAY_REFRESH_MESSAGE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [cacheAgeSeconds, error, loading, refreshAvailableInSeconds]);

  const freshnessMessage = formatFreshnessMessage({
    cacheAgeSeconds,
    refreshAvailableInSeconds,
    showMayRefreshMessage,
    showRefreshCountdown,
  });
  const refreshDisabled = refreshAvailableInSeconds > 0;
  const showFreshnessBar =
    !loading &&
    !error &&
    cacheAgeSeconds != null &&
    (refreshAvailableInSeconds === 0 || showRefreshCountdown);
  const showMatchesChrome = !loading && !error && !callerOptedOut;
  const showEmptyMatches = showMatchesChrome && matches.length === 0;
  const showFilteredEmpty = showMatchesChrome && matches.length > 0 && matchRows.length === 0;
  const showPagination = showMatchesChrome && (canGoPrevious || canGoNext || pageIndex > 1);

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

      {showFreshnessBar ? (
        <div className="matches-freshness" data-cached={isUsingCachedResult ? "true" : "false"}>
          {freshnessMessage ? <p className="matches-freshness-text">{freshnessMessage}</p> : null}
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

      {showMatchesChrome ? (
        <MatchesToolbar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          storyFilter={storyFilter}
          onStoryChange={setStoryFilter}
          rarityFilter={rarityFilter}
          onRarityChange={setRarityFilter}
          sortField={sortField}
          onSortFieldChange={setSortField}
          sortDirection={sortDirection}
          onToggleSortDirection={() =>
            setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
          }
          rarityOptions={rarityOptions}
          stories={stories}
          resultCount={matchRows.length}
          totalCount={totalMatches}
          onReset={resetFilters}
        />
      ) : null}

      {showEmptyMatches ? (
        <section className="matches-panel">
          <h2>No reciprocal matches yet</h2>
          <p>Keep collecting duplicates and check back as more collectors join.</p>
        </section>
      ) : null}

      {showFilteredEmpty ? (
        <section className="matches-panel">
          <h2>No matches on this page for these filters</h2>
          <p>Try clearing filters or browsing another page of collectors.</p>
        </section>
      ) : null}

      {showMatchesChrome
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
                      <span>{`${pair.theirLabel} is available for trade for your ${pair.yourLabel}.`}</span>
                    </button>
                    {activeRow === pair.rowId ? (
                      <div className="matches-contact">
                        <p>
                          Contact {counterparty.displayName}.{" "}
                          {formatContactDetails(counterparty.contact)}
                        </p>
                        {counterparty.contact?.fallbackReason ? (
                          <p className="matches-contact-fallback">
                            {counterparty.contact.fallbackReason}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))
        : null}

      {showPagination ? (
        <nav className="matches-pagination" aria-label="Matches pagination">
          <button type="button" onClick={goToPreviousPage} disabled={!canGoPrevious || loading}>
            Previous
          </button>
          <p className="matches-pagination-status">
            Page <strong>{pageIndex}</strong>
            {totalOnPage > 0 ? (
              <>
                {" "}
                · <strong>{totalOnPage}</strong> collector{totalOnPage === 1 ? "" : "s"} (up to{" "}
                {pageSize}/page)
              </>
            ) : null}
          </p>
          <button type="button" onClick={goToNextPage} disabled={!canGoNext || loading}>
            Next
          </button>
        </nav>
      ) : null}
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
