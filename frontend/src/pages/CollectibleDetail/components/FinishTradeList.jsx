import { useEffect, useRef, useState } from "react";
import InfoBubble from "../../../components/InfoBubble.jsx";
import { resolveSkuId } from "../../../data/collectibles";
import {
  normalizeTradeFlag,
  TRADE_STATUS_HELP,
  TRADE_STATUS_SAVE_ERROR,
  TRADE_STATUS_UFT_HINT,
} from "../../../lib/tradeFlag.js";
import AddToCollectionButton, {
  formatFinishLabel,
} from "../../Collectibles/components/AddToCollectionButton";
import { useCollectionQuantityMutations } from "../../Collectibles/hooks/useCollectionQuantityMutations";

function isPinCollectible(item) {
  return item?.collectibleType === "pin" || item?.category === "pin";
}

function TradeStatusSwitch({ name, value, quantity, loading, onChange }) {
  const [draft, setDraft] = useState(null);
  const [saveError, setSaveError] = useState(false);
  const shown = draft ?? value;
  const uftDisabled = quantity < 1;
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (draft == null) return;
    if (value === draft) {
      setDraft(null);
      return;
    }
    if (uftDisabled && draft === "uft") {
      setDraft(null);
    }
  }, [draft, value, uftDisabled]);

  useEffect(() => {
    const prev = prevValueRef.current;
    if (prev === value) return;
    prevValueRef.current = value;
    setDraft((current) => (current != null && current !== value ? null : current));
  }, [value]);

  async function select(next) {
    if (loading || next === shown) return;
    if (next === "uft" && uftDisabled) return;
    setDraft(next);
    setSaveError(false);
    try {
      await onChange(next);
    } catch {
      setDraft(null);
      setSaveError(true);
    }
  }

  const options = [
    { value: "none", label: "None" },
    { value: "iso", label: "ISO" },
    { value: "uft", label: "UFT", disabled: uftDisabled },
  ];

  return (
    <div className="trade-status">
      <div className="trade-status__legend">
        Trade status
        <InfoBubble label="About trade status" placement="end">
          {TRADE_STATUS_HELP}
        </InfoBubble>
      </div>
      <div className="trade-status__options" role="radiogroup" aria-label="Trade status">
        {options.map((option) => (
          <label key={option.value} className="trade-status__option">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={shown === option.value}
              disabled={loading || option.disabled}
              onChange={() => select(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
      {uftDisabled ? <p className="trade-status__hint">{TRADE_STATUS_UFT_HINT}</p> : null}
      {saveError ? <p className="trade-status__error">{TRADE_STATUS_SAVE_ERROR}</p> : null}
    </div>
  );
}

function readQuantity(entry) {
  const candidates = [entry?.quantity, entry?.count, entry?.copies, entry?.total];
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return Math.max(0, candidate);
    }
  }
  return 0;
}

function quantityForSku(entries, skuId) {
  let total = 0;
  for (const entry of entries) {
    if (entry?.skuId !== skuId) continue;
    total += readQuantity(entry);
  }
  return total;
}

function flagForSku(entries, skuId) {
  for (const entry of entries) {
    if (entry?.skuId !== skuId) continue;
    const flag = normalizeTradeFlag(entry.tradeFlag);
    if (flag) return flag;
  }
  return "none";
}

export default function FinishTradeList({ card, entries, loading, ownedBySkuId }) {
  const { setCollectionTradeFlag } = useCollectionQuantityMutations();
  const pin = isPinCollectible(card);
  const rows = pin
    ? [
        {
          key: "pin",
          label: card.displayName || "Pin",
          finish: null,
          skuId: resolveSkuId(card, null),
        },
      ]
    : (card.finishes ?? []).map((finish) => ({
        key: finish,
        label: formatFinishLabel(finish),
        finish,
        skuId: resolveSkuId(card, finish),
      }));

  return (
    <div className="finish-trade-list">
      {rows.map((row) => {
        const quantity = row.skuId ? quantityForSku(entries, row.skuId) : 0;
        const flag = row.skuId ? flagForSku(entries, row.skuId) : "none";
        return (
          <div key={row.key} className="finish-trade-row">
            <div className="finish-trade-row__main">
              <span className="finish-trade-row__name">{row.label}</span>
              <span className="finish-trade-row__qty">{quantity}</span>
            </div>
            <div className="finish-trade-row__controls">
              <AddToCollectionButton
                collectible={card}
                variant="card"
                onlyFinish={row.finish}
                ownedBySkuId={ownedBySkuId}
                deleteWhenZero={false}
              />
              <TradeStatusSwitch
                name={`trade-status-${row.skuId || row.key}`}
                value={flag}
                quantity={quantity}
                loading={loading}
                onChange={(next) =>
                  setCollectionTradeFlag({
                    card,
                    finish: row.finish,
                    tradeFlag: next === "none" ? null : next,
                  })
                }
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
