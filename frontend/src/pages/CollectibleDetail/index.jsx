import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PinImage from "../../components/PinImage/PinImage.jsx";
import { useAuth } from "../../contexts/AuthContext";
import { getCollectibleRecord, getSkuRecord, resolveSkuId } from "../../data/collectibles";
import BinderInfo from "../Collectibles/components/BinderInfo";
import CategoryPill from "../Collectibles/components/CategoryPill";
import FinishPills from "../Collectibles/components/FinishPills";
import { categoryLabels } from "../Collectibles/constants";
import { usePurgeSoftZeroEntriesOnMount } from "../Collectibles/hooks/usePurgeSoftZeroEntriesOnMount";
import FinishTradeList from "./components/FinishTradeList";
import { useCollectibleCollectionEntry } from "./hooks/useCollectibleCollectionEntry";
import "./CollectibleDetail.css";

function normalizeQuantity(entry) {
  if (!entry) return 0;
  const candidates = [entry.quantity, entry.count, entry.copies, entry.total];
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return 0;
}

function resolveTimestamp(entry) {
  if (!entry) return null;
  const possible = entry.updatedAt ?? entry.acquiredAt ?? entry.createdAt ?? null;
  if (!possible) {
    return null;
  }

  if (typeof possible.toDate === "function") {
    try {
      return possible.toDate();
    } catch (err) {
      console.warn("Failed to convert Firestore timestamp", err);
    }
  }

  if (possible instanceof Date) {
    return possible;
  }

  const date = new Date(possible);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date) {
  if (!date) {
    return null;
  }
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
      date,
    );
  } catch (err) {
    console.warn("Failed to format date", err);
    return date.toISOString();
  }
}

const DRAGONSTEEL_STORE_URL = /^https:\/\/www\.dragonsteelbooks\.com\/products\/[a-z0-9-]+$/;
const WAYBACK_ARCHIVE_URL =
  /^https:\/\/web\.archive\.org\/web\/(\d{14})\/https:\/\/(?:www\.dragonsteelbooks\.com|store\.brandonsanderson\.com)\/products\/[a-z0-9-]+$/;
const ARCHIVE_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function dragonsteelStoreLink(card) {
  if (card?.collectibleType !== "pin") return null;
  if (card.storeMatch !== "exact" && card.storeMatch !== "bundle") return null;
  if (typeof card.storeUrl !== "string" || !DRAGONSTEEL_STORE_URL.test(card.storeUrl)) return null;
  return {
    href: card.storeUrl,
    label:
      card.storeMatch === "bundle"
        ? "Sold in a bundle on the Dragonsteel store"
        : "Dragonsteel store",
  };
}

function archiveCaptureLabel(archiveUrl) {
  if (typeof archiveUrl !== "string") return null;
  const stamp = WAYBACK_ARCHIVE_URL.exec(archiveUrl)?.[1];
  if (!stamp) return null;
  const month = Number(stamp.slice(4, 6));
  if (month < 1 || month > 12) return null;
  return `${ARCHIVE_MONTHS[month - 1]} ${stamp.slice(0, 4)}`;
}

function archivedStoreLink(card) {
  if (card?.collectibleType !== "pin") return null;
  if (typeof card.storeUrl === "string" && card.storeUrl.trim().length > 0) return null;
  if (card.archiveMatch !== "exact" && card.archiveMatch !== "bundle") return null;
  const captured = archiveCaptureLabel(card.archiveUrl);
  if (!captured) return null;
  return {
    href: card.archiveUrl,
    label:
      card.archiveMatch === "bundle"
        ? `Archived bundle page (Wayback Machine, ${captured})`
        : `Archived Dragonsteel store page (Wayback Machine, ${captured})`,
  };
}

export default function CollectibleDetailPage() {
  const { collectibleId, skuId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const ownerUid = user?.uid ?? null;

  const cardRecord = useMemo(
    () => (collectibleId ? getCollectibleRecord(collectibleId) : null),
    [collectibleId],
  );
  const skuRecord = useMemo(() => (skuId ? getSkuRecord(skuId) : null), [skuId]);

  const card = skuRecord?.card ?? cardRecord;

  const {
    entry: collectionEntry,
    entries: collectionEntries,
    loading: collectionLoading,
  } = useCollectibleCollectionEntry(ownerUid, collectibleId, skuId);
  const collectionRows = collectionEntries ?? (collectionEntry ? [collectionEntry] : []);

  usePurgeSoftZeroEntriesOnMount(ownerUid, collectionRows, collectionLoading);

  const notes = useMemo(() => {
    if (!collectionEntry) return null;
    return typeof collectionEntry.notes === "string" && collectionEntry.notes.trim().length > 0
      ? collectionEntry.notes.trim()
      : null;
  }, [collectionEntry]);

  const updatedAt = useMemo(() => resolveTimestamp(collectionEntry), [collectionEntry]);
  const updatedAtLabel = useMemo(() => formatDate(updatedAt), [updatedAt]);

  const finish = useMemo(
    () =>
      skuRecord?.finish ??
      (collectionEntry?.finish ? String(collectionEntry.finish).toUpperCase() : null),
    [collectionEntry, skuRecord],
  );

  const ownedBySkuId = useMemo(() => {
    const owned = {};
    for (const entry of collectionRows) {
      if (!entry?.skuId) continue;
      owned[entry.skuId] = Math.max(0, normalizeQuantity(entry));
    }
    const finishes = card?.finishes ?? [];
    const skuIds = finishes.length
      ? finishes.map((finish) => resolveSkuId(card, finish))
      : [resolveSkuId(card, null)];
    for (const id of skuIds) {
      if (id && !Object.hasOwn(owned, id)) owned[id] = 0;
    }
    return owned;
  }, [card, collectionRows]);

  const storeLink = dragonsteelStoreLink(card);
  const archiveLink = storeLink ? null : archivedStoreLink(card);

  if (!card) {
    return (
      <div className="card-detail-page">
        <div className="card-detail__error">
          <h1>Collectible Not Found</h1>
          <p>The collectible you're looking for doesn't exist.</p>
          <button
            type="button"
            onClick={() => navigate("/collectibles")}
            className="card-detail__back-button"
          >
            Back to Collectibles
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card-detail-page">
      <button type="button" onClick={() => navigate(-1)} className="card-detail__back-button">
        ← Back
      </button>

      <div className="card-detail__header">
        {card.collectibleType === "pin" || card.category === "pin" ? (
          <PinImage pinId={card.id} name={card.displayName} image={card.image} variant="detail" />
        ) : null}
        <div className="card-detail__header-main">
          <div className="card-detail__header-top">
            <CategoryPill category={card.category} />
            <span className="card-detail__id mono">{card.id}</span>
          </div>
          <h1 className="card-detail__title">{card.displayName}</h1>
          <p className="card-detail__subtitle">{card.detail}</p>
        </div>
      </div>

      <div className="card-detail__content">
        <section className="card-detail__info">
          <h2 className="card-detail__section-title">Details</h2>

          <dl className="card-detail__stats">
            <div>
              <dt>Category</dt>
              <dd>
                <CategoryPill category={card.category} label={categoryLabels[card.category]} />
              </dd>
            </div>
            <div>
              <dt>{card.collectibleType === "pin" ? "Series" : "Story"}</dt>
              <dd>{card.storyTitle ?? "—"}</dd>
            </div>
            <div>
              <dt>Number</dt>
              <dd>{card.number ?? "—"}</dd>
            </div>
            {card.collectibleType === "pin" ? (
              <>
                {card.country ? (
                  <div>
                    <dt>Country</dt>
                    <dd>{card.country}</dd>
                  </div>
                ) : null}
                {card.release ? (
                  <div>
                    <dt>Release</dt>
                    <dd>{card.release}</dd>
                  </div>
                ) : null}
                {card.catalogName ? (
                  <div>
                    <dt>Catalog</dt>
                    <dd>{card.catalogName}</dd>
                  </div>
                ) : null}
                {storeLink ? (
                  <div className="card-detail__store">
                    <dt>Store</dt>
                    <dd>
                      <a
                        className="card-detail__store-link"
                        href={storeLink.href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {storeLink.label}
                      </a>
                    </dd>
                  </div>
                ) : archiveLink ? (
                  <div className="card-detail__store">
                    <dt>Store</dt>
                    <dd>
                      <a
                        className="card-detail__store-link"
                        href={archiveLink.href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {archiveLink.label}
                      </a>
                    </dd>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div>
                  <dt>Rarity</dt>
                  <dd>{card.rarity ?? "—"}</dd>
                </div>
                <div>
                  <dt>Finishes</dt>
                  <dd>
                    <FinishPills
                      finishes={card.finishes}
                      empty={<span className="muted">No finishes recorded</span>}
                    />
                  </dd>
                </div>
                <div>
                  <dt>Binder Location</dt>
                  <dd>
                    <BinderInfo binder={card.binder} layout="grid" />
                  </dd>
                </div>
              </>
            )}
            {skuId && (
              <div>
                <dt>SKU</dt>
                <dd className="mono">{skuId}</dd>
              </div>
            )}
            {finish && (
              <div>
                <dt>Finish (Current)</dt>
                <dd>
                  <span className="finish-pill">{finish}</span>
                </dd>
              </div>
            )}
          </dl>
        </section>

        {user && (
          <section className="card-detail__collection">
            <h2 className="card-detail__section-title">Your Collection</h2>

            {collectionLoading ? (
              <div className="card-detail__loading">Loading collection data…</div>
            ) : null}

            <FinishTradeList
              card={card}
              entries={collectionRows}
              loading={collectionLoading}
              ownedBySkuId={ownedBySkuId}
            />

            {collectionEntry ? (
              <dl className="card-detail__collection-stats">
                {updatedAtLabel && (
                  <div>
                    <dt>Last Updated</dt>
                    <dd>{updatedAtLabel}</dd>
                  </div>
                )}
                {notes && (
                  <div className="card-detail__notes-section">
                    <dt>Notes</dt>
                    <dd className="card-detail__notes">{notes}</dd>
                  </div>
                )}
              </dl>
            ) : null}
          </section>
        )}
      </div>
    </div>
  );
}
