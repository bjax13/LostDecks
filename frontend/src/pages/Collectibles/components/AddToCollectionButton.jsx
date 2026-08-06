import { useEffect, useMemo, useState } from "react";
import { useAuthModal } from "../../../contexts/AuthModalContext.jsx";
import { resolveSkuId } from "../../../data/collectibles";
import { useCollectionQuantityMutations } from "../hooks/useCollectionQuantityMutations";
import { getOwnedQuantity } from "../utils/ownedQuantities";

const successMessage = "Added to your collection!";
const errorMessage = "Couldn't update collection. Please try again.";

export function formatFinishLabel(finish) {
  if (!finish || typeof finish !== "string") {
    return "";
  }
  const lower = finish.toLowerCase();
  return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
}

function isPinCollectible(item) {
  return item?.collectibleType === "pin" || item?.category === "pin";
}

export function formatOwnedAddLabel({ label, ownedQuantity, isPin = false }) {
  if (ownedQuantity > 0) {
    return isPin ? `Owned · x${ownedQuantity}` : `${label} · x${ownedQuantity}`;
  }
  return isPin ? "Add to collection" : `Add ${label}`;
}

export function formatOwnedQuantityLabel({ label, ownedQuantity, isPin = false }) {
  if (isPin) {
    return `Owned · x${ownedQuantity}`;
  }
  return `${label} · x${ownedQuantity}`;
}

export default function AddToCollectionButton({
  collectible,
  card,
  variant = "card",
  ownedBySkuId = {},
  deleteWhenZero = true,
  onQuantityChange,
}) {
  const item = collectible ?? card;
  const { addToCollection, decrementFromCollection, status, error, user, reset } =
    useCollectionQuantityMutations();
  const { openAuthModal } = useAuthModal();
  const [feedback, setFeedback] = useState(null);
  const [pendingFinish, setPendingFinish] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [lastFinish, setLastFinish] = useState(null);
  const [lastAction, setLastAction] = useState(null);
  const [pendingPinAdd, setPendingPinAdd] = useState(false);

  const isPin = isPinCollectible(item);
  const finishes = useMemo(() => item?.finishes ?? [], [item]);
  const availableFinishes = useMemo(
    () =>
      finishes.reduce((acc, finish) => {
        acc[finish] = true;
        return acc;
      }, {}),
    [finishes],
  );
  const pinOwnedQuantity = useMemo(
    () => (isPin ? getOwnedQuantity(ownedBySkuId, item, null) : 0),
    [isPin, item, ownedBySkuId],
  );
  const pinSkuId = useMemo(() => (isPin && item ? resolveSkuId(item, null) : null), [isPin, item]);
  const pinHasSoftZero = Boolean(
    isPin && pinSkuId && Object.hasOwn(ownedBySkuId, pinSkuId) && pinOwnedQuantity === 0,
  );

  useEffect(() => {
    if (!item) return;
    setFeedback(null);
    setPendingFinish(null);
    setLastFinish(null);
    setPendingPinAdd(false);
    setPendingAction(null);
    setLastAction(null);
    reset();
  }, [item, reset]);

  useEffect(() => {
    if (status === "success") {
      const finishLabel = lastFinish ? formatFinishLabel(lastFinish) : null;
      let message = successMessage;
      if (lastAction === "decrement") {
        message = finishLabel ? `Removed one ${finishLabel}.` : "Removed one from your collection.";
      } else if (finishLabel) {
        message = `Added ${finishLabel} to your collection!`;
      }
      setFeedback({
        type: "success",
        message,
      });
      const timer = setTimeout(() => {
        setFeedback(null);
        reset();
      }, 2500);
      return () => clearTimeout(timer);
    }

    if (status === "error") {
      setFeedback({ type: "error", message: errorMessage });
    }

    return undefined;
  }, [status, reset, lastFinish, lastAction]);

  useEffect(() => () => reset(), [reset]);

  useEffect(() => {
    if (status !== "loading") {
      setPendingFinish(null);
      setPendingPinAdd(false);
    }
  }, [status]);

  const notifyQuantityChange = (result) => {
    if (typeof onQuantityChange === "function" && result?.skuId != null) {
      onQuantityChange({
        skuId: result.skuId,
        quantity: result.quantity ?? 0,
        deleted: Boolean(result.deleted),
      });
    }
  };

  const requireUser = () => {
    if (!user) {
      openAuthModal({ reason: "add-to-collection" });
      return false;
    }
    return true;
  };

  const handleAdd = async (finish) => {
    if (!item) return;
    if (!requireUser()) return;

    try {
      if (finish) {
        setPendingFinish(finish);
        setLastFinish(finish);
      } else {
        setPendingPinAdd(true);
        setLastFinish(null);
      }
      setPendingAction("add");
      setLastAction("add");
      setFeedback(null);
      const result = await addToCollection({
        card: item,
        finish: finish ?? null,
        quantity: 1,
      });
      notifyQuantityChange(result);
    } catch (err) {
      if (err?.code === "auth-required") {
        openAuthModal({ reason: "add-to-collection" });
      } else {
        setFeedback({ type: "error", message: errorMessage });
      }
    }
  };

  const handleDecrement = async (finish) => {
    if (!item) return;
    if (!requireUser()) return;

    try {
      if (finish) {
        setPendingFinish(finish);
        setLastFinish(finish);
      } else {
        setPendingPinAdd(true);
        setLastFinish(null);
      }
      setPendingAction("decrement");
      setLastAction("decrement");
      setFeedback(null);
      const result = await decrementFromCollection({
        card: item,
        finish: finish ?? null,
        quantity: 1,
        deleteWhenZero,
      });
      notifyQuantityChange(result);
    } catch (err) {
      if (err?.code === "auth-required") {
        openAuthModal({ reason: "add-to-collection" });
      } else {
        setFeedback({ type: "error", message: errorMessage });
      }
    }
  };

  const isLoading = status === "loading";
  const finishButtons = useMemo(
    () =>
      ["DUN", "FOIL"]
        .filter((finish) => availableFinishes[finish])
        .map((finish) => {
          const label = formatFinishLabel(finish);
          const skuId = resolveSkuId(item, finish);
          const ownedQuantity = getOwnedQuantity(ownedBySkuId, item, finish);
          const hasExplicitZero =
            Boolean(skuId) && Object.hasOwn(ownedBySkuId, skuId) && ownedQuantity === 0;
          const showStepper = ownedQuantity > 0 || hasExplicitZero;
          return {
            finish,
            label,
            ownedQuantity,
            showStepper,
            buttonLabel: formatOwnedAddLabel({ label, ownedQuantity }),
            quantityLabel: formatOwnedQuantityLabel({ label, ownedQuantity }),
          };
        }),
    [availableFinishes, item, ownedBySkuId],
  );

  const pinButtonLabel = formatOwnedAddLabel({
    label: "Add to collection",
    ownedQuantity: pinOwnedQuantity,
    isPin: true,
  });
  const pinQuantityLabel = formatOwnedQuantityLabel({
    label: "Owned",
    ownedQuantity: pinOwnedQuantity,
    isPin: true,
  });
  const showPinStepper = pinOwnedQuantity > 0 || pinHasSoftZero;

  const renderStepper = ({
    key,
    quantityLabel,
    ownedQuantity,
    onDecrement,
    onIncrement,
    loadingLabel,
    isPending,
  }) => (
    <div key={key} className="add-to-collection__stepper">
      <button
        type="button"
        className="add-to-collection__button add-to-collection__button--step"
        onClick={onDecrement}
        disabled={isLoading || ownedQuantity <= 0}
        aria-label={`Decrease ${quantityLabel}`}
      >
        {isLoading && isPending && pendingAction === "decrement" ? "…" : "−"}
      </button>
      <span className="add-to-collection__quantity" aria-live="polite">
        {isLoading && isPending ? loadingLabel : quantityLabel}
      </span>
      <button
        type="button"
        className="add-to-collection__button add-to-collection__button--step"
        onClick={onIncrement}
        disabled={isLoading}
        aria-label={`Increase ${quantityLabel}`}
      >
        {isLoading && isPending && pendingAction === "add" ? "…" : "+"}
      </button>
    </div>
  );

  return (
    <div className={`add-to-collection add-to-collection--${variant}`}>
      {isPin ? (
        <div className="add-to-collection__buttons">
          {showPinStepper ? (
            renderStepper({
              key: "pin",
              quantityLabel: pinQuantityLabel,
              ownedQuantity: pinOwnedQuantity,
              onDecrement: () => handleDecrement(null),
              onIncrement: () => handleAdd(null),
              loadingLabel: "Updating…",
              isPending: pendingPinAdd,
            })
          ) : (
            <button
              type="button"
              className="add-to-collection__button"
              onClick={() => handleAdd(null)}
              disabled={isLoading}
            >
              {isLoading && pendingPinAdd ? "Adding…" : pinButtonLabel}
            </button>
          )}
        </div>
      ) : finishButtons.length > 0 ? (
        <div className="add-to-collection__buttons">
          {finishButtons.map(
            ({ finish, label, buttonLabel, quantityLabel, ownedQuantity, showStepper }) =>
              showStepper ? (
                renderStepper({
                  key: finish,
                  quantityLabel,
                  ownedQuantity,
                  onDecrement: () => handleDecrement(finish),
                  onIncrement: () => handleAdd(finish),
                  loadingLabel: `Updating ${label}…`,
                  isPending: pendingFinish === finish,
                })
              ) : (
                <button
                  key={finish}
                  type="button"
                  className="add-to-collection__button"
                  onClick={() => handleAdd(finish)}
                  disabled={isLoading}
                >
                  {isLoading && pendingFinish === finish ? `Adding ${label}…` : buttonLabel}
                </button>
              ),
          )}
        </div>
      ) : (
        <span className="add-to-collection__feedback add-to-collection__feedback--details">
          No finishes available
        </span>
      )}

      {feedback ? (
        <span
          className={`add-to-collection__feedback add-to-collection__feedback--${feedback.type}`}
        >
          {feedback.message}
        </span>
      ) : null}

      {status === "error" && error?.code && error.code !== "auth-required" ? (
        <span className="add-to-collection__feedback add-to-collection__feedback--error add-to-collection__feedback--details">
          {error.message ?? "Unexpected error"}
        </span>
      ) : null}
    </div>
  );
}
