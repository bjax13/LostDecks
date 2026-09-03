import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useAuthModal } from "../../contexts/AuthModalContext.jsx";
import { useUserCollection } from "../Collection/hooks/useUserCollection";
import { applyBulkCollectionUpdate } from "../Collection/utils/bulkImport";
import {
  buildCollectionRows,
  createCoverageState,
  DEFAULT_MANUAL_QUANTITY,
  formatCollectionQuantitySummary,
  formatGroupQuantitySummary,
  formatReviewGroupLabel,
  formatSkuNumberLabel,
  formatSkuQuantityAriaLabel,
  getCondensedSkuListStyle,
  getDefaultExpandedReviewIds,
  getSkuFinishLabel,
  getSkuVariantLabel,
  gettingStartedTree,
  resolveSkuQuantity,
} from "./gettingStartedCatalog";
import "./GettingStarted.css";

const PROFILE_OPTIONS = [
  {
    id: "spreadsheet",
    title: "My collection is in a spreadsheet",
    description: "Prepare a CSV and use the bulk importer on your collection page.",
  },
  {
    id: "manual",
    title: "My collection is not in a spreadsheet",
    description: "Start with zero selected, then mark the groups or cards you already own.",
  },
];

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

function GroupBulkActions({ groupLabel, summary, onSetAll }) {
  const [customValue, setCustomValue] = useState("1");
  const errorId = useId();
  const parsedQuantity = parseBulkQuantity(customValue);
  const hasInvalidQuantity = customValue !== "" && !parsedQuantity.valid;

  return (
    <div
      className="getting-started__bulk-actions"
      role="toolbar"
      aria-label={`Bulk action for ${groupLabel}`}
    >
      <div className="getting-started__bulk-actions-controls">
        <span className="getting-started__bulk-actions-label">Bulk Action</span>
        <div className="getting-started__bulk-actions-apply">
          <label className="getting-started__bulk-actions-custom">
            <span className="getting-started__sr-only">Custom quantity for {groupLabel}</span>
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              aria-invalid={hasInvalidQuantity}
              aria-describedby={hasInvalidQuantity ? errorId : undefined}
              value={customValue}
              onChange={(event) => setCustomValue(event.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={!parsedQuantity.valid}
            onClick={() => {
              if (!parsedQuantity.valid) return;
              onSetAll(String(parsedQuantity.quantity));
            }}
          >
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

function CondensedSkuCell({ shortLabel, variantLabel = null, quantityLabel, quantity, onAdjust }) {
  const hasVariantLine = Boolean(variantLabel);

  return (
    // biome-ignore lint/a11y/useSemanticElements: quantity cell is a composite control, not a form fieldset
    <div
      className={`getting-started__sku-condensed${hasVariantLine ? " has-variant" : ""}`}
      role="group"
      aria-label={`${quantityLabel}, ${quantity}`}
    >
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
        aria-labelledby="getting-started-none-confirm-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="getting-started-none-confirm-title">Set all cards to zero?</h2>
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

function StepIndicator({ step, profile, onSelectStep }) {
  const spreadsheet = profile === "spreadsheet";
  const steps = spreadsheet
    ? [
        { id: "profile", label: "About you" },
        { id: "spreadsheet", label: "Import guide" },
      ]
    : [
        { id: "profile", label: "About you" },
        { id: "manual", label: "Card review" },
      ];
  const activeIndex = Math.max(
    0,
    steps.findIndex((entry) => entry.id === step),
  );

  const isStepClickable = (entry, index) => {
    if (index < activeIndex) return true;
    if (entry.id === "manual" && step === "profile") return true;
    return false;
  };

  return (
    <ol className="getting-started__steps is-two-step" aria-label="Getting started progress">
      {steps.map((entry, index) => {
        const isActive = index <= activeIndex;
        const isCurrent = index === activeIndex;
        const isClickable = isStepClickable(entry, index);

        return (
          <li
            key={entry.id}
            className={`${isActive ? "is-active" : ""} ${isClickable ? "is-clickable" : ""}`}
            aria-current={isCurrent ? "step" : undefined}
          >
            {isClickable ? (
              <button
                type="button"
                className="getting-started__step-button"
                onClick={() => onSelectStep(entry.id)}
              >
                <span>{index + 1}</span>
                {entry.label}
              </button>
            ) : (
              <>
                <span>{index + 1}</span>
                {entry.label}
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function GettingStartedPage() {
  const [step, setStep] = useState("profile");
  const [profile, setProfile] = useState(null);
  const [coverage, setCoverage] = useState({});
  const [quantities, setQuantities] = useState({});
  const [expandedReviewIds, setExpandedReviewIds] = useState(() => new Set());
  const [noneConfirmRequest, setNoneConfirmRequest] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const { entries, loading: collectionLoading } = useUserCollection(user?.uid ?? null);
  const navigate = useNavigate();

  const collectionSummary = useMemo(
    () =>
      formatCollectionQuantitySummary(
        gettingStartedTree,
        coverage,
        quantities,
        DEFAULT_MANUAL_QUANTITY,
      ),
    [coverage, quantities],
  );

  const beginProfile = () => {
    if (!profile) return;
    setError(null);
    if (profile === "spreadsheet") {
      setStep("spreadsheet");
      return;
    }
    const newCoverage = createCoverageState("none");
    setCoverage(newCoverage);
    setQuantities({});
    setExpandedReviewIds(getDefaultExpandedReviewIds(newCoverage));
    setStep("manual");
  };

  const selectStep = (targetStep) => {
    if (targetStep === "profile") {
      setStep("profile");
      return;
    }

    if (targetStep === "manual") {
      setError(null);
      if (!profile) {
        setProfile("manual");
      }
      const newCoverage =
        Object.keys(coverage).length === 0 ? createCoverageState("none") : coverage;
      if (Object.keys(coverage).length === 0) {
        setCoverage(newCoverage);
        setQuantities({});
      }
      setExpandedReviewIds(getDefaultExpandedReviewIds(newCoverage));
      setStep("manual");
      return;
    }

    if (targetStep === "spreadsheet") {
      setStep("spreadsheet");
    }
  };

  const setGroupCoverage = (groupId, status) => {
    setCoverage((current) => ({ ...current, [groupId]: status }));
  };

  const toggleReviewNode = (nodeId) => {
    setExpandedReviewIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const findReviewGroup = (groupId) => {
    for (const section of gettingStartedTree) {
      const group = section.children.find((child) => child.id === groupId);
      if (group) return group;
    }
    return null;
  };

  const syncCoverageAfterQuantityChange = (
    group,
    nextQuantities,
    groupStatus = coverage[group.id],
  ) => {
    if (groupStatus === "some") {
      return;
    }

    const resolved = group.skus.map((sku) =>
      resolveSkuQuantity(sku.skuId, groupStatus, nextQuantities, DEFAULT_MANUAL_QUANTITY),
    );

    const allZero = resolved.every((qty) => qty === 0);
    const anyZero = resolved.some((qty) => qty === 0);
    const anyPositive = resolved.some((qty) => qty > 0);

    if (groupStatus === "all") {
      if (allZero) {
        setGroupCoverage(group.id, "none");
      } else if (anyZero) {
        setGroupCoverage(group.id, "some");
      }
      return;
    }

    if (groupStatus === "none" && anyPositive) {
      setGroupCoverage(group.id, "some");
    }
  };

  const getSkuDisplayQuantity = (skuId, groupId) =>
    String(resolveSkuQuantity(skuId, coverage[groupId], quantities, DEFAULT_MANUAL_QUANTITY));

  const setGroupQuantities = (group, quantity) => {
    const nextValue = String(quantity);
    const groupStatus = coverage[group.id];
    const nextQuantities = { ...quantities };
    for (const sku of group.skus) {
      nextQuantities[sku.skuId] = nextValue;
    }
    syncCoverageAfterQuantityChange(group, nextQuantities, groupStatus);
    setQuantities(nextQuantities);
  };

  const fillGroupQuantitiesToAtLeastOne = (group, previousGroupStatus) => {
    setQuantities((current) => {
      const next = { ...current };
      for (const sku of group.skus) {
        const qty = resolveSkuQuantity(
          sku.skuId,
          previousGroupStatus,
          current,
          DEFAULT_MANUAL_QUANTITY,
        );
        if (qty < 1) {
          next[sku.skuId] = "1";
        }
      }
      return next;
    });
  };

  const setReviewGroupCoverage = (group, section, status) => {
    const previousGroupStatus = coverage[group.id];

    setGroupCoverage(group.id, status);

    if (status === "some") {
      setExpandedReviewIds((current) => {
        const next = new Set(current);
        next.add(section.id);
        next.add(group.id);
        return next;
      });
      return;
    }

    if (status === "all") {
      fillGroupQuantitiesToAtLeastOne(group, previousGroupStatus);
      return;
    }

    setQuantities((current) => {
      const next = { ...current };
      for (const sku of group.skus) {
        next[sku.skuId] = "0";
      }
      return next;
    });
  };

  const handleReviewGroupCoverage = (group, section, status) => {
    if (status === "none") {
      if (coverage[group.id] === "none") return;
      const groupTitle = formatReviewGroupLabel(group, section);
      setNoneConfirmRequest({ group, section, groupTitle });
      return;
    }
    setReviewGroupCoverage(group, section, status);
  };

  const confirmNoneCoverage = () => {
    if (!noneConfirmRequest) return;
    setReviewGroupCoverage(noneConfirmRequest.group, noneConfirmRequest.section, "none");
    setNoneConfirmRequest(null);
  };

  const cancelNoneCoverage = () => {
    setNoneConfirmRequest(null);
  };

  const adjustSkuQuantity = (skuId, groupId, delta) => {
    const group = findReviewGroup(groupId);
    if (!group) return;

    const groupStatus = coverage[groupId];
    const base = resolveSkuQuantity(skuId, groupStatus, quantities, DEFAULT_MANUAL_QUANTITY);
    const nextQuantities = {
      ...quantities,
      [skuId]: String(Math.max(0, base + delta)),
    };
    syncCoverageAfterQuantityChange(group, nextQuantities, groupStatus);
    setQuantities(nextQuantities);
  };

  const handleSave = async () => {
    if (!user) {
      openAuthModal({ reason: "getting-started-save" });
      return;
    }

    setSaving(true);
    setError(null);
    let timeoutId = null;
    try {
      const saveTimeoutMs = 20000;
      await Promise.race([
        applyBulkCollectionUpdate({
          ownerUid: user.uid,
          rows: buildCollectionRows(coverage, quantities, DEFAULT_MANUAL_QUANTITY),
          existingEntries: entries,
        }),
        new Promise((_, reject) => {
          timeoutId = window.setTimeout(() => {
            reject(
              new Error(
                "Saving timed out. If you are using local emulators, make sure Firebase emulators are running, then try again.",
              ),
            );
          }, saveTimeoutMs);
        }),
      ]);
      navigate("/collections", { state: { onboardingComplete: true } });
    } catch (saveError) {
      console.error("Getting started collection update failed", saveError);
      setError(saveError.message ?? "We could not update your collection. Please try again.");
    } finally {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      setSaving(false);
    }
  };

  return (
    <main className="getting-started">
      <header className="getting-started__header">
        <Link to="/" className="getting-started__back">
          Back to home
        </Link>
        <p className="getting-started__eyebrow">Lost Decks setup</p>
        <h1>Build your collection without entering every card.</h1>
        <p>
          Tell us roughly what you own. We will only ask about the cards that need a closer look.
        </p>
      </header>

      <StepIndicator step={step} profile={profile} onSelectStep={selectStep} />

      <section className="getting-started__workspace" aria-live="polite">
        {step === "profile" ? (
          <>
            <div className="getting-started__section-heading">
              <span>Step 1</span>
              <h2>What best describes you?</h2>
              <p>Choose whether to import from a spreadsheet or review cards in the app.</p>
            </div>
            <fieldset className="getting-started__profile-options">
              <legend className="getting-started__sr-only">
                Choose a collection starting point
              </legend>
              {PROFILE_OPTIONS.map((option) => (
                <label key={option.id} className={profile === option.id ? "is-selected" : ""}>
                  <input
                    type="radio"
                    name="profile"
                    value={option.id}
                    checked={profile === option.id}
                    onChange={() => setProfile(option.id)}
                  />
                  <span>
                    <strong>{option.title}</strong>
                    <small>{option.description}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="getting-started__actions">
              <button
                type="button"
                className="getting-started__button is-primary"
                disabled={!profile}
                onClick={beginProfile}
              >
                Continue
              </button>
            </div>
          </>
        ) : null}

        {step === "manual" ? (
          <>
            <div className="getting-started__section-heading">
              <span>Step 2</span>
              <h2>Review your collection</h2>
              <p>
                All and None are set to 1 and 0, but can be expanded for more granular edits.
                Selecting Some will proactively open the granular view.
              </p>
            </div>
            <div className="getting-started__tree" role="tree" aria-label="Cards to review">
              {gettingStartedTree.map((section) => {
                const sectionExpanded = expandedReviewIds.has(section.id);
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
                      onClick={() => toggleReviewNode(section.id)}
                    >
                      <button
                        type="button"
                        className="getting-started__tree-toggle"
                        aria-expanded={sectionExpanded}
                        aria-label={`${sectionExpanded ? "Collapse" : "Expand"} ${section.label}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleReviewNode(section.id);
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
                          const groupExpanded = expandedReviewIds.has(group.id);
                          const groupTitle = formatReviewGroupLabel(group, section);
                          const groupSummary = formatGroupQuantitySummary(
                            group,
                            coverage,
                            quantities,
                            DEFAULT_MANUAL_QUANTITY,
                          );
                          return (
                            <div key={group.id} role="treeitem" tabIndex={-1}>
                              {/* biome-ignore lint/a11y/useKeyWithClickEvents: row click mirrors dedicated expand button */}
                              {/* biome-ignore lint/a11y/noStaticElementInteractions: expand affordance also exposed via toggle button */}
                              <div
                                className="getting-started__tree-row is-group"
                                onClick={() => toggleReviewNode(group.id)}
                              >
                                <button
                                  type="button"
                                  className="getting-started__tree-toggle"
                                  aria-expanded={groupExpanded}
                                  aria-label={`${groupExpanded ? "Collapse" : "Expand"} ${groupTitle}`}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    toggleReviewNode(group.id);
                                  }}
                                >
                                  <span aria-hidden="true" />
                                </button>
                                <span>{groupTitle}</span>
                                <CoverageControl
                                  label={groupTitle}
                                  value={coverage[group.id]}
                                  onChange={(status) =>
                                    handleReviewGroupCoverage(group, section, status)
                                  }
                                />
                              </div>
                              {groupExpanded ? (
                                <>
                                  <GroupBulkActions
                                    groupLabel={groupTitle}
                                    summary={groupSummary}
                                    onSetAll={(quantity) => setGroupQuantities(group, quantity)}
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
                                      const quantityLabel = formatSkuQuantityAriaLabel({
                                        groupTitle,
                                        finishLabel:
                                          sku.card?.category === "nonsense" ? null : finishLabel,
                                        numberLabel,
                                        variantLabel,
                                      });
                                      const displayQuantity = getSkuDisplayQuantity(
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
                                          onAdjust={(delta) =>
                                            adjustSkuQuantity(sku.skuId, group.id, delta)
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
            <div className="getting-started__actions is-split">
              <button
                type="button"
                className="getting-started__button"
                onClick={() => setStep("profile")}
              >
                Back
              </button>
              <div className="getting-started__actions-primary">
                <p
                  className="getting-started__collection-summary"
                  role="status"
                  aria-label="Collection summary"
                >
                  {collectionSummary}
                </p>
                <button
                  type="button"
                  className="getting-started__button is-primary"
                  disabled={saving || collectionLoading}
                  onClick={handleSave}
                >
                  {saving ? "Saving collection..." : user ? "Save collection" : "Sign in and save"}
                </button>
              </div>
            </div>
          </>
        ) : null}

        {step === "spreadsheet" ? (
          <>
            <div className="getting-started__section-heading">
              <span>Spreadsheet import</span>
              <h2>Prepare your collection for bulk import.</h2>
              <p>
                The importer uses a CSV so it can match every row to a Lost Decks SKU before saving.
              </p>
            </div>
            <ol className="getting-started__import-steps">
              <li>
                <span>1</span>
                <div>
                  <strong>Download the template</strong>
                  <p>
                    It includes every supported SKU and the quantity column the importer expects.
                  </p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>Fill it in with your spreadsheet app</strong>
                  <p>Use Excel, Numbers, or Google Sheets. Keep the SKU ID column unchanged.</p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>Export as CSV and upload</strong>
                  <p>The collection page will validate and apply the rows in one update.</p>
                </div>
              </li>
            </ol>
            <div className="getting-started__actions is-split">
              <button
                type="button"
                className="getting-started__button"
                onClick={() => setStep("profile")}
              >
                Back
              </button>
              {user ? (
                <Link className="getting-started__button is-primary" to="/collections#bulk-import">
                  Go to bulk import
                </Link>
              ) : (
                <button
                  type="button"
                  className="getting-started__button is-primary"
                  onClick={() => openAuthModal({ reason: "getting-started-import" })}
                >
                  Sign in to import
                </button>
              )}
            </div>
          </>
        ) : null}
      </section>
      <NoneCoverageConfirmModal
        groupTitle={noneConfirmRequest?.groupTitle ?? ""}
        isOpen={noneConfirmRequest !== null}
        onConfirm={confirmNoneCoverage}
        onCancel={cancelNoneCoverage}
      />
    </main>
  );
}
