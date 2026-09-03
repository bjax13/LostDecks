import { useEffect, useState } from "react";
import AuthGuard from "../../components/Auth/AuthGuard";
import { useAuth } from "../../contexts/AuthContext";
import { getSkuRecord } from "../../data/collectibles";
import { isValidTradingEmail, MATCH_CONTACT_SHARING } from "../../lib/userPreferences";
import MatchesToolbar from "./components/MatchesToolbar";
import { matchLaneLabels } from "./constants";
import { useMatchesExplorer } from "./hooks/useMatchesExplorer";
import { useTradeMatches } from "./hooks/useTradeMatches";
import "./Matches.css";

const MAY_REFRESH_MESSAGE_MS = 3_000;

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

function formatPileQty(side, owned) {
  if (side === "they") {
    return "they have 2+";
  }
  return `you own ${owned}`;
}

function PileItem({ item, side }) {
  return (
    <li className="matches-pile-item">
      <span className="matches-pile-item-name">{formatSkuLabel(item.skuId)}</span>
      <span className="matches-pile-item-qty">{formatPileQty(side, item.owned)}</span>
    </li>
  );
}

function TradeLane({ lane }) {
  return (
    <section className="matches-lane">
      <h3 className="matches-lane-title">{matchLaneLabels[lane.id] ?? lane.id}</h3>
      <div className="matches-piles">
        <div className="matches-pile">
          <h4 className="matches-pile-title">They can send you</h4>
          <ul className="matches-pile-list">
            {lane.theyCanSend.map((item) => (
              <PileItem key={`they-${item.skuId}`} item={item} side="they" />
            ))}
          </ul>
        </div>
        <div className="matches-pile">
          <h4 className="matches-pile-title">You can send them</h4>
          <ul className="matches-pile-list">
            {lane.youCanSend.map((item) => (
              <PileItem key={`you-${item.skuId}`} item={item} side="you" />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function mailtoHref(email) {
  const trimmed = typeof email === "string" ? email.trim() : "";
  if (!isValidTradingEmail(trimmed)) {
    return null;
  }
  return `mailto:${encodeURIComponent(trimmed)}`;
}

function MatchContact({ contact, displayName }) {
  const email = contact?.email?.trim() || "";
  const mailHref = mailtoHref(email);
  const canCopyEmail = Boolean(email);
  const isDiscord = contact?.method === MATCH_CONTACT_SHARING.DISCORD && contact.discordHandle;

  async function copyEmail() {
    if (!canCopyEmail || !navigator.clipboard?.writeText) {
      return;
    }
    await navigator.clipboard.writeText(email);
  }

  return (
    <div className="matches-contact">
      <p className="matches-contact-title">Contact {displayName}</p>
      {isDiscord ? (
        <p>
          Discord: {contact.discordHandle} in{" "}
          {contact.discordChannel || "Sanderson Collectors Guild"}
        </p>
      ) : null}
      {canCopyEmail || mailHref ? (
        <div className="matches-contact-actions">
          {canCopyEmail ? (
            <button type="button" className="matches-contact-button" onClick={copyEmail}>
              Copy email
            </button>
          ) : null}
          {mailHref ? (
            <a className="matches-contact-button matches-contact-button-ghost" href={mailHref}>
              Email
            </a>
          ) : null}
        </div>
      ) : null}
      {!canCopyEmail && !isDiscord ? <p>Contact details are unavailable.</p> : null}
      {contact?.fallbackReason ? (
        <p className="matches-contact-fallback">{contact.fallbackReason}</p>
      ) : null}
    </div>
  );
}

function MatchGroup({ counterparty }) {
  const [open, setOpen] = useState(true);

  return (
    <details
      className="matches-panel"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="matches-group-heading">
        <h2>{counterparty.displayName}</h2>
      </summary>
      {counterparty.lanes.map((lane) => (
        <TradeLane key={lane.id} lane={lane} />
      ))}
      <MatchContact contact={counterparty.contact} displayName={counterparty.displayName} />
    </details>
  );
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
    searchTerm,
    setSearchTerm,
    laneFilter,
    setLaneFilter,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    resetFilters,
  } = useMatchesExplorer({ matches });

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
  const showFilteredEmpty = showMatchesChrome && matches.length > 0 && filteredMatches.length === 0;
  const showPagination = showMatchesChrome && (canGoPrevious || canGoNext || pageIndex > 1);

  return (
    <section className="matches-page">
      <header className="matches-header">
        <h1>Matches</h1>
        <p className="matches-hint">
          Find collectors with extras you need, and extras they need from you.
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
          laneFilter={laneFilter}
          onLaneChange={setLaneFilter}
          sortField={sortField}
          onSortFieldChange={setSortField}
          sortDirection={sortDirection}
          onToggleSortDirection={() =>
            setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
          }
          resultCount={filteredMatches.length}
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
        ? filteredMatches.map((counterparty) => (
            <MatchGroup key={counterparty.userId} counterparty={counterparty} />
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
