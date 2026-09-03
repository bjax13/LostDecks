import { useState } from "react";
import { adjustCollectionEntryQuantity } from "../utils/adjustCollectionQuantity";

export default function CollectionQuantityControls({ entry }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const quantity = Math.max(0, entry?.quantity ?? 0);
  const label = entry?.displayName ?? entry?.skuId ?? "item";

  const handleDecrement = async (event) => {
    event.stopPropagation();
    if (busy || quantity <= 0 || !entry?.id) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await adjustCollectionEntryQuantity({ entry, delta: -1 });
    } catch (err) {
      console.error("Failed to update collection quantity", err);
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: quantity cell is a composite control, not a form fieldset
    <div
      className="collection-table__quantity-controls"
      role="group"
      aria-label={`${label} quantity, ${quantity}`}
    >
      <button
        type="button"
        className="collection-table__quantity-button"
        aria-label={`Decrease ${label} quantity`}
        onClick={handleDecrement}
        disabled={busy || quantity <= 0}
      >
        {busy ? "…" : "−"}
      </button>
      <span className="collection-table__quantity">{quantity}</span>
      {error ? (
        <span className="collection-table__quantity-error" role="alert">
          Couldn't update quantity
        </span>
      ) : null}
    </div>
  );
}
