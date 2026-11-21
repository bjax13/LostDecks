import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MATCHES_VIEWED } from "../../analytics/events.js";
import { captureEvent } from "../../analytics/posthog.js";
import AuthGuard from "../../components/Auth/AuthGuard";
import InfoBubble from "../../components/InfoBubble.jsx";
import PinImage from "../../components/PinImage/PinImage.jsx";
import TradeFlagTag from "../../components/TradeFlagTag.jsx";
import { useAuth } from "../../contexts/AuthContext";
import { getSkuRecord } from "../../data/collectibles";
import {
  MATCHES_EMPTY_BODY,
  MATCHES_KEEP_TIP,
  MATCHES_PAGE_HELP,
  MATCHES_WELCOME_BODY,
} from "../../lib/matchHelpCopy.js";
import {
  MATCH_LOCATION_FILTER_NOTE,
  MATCH_LOCATION_FILTER_NOTICE_AFTER,
  MATCH_LOCATION_FILTER_NOTICE_BEFORE,
  MATCH_LOCATION_FILTER_NOTICE_LINK,
  readStoredMatchLocationFilter,
  serverLocationFilter,
  writeStoredMatchLocationFilter,
} from "../../lib/matchLocationFilter";
import { normalizeMatchCountry, normalizeMatchRegion } from "../../lib/matchLocations";
import { pileTradeFlagTag } from "../../lib/tradeFlag.js";
import {
  isValidTradingEmail,
  MATCH_CONTACT_SHARING,
  subscribeUserPreferences,
} from "../../lib/userPreferences";
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

function formatExtras(extras) {
  const count = Number.isFinite(extras) ? Math.max(0, Math.floor(extras)) : 0;
  return count === 1 ? "1 extra" : `${count} extras`;
}

function formatPileQty(side, item) {
  if (side === "they") {
    return formatExtras(item.extras);
  }
  return `you own ${item.owned}`;
}

function pinSlotForSku(skuId) {
  const sku = getSkuRecord(skuId);
  const card = sku?.card;
  const id = card?.id || skuId;
  const isPin =
    card?.collectibleType === "pin" ||
    card?.category === "pin" ||
    /^PIN-[A-Z0-9]{2,6}-\d{2,3}$/.test(typeof id === "string" ? id : "");
  if (!isPin) return null;
  return {
    pinId: id,
    name: card?.displayName || id,
    image: card?.image,
  };
}

function PileItem({ item, side }) {
  const pin = pinSlotForSku(item.skuId);
  const flags = Array.isArray(item.tradeFlags) ? item.tradeFlags : [];
  return (
    <li className="matches-pile-item">
      <span className="matches-pile-item-main">
        {pin ? (
          <PinImage pinId={pin.pinId} name={pin.name} image={pin.image} variant="match" />
        ) : null}
        <span className="matches-pile-item-name">{formatSkuLabel(item.skuId)}</span>
      </span>
      <span className="matches-pile-item-meta">
        {flags.map((flag) => (
          <TradeFlagTag key={flag} flag={flag} label={pileTradeFlagTag(side, flag)} />
        ))}
        <span className="matches-pile-item-qty">{formatPileQty(side, item)}</span>
      </span>
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
  const [searchParams] = useSearchParams();
  const [showMayRefreshMessage, setShowMayRefreshMessage] = useState(false);
  const [pinsLaneEnabled, setPinsLaneEnabled] = useState(true);
  const [locationUserId, setLocationUserId] = useState(user?.uid ?? null);
  const [viewerLocation, setViewerLocation] = useState({ country: "", region: "" });
  const [locationPrefsReady, setLocationPrefsReady] = useState(false);
  const [locationFilterChoice, setLocationFilterChoice] = useState(() =>
    readStoredMatchLocationFilter(user?.uid),
  );
  const [locationNoticeOpen, setLocationNoticeOpen] = useState(false);
  const locationNoticeRef = useRef(null);

  if ((user?.uid ?? null) !== locationUserId) {
    const nextUserId = user?.uid ?? null;
    setLocationUserId(nextUserId);
    setLocationPrefsReady(false);
    setViewerLocation({ country: "", region: "" });
    setLocationNoticeOpen(false);
    setLocationFilterChoice(readStoredMatchLocationFilter(nextUserId));
  }

  const locationFilter = serverLocationFilter(locationFilterChoice, viewerLocation);
  const welcome = searchParams.get("welcome") === "1";
  const matchesViewedKeyRef = useRef(null);
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
  } = useTradeMatches(user?.uid, {
    locationFilter,
    ready: !user?.uid || locationPrefsReady,
  });

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
    if (loading || error || isUsingCachedResult) {
      return;
    }
    const key = `${pageIndex}:${matches.length}:${callerOptedOut}`;
    if (matchesViewedKeyRef.current === key) {
      return;
    }
    matchesViewedKeyRef.current = key;
    captureEvent(MATCHES_VIEWED, {
      matchCount: matches.length,
      callerOptedOut,
      pageIndex,
    });
  }, [callerOptedOut, error, isUsingCachedResult, loading, matches.length, pageIndex]);

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

  useEffect(() => {
    if (!locationNoticeOpen) {
      return undefined;
    }
    locationNoticeRef.current?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") {
        setLocationNoticeOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [locationNoticeOpen]);

  useEffect(() => {
    if (!user?.uid) {
      setPinsLaneEnabled(true);
      return undefined;
    }
    return subscribeUserPreferences(
      user.uid,
      (preferences) => {
        setPinsLaneEnabled(preferences.matchLanes?.pins !== false);
        const country = normalizeMatchCountry(preferences.matchCountry);
        const region = normalizeMatchRegion(country, preferences.matchRegion);
        setViewerLocation({ country, region });
        setLocationFilterChoice((current) => {
          const next = {
            country: current.country && Boolean(country),
            state: current.state && Boolean(country) && Boolean(region),
          };
          if (next.country !== current.country || next.state !== current.state) {
            writeStoredMatchLocationFilter(user.uid, next);
            return next;
          }
          return current;
        });
        setLocationPrefsReady(true);
      },
      () => {
        setPinsLaneEnabled(true);
        setViewerLocation({ country: "", region: "" });
        setLocationFilterChoice({ country: false, state: false });
        setLocationPrefsReady(true);
      },
    );
  }, [user?.uid]);

  const handleLocationFilterChange = (kind, checked) => {
    if (checked) {
      const missingCountry = !viewerLocation.country;
      const missingState = missingCountry || !viewerLocation.region;
      if ((kind === "country" && missingCountry) || (kind === "state" && missingState)) {
        setLocationNoticeOpen(true);
        return;
      }
    }

    setLocationFilterChoice((current) => {
      const next = { ...current, [kind]: checked };
      if (user?.uid) {
        writeStoredMatchLocationFilter(user.uid, next);
      }
      return next;
    });
  };

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
        <div className="matches-title-row">
          <h1>Matches</h1>
          <InfoBubble label="How matching works">{MATCHES_PAGE_HELP}</InfoBubble>
        </div>
        <p className="matches-hint">{MATCHES_KEEP_TIP}</p>
      </header>

      {!callerOptedOut ? (
        <div className="matches-location-filters">
          <label>
            <input
              type="checkbox"
              checked={locationFilterChoice.state}
              disabled={!locationPrefsReady}
              onChange={(event) => handleLocationFilterChange("state", event.target.checked)}
            />
            Only my state
          </label>
          <label>
            <input
              type="checkbox"
              checked={locationFilterChoice.country}
              disabled={!locationPrefsReady}
              onChange={(event) => handleLocationFilterChange("country", event.target.checked)}
            />
            Only my country
          </label>
          {locationFilter !== "off" ? (
            <p className="matches-location-note">{MATCH_LOCATION_FILTER_NOTE}</p>
          ) : null}
        </div>
      ) : null}

      {locationNoticeOpen ? (
        // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click dismisses; Escape and Close also dismiss
        // biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes the popup from a window listener
        <div
          className="matches-location-popup-backdrop"
          onClick={() => setLocationNoticeOpen(false)}
        >
          <div
            className="matches-location-popup"
            role="dialog"
            aria-modal="true"
            aria-labelledby="matches-location-popup-title"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setLocationNoticeOpen(false);
              }
            }}
          >
            <p id="matches-location-popup-title">
              {MATCH_LOCATION_FILTER_NOTICE_BEFORE}
              <Link to="/account">{MATCH_LOCATION_FILTER_NOTICE_LINK}</Link>
              {MATCH_LOCATION_FILTER_NOTICE_AFTER}
            </p>
            <button
              type="button"
              ref={locationNoticeRef}
              onClick={() => setLocationNoticeOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      {welcome ? (
        <section className="matches-panel matches-welcome">
          <h2>You&apos;re in!</h2>
          <p>{MATCHES_WELCOME_BODY}</p>
          <div className="matches-welcome-actions">
            <Link className="matches-contact-button" to="/getting-started?collect=pins">
              Add spares
            </Link>
            <span className="matches-welcome-share" title="Coming soon">
              Share your list
            </span>
          </div>
        </section>
      ) : null}

      {!pinsLaneEnabled ? (
        <section className="matches-panel">
          <p>Pin matching is off in Account.</p>
        </section>
      ) : null}

      {loading ? <p>Finding possible matches…</p> : null}
      {error ? (
        <section className="matches-panel">
          <p className="matches-error">
            {typeof error?.message === "string" && error.message.trim()
              ? error.message
              : "Could not load matches right now."}
          </p>
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
          <p>{welcome ? MATCHES_WELCOME_BODY : MATCHES_EMPTY_BODY}</p>
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
