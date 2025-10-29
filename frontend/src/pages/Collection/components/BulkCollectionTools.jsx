import { useMemo, useState } from 'react';
import {
  applyBulkCollectionUpdate,
  createCollectionTemplateCsv,
  parseBulkCollectionCsv
} from '../utils/bulkImport';

function formatSummaryCount(count, singular, plural) {
  if (count === 0) {
    return null;
  }
  const label = count === 1 ? singular : plural;
  return `${count} ${label}`;
}

function combineSummary(report) {
  const segments = [
    formatSummaryCount(report.created ?? 0, 'new entry', 'new entries'),
    formatSummaryCount(report.updated ?? 0, 'update', 'updates'),
    formatSummaryCount(report.deleted ?? 0, 'removal', 'removals')
  ].filter(Boolean);

  if (segments.length === 0) {
    return 'No changes were necessary.';
  }

  if (segments.length === 1) {
    return segments[0];
  }

  return `${segments.slice(0, -1).join(', ')} and ${segments.at(-1)}`;
}

export default function BulkCollectionTools({ ownerUid, entries, disabled }) {
  const [processing, setProcessing] = useState(false);
  const [report, setReport] = useState(null);
  const [issues, setIssues] = useState([]);
  const [error, setError] = useState(null);
  const [lastFileName, setLastFileName] = useState('');

  const existingEntries = useMemo(() => entries ?? [], [entries]);

  const handleDownloadTemplate = () => {
    if (!ownerUid || processing) {
      return;
    }

    const csv = createCollectionTemplateCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'lost-tales-collection-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !ownerUid) {
      return;
    }

    setProcessing(true);
    setReport(null);
    setIssues([]);
    setError(null);
    setLastFileName(file.name);

    try {
      const text = await file.text();
      const rows = parseBulkCollectionCsv(text);

      if (rows.length === 0) {
        setError('The uploaded file did not contain any collection updates.');
        return;
      }

      const result = await applyBulkCollectionUpdate({
        ownerUid,
        rows,
        existingEntries
      });

      setReport(result);
      setIssues(result.issues ?? []);
    } catch (err) {
      console.error('Bulk collection upload failed', err);
      setError(err.message ?? 'Failed to process the uploaded file.');
    } finally {
      setProcessing(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const summaryText = report ? combineSummary(report) : null;

  return (
    <section className="collection-bulk" aria-label="Bulk update tools">
      <div className="collection-bulk__header">
        <h2>Bulk update your collection</h2>
        <p>
          Download the CSV template, fill in your card counts, then upload it here to sync your
          Stormlight Lost Tales collection in one go.
        </p>
      </div>

      {!ownerUid ? (
        <p className="collection-bulk__hint">Sign in to download the template or upload updates.</p>
      ) : null}

      <div className="collection-bulk__actions">
        <button
          type="button"
          className="collection-bulk__button"
          onClick={handleDownloadTemplate}
          disabled={!ownerUid || disabled || processing}
        >
          Download template
        </button>
        <label className={`collection-bulk__upload ${processing ? 'is-uploading' : ''}`}>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            disabled={!ownerUid || disabled || processing}
          />
          <span>{processing ? 'Uploading…' : 'Upload filled template'}</span>
        </label>
      </div>

      {lastFileName ? (
        <p className="collection-bulk__filename">Last uploaded file: {lastFileName}</p>
      ) : null}

      {summaryText ? (
        <div className="collection-bulk__report" role="status">
          <strong>Bulk update complete.</strong> {summaryText}
        </div>
      ) : null}

      {issues.length > 0 ? (
        <div className="collection-bulk__issues">
          <strong>Some rows were skipped:</strong>
          <ul>
            {issues.map((issue) => (
              <li key={`${issue.line}-${issue.message}`}>
                {issue.line === '?' ? 'Row' : `Line ${issue.line}`}:
                {' '}
                {issue.message}
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
    </section>
  );
}
