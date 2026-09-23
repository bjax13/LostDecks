import { useMemo, useState } from "react";
import {
  applyBulkCollectionUpdate,
  createStoryDeckCollectionCsv,
  parseBulkCollectionCsv,
} from "../utils/bulkImport";
import IsoUftPostModal from "./IsoUftPostModal.jsx";
import VisualBulkCollectionEditorModal from "./VisualBulkCollectionEditorModal.jsx";

function formatSummaryCount(count, singular, plural) {
  if (count === 0) {
    return null;
  }
  const label = count === 1 ? singular : plural;
  return `${count} ${label}`;
}

function combineSummary(report) {
  const segments = [
    formatSummaryCount(report.created ?? 0, "new entry", "new entries"),
    formatSummaryCount(report.updated ?? 0, "update", "updates"),
    formatSummaryCount(report.deleted ?? 0, "removal", "removals"),
  ].filter(Boolean);

  if (segments.length === 0) {
    return "No changes were necessary.";
  }

  if (segments.length === 1) {
    return segments[0];
  }

  return `${segments.slice(0, -1).join(", ")} and ${segments.at(-1)}`;
}

const CSV_DOWNLOADS = [
  {
    mode: "zeros",
    label: "Empty template (all 0s)",
    filename: "lost-tales-collection-empty.csv",
  },
  {
    mode: "ones",
    label: "Full-set template (all 1s)",
    filename: "lost-tales-collection-full-set.csv",
  },
  {
    mode: "current",
    label: "Story Deck quantities (current)",
    filename: "lost-tales-collection-current.csv",
  },
];

function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function BulkCollectionTools({ ownerUid, entries, disabled }) {
  const [processing, setProcessing] = useState(false);
  const [report, setReport] = useState(null);
  const [issues, setIssues] = useState([]);
  const [error, setError] = useState(null);
  const [lastFileName, setLastFileName] = useState("");
  const [postStatus, setPostStatus] = useState(null);
  const [postError, setPostError] = useState(null);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [isVisualEditorOpen, setIsVisualEditorOpen] = useState(false);
  const [visualEditorSession, setVisualEditorSession] = useState(0);
  const [visualReport, setVisualReport] = useState(null);

  const existingEntries = useMemo(() => entries ?? [], [entries]);

  const handleDownloadCsv = (mode, filename) => {
    if (!ownerUid || processing) {
      return;
    }

    const csv = createStoryDeckCollectionCsv({
      mode,
      entries: existingEntries,
    });
    downloadCsv(filename, csv);
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !ownerUid) {
      return;
    }

    setProcessing(true);
    setReport(null);
    setVisualReport(null);
    setIssues([]);
    setError(null);
    setLastFileName(file.name);

    try {
      const text = await file.text();
      const rows = parseBulkCollectionCsv(text);

      if (rows.length === 0) {
        setError("The uploaded file did not contain any collection updates.");
        return;
      }

      const result = await applyBulkCollectionUpdate({
        ownerUid,
        rows,
        existingEntries,
      });

      setReport(result);
      setIssues(result.issues ?? []);
    } catch (err) {
      console.error("Bulk collection upload failed", err);
      setError(err.message ?? "Failed to process the uploaded file.");
    } finally {
      setProcessing(false);
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const handleOpenPostModal = () => {
    if (!ownerUid || processing || disabled) {
      return;
    }

    setPostStatus(null);
    setPostError(null);
    setIsPostModalOpen(true);
  };

  const handlePostCopied = ({ skippedEntries }) => {
    setPostStatus(
      skippedEntries > 0
        ? `Copied ISO/UFT post. ${skippedEntries} entries without a valid SKU were skipped.`
        : "Copied ISO/UFT post to your clipboard.",
    );
  };

  const handlePostCopyError = () => {
    setPostError("Unable to copy the post. Please try again.");
  };

  const handleOpenVisualEditor = () => {
    if (!ownerUid || processing || disabled) {
      return;
    }
    setVisualReport(null);
    setVisualEditorSession((current) => current + 1);
    setIsVisualEditorOpen(true);
  };

  const handleVisualSaved = (result) => {
    setVisualReport(result);
    setReport(result);
    setIssues(result.issues ?? []);
  };

  const summaryText = report ? combineSummary(report) : null;
  const actionsDisabled = !ownerUid || disabled || processing;

  return (
    <section id="bulk-import" className="collection-bulk" aria-label="Bulk update tools">
      <div className="collection-bulk__header">
        <h2>Bulk update your collection</h2>
        <p>
          Sync your Stormlight Lost Tales / Story Deck card collection with a CSV. Pins are not
          included and will not be changed by import. Quantity in the CSV is the new total for each
          SKU (not an increment). Use 0 to remove that card SKU from your Story Deck collection.
        </p>
        <p>
          Downloads: empty template (all 0s), full-set template (all 1s), or Story Deck quantities
          (current) for editing and re-upload. Pins are left out of these files.
        </p>
      </div>

      {!ownerUid ? (
        <p className="collection-bulk__hint">Sign in to download a CSV or upload updates.</p>
      ) : null}

      <div className="collection-bulk__panel">
        <h3 className="collection-bulk__panel-title">CSV import</h3>
        <p className="collection-bulk__panel-description">
          Best for large updates from a spreadsheet. Quantity in the file is the new total per SKU.
        </p>
        <div className="collection-bulk__actions">
          {CSV_DOWNLOADS.map((download) => (
            <button
              key={download.mode}
              type="button"
              className="collection-bulk__button"
              onClick={() => handleDownloadCsv(download.mode, download.filename)}
              disabled={actionsDisabled}
            >
              {download.label}
            </button>
          ))}
          <button
            type="button"
            className="collection-bulk__button"
            onClick={handleOpenPostModal}
            disabled={actionsDisabled}
          >
            Copy ISO/UFT post
          </button>
          <label className={`collection-bulk__upload ${processing ? "is-uploading" : ""}`}>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              disabled={actionsDisabled}
            />
            <span>{processing ? "Uploading…" : "Upload filled template"}</span>
          </label>
        </div>
      </div>

      <div className="collection-bulk__panel collection-bulk__panel--visual">
        <h3 className="collection-bulk__panel-title">Visual editor</h3>
        <p className="collection-bulk__panel-description">
          Use the same add/remove tree as Getting Started step 2. Your current collection quantities
          are prefilled when you open the editor.
        </p>
        <div className="collection-bulk__actions">
          <button
            type="button"
            className="collection-bulk__button collection-bulk__button--visual"
            onClick={handleOpenVisualEditor}
            disabled={actionsDisabled}
          >
            Open visual editor
          </button>
        </div>
      </div>

      {lastFileName ? (
        <p className="collection-bulk__filename">Last uploaded file: {lastFileName}</p>
      ) : null}

      {postStatus ? (
        <div className="collection-bulk__post-status" role="status">
          {postStatus}
        </div>
      ) : null}

      {postError ? (
        <div className="collection-bulk__post-status is-error" role="alert">
          {postError}
        </div>
      ) : null}

      {summaryText ? (
        <div className="collection-bulk__report" role="status">
          <strong>{visualReport ? "Visual update complete." : "Bulk update complete."}</strong>{" "}
          {summaryText}
        </div>
      ) : null}

      {issues.length > 0 ? (
        <div className="collection-bulk__issues">
          <strong>Some rows were skipped:</strong>
          <ul>
            {issues.map((issue) => (
              <li key={`${issue.line}-${issue.message}`}>
                {issue.line === "?" ? "Row" : `Line ${issue.line}`}: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <div className="collection-bulk__error" role="alert">
          {error}
        </div>
      ) : null}

      <IsoUftPostModal
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
        entries={existingEntries}
        onCopied={handlePostCopied}
        onCopyError={handlePostCopyError}
      />
      <VisualBulkCollectionEditorModal
        isOpen={isVisualEditorOpen}
        onClose={() => setIsVisualEditorOpen(false)}
        ownerUid={ownerUid}
        entries={existingEntries}
        onSaved={handleVisualSaved}
        sessionKey={visualEditorSession}
      />
    </section>
  );
}
