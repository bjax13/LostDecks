import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  GETTING_STARTED_SAVED,
  GETTING_STARTED_STEP,
  SIGN_IN_PROMPTED,
} from "../../analytics/events.js";
import { captureEvent } from "../../analytics/posthog.js";
import { SITE_NAME } from "../../brand.js";
import CollectionReviewEditor from "../../components/CollectionReviewEditor/CollectionReviewEditor.jsx";
import { useCollectionReviewEditor } from "../../components/CollectionReviewEditor/useCollectionReviewEditor.js";
import { useAuth } from "../../contexts/AuthContext";
import { useAuthModal } from "../../contexts/AuthModalContext.jsx";
import { decodeHavePrefill } from "../../lib/havePrefill.js";
import { mergePickRows, savePendingPicks } from "../../lib/pendingPicks.js";
import pinsCatalog from "../../storyData/pins-catalog.json";
import { useUserCollection } from "../Collection/hooks/useUserCollection";
import { applyBulkCollectionUpdate } from "../Collection/utils/bulkImport";
import { collectionEntriesHydrationKey } from "../Collection/utils/collectionEntrySku.js";
import {
  buildGettingStartedNonDestructiveSaveRows,
  COLLECTIBLE_TYPE_BOTH,
  COLLECTIBLE_TYPE_CARDS,
  COLLECTIBLE_TYPE_PINS,
  createCoverageState,
  deriveReviewStateFromEntries,
  filterChasmFriendsTree,
  filterGettingStartedTree,
  gettingStartedTree,
  includesPins,
} from "./gettingStartedCatalog";
import "./GettingStarted.css";
import QuickPinPicker from "./QuickPinPicker.jsx";

function seriesMembershipFromTree(tree) {
  const pinsSection = tree.find((section) => section.id === "pins");
  return (pinsSection?.children ?? []).map((group) => ({
    id: group.id,
    skuIds: group.skus.map((sku) => sku.skuId),
  }));
}

const HAVE_PREFILL_CONTEXT = {
  catalogSkuIds: pinsCatalog.pins.map((pin) => pin.id),
  seriesList: seriesMembershipFromTree(gettingStartedTree),
};

const COLLECTIBLE_OPTIONS = [
  {
    id: COLLECTIBLE_TYPE_PINS,
    title: "Pins",
    description: "I only collect enamel pins.",
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

const VALID_COLLECT_PARAMS = new Set([
  COLLECTIBLE_TYPE_PINS,
  COLLECTIBLE_TYPE_CARDS,
  COLLECTIBLE_TYPE_BOTH,
]);

const CHASM_FRIENDS_PINS_PARAM = "chasmfriends";
const PIN_REVIEW_INTRO =
  "All and None are set to 1 and 0, but can be expanded for more granular edits. Selecting Some will proactively open the granular view.";

function isChasmFriendsParam(searchParams) {
  return searchParams.get("pins") === CHASM_FRIENDS_PINS_PARAM;
}

function isFullPinReviewParam(searchParams) {
  return searchParams.get("pins") === "all";
}

function expandedIdsForTree(tree) {
  const ids = new Set();
  for (const section of tree) {
    ids.add(section.id);
    for (const group of section.children) {
      ids.add(group.id);
    }
  }
  return ids;
}

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
  const [searchParams] = useSearchParams();
  const fullPinReview = isFullPinReviewParam(searchParams);
  const chasmFriendsShortcut = isChasmFriendsParam(searchParams);
  const [step, setStep] = useState(chasmFriendsShortcut || fullPinReview ? "manual" : "profile");
  const [collectibleType, setCollectibleType] = useState(
    chasmFriendsShortcut || fullPinReview ? COLLECTIBLE_TYPE_PINS : null,
  );
  const [profile, setProfile] = useState(chasmFriendsShortcut || fullPinReview ? "manual" : null);
  const [coverage, setCoverage] = useState(() => {
    if (chasmFriendsShortcut) return createCoverageState("none", filterChasmFriendsTree());
    if (fullPinReview) {
      return createCoverageState(
        "none",
        filterGettingStartedTree(gettingStartedTree, COLLECTIBLE_TYPE_PINS),
      );
    }
    return {};
  });
  const [quantities, setQuantities] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [chasmSaved, setChasmSaved] = useState(false);
  const urlBootstrappedRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const chasmTrackedRef = useRef(false);
  const collectionSeedPendingRef = useRef(false);
  const collectionHydratedRef = useRef(false);
  const hydratedEntriesKeyRef = useRef("");
  const hydratedSeedQuantitiesRef = useRef({});
  const explicitZeroGroupIdsRef = useRef(new Set());
  const sessionScopedGroupIdsRef = useRef(new Set());
  const fullPinReviewSeededRef = useRef(false);
  const manualReviewCollectibleTypeRef = useRef(null);
  const hydratedOwnerUidRef = useRef(null);
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const {
    entries,
    status: collectionStatus,
    error: collectionError,
  } = useUserCollection(user?.uid ?? null);
  const collectionLoading = collectionStatus === "loading";
  const collectionReady = collectionStatus === "ready";
  const navigate = useNavigate();

  const haveRaw = searchParams.get("have");
  const havePrefill = useMemo(() => decodeHavePrefill(haveRaw, HAVE_PREFILL_CONTEXT), [haveRaw]);

  const reviewTree = useMemo(() => {
    if (chasmFriendsShortcut) return filterChasmFriendsTree();
    return filterGettingStartedTree(gettingStartedTree, collectibleType ?? COLLECTIBLE_TYPE_BOTH);
  }, [chasmFriendsShortcut, collectibleType]);

  const reviewEditor = useCollectionReviewEditor({
    reviewTree,
    collectibleType: collectibleType ?? COLLECTIBLE_TYPE_BOTH,
    coverage,
    setCoverage,
    quantities,
    setQuantities,
    initialExpandedReviewIds: chasmFriendsShortcut ? expandedIdsForTree(reviewTree) : null,
    onReviewGroupScoped: (groupId) => {
      sessionScopedGroupIdsRef.current.add(groupId);
    },
    onReviewGroupExplicitNone: (groupId) => {
      explicitZeroGroupIdsRef.current.add(groupId);
    },
  });

  const spreadsheetDisabled = collectibleType === COLLECTIBLE_TYPE_PINS;

  const canContinueProfile = Boolean(
    collectibleType && profile && !(spreadsheetDisabled && profile === "spreadsheet"),
  );

  const goToStep = (nextStep, nextCollectibleType = collectibleType) => {
    setStep(nextStep);
    captureEvent(GETTING_STARTED_STEP, {
      step: nextStep,
      collectibleType: nextCollectibleType,
    });
  };

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

  const resolveCollectionSeedSource = () => {
    if (!user?.uid) {
      collectionSeedPendingRef.current = false;
      return null;
    }
    if (collectionStatus !== "ready") {
      collectionSeedPendingRef.current = true;
      return undefined;
    }
    collectionSeedPendingRef.current = false;
    return entries ?? [];
  };

  const applyManualReviewSeed = (tree, sourceEntries) => {
    if (sourceEntries === undefined) {
      return;
    }
    if (sourceEntries === null) {
      collectionHydratedRef.current = false;
      hydratedSeedQuantitiesRef.current = {};
      const newCoverage = createCoverageState("none", tree);
      setCoverage(newCoverage);
      setQuantities({});
      reviewEditor.resetExpandedReviewIds(newCoverage);
      return;
    }

    const seeded = deriveReviewStateFromEntries(sourceEntries, tree);
    setCoverage(seeded.coverage);
    setQuantities(seeded.quantities);
    reviewEditor.resetExpandedReviewIds(seeded.coverage);
    hydratedSeedQuantitiesRef.current = { ...seeded.quantities };
    hydratedEntriesKeyRef.current = collectionEntriesHydrationKey(sourceEntries);
    collectionHydratedRef.current = true;
    collectionSeedPendingRef.current = false;
    manualReviewCollectibleTypeRef.current = collectibleType ?? COLLECTIBLE_TYPE_BOTH;
    hydratedOwnerUidRef.current = user?.uid ?? null;
  };

  const resetManualReviewSessionScopes = () => {
    explicitZeroGroupIdsRef.current = new Set();
    sessionScopedGroupIdsRef.current = new Set();
  };

  const resetReviewStateForOwnerChange = () => {
    resetManualReviewSessionScopes();
    collectionHydratedRef.current = false;
    collectionSeedPendingRef.current = Boolean(user?.uid);
    hydratedEntriesKeyRef.current = "";
    hydratedSeedQuantitiesRef.current = {};
    manualReviewCollectibleTypeRef.current = null;
    hydratedOwnerUidRef.current = null;

    setCoverage({});
    setQuantities({});
    reviewEditor.resetExpandedReviewIds({});
  };

  const seedManualReviewForTree = (tree) => {
    const source = resolveCollectionSeedSource();
    if (source === undefined) {
      return;
    }
    applyManualReviewSeed(tree, source);
  };

  const beginManualReview = (nextCollectibleType = collectibleType) => {
    const type = nextCollectibleType ?? COLLECTIBLE_TYPE_BOTH;
    const tree = filterGettingStartedTree(gettingStartedTree, type);
    const ownerUid = user?.uid ?? null;
    const sameOwner = hydratedOwnerUidRef.current === ownerUid;
    const userScopedReview =
      sessionScopedGroupIdsRef.current.size > 0 || explicitZeroGroupIdsRef.current.size > 0;
    const hasExistingReview =
      Object.keys(coverage).length > 0 &&
      (userScopedReview || (collectionHydratedRef.current && sameOwner));
    const sameCollectibleScope = manualReviewCollectibleTypeRef.current === type;

    if (!hasExistingReview || !sameCollectibleScope) {
      resetManualReviewSessionScopes();
      seedManualReviewForTree(tree);
      manualReviewCollectibleTypeRef.current = type;
    }

    goToStep("manual", type);
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
      goToStep("spreadsheet");
      return;
    }
    beginManualReview(collectibleType);
  };

  const selectStep = (targetStep) => {
    if (targetStep === "profile") {
      goToStep("profile");
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
      beginManualReview(nextCollectibleType);
      return;
    }

    if (targetStep === "spreadsheet") {
      goToStep("spreadsheet");
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: bootstrap once from collect URL param
  useEffect(() => {
    if (urlBootstrappedRef.current) return;
    if (isChasmFriendsParam(searchParams)) {
      urlBootstrappedRef.current = true;
      return;
    }
    const collect = searchParams.get("collect");
    if (!VALID_COLLECT_PARAMS.has(collect)) {
      return;
    }
    urlBootstrappedRef.current = true;
    setCollectibleType(collect);
    setProfile("manual");
    setError(null);
    if (collect === COLLECTIBLE_TYPE_PINS) {
      goToStep("quick", collect);
      return;
    }
    beginManualReview(collect);
  }, [searchParams]);

  useEffect(() => {
    if (!chasmFriendsShortcut || chasmTrackedRef.current) return;
    chasmTrackedRef.current = true;
    captureEvent(GETTING_STARTED_STEP, {
      step: "manual",
      collectibleType: COLLECTIBLE_TYPE_PINS,
    });
  }, [chasmFriendsShortcut]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: pins=all lands on manual without beginManualReview
  useEffect(() => {
    if (!fullPinReview || chasmFriendsShortcut || fullPinReviewSeededRef.current) {
      return;
    }
    if (step !== "manual") {
      return;
    }
    fullPinReviewSeededRef.current = true;
    const tree = filterGettingStartedTree(gettingStartedTree, COLLECTIBLE_TYPE_PINS);
    seedManualReviewForTree(tree);
  }, [fullPinReview, chasmFriendsShortcut, step]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: drop hydrated review when auth uid changes
  useEffect(() => {
    const uid = user?.uid ?? null;
    const seededUid = hydratedOwnerUidRef.current;

    if (seededUid === uid) {
      return;
    }

    if (seededUid !== null && seededUid !== uid) {
      resetReviewStateForOwnerChange();
    }
  }, [user?.uid]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: hydrate manual review when auth/collection resolve
  useEffect(() => {
    if (step !== "manual" || collectionStatus !== "ready" || chasmFriendsShortcut) {
      return;
    }

    if (!user?.uid) {
      collectionSeedPendingRef.current = true;
      return;
    }

    const hasEntries = (entries?.length ?? 0) > 0;
    const hydrationKey = collectionEntriesHydrationKey(entries ?? []);
    const userTouchedReview =
      sessionScopedGroupIdsRef.current.size > 0 || explicitZeroGroupIdsRef.current.size > 0;
    const entriesChangedSinceHydrate =
      hydrationKey.length > 0 && hydrationKey !== hydratedEntriesKeyRef.current;
    const shouldHydrate =
      collectionSeedPendingRef.current ||
      (!collectionHydratedRef.current && hasEntries) ||
      (!userTouchedReview && entriesChangedSinceHydrate);
    if (!shouldHydrate) {
      return;
    }

    if (!hasEntries && !collectionSeedPendingRef.current) {
      return;
    }

    collectionSeedPendingRef.current = false;
    applyManualReviewSeed(reviewTree, entries ?? []);
  }, [step, collectionStatus, entries, reviewTree, user]);

  const handleSave = async () => {
    if (user && !collectionReady) {
      return;
    }
    if (!user) {
      pendingSaveRef.current = true;
      captureEvent(SIGN_IN_PROMPTED, { reason: "getting-started-save" });
      openAuthModal({
        reason: "getting-started-save",
        initialMode: "register",
        onSuccess: () => {
          pendingSaveRef.current = true;
        },
      });
      return;
    }

    setSaving(true);
    setError(null);
    let timeoutId = null;
    try {
      const saveTimeoutMs = 20000;
      const result = await Promise.race([
        applyBulkCollectionUpdate({
          ownerUid: user.uid,
          rows: buildGettingStartedNonDestructiveSaveRows(
            coverage,
            quantities,
            reviewTree,
            entries ?? [],
          ),
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
      pendingSaveRef.current = false;
      captureEvent(GETTING_STARTED_SAVED, {
        collectibleType,
        created: result?.created ?? 0,
        updated: result?.updated ?? 0,
        deleted: result?.deleted ?? 0,
      });
      if (chasmFriendsShortcut) {
        setChasmSaved(true);
      } else {
        navigate("/collections", { state: { onboardingComplete: true } });
      }
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: retry save once after auth modal success
  useEffect(() => {
    if (!user || !pendingSaveRef.current || saving || !collectionReady) {
      return;
    }
    pendingSaveRef.current = false;
    void handleSave();
  }, [user, saving, collectionReady]);

  const handleQuickPickerSubmit = async (pickQuantities) => {
    const source = {
      utm_source: searchParams.get("utm_source"),
      utm_campaign: searchParams.get("utm_campaign"),
    };

    if (!user) {
      savePendingPicks(pickQuantities, source);
      openAuthModal({
        reason: "qr-picks",
        initialMode: "register",
      });
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const rows = mergePickRows(pickQuantities, entries);
      if (rows.length > 0) {
        await applyBulkCollectionUpdate({
          ownerUid: user.uid,
          rows,
          existingEntries: entries,
          allowPins: true,
        });
      }
      navigate("/matches?welcome=1");
    } catch (saveError) {
      console.error("Quick pin picker save failed", saveError);
      setError(saveError.message ?? "We could not update your collection. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const openFullPinReview = () => {
    setCollectibleType(COLLECTIBLE_TYPE_PINS);
    setProfile("manual");
    setChasmSaved(false);
    const tree = filterGettingStartedTree(gettingStartedTree, COLLECTIBLE_TYPE_PINS);
    seedManualReviewForTree(tree);
    goToStep("manual", COLLECTIBLE_TYPE_PINS);
  };

  const markAllChasmFriends = () => {
    const section = reviewTree.find((entry) => entry.id === "pins");
    const group = section?.children.find((entry) => entry.label === "ChasmFriends");
    if (!section || !group) return;
    reviewEditor.handleReviewGroupCoverage(group, section, "all");
  };

  const reviewHeading =
    collectibleType === COLLECTIBLE_TYPE_PINS
      ? "Review your pins"
      : collectibleType === COLLECTIBLE_TYPE_CARDS
        ? "Review your cards"
        : "Review your collection";
  const reviewIntro = PIN_REVIEW_INTRO;

  const isQuickStep = step === "quick";

  return (
    <main className="getting-started">
      <header className="getting-started__header">
        <Link to="/" className="getting-started__back">
          Back to home
        </Link>
        <p className="getting-started__eyebrow">{SITE_NAME} setup</p>
        <h1>
          {chasmFriendsShortcut
            ? "which chasm friends do you have?"
            : isQuickStep
              ? "Mark what you have, then find trades."
              : "Build your collection without entering every card."}
        </h1>
        <p>
          {chasmFriendsShortcut
            ? PIN_REVIEW_INTRO
            : isQuickStep
              ? "Scan the QR, mark Need / Have / Have spares, and jump into Matches after you sign up."
              : "Tell us roughly what you own. We will only ask about the cards that need a closer look."}
        </p>
        {chasmFriendsShortcut && !chasmSaved ? (
          <button
            type="button"
            className="getting-started__button is-primary getting-started__chasm-all"
            onClick={markAllChasmFriends}
          >
            i have all 5
          </button>
        ) : null}
        {chasmFriendsShortcut && chasmSaved ? (
          <div className="getting-started__chasm-done">
            <Link className="getting-started__button is-primary" to="/matches">
              done. see who needs yours
            </Link>
            <Link
              className="getting-started__chasm-more"
              to="/getting-started?pins=all"
              onClick={openFullPinReview}
            >
              add the rest of your pins
            </Link>
          </div>
        ) : null}
      </header>

      {!isQuickStep && !chasmFriendsShortcut ? (
        <StepIndicator
          step={step}
          profile={profile}
          collectibleType={collectibleType}
          onSelectStep={selectStep}
        />
      ) : null}

      <section className="getting-started__workspace" aria-live="polite">
        {isQuickStep ? (
          <QuickPinPicker
            entries={entries}
            collectionLoading={collectionLoading}
            collectionReady={collectionReady}
            saving={saving}
            error={error}
            isSignedIn={Boolean(user)}
            prefill={havePrefill}
            onSubmit={handleQuickPickerSubmit}
          />
        ) : null}

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
            {chasmFriendsShortcut ? null : (
              <div className="getting-started__section-heading">
                <span>Step 2</span>
                <h2>{reviewHeading}</h2>
                <p>{reviewIntro}</p>
              </div>
            )}
            {user && collectionLoading ? (
              <div
                className="getting-started__collection-loading"
                role="status"
                aria-live="polite"
                aria-busy="true"
              >
                <div className="getting-started__collection-loading-spinner" aria-hidden="true" />
                <p>Loading your saved collection…</p>
              </div>
            ) : (
              <CollectionReviewEditor
                reviewTree={reviewTree}
                collectibleType={collectibleType ?? COLLECTIBLE_TYPE_BOTH}
                editor={reviewEditor}
                error={error ?? (collectionStatus === "error" ? collectionError?.message : null)}
                footerStart={
                  chasmFriendsShortcut ? null : (
                    <button
                      type="button"
                      className="getting-started__button"
                      onClick={() => setStep("profile")}
                    >
                      Back
                    </button>
                  )
                }
                footerPrimary={
                  chasmFriendsShortcut && chasmSaved ? null : (
                    <button
                      type="button"
                      className="getting-started__button is-primary"
                      disabled={saving || (user && !collectionReady)}
                      onClick={handleSave}
                    >
                      {saving
                        ? "Saving collection..."
                        : user
                          ? "Save collection"
                          : "Sign in and save"}
                    </button>
                  )
                }
              />
            )}
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
                  ? " Story Deck card rows are supported here; add pins later from your collection or by restarting Getting Started with Pins."
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
