import { useState } from "react";
import { SITE_URL } from "../../../brand.js";
import {
  disablePublicTradeList,
  enablePublicTradeList,
  refreshPublicTradeList,
} from "../../../lib/publicTradeLists.js";
import { buildIsoUftSkuLists } from "../utils/isoUftPost.js";

function formatShareUpdatedAt(value) {
  if (!value) {
    return null;
  }
  const date =
    typeof value.toDate === "function"
      ? value.toDate()
      : value instanceof Date
        ? value
        : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    date,
  );
}

export default function PublicTradeListToggle({
  ownerUid,
  displayName,
  discordHandle = "",
  entries,
  matchKeep,
  publicShareId,
  onShareIdChange,
  lastUpdatedAt = null,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [localUpdatedAt, setLocalUpdatedAt] = useState(lastUpdatedAt);

  const isPublic = Boolean(publicShareId);
  const publicUrl = isPublic ? `${SITE_URL}/t/${publicShareId}` : null;
  const updatedLabel = formatShareUpdatedAt(localUpdatedAt);

  const snapshotLists = () => buildIsoUftSkuLists(entries ?? [], { matchKeep });

  const handleEnable = async () => {
    if (!ownerUid || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { iso, uft } = snapshotLists();
      const shareId = await enablePublicTradeList({
        ownerUid,
        existingShareId: publicShareId || null,
        displayName,
        discordHandle,
        iso,
        uft,
      });
      onShareIdChange?.(shareId);
      setLocalUpdatedAt(new Date());
    } catch (err) {
      console.error("Failed to enable public trade list", err);
      setError(err.message ?? "Unable to make the list public.");
    } finally {
      setBusy(false);
    }
  };

  const handleRefresh = async () => {
    if (!ownerUid || !publicShareId || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { iso, uft } = snapshotLists();
      await refreshPublicTradeList({
        ownerUid,
        shareId: publicShareId,
        displayName,
        discordHandle,
        iso,
        uft,
      });
      setLocalUpdatedAt(new Date());
    } catch (err) {
      console.error("Failed to refresh public trade list", err);
      setError(err.message ?? "Unable to update the public list.");
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    if (!ownerUid || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await disablePublicTradeList({ ownerUid, shareId: publicShareId });
      onShareIdChange?.("");
      setLocalUpdatedAt(null);
    } catch (err) {
      console.error("Failed to stop sharing trade list", err);
      setError(err.message ?? "Unable to stop sharing.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="collection-bulk-post-modal__share">
      <label className="collection-bulk-post-modal__option">
        <input
          type="checkbox"
          checked={isPublic}
          disabled={busy || !ownerUid}
          onChange={(event) => {
            if (event.target.checked) {
              handleEnable();
            } else {
              handleDisable();
            }
          }}
        />
        <span>Make my trade list public</span>
      </label>
      {isPublic ? (
        <div className="collection-bulk-post-modal__share-details">
          <p className="collection-bulk-post-modal__share-url">
            Public link:{" "}
            <a href={`/t/${publicShareId}`} target="_blank" rel="noreferrer">
              {publicUrl}
            </a>
          </p>
          {updatedLabel ? (
            <p className="collection-bulk-post-modal__share-updated">Last updated {updatedLabel}</p>
          ) : null}
          <button
            type="button"
            className="collection-bulk-post-modal__button collection-bulk-post-modal__button--secondary"
            onClick={handleRefresh}
            disabled={busy}
          >
            Update public list
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="collection-bulk-post-modal__share-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Call from copy handler to keep the public snapshot fresh when sharing is on. */
export async function refreshPublicListOnCopy({
  ownerUid,
  publicShareId,
  displayName,
  discordHandle,
  entries,
  matchKeep,
}) {
  if (!ownerUid || !publicShareId) {
    return;
  }
  const { iso, uft } = buildIsoUftSkuLists(entries ?? [], { matchKeep });
  await refreshPublicTradeList({
    ownerUid,
    shareId: publicShareId,
    displayName,
    discordHandle,
    iso,
    uft,
  });
}
