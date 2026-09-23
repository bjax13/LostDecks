import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SITE_NAME } from "../../brand.js";
import CollectionReviewEditor from "../../components/CollectionReviewEditor/CollectionReviewEditor.jsx";
import { useCollectionReviewEditor } from "../../components/CollectionReviewEditor/useCollectionReviewEditor.js";
import { useAuth } from "../../contexts/AuthContext";
import { useAuthModal } from "../../contexts/AuthModalContext.jsx";
import { useUserCollection } from "../Collection/hooks/useUserCollection";
import { applyBulkCollectionUpdate } from "../Collection/utils/bulkImport";
import {
  buildCollectionRows,
  COLLECTIBLE_TYPE_BOTH,
  COLLECTIBLE_TYPE_CARDS,
  COLLECTIBLE_TYPE_PINS,
  createCoverageState,
  DEFAULT_MANUAL_QUANTITY,
  filterGettingStartedTree,
  gettingStartedTree,
  includesPins,
} from "./gettingStartedCatalog";
import "./GettingStarted.css";

const COLLECTIBLE_OPTIONS = [
  {
    id: COLLECTIBLE_TYPE_PINS,
    title: "ChasmFriends Pins",
    description: "I only collect ChasmFriends pins.",
  },
  {
    id: COLLECTIBLE_TYPE_CARDS,
    title: "Story Deck Cards",
    description: "I only collect Story Deck cards.",
  },
  {
    id: COLLECTIBLE_TYPE_BOTH,
    title: "Both",
    description: "I collect pins and Story Deck cards.",
  },
];

const PROFILE_OPTIONS = [
  {
    id: "spreadsheet",
    title: "My collection is in a spreadsheet",
    description: "Prepare a CSV and use the bulk importer on your collection page.",
    cardsOnly: true,
  },
  {
    id: "manual",
    title: "My collection is not in a spreadsheet",
    description: "Start with zero selected, then mark the groups or cards you already own.",
  },
];

function StepIndicator({ step, profile, collectibleType, onSelectStep }) {
  const spreadsheet = profile === "spreadsheet";
  const reviewLabel = collectibleType === COLLECTIBLE_TYPE_PINS ? "Pin review" : "Card review";
  const steps = spreadsheet
    ? [
        { id: "profile", label: "About you" },
        { id: "spreadsheet", label: "Import guide" },
      ]
    : [
        { id: "profile", label: "About you" },
        { id: "manual", label: reviewLabel },
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
  const [collectibleType, setCollectibleType] = useState(null);
  const [profile, setProfile] = useState(null);
  const [coverage, setCoverage] = useState({});
  const [quantities, setQuantities] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const { entries, loading: collectionLoading } = useUserCollection(user?.uid ?? null);
  const navigate = useNavigate();

  const reviewTree = useMemo(
    () => filterGettingStartedTree(gettingStartedTree, collectibleType ?? COLLECTIBLE_TYPE_BOTH),
    [collectibleType],
  );

  const reviewEditor = useCollectionReviewEditor({
    reviewTree,
    collectibleType: collectibleType ?? COLLECTIBLE_TYPE_BOTH,
    coverage,
    setCoverage,
    quantities,
    setQuantities,
  });

  const spreadsheetDisabled = collectibleType === COLLECTIBLE_TYPE_PINS;

  const canContinueProfile = Boolean(
    collectibleType && profile && !(spreadsheetDisabled && profile === "spreadsheet"),
  );

  const selectCollectibleType = (nextType) => {
    setCollectibleType(nextType);
    if (nextType === COLLECTIBLE_TYPE_PINS) {
      setProfile("manual");
    }
  };

  const selectProfile = (nextProfile) => {
    if (spreadsheetDisabled && nextProfile === "spreadsheet") return;
    setProfile(nextProfile);
  };

  const beginManualReview = (nextCollectibleType = collectibleType) => {
    const tree = filterGettingStartedTree(
      gettingStartedTree,
      nextCollectibleType ?? COLLECTIBLE_TYPE_BOTH,
    );
    const newCoverage = createCoverageState("none", tree);
    setCoverage(newCoverage);
    setQuantities({});
    reviewEditor.resetExpandedReviewIds(newCoverage);
    setStep("manual");
  };

  const beginProfile = () => {
    if (!collectibleType || !profile) return;
    if (collectibleType === COLLECTIBLE_TYPE_PINS && profile === "spreadsheet") {
      setProfile("manual");
      beginManualReview(COLLECTIBLE_TYPE_PINS);
      return;
    }
    setError(null);
    if (profile === "spreadsheet") {
      setStep("spreadsheet");
      return;
    }
    beginManualReview(collectibleType);
  };

  const selectStep = (targetStep) => {
    if (targetStep === "profile") {
      setStep("profile");
      return;
    }

    if (targetStep === "manual") {
      setError(null);
      const nextCollectibleType = collectibleType ?? COLLECTIBLE_TYPE_BOTH;
      if (!collectibleType) {
        setCollectibleType(COLLECTIBLE_TYPE_BOTH);
      }
      if (
        !profile ||
        (nextCollectibleType === COLLECTIBLE_TYPE_PINS && profile === "spreadsheet")
      ) {
        setProfile("manual");
      }
      if (Object.keys(coverage).length === 0) {
        beginManualReview(nextCollectibleType);
        return;
      }
      reviewEditor.resetExpandedReviewIds(coverage);
      setStep("manual");
      return;
    }

    if (targetStep === "spreadsheet") {
      setStep("spreadsheet");
    }
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
          rows: buildCollectionRows(coverage, quantities, DEFAULT_MANUAL_QUANTITY, reviewTree),
          existingEntries: entries,
          allowPins: includesPins(collectibleType),
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

  const reviewHeading =
    collectibleType === COLLECTIBLE_TYPE_PINS
      ? "Review your pins"
      : collectibleType === COLLECTIBLE_TYPE_CARDS
        ? "Review your cards"
        : "Review your collection";
  const reviewIntro =
    collectibleType === COLLECTIBLE_TYPE_PINS
      ? "All and None are set to 1 and 0, but can be expanded for more granular edits. Selecting Some will proactively open the granular view."
      : "All and None are set to 1 and 0, but can be expanded for more granular edits. Selecting Some will proactively open the granular view.";

  return (
    <main className="getting-started">
      <header className="getting-started__header">
        <Link to="/" className="getting-started__back">
          Back to home
        </Link>
        <p className="getting-started__eyebrow">{SITE_NAME} setup</p>
        <h1>Build your collection without entering every card.</h1>
        <p>
          Tell us roughly what you own. We will only ask about the cards that need a closer look.
        </p>
      </header>

      <StepIndicator
        step={step}
        profile={profile}
        collectibleType={collectibleType}
        onSelectStep={selectStep}
      />

      <section className="getting-started__workspace" aria-live="polite">
        {step === "profile" ? (
          <>
            <div className="getting-started__section-heading">
              <span>Step 1</span>
              <h2>What best describes you?</h2>
              <p>Tell us what you collect, then choose how you want to start.</p>
            </div>

            <div className="getting-started__profile-block">
              <h3 className="getting-started__profile-question">Do you collect…</h3>
              <fieldset className="getting-started__profile-options is-three">
                <legend className="getting-started__sr-only">
                  Choose what collectibles you collect
                </legend>
                {COLLECTIBLE_OPTIONS.map((option) => (
                  <label
                    key={option.id}
                    className={collectibleType === option.id ? "is-selected" : ""}
                  >
                    <input
                      type="radio"
                      name="collectible-type"
                      value={option.id}
                      checked={collectibleType === option.id}
                      aria-label={option.title}
                      onChange={() => selectCollectibleType(option.id)}
                    />
                    <span>
                      <strong aria-hidden="true">{option.title}</strong>
                      <small>{option.description}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
            </div>

            {collectibleType ? (
              <div className="getting-started__profile-block">
                <h3 className="getting-started__profile-question">
                  {collectibleType === COLLECTIBLE_TYPE_PINS
                    ? "How do you want to set up your pins?"
                    : "How is your collection stored?"}
                </h3>
                <fieldset className="getting-started__profile-options">
                  <legend className="getting-started__sr-only">
                    Choose a collection starting point
                  </legend>
                  {PROFILE_OPTIONS.map((option) => {
                    const optionDisabled = spreadsheetDisabled && option.cardsOnly;
                    const labelClassName = [
                      profile === option.id && !optionDisabled ? "is-selected" : null,
                      optionDisabled ? "is-disabled" : null,
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <label key={option.id} className={labelClassName || undefined}>
                        <input
                          type="radio"
                          name="profile"
                          value={option.id}
                          checked={profile === option.id}
                          disabled={optionDisabled}
                          aria-label={option.title}
                          onChange={() => selectProfile(option.id)}
                        />
                        <span>
                          <strong aria-hidden="true">{option.title}</strong>
                          <small>
                            {optionDisabled
                              ? "Spreadsheet import is for Story Deck cards only."
                              : collectibleType === COLLECTIBLE_TYPE_PINS && option.id === "manual"
                                ? "Start with zero selected, then mark the pins you already own."
                                : option.description}
                          </small>
                        </span>
                      </label>
                    );
                  })}
                </fieldset>
              </div>
            ) : null}

            <div className="getting-started__actions">
              <button
                type="button"
                className="getting-started__button is-primary"
                disabled={!canContinueProfile}
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
              <h2>{reviewHeading}</h2>
              <p>{reviewIntro}</p>
            </div>
            <CollectionReviewEditor
              reviewTree={reviewTree}
              collectibleType={collectibleType ?? COLLECTIBLE_TYPE_BOTH}
              editor={reviewEditor}
              error={error}
              footerStart={
                <button
                  type="button"
                  className="getting-started__button"
                  onClick={() => setStep("profile")}
                >
                  Back
                </button>
              }
              footerPrimary={
                <button
                  type="button"
                  className="getting-started__button is-primary"
                  disabled={saving || collectionLoading}
                  onClick={handleSave}
                >
                  {saving ? "Saving collection..." : user ? "Save collection" : "Sign in and save"}
                </button>
              }
            />
          </>
        ) : null}

        {step === "spreadsheet" ? (
          <>
            <div className="getting-started__section-heading">
              <span>Spreadsheet import</span>
              <h2>Prepare your collection for bulk import.</h2>
              <p>
                The importer uses a CSV so it can match every row to a {SITE_NAME} SKU before
                saving.
                {includesPins(collectibleType)
                  ? " Story Deck card rows are supported here; add ChasmFriends pins later from your collection or by restarting Getting Started with Pins."
                  : null}
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
    </main>
  );
}
