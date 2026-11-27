import { useMemo, useState } from "react";
import {
  AI_PHOTO_IMPORT_ESTIMATED_COST,
  AI_PHOTO_IMPORT_ITEMS_ADJUSTED,
  AI_PHOTO_IMPORT_ITEMS_CONFIRMED,
  AI_PHOTO_IMPORT_ITEMS_FOUND,
  AI_PHOTO_IMPORT_PHOTOS_SENT,
} from "../../../analytics/events.js";
import { captureEvent, isAiPhotoImportEnabled } from "../../../analytics/posthog.js";
import { getSkuRecord } from "../../../data/collectibles.js";
import { preparePhotoForAiImport } from "../utils/aiPhotoImportImage.js";
import { matchExtractionsToCatalog } from "../utils/aiPhotoImportMatcher.js";
import { analyzeCollectionPhotos } from "../utils/analyzeCollectionPhotos.js";
import { applyBulkCollectionUpdate } from "../utils/bulkImport.js";

function formatConfidence(value) {
  if (!Number.isFinite(value)) {
    return "—";
  }
  return `${Math.round(value * 100)}%`;
}

function buildDraftRow(match, id) {
  return {
    id,
    skuId: match.skuId ?? "",
    quantity: 1,
    notes: "",
    matchConfidence: match.matchConfidence,
    visionConfidence: match.extraction?.confidence ?? 0,
    candidates: match.candidates ?? [],
    extractionLabel: match.extraction?.name ?? "Unknown item",
    sourceSkuId: match.skuId ?? "",
    removed: false,
  };
}

function summarizeCatalogLabel(skuId) {
  const record = getSkuRecord(skuId);
  if (!record) {
    return skuId;
  }
  const finish = record.finish ? ` (${record.finish})` : "";
  const name = record.card?.displayName ?? record.cardId;
  return `${name}${finish} — ${record.skuId}`;
}

export default function AiPhotoImportPanel({ ownerUid, existingEntries, disabled }) {
  const featureEnabled = isAiPhotoImportEnabled();
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [draftRows, setDraftRows] = useState([]);
  const [importReport, setImportReport] = useState(null);
  const [estimatedCost, setEstimatedCost] = useState(null);

  const activeRows = useMemo(() => draftRows.filter((row) => !row.removed), [draftRows]);

  if (!featureEnabled) {
    return null;
  }

  const handleFilesSelected = async (event) => {
    const fileList = event.target.files;
    event.target.value = "";
    if (!ownerUid || disabled || !fileList?.length) {
      return;
    }
    setStatus("analyzing");
    setError(null);
    setImportReport(null);
    setDraftRows([]);

    try {
      const files = Array.from(fileList).slice(0, 6);
      const images = await Promise.all(files.map((file) => preparePhotoForAiImport(file)));
      const response = await analyzeCollectionPhotos(
        images.map((image) => ({
          mimeType: image.mimeType,
          dataBase64: image.dataBase64,
        })),
      );
      const matches = matchExtractionsToCatalog(response.extractions ?? []);
      const rows = matches.map((match, index) => buildDraftRow(match, `draft-${index}`));
      setDraftRows(rows);
      setEstimatedCost(response.meta?.estimatedCostUsd ?? null);
      setStatus(rows.length ? "review" : "empty");

      captureEvent(AI_PHOTO_IMPORT_PHOTOS_SENT, {
        photoCount: images.length,
        estimatedCostUsd: response.meta?.estimatedCostUsd ?? null,
      });
      captureEvent(AI_PHOTO_IMPORT_ITEMS_FOUND, {
        itemCount: rows.length,
        photoCount: images.length,
      });
      if (response.meta?.estimatedCostUsd != null) {
        captureEvent(AI_PHOTO_IMPORT_ESTIMATED_COST, {
          estimatedCostUsd: response.meta.estimatedCostUsd,
          photoCount: images.length,
        });
      }
    } catch (err) {
      console.error("AI photo import failed", err);
      const message =
        (typeof err?.message === "string" && err.message.trim()) ||
        (typeof err?.details === "string" && err.details.trim()) ||
        "Could not analyze the photos. Check your connection and try again.";
      setError(message);
      setStatus("idle");
    }
  };

  const updateRow = (rowId, patch) => {
    setDraftRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    );
  };

  const handleConfirm = async () => {
    if (!ownerUid || !activeRows.length) {
      return;
    }
    setStatus("confirming");
    setError(null);
    try {
      const rows = activeRows.map((row, index) => ({
        __lineNumber: index + 1,
        skuId: row.skuId,
        quantity: String(row.quantity),
        notes: row.notes,
      }));
      const result = await applyBulkCollectionUpdate({
        ownerUid,
        rows,
        existingEntries,
        allowPins: true,
      });
      setImportReport(result);

      const correctedCount = activeRows.filter(
        (row) => row.skuId.trim().toUpperCase() !== (row.sourceSkuId ?? "").trim().toUpperCase(),
      ).length;
      const removedCount = draftRows.filter((row) => row.removed).length;

      captureEvent(AI_PHOTO_IMPORT_ITEMS_ADJUSTED, {
        correctedCount,
        removedCount,
      });
      captureEvent(AI_PHOTO_IMPORT_ITEMS_CONFIRMED, {
        confirmedCount: activeRows.length,
        created: result.created,
        updated: result.updated,
        deleted: result.deleted,
        estimatedCostUsd: estimatedCost,
      });
      setStatus("done");
      setDraftRows([]);
    } catch (err) {
      console.error("AI photo import confirm failed", err);
      setError(err?.message ?? "Could not import items.");
      setStatus("review");
    }
  };

  const actionsDisabled =
    !ownerUid || disabled || status === "analyzing" || status === "confirming";

  return (
    <div className="collection-bulk__panel collection-bulk__panel--ai">
      <h3 className="collection-bulk__panel-title">AI photo import</h3>
      <p className="collection-bulk__panel-description">
        Photograph or upload cards and pins. We&apos;ll suggest catalog matches for you to review
        before anything is saved.
      </p>

      {!ownerUid ? (
        <p className="collection-bulk__hint">Sign in to use AI photo import.</p>
      ) : (
        <div className="collection-bulk__actions">
          <label className="collection-bulk__upload">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              multiple
              onChange={handleFilesSelected}
              disabled={actionsDisabled}
            />
            <span>
              {status === "analyzing"
                ? "Analyzing photos…"
                : "Add photos (camera or gallery, up to 6)"}
            </span>
          </label>
        </div>
      )}

      {status === "empty" ? (
        <p className="collection-bulk__hint" role="status">
          No collectibles were detected in those photos. Try a closer shot with less glare.
        </p>
      ) : null}

      {activeRows.length > 0 ? (
        <div className="collection-ai-review" aria-live="polite">
          <h4>Review matches</h4>
          <p className="collection-bulk__panel-description">
            Adjust SKUs, quantities, and notes. Nothing is saved until you confirm.
          </p>
          <table className="collection-ai-review__table">
            <thead>
              <tr>
                <th>Detected</th>
                <th>Catalog SKU</th>
                <th>Qty</th>
                <th>Notes</th>
                <th>Confidence</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {draftRows.map((row) =>
                row.removed ? null : (
                  <tr key={row.id}>
                    <td>{row.extractionLabel}</td>
                    <td>
                      <select
                        value={row.skuId}
                        onChange={(event) => updateRow(row.id, { skuId: event.target.value })}
                        aria-label={`SKU for ${row.extractionLabel}`}
                      >
                        <option value="">Select SKU…</option>
                        {[
                          ...new Set([
                            ...row.candidates.map((candidate) => candidate.skuId),
                            row.skuId,
                          ]),
                        ]
                          .filter(Boolean)
                          .map((skuId) => (
                            <option key={skuId} value={skuId}>
                              {summarizeCatalogLabel(skuId)}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={999}
                        value={row.quantity}
                        onChange={(event) =>
                          updateRow(row.id, { quantity: Number(event.target.value) })
                        }
                        aria-label={`Quantity for ${row.extractionLabel}`}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.notes}
                        onChange={(event) => updateRow(row.id, { notes: event.target.value })}
                        aria-label={`Notes for ${row.extractionLabel}`}
                      />
                    </td>
                    <td>{formatConfidence(row.matchConfidence)}</td>
                    <td>
                      <button
                        type="button"
                        className="collection-bulk__button"
                        onClick={() => updateRow(row.id, { removed: true })}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
          <div className="collection-bulk__actions">
            <button
              type="button"
              className="collection-bulk__button collection-bulk__button--visual"
              disabled={actionsDisabled || !activeRows.every((row) => row.skuId)}
              onClick={handleConfirm}
            >
              {status === "confirming" ? "Importing…" : "Confirm import"}
            </button>
          </div>
        </div>
      ) : null}

      {importReport ? (
        <div className="collection-bulk__report" role="status">
          <strong>AI import complete.</strong> {importReport.created} new, {importReport.updated}{" "}
          updated, {importReport.deleted} removed.
        </div>
      ) : null}

      {error ? (
        <div className="collection-bulk__error" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}
