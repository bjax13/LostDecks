import { Timestamp } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SITE_NAME } from "../../brand.js";
import { fetchShareSnapshot, formatShareUpdatedAt, isShareStale } from "../../lib/tradeShares.js";
import { formatPublicShareLists } from "./shareListFormat.js";
import "./PublicTradeList.css";

function UnavailableState() {
  return (
    <main className="public-trade-list">
      <h1>This list isn&apos;t shared anymore</h1>
      <p className="public-trade-list__empty">
        The owner may have stopped sharing, or this link is out of date.
      </p>
      <p className="public-trade-list__cta">
        <Link to="/getting-started?utm_source=share&utm_medium=trade_list">
          Start your own collection on {SITE_NAME}
        </Link>
      </p>
    </main>
  );
}

export default function PublicTradeListPage() {
  const { shareId } = useParams();
  const [status, setStatus] = useState("loading");
  const [share, setShare] = useState(null);

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }),
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!shareId) {
        setStatus("missing");
        return;
      }

      setStatus("loading");
      try {
        const snapshot = await fetchShareSnapshot(shareId);
        if (cancelled) {
          return;
        }
        if (!snapshot) {
          setShare(null);
          setStatus("missing");
          return;
        }
        setShare(snapshot);
        setStatus("ready");
      } catch (err) {
        console.error("Failed to load shared trade list", err);
        if (!cancelled) {
          setShare(null);
          setStatus("missing");
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  if (status === "loading") {
    return (
      <main className="public-trade-list" aria-busy="true">
        <h1>Loading trade list…</h1>
      </main>
    );
  }

  if (status === "missing" || !share) {
    return <UnavailableState />;
  }

  const { iso, uft } = formatPublicShareLists(share);
  const updatedLabel = formatShareUpdatedAt(share.updatedAt, dateFormatter);
  const stale = isShareStale(
    share.updatedAt instanceof Timestamp ? share.updatedAt : share.updatedAt,
  );
  const displayName =
    typeof share.displayName === "string" ? share.displayName.trim() : "Collector";
  const refParam = shareId ? `&ref=${encodeURIComponent(shareId)}` : "";

  return (
    <main className="public-trade-list">
      <h1>
        {displayName}&apos;s trade list
        {stale ? (
          <span className="public-trade-list__badge" role="status">
            May be out of date
          </span>
        ) : null}
      </h1>
      {updatedLabel ? <p className="public-trade-list__meta">Last updated {updatedLabel}</p> : null}
      {share.discordHandle ? (
        <p className="public-trade-list__meta">Discord: {share.discordHandle}</p>
      ) : null}
      {share.region ? <p className="public-trade-list__meta">Region: {share.region}</p> : null}

      <section className="public-trade-list__section" aria-labelledby="shared-iso-heading">
        <h2 id="shared-iso-heading">ISO (looking for)</h2>
        {iso.length === 0 ? (
          <p>None listed.</p>
        ) : (
          <ul>
            {iso.map((line) => (
              <li key={`iso-${line}`}>{line}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="public-trade-list__section" aria-labelledby="shared-uft-heading">
        <h2 id="shared-uft-heading">UFT (up for trade)</h2>
        {uft.length === 0 ? (
          <p>None listed.</p>
        ) : (
          <ul>
            {uft.map((line) => (
              <li key={`uft-${line}`}>{line}</li>
            ))}
          </ul>
        )}
      </section>

      <p className="public-trade-list__cta">
        <Link to={`/getting-started?collect=pins&utm_source=share${refParam}`}>
          See if you can trade — add your cards or pins
        </Link>
      </p>
    </main>
  );
}
