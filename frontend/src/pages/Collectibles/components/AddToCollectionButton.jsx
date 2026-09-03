import { useEffect, useMemo, useState } from "react";
import { useAuthModal } from "../../../contexts/AuthModalContext.jsx";
import { useAddToCollection } from "../hooks/useAddToCollection";
import { getOwnedQuantity } from "../utils/ownedQuantities";

const successMessage = "Added to your collection!";
const removedMessage = "Removed from your collection.";
const errorMessage = "Couldn't add collectible. Please try again.";
const removeErrorMessage = "Couldn't update quantity. Please try again.";

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

export default function AddToCollectionButton({
  collectible,
  card,
  variant = "card",
  ownedBySkuId = {},
}) {
  const item = collectible ?? card;
  const { addToCollection, decrementFromCollection, status, error, user, reset } =
    useAddToCollection();
  const { openAuthModal } = useAuthModal();
  const [feedback, setFeedback] = useState(null);
  const [pendingFinish, setPendingFinish] = useState(null);
  const [lastFinish, setLastFinish] = useState(null);
  const [pendingPinAdd, setPendingPinAdd] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [lastAction, setLastAction] = useState("add");

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

  useEffect(() => {
    if (!item) return;
    setFeedback(null);
    setPendingFinish(null);
    setLastFinish(null);
    setPendingPinAdd(false);
    setPendingAction(null);
    setLastAction("add");
    reset();
  }, [item, reset]);

  useEffect(() => {
    if (status === "success") {
      const finishLabel = lastFinish ? formatFinishLabel(lastFinish) : null;
      const removed = lastAction === "remove";
      let message = successMessage;
      if (removed) {
        message = finishLabel ? `Removed ${finishLabel} from your collection.` : removedMessage;
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
      setFeedback({
        type: "error",
        message: lastAction === "remove" ? removeErrorMessage : errorMessage,
      });
    }

    return undefined;
  }, [status, reset, lastFinish, lastAction]);

  useEffect(() => () => reset(), [reset]);

  useEffect(() => {
    if (status !== "loading") {
      setPendingFinish(null);
      setPendingPinAdd(false);
      setPendingAction(null);
    }
  }, [status]);

  const runAuthenticatedAction = async ({ finish, action }) => {
    if (!item) return;

    if (!user) {
      openAuthModal({ reason: "add-to-collection" });
      return;
    }

    try {
      if (finish) {
        setPendingFinish(finish);
        setLastFinish(finish);
      } else {
        setPendingPinAdd(true);
        setLastFinish(null);
      }
      setPendingAction(action);
      setLastAction(action);
      setFeedback(null);
      if (action === "remove") {
        await decrementFromCollection({
          card: item,
          finish: finish ?? null,
        });
      } else {
        await addToCollection({
          card: item,
          finish: finish ?? null,
          quantity: 1,
        });
      }
    } catch (err) {
      if (err?.code === "auth-required") {
        openAuthModal({ reason: "add-to-collection" });
      } else {
        setFeedback({
          type: "error",
          message: action === "remove" ? removeErrorMessage : errorMessage,
        });
      }
    }
  };

  const handleAdd = (finish) => runAuthenticatedAction({ finish, action: "add" });
  const handleRemove = (finish) => runAuthenticatedAction({ finish, action: "remove" });

  const isLoading = status === "loading";
  const finishButtons = useMemo(
    () =>
      ["DUN", "FOIL"]
        .filter((finish) => availableFinishes[finish])
        .map((finish) => {
          const label = formatFinishLabel(finish);
          const ownedQuantity = getOwnedQuantity(ownedBySkuId, item, finish);
          return {
            finish,
            label,
            ownedQuantity,
            buttonLabel: formatOwnedAddLabel({ label, ownedQuantity }),
          };
        }),
    [availableFinishes, item, ownedBySkuId],
  );

  const pinButtonLabel = formatOwnedAddLabel({
    label: "Add to collection",
    ownedQuantity: pinOwnedQuantity,
    isPin: true,
  });

  const renderRemoveButton = ({ finish, label, ownedQuantity, isPinButton = false }) => {
    if (ownedQuantity <= 0) {
      return null;
    }

    const removingThis =
      isLoading &&
      pendingAction === "remove" &&
      (isPinButton ? pendingPinAdd : pendingFinish === finish);
    const accessibleName = isPinButton ? "Decrease owned quantity" : `Decrease ${label} quantity`;

    return (
      <button
        type="button"
        className="add-to-collection__button add-to-collection__button--remove"
        onClick={() => handleRemove(finish)}
        disabled={isLoading}
        aria-label={accessibleName}
      >
        {removingThis ? "Removing…" : "−"}
      </button>
    );
  };

  return (
    <div className={`add-to-collection add-to-collection--${variant}`}>
      {isPin ? (
        <div className="add-to-collection__buttons">
          <div className="add-to-collection__finish-group">
            {renderRemoveButton({
              finish: null,
              label: "owned",
              ownedQuantity: pinOwnedQuantity,
              isPinButton: true,
            })}
            <button
              type="button"
              className="add-to-collection__button"
              onClick={() => handleAdd(null)}
              disabled={isLoading}
            >
              {isLoading && pendingPinAdd && pendingAction !== "remove"
                ? "Adding…"
                : pinButtonLabel}
            </button>
          </div>
        </div>
      ) : finishButtons.length > 0 ? (
        <div className="add-to-collection__buttons">
          {finishButtons.map(({ finish, label, buttonLabel, ownedQuantity }) => (
            <div key={finish} className="add-to-collection__finish-group">
              {renderRemoveButton({ finish, label, ownedQuantity })}
              <button
                type="button"
                className="add-to-collection__button"
                onClick={() => handleAdd(finish)}
                disabled={isLoading}
              >
                {isLoading && pendingFinish === finish && pendingAction !== "remove"
                  ? `Adding ${label}…`
                  : buttonLabel}
              </button>
            </div>
          ))}
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
