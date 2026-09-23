import { useMemo, useState } from "react";
import CollectionReviewEditor from "../../../components/CollectionReviewEditor/CollectionReviewEditor.jsx";
import { useCollectionReviewEditor } from "../../../components/CollectionReviewEditor/useCollectionReviewEditor.js";
import {
  buildCollectionRows,
  COLLECTIBLE_TYPE_BOTH,
  deriveReviewStateFromEntries,
  filterGettingStartedTree,
  getDefaultExpandedReviewIds,
  gettingStartedTree,
} from "../../GettingStarted/gettingStartedCatalog";
import { applyBulkCollectionUpdate } from "../utils/bulkImport";

function VisualBulkCollectionEditorModalContent({ ownerUid, entries, onClose, onSaved }) {
  const reviewTree = useMemo(
    () => filterGettingStartedTree(gettingStartedTree, COLLECTIBLE_TYPE_BOTH),
    [],
  );

  const seeded = useMemo(
    () => deriveReviewStateFromEntries(entries ?? [], reviewTree),
    [entries, reviewTree],
  );

  const [coverage, setCoverage] = useState(seeded.coverage);
  const [quantities, setQuantities] = useState(seeded.quantities);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const editor = useCollectionReviewEditor({
    reviewTree,
    collectibleType: COLLECTIBLE_TYPE_BOTH,
    coverage,
    setCoverage,
    quantities,
    setQuantities,
    initialExpandedReviewIds: getDefaultExpandedReviewIds(seeded.coverage, reviewTree),
  });

  const handleSave = async () => {
    if (!ownerUid) return;

    setSaving(true);
    setError(null);
    try {
      const result = await applyBulkCollectionUpdate({
        ownerUid,
        rows: buildCollectionRows(coverage, quantities, undefined, reviewTree),
        existingEntries: entries ?? [],
        allowPins: true,
      });
      onSaved?.(result);
      onClose();
    } catch (saveError) {
      console.error("Visual bulk collection update failed", saveError);
      setError(saveError.message ?? "We could not update your collection. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismisses on pointer click
    <div className="collection-bulk-visual-modal__backdrop" onClick={onClose} role="presentation">
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: stop propagation only */}
      <div
        className="collection-bulk-visual-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="collection-bulk-visual-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="collection-bulk-visual-modal__header">
          <div>
            <h2 id="collection-bulk-visual-modal-title">Visual collection editor</h2>
            <p>
              Adjust quantities with the same add/remove controls as Getting Started. Changes apply
              when you save.
            </p>
          </div>
          <button type="button" className="collection-bulk-visual-modal__close" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="collection-bulk-visual-modal__body">
          <CollectionReviewEditor
            reviewTree={reviewTree}
            collectibleType={COLLECTIBLE_TYPE_BOTH}
            editor={editor}
            error={error}
            showFooter={false}
          />
        </div>
        <footer className="collection-bulk-visual-modal__footer">
          <p className="getting-started__collection-summary" role="status">
            {editor.collectionSummary}
          </p>
          <div className="collection-bulk-visual-modal__footer-actions">
            <button
              type="button"
              className="collection-bulk__button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="collection-bulk__button collection-bulk-visual-modal__save"
              onClick={handleSave}
              disabled={saving || !ownerUid}
            >
              {saving ? "Saving…" : "Save collection"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default function VisualBulkCollectionEditorModal({
  isOpen,
  onClose,
  ownerUid,
  entries,
  onSaved,
  sessionKey,
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <VisualBulkCollectionEditorModalContent
      key={sessionKey}
      ownerUid={ownerUid}
      entries={entries}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
