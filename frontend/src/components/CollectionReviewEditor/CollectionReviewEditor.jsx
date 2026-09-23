import { useEffect, useId, useRef, useState } from "react";
import {
  COLLECTIBLE_TYPE_PINS,
  formatReviewGroupLabel,
  formatSkuNumberLabel,
  formatSkuQuantityAriaLabel,
  getCondensedSkuListStyle,
  getSkuFinishLabel,
  getSkuVariantLabel,
} from "../../pages/GettingStarted/gettingStartedCatalog";
import "../../pages/GettingStarted/GettingStarted.css";

const COVERAGE_OPTIONS = [
  { id: "all", label: "All" },
  { id: "some", label: "Some" },
  { id: "none", label: "None" },
];

function parseBulkQuantity(value) {
  if (value === "") return { valid: false };
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return { valid: false };
  return { valid: true, quantity: Math.floor(parsed) };
}

function inspectBulkQuantityInput(input) {
  if (!input) return { status: "empty" };
  if (input.validity.badInput || input.validity.rangeUnderflow) {
    return { status: "invalid" };
  }
  const parsed = parseBulkQuantity(input.value);
  if (!parsed.valid) {
    return input.value === "" ? { status: "empty" } : { status: "invalid" };
  }
  return { status: "ok", quantity: parsed.quantity };
}

function GroupBulkActions({ groupLabel, summary, onSetAll }) {
  const inputRef = useRef(null);
  const errorId = useId();
  const [inputStatus, setInputStatus] = useState("ok");
  const hasInvalidQuantity = inputStatus === "invalid";
  const canApply = inputStatus === "ok";

  const syncFromInput = (input) => {
    setInputStatus(inspectBulkQuantityInput(input).status);
  };

  const applyAll = () => {
    const input = inputRef.current;
    const result = inspectBulkQuantityInput(input);
    setInputStatus(result.status);
    if (result.status !== "ok") return;
    onSetAll(String(result.quantity));
    if (input) input.value = String(result.quantity);
  };

  return (
    <div
      className="getting-started__bulk-actions"
      role="toolbar"
      aria-label={`Bulk action for ${groupLabel}`}
    >
      <div className="getting-started__bulk-actions-controls">
        <span className="getting-started__bulk-actions-label">Bulk Action</span>
        <div
          className={`getting-started__bulk-actions-apply${hasInvalidQuantity ? " is-invalid" : ""}`}
        >
          <label className="getting-started__bulk-actions-custom">
            <span className="getting-started__sr-only">Custom quantity for {groupLabel}</span>
            <input
              ref={inputRef}
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              defaultValue="1"
              aria-invalid={hasInvalidQuantity}
              aria-describedby={hasInvalidQuantity ? errorId : undefined}
              onChange={(event) => syncFromInput(event.currentTarget)}
              onInput={(event) => syncFromInput(event.currentTarget)}
              onBlur={(event) => syncFromInput(event.currentTarget)}
            />
          </label>
          <button type="button" disabled={!canApply} onClick={applyAll}>
            Apply all
          </button>
        </div>
        {hasInvalidQuantity ? (
          <p id={errorId} className="getting-started__bulk-actions-error" role="alert">
            Quantity must be 0 or more.
          </p>
        ) : null}
      </div>
      {summary ? <small className="getting-started__bulk-actions-summary">{summary}</small> : null}
    </div>
  );
}

function CondensedSkuCell({
  shortLabel,
  variantLabel = null,
  quantityLabel,
  quantity,
  onAdjust,
  usesNameLabel = false,
}) {
  const hasVariantLine = Boolean(variantLabel);
  const cellClassName = [
    "getting-started__sku-condensed",
    hasVariantLine ? "has-variant" : null,
    usesNameLabel ? "has-name-label" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    // biome-ignore lint/a11y/useSemanticElements: quantity cell is a composite control, not a form fieldset
    <div className={cellClassName} role="group" aria-label={`${quantityLabel}, ${quantity}`}>
      <span className="getting-started__sku-condensed-label">
        <span className="getting-started__sku-condensed-short">{shortLabel} :</span>
        {hasVariantLine ? (
          <span className="getting-started__sku-condensed-variant">{variantLabel}</span>
        ) : null}
      </span>
      <button
        type="button"
        className="getting-started__sku-condensed-step"
        aria-label={`Decrease ${quantityLabel}`}
        onClick={(event) => {
          event.stopPropagation();
          onAdjust(-1);
        }}
      >
        −
      </button>
      <span className="getting-started__sku-condensed-qty" aria-hidden="true">
        {quantity}
      </span>
      <button
        type="button"
        className="getting-started__sku-condensed-step"
        aria-label={`Increase ${quantityLabel}`}
        onClick={(event) => {
          event.stopPropagation();
          onAdjust(1);
        }}
      >
        +
      </button>
    </div>
  );
}

function NoneCoverageConfirmModal({ groupTitle, isOpen, onConfirm, onCancel }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onCancel();
    };

    window.addEventListener("keydown", handleKeyDown);
    dialogRef.current?.focus();

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismisses on pointer click
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes via window listener
    <div className="getting-started__modal-backdrop" onClick={onCancel}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: click only stops backdrop dismiss; Escape handled on window */}
      <div
        ref={dialogRef}
        className="getting-started__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="collection-review-none-confirm-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="collection-review-none-confirm-title">Set all cards to zero?</h2>
        <p>
          This will clear quantities for <strong>{groupTitle}</strong>. Are you sure you want to set
          this group to None?
        </p>
        <div className="getting-started__modal-actions">
          <button type="button" className="getting-started__button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="getting-started__button is-primary" onClick={onConfirm}>
            Set to none
          </button>
        </div>
      </div>
    </div>
  );
}

function CoverageControl({ label, value, onChange }) {
  return (
    <fieldset
      className="getting-started__coverage-control"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <legend className="getting-started__sr-only">{label} coverage</legend>
      {COVERAGE_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          className={value === option.id ? "is-active" : ""}
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}

function resolveReviewTreeLabel(collectibleType) {
  if (collectibleType === COLLECTIBLE_TYPE_PINS) return "Pins to review";
  return "Cards to review";
}

export default function CollectionReviewEditor({
  reviewTree,
  collectibleType,
  editor,
  error = null,
  footerStart = null,
  footerPrimary = null,
  showFooter = true,
}) {
  const reviewTreeLabel = resolveReviewTreeLabel(collectibleType);

  return (
    <>
      <div className="getting-started__tree" role="tree" aria-label={reviewTreeLabel}>
        {reviewTree.map((section) => {
          const sectionExpanded = editor.expandedReviewIds.has(section.id);
          return (
            <div
              className="getting-started__tree-section"
              key={section.id}
              role="treeitem"
              tabIndex={-1}
            >
              {/* biome-ignore lint/a11y/useKeyWithClickEvents: row click mirrors dedicated expand button */}
              {/* biome-ignore lint/a11y/noStaticElementInteractions: expand affordance also exposed via toggle button */}
              <div
                className="getting-started__tree-row is-section"
                onClick={() => editor.toggleReviewNode(section.id)}
              >
                <button
                  type="button"
                  className="getting-started__tree-toggle"
                  aria-expanded={sectionExpanded}
                  aria-label={`${sectionExpanded ? "Collapse" : "Expand"} ${section.label}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    editor.toggleReviewNode(section.id);
                  }}
                >
                  <span aria-hidden="true" />
                </button>
                <strong>{section.label}</strong>
              </div>
              {sectionExpanded ? (
                // biome-ignore lint/a11y/useSemanticElements: tree group container, not a form fieldset
                <div className="getting-started__tree-children" role="group">
                  {section.children.map((group) => {
                    const groupExpanded = editor.expandedReviewIds.has(group.id);
                    const groupTitle = formatReviewGroupLabel(group, section);
                    const groupSummary = editor.getGroupSummary(group);
                    return (
                      <div key={group.id} role="treeitem" tabIndex={-1}>
                        {/* biome-ignore lint/a11y/useKeyWithClickEvents: row click mirrors dedicated expand button */}
                        {/* biome-ignore lint/a11y/noStaticElementInteractions: expand affordance also exposed via toggle button */}
                        <div
                          className="getting-started__tree-row is-group"
                          onClick={() => editor.toggleReviewNode(group.id)}
                        >
                          <button
                            type="button"
                            className="getting-started__tree-toggle"
                            aria-expanded={groupExpanded}
                            aria-label={`${groupExpanded ? "Collapse" : "Expand"} ${groupTitle}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              editor.toggleReviewNode(group.id);
                            }}
                          >
                            <span aria-hidden="true" />
                          </button>
                          <span>{groupTitle}</span>
                          <CoverageControl
                            label={groupTitle}
                            value={editor.coverage[group.id]}
                            onChange={(status) =>
                              editor.handleReviewGroupCoverage(group, section, status)
                            }
                          />
                        </div>
                        {groupExpanded ? (
                          <>
                            <GroupBulkActions
                              groupLabel={groupTitle}
                              summary={groupSummary}
                              onSetAll={(quantity) => editor.setGroupQuantities(group, quantity)}
                            />
                            {/* biome-ignore lint/a11y/useSemanticElements: SKU list grouping, not a form fieldset */}
                            <div
                              className="getting-started__tree-children getting-started__sku-list"
                              role="group"
                              style={getCondensedSkuListStyle(group.skus.length)}
                            >
                              {group.skus.map((sku) => {
                                const numberLabel = formatSkuNumberLabel(sku);
                                const variantLabel = getSkuVariantLabel(sku, group.skus);
                                const finishLabel = getSkuFinishLabel(sku);
                                const isPin =
                                  sku.card?.collectibleType === "pin" ||
                                  sku.card?.category === "pin";
                                const quantityLabel = formatSkuQuantityAriaLabel({
                                  groupTitle,
                                  finishLabel:
                                    sku.card?.category === "nonsense" || isPin ? null : finishLabel,
                                  numberLabel,
                                  variantLabel,
                                });
                                const displayQuantity = editor.getSkuDisplayQuantity(
                                  sku.skuId,
                                  group.id,
                                );

                                return (
                                  <CondensedSkuCell
                                    key={sku.skuId}
                                    shortLabel={numberLabel}
                                    variantLabel={variantLabel}
                                    quantityLabel={quantityLabel}
                                    quantity={displayQuantity}
                                    usesNameLabel={isPin}
                                    onAdjust={(delta) =>
                                      editor.adjustSkuQuantity(sku.skuId, group.id, delta)
                                    }
                                  />
                                );
                              })}
                            </div>
                          </>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {error ? (
        <p className="getting-started__error" role="alert">
          {error}
        </p>
      ) : null}
      {showFooter ? (
        <div className="getting-started__actions is-split">
          {footerStart}
          <div className="getting-started__actions-primary">
            <p
              className="getting-started__collection-summary"
              role="status"
              aria-label="Collection summary"
            >
              {editor.collectionSummary}
            </p>
            {footerPrimary}
          </div>
        </div>
      ) : (
        <p
          className="getting-started__collection-summary"
          role="status"
          aria-label="Collection summary"
        >
          {editor.collectionSummary}
        </p>
      )}
      <NoneCoverageConfirmModal
        groupTitle={editor.noneConfirmRequest?.groupTitle ?? ""}
        isOpen={editor.noneConfirmRequest !== null}
        onConfirm={editor.confirmNoneCoverage}
        onCancel={editor.cancelNoneCoverage}
      />
    </>
  );
}
