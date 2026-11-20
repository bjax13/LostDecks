import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SITE_NAME } from "../../brand.js";
import { datasetSkus, getCollectibleRecord } from "../../data/collectibles.js";
import { fetchPublicTradeList, isPublicTradeListStale } from "../../lib/publicTradeLists.js";
import "./PublicTradeList.css";

function skuIdToCard(skuId) {
  const normalized = String(skuId).trim().toUpperCase();
  const sku = datasetSkus.find((entry) => String(entry.skuId).toUpperCase() === normalized);
  if (!sku?.cardId) {
    return { skuId: normalized, label: normalized, finish: null };
  }
  const card = getCollectibleRecord(sku.cardId);
  const finish = sku.finish ? String(sku.finish).toUpperCase() : null;
  const name = card?.displayName ?? sku.cardId;
  const finishLabel = finish ? ` (${finish})` : "";
  return {
    skuId: normalized,
    label: `${name}${finishLabel}`,
    finish,
    card,
  };
}

function formatUpdatedAt(updatedAt) {
  if (!updatedAt) {
    return null;
  }
  const date =
    typeof updatedAt.toDate === "function"
      ? updatedAt.toDate()
      : updatedAt instanceof Date
        ? updatedAt
        : new Date(updatedAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    date,
  );
}

export default function PublicTradeListPage() {
  const { shareId } = useParams();
  const [docData, setDocData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPublicTradeList(shareId)
      .then((data) => {
        if (!cancelled) {
          setDocData(data);
        }
      })
      .catch((err) => {
        console.error("Failed to load public trade list", err);
        if (!cancelled) {
          setError(err);
          setDocData(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  const isoItems = useMemo(
    () => (docData?.iso ?? []).map((skuId) => skuIdToCard(skuId)),
    [docData],
  );
  const uftItems = useMemo(
    () =>
      (docData?.uft ?? []).map((row) => ({
        ...skuIdToCard(row.skuId),
        quantity: row.quantity,
      })),
    [docData],
  );

  const ctaHref = `/getting-started?collect=pins&utm_source=share&ref=${encodeURIComponent(shareId ?? "")}`;
  const updatedLabel = formatUpdatedAt(docData?.updatedAt);
  const stale = isPublicTradeListStale(docData?.updatedAt);

  if (loading) {
    return (
      <main className="public-trade-list">
        <p className="public-trade-list__status">Loading trade list…</p>
      </main>
    );
  }

  if (error || !docData) {
    return (
      <main className="public-trade-list">
        <h1>This list isn&apos;t shared anymore</h1>
        <p>
          The collector may have stopped sharing, or this link is outdated. You can still start your
          own collection on {SITE_NAME}.
        </p>
        <Link className="public-trade-list__cta" to={ctaHref}>
          See if you can trade — add your cards or pins
        </Link>
      </main>
    );
  }

  return (
    <main className="public-trade-list">
      <header className="public-trade-list__header">
        <h1>{docData.displayName}&apos;s trade list</h1>
        {updatedLabel ? (
          <p className="public-trade-list__updated">
            Last updated {updatedLabel}
            {stale ? (
              <span className="public-trade-list__stale" title="Older than 30 days">
                Stale
              </span>
            ) : null}
          </p>
        ) : null}
        {docData.discordHandle ? (
          <p className="public-trade-list__contact">Discord: {docData.discordHandle}</p>
        ) : null}
        {docData.region ? (
          <p className="public-trade-list__contact">Region: {docData.region}</p>
        ) : null}
      </header>

      <section className="public-trade-list__section" aria-labelledby="uft-heading">
        <h2 id="uft-heading">UFT</h2>
        {uftItems.length === 0 ? (
          <p className="public-trade-list__empty">None listed.</p>
        ) : (
          <ul className="public-trade-list__items">
            {uftItems.map((item) => (
              <li key={`uft-${item.skuId}`}>
                {item.label}
                {item.quantity > 1 ? ` ×${item.quantity}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="public-trade-list__section" aria-labelledby="iso-heading">
        <h2 id="iso-heading">ISO</h2>
        {isoItems.length === 0 ? (
          <p className="public-trade-list__empty">None listed.</p>
        ) : (
          <ul className="public-trade-list__items">
            {isoItems.map((item) => (
              <li key={`iso-${item.skuId}`}>{item.label}</li>
            ))}
          </ul>
        )}
      </section>

      <Link className="public-trade-list__cta" to={ctaHref}>
        See if you can trade — add your cards or pins
      </Link>
    </main>
  );
}
