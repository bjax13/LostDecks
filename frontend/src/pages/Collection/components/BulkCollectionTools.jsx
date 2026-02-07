import { useMemo, useState } from 'react';
import {
  applyBulkCollectionUpdate,
  createCollectionTemplateCsv,
  parseBulkCollectionCsv
} from '../utils/bulkImport';
import { datasetSkus, datasetStories, getCardRecord, getSkuRecord } from '../../../data/cards';

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

function normalizeQuantity(entry) {
  const candidates = [entry.quantity, entry.count, entry.copies, entry.total];
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return 1;
}

function normalizeSkuId(skuId) {
  if (!skuId || typeof skuId !== 'string') {
    return null;
  }
  const [cardId, finish] = skuId.split('#');
  if (!finish) {
    return skuId.trim();
  }
  return `${cardId}#${finish.toUpperCase()}`;
}

function getVariantLabel(detail) {
  if (!detail) {
    return null;
  }
  const trimmed = detail.trim();
  if (trimmed.toLowerCase() === 'standard variant') {
    return null;
  }
  if (trimmed.toLowerCase().startsWith('variant:')) {
    return trimmed.slice('variant:'.length).trim();
  }
  return trimmed;
}

function formatTradeItem(card) {
  if (!card) {
    return null;
  }
  if (card.category === 'story') {
    return { text: `${card.number}`, sortKey: [card.number, ''] };
  }
  if (card.category === 'herald') {
    const label = card.displayName ?? 'Unknown Herald';
    const number = Number.isFinite(card.number) ? card.number : 0;
    return { text: `${number} ${label}`, sortKey: [number, label] };
  }
  if (card.category === 'nonsense') {
    const variant = getVariantLabel(card.detail);
    return {
      text: variant ? `${card.number} ${variant}` : `${card.number}`,
      sortKey: [card.number, variant ?? '']
    };
  }
  return { text: card.displayName ?? card.id ?? 'Unknown', sortKey: [card.displayName ?? '', ''] };
}

const defaultPostSections = {
  storyFoil: true,
  storyDun: true,
  heraldFoil: true,
  heraldDun: true,
  nonsenseDun: true,
  nonsenseFoil: true
};

function buildIsoUftPost(entries, options = {}) {
  const sectionsEnabled = options.sectionsEnabled ?? defaultPostSections;
  const ownedSkuCounts = new Map();
  let skippedEntries = 0;

  entries.forEach((entry) => {
    const quantity = Math.max(0, normalizeQuantity(entry));
    if (!quantity) {
      return;
    }

    const normalizedSkuId = normalizeSkuId(entry.skuId);
    const skuInfo = normalizedSkuId ? getSkuRecord(normalizedSkuId) : null;
    const cardId = entry.cardId ?? skuInfo?.cardId ?? null;
    const finish = typeof entry.finish === 'string' && entry.finish.trim().length > 0
      ? entry.finish.trim().toUpperCase()
      : skuInfo?.finish ?? null;
    const skuKey = normalizedSkuId ?? (cardId && finish ? `${cardId}#${finish}` : null);

    if (!skuKey) {
      skippedEntries += 1;
      return;
    }

    ownedSkuCounts.set(skuKey, (ownedSkuCounts.get(skuKey) ?? 0) + quantity);
  });

  const storyOrder = datasetStories.map((story) => story.title);
  const storyRank = (title) => {
    const index = storyOrder.indexOf(title);
    return index === -1 ? Number.POSITIVE_INFINITY : index;
  };

  const buildSectionLines = ({ predicate, groupSuffix }, mode) => {
    const groups = new Map();

    datasetSkus.forEach((sku) => {
      const skuKey = normalizeSkuId(sku.skuId);
      const ownedCount = skuKey ? ownedSkuCounts.get(skuKey) ?? 0 : 0;
      if (mode === 'iso' ? ownedCount > 0 : ownedCount <= 1) {
        return;
      }

      const finish = sku.finish ? sku.finish.toUpperCase() : null;
      const card = getCardRecord(sku.cardId);
      if (!card || !predicate({ card, finish })) {
        return;
      }

      const item = formatTradeItem(card);
      if (!item) {
        return;
      }

      const storyTitle = card.storyTitle ?? 'Other';
      if (!groups.has(storyTitle)) {
        groups.set(storyTitle, []);
      }
      groups.get(storyTitle).push(item);
    });

    const orderedGroups = Array.from(groups.entries()).sort(([titleA], [titleB]) => {
      const rankA = storyRank(titleA);
      const rankB = storyRank(titleB);
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      return titleA.localeCompare(titleB);
    });

    const lines = [];
    orderedGroups.forEach(([storyTitle, items]) => {
      items.sort((a, b) => {
        if (a.sortKey[0] !== b.sortKey[0]) {
          return a.sortKey[0] - b.sortKey[0];
        }
        return String(a.sortKey[1]).localeCompare(String(b.sortKey[1]));
      });
      lines.push(`${storyTitle} ${groupSuffix}: ${items.map((item) => item.text).join(', ')}`);
    });

    return lines;
  };

  const sections = [
    {
      key: 'storyFoil',
      title: 'Story Foils',
      groupSuffix: 'Foils',
      predicate: ({ card, finish }) => card.category === 'story' && finish === 'FOIL'
    },
    {
      key: 'storyDun',
      title: 'Story Dun',
      groupSuffix: 'Dun',
      predicate: ({ card, finish }) => card.category === 'story' && finish === 'DUN'
    },
    {
      key: 'heraldFoil',
      title: 'Heralds (Foil)',
      groupSuffix: 'Heralds',
      predicate: ({ card, finish }) => card.category === 'herald' && finish === 'FOIL'
    },
    {
      key: 'heraldDun',
      title: 'Heralds (Dun)',
      groupSuffix: 'Heralds',
      predicate: ({ card, finish }) => card.category === 'herald' && finish === 'DUN'
    },
    {
      key: 'nonsenseDun',
      title: 'Nonsense (Dun)',
      groupSuffix: 'Nonsense',
      predicate: ({ card, finish }) => card.category === 'nonsense' && finish === 'DUN'
    },
    {
      key: 'nonsenseFoil',
      title: 'Nonsense (Foil)',
      groupSuffix: 'Nonsense',
      predicate: ({ card, finish }) => card.category === 'nonsense' && finish === 'FOIL'
    }
  ].filter((section) => sectionsEnabled[section.key]);

  const buildBlock = (label, mode) => {
    const lines = [label, ''];
    let hasContent = false;

    sections.forEach((section) => {
      const sectionLines = buildSectionLines(section, mode);
      if (sectionLines.length === 0) {
        return;
      }
      hasContent = true;
      lines.push(`${section.title}:`);
      lines.push(...sectionLines);
      lines.push('');
    });

    if (!hasContent) {
      lines.push(mode === 'iso' ? 'None needed yet.' : 'None available yet.');
      lines.push('');
    }

    return lines;
  };

  const lines = [
    ...buildBlock('ISO:', 'iso'),
    ...buildBlock('UFT:', 'uft')
  ];

  while (lines.length > 0 && lines.at(-1) === '') {
    lines.pop();
  }

  return {
    text: lines.join('\n'),
    skippedEntries
  };
}

export default function BulkCollectionTools({ ownerUid, entries, disabled }) {
  const [processing, setProcessing] = useState(false);
  const [report, setReport] = useState(null);
  const [issues, setIssues] = useState([]);
  const [error, setError] = useState(null);
  const [lastFileName, setLastFileName] = useState('');
  const [postStatus, setPostStatus] = useState(null);
  const [postError, setPostError] = useState(null);
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [postOptions, setPostOptions] = useState(defaultPostSections);
  const [modalStatus, setModalStatus] = useState(null);
  const [modalError, setModalError] = useState(null);

  const existingEntries = useMemo(() => entries ?? [], [entries]);
  const postPreview = useMemo(
    () => buildIsoUftPost(existingEntries, { sectionsEnabled: postOptions }),
    [existingEntries, postOptions]
  );

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

  const handleCopyPost = async () => {
    if (!ownerUid || processing || disabled) {
      return;
    }

    setPostStatus(null);
    setPostError(null);

    const { text, skippedEntries } = postPreview;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setPostStatus(
        skippedEntries > 0
          ? `Copied ISO/UFT post. ${skippedEntries} entries without a finish were skipped.`
          : 'Copied ISO/UFT post to your clipboard.'
      );
    } catch (err) {
      console.error('Failed to copy ISO/UFT post', err);
      setPostError('Unable to copy the post. Please try again.');
    }
  };

  const summaryText = report ? combineSummary(report) : null;

  const handleModalCopy = async () => {
    setModalStatus(null);
    setModalError(null);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(postPreview.text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = postPreview.text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setModalStatus('Copied ISO/UFT post to your clipboard.');
    } catch (err) {
      console.error('Failed to copy ISO/UFT post', err);
      setModalError('Unable to copy the post. Please try again.');
    }
  };

  const handleToggleSection = (key) => (event) => {
    setPostOptions((prev) => ({
      ...prev,
      [key]: event.target.checked
    }));
  };

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
        <button
          type="button"
          className="collection-bulk__button is-compact"
          onClick={handleCopyPost}
          disabled={!ownerUid || disabled || processing}
        >
          Copy post
        </button>
        <button
          type="button"
          className="collection-bulk__button"
          onClick={() => {
            setModalStatus(null);
            setModalError(null);
            setPostModalOpen(true);
          }}
          disabled={!ownerUid || disabled || processing}
        >
          Customize post
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

      {postModalOpen ? (
        <div className="collection-bulk__modal" role="dialog" aria-modal="true">
          <div
            className="collection-bulk__modal-overlay"
            onClick={() => setPostModalOpen(false)}
            aria-hidden="true"
          />
          <div className="collection-bulk__modal-card">
            <header className="collection-bulk__modal-header">
              <div>
                <h3>Customize ISO/UFT post</h3>
                <p>Toggle groups on or off, then copy the preview.</p>
              </div>
              <button
                type="button"
                className="collection-bulk__modal-close"
                onClick={() => setPostModalOpen(false)}
              >
                Close
              </button>
            </header>

            <div className="collection-bulk__modal-body">
              <div className="collection-bulk__modal-options">
                <label>
                  <input
                    type="checkbox"
                    checked={postOptions.storyFoil}
                    onChange={handleToggleSection('storyFoil')}
                  />
                  Story Foils
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={postOptions.storyDun}
                    onChange={handleToggleSection('storyDun')}
                  />
                  Story Dun
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={postOptions.nonsenseDun}
                    onChange={handleToggleSection('nonsenseDun')}
                  />
                  Nonsense (Dun)
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={postOptions.nonsenseFoil}
                    onChange={handleToggleSection('nonsenseFoil')}
                  />
                  Nonsense (Foil)
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={postOptions.heraldDun}
                    onChange={handleToggleSection('heraldDun')}
                  />
                  Heralds (Dun)
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={postOptions.heraldFoil}
                    onChange={handleToggleSection('heraldFoil')}
                  />
                  Heralds (Foil)
                </label>
              </div>

              <div className="collection-bulk__modal-preview">
                <span className="collection-bulk__modal-label">Preview</span>
                <textarea readOnly value={postPreview.text} />
                {postPreview.skippedEntries > 0 ? (
                  <span className="collection-bulk__modal-note">
                    {postPreview.skippedEntries} entries without a finish were skipped.
                  </span>
                ) : null}
              </div>
            </div>

            <footer className="collection-bulk__modal-footer">
              <button
                type="button"
                className="collection-bulk__button"
                onClick={handleModalCopy}
              >
                Copy post
              </button>
              {modalStatus ? (
                <span className="collection-bulk__modal-status">{modalStatus}</span>
              ) : null}
              {modalError ? (
                <span className="collection-bulk__modal-status is-error">{modalError}</span>
              ) : null}
            </footer>
          </div>
        </div>
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
