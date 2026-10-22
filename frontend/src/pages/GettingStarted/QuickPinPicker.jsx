import { useEffect, useMemo, useState } from "react";
import { gettingStartedTree } from "./gettingStartedCatalog";
import "./QuickPinPicker.css";

const MAX_QTY = 20;
const MODE_NEED = "need";
const MODE_HAVE = "have";
const MODE_SPARES = "spares";

function modeFromQuantity(quantity) {
  if (quantity <= 0) return MODE_NEED;
  if (quantity === 1) return MODE_HAVE;
  return MODE_SPARES;
}

function quantityFromMode(mode, spares) {
  if (mode === MODE_NEED) return 0;
  if (mode === MODE_HAVE) return 1;
  return Math.min(MAX_QTY, Math.max(2, 1 + spares));
}

function buildSeriesFromTree(tree = gettingStartedTree) {
  const pinsSection = tree.find((section) => section.id === "pins");
  return (pinsSection?.children ?? []).map((group) => ({
    id: group.id,
    label: group.label,
    pins: group.skus.map((sku) => ({
      skuId: sku.skuId,
      name: sku.label || sku.card?.displayName || sku.skuId,
    })),
  }));
}

function quantitiesFromEntries(entries, pinSkuIds) {
  const bySku = new Map();
  for (const entry of entries ?? []) {
    const skuId = typeof entry?.skuId === "string" ? entry.skuId.trim().toUpperCase() : "";
    if (!skuId || !pinSkuIds.has(skuId)) continue;
    const raw = entry.quantity ?? entry.count ?? entry.copies ?? entry.total;
    const qty = typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
    bySku.set(skuId, (bySku.get(skuId) ?? 0) + qty);
  }
  const quantities = {};
  for (const skuId of pinSkuIds) {
    quantities[skuId] = bySku.get(skuId) ?? 0;
  }
  return quantities;
}

/**
 * Scalable have/need picker for the full pin catalog (grouped by series).
 */
export default function QuickPinPicker({
  entries = [],
  collectionLoading = false,
  saving = false,
  error = null,
  isSignedIn = false,
  onSubmit,
}) {
  const seriesList = useMemo(() => buildSeriesFromTree(), []);
  const allPinSkuIds = useMemo(() => {
    const ids = new Set();
    for (const series of seriesList) {
      for (const pin of series.pins) ids.add(pin.skuId);
    }
    return ids;
  }, [seriesList]);

  const [quantities, setQuantities] = useState(() =>
    Object.fromEntries([...allPinSkuIds].map((skuId) => [skuId, 0])),
  );
  const [search, setSearch] = useState("");
  const [expandedSeries, setExpandedSeries] = useState(() => new Set());
  const [hydratedFromCollection, setHydratedFromCollection] = useState(false);

  useEffect(() => {
    if (collectionLoading || hydratedFromCollection || !isSignedIn) {
      return;
    }
    setQuantities(quantitiesFromEntries(entries, allPinSkuIds));
    setHydratedFromCollection(true);
  }, [allPinSkuIds, collectionLoading, entries, hydratedFromCollection, isSignedIn]);

  const normalizedSearch = search.trim().toLowerCase();

  const visibleSeries = useMemo(() => {
    if (!normalizedSearch) {
      return seriesList.map((series) => ({
        ...series,
        pins: series.pins,
        matchCount: series.pins.length,
      }));
    }
    return seriesList
      .map((series) => {
        const pins = series.pins.filter(
          (pin) =>
            pin.name.toLowerCase().includes(normalizedSearch) ||
            pin.skuId.toLowerCase().includes(normalizedSearch) ||
            series.label.toLowerCase().includes(normalizedSearch),
        );
        return { ...series, pins, matchCount: pins.length };
      })
      .filter((series) => series.matchCount > 0);
  }, [normalizedSearch, seriesList]);

  // While searching, auto-expand matching series for discoverability.
  const effectiveExpanded = useMemo(() => {
    if (normalizedSearch) {
      return new Set(visibleSeries.map((series) => series.id));
    }
    return expandedSeries;
  }, [expandedSeries, normalizedSearch, visibleSeries]);

  const setPinQuantity = (skuId, nextQty) => {
    const clamped = Math.max(0, Math.min(MAX_QTY, Math.floor(nextQty)));
    setQuantities((prev) => ({ ...prev, [skuId]: clamped }));
  };

  const setSeriesQuantities = (series, qty) => {
    setQuantities((prev) => {
      const next = { ...prev };
      for (const pin of series.pins) {
        // Use original series pin list for bulk actions when searching filtered view:
        // callers pass the unfiltered series from seriesList for have/need all.
        next[pin.skuId] = qty;
      }
      return next;
    });
  };

  const toggleSeries = (seriesId) => {
    setExpandedSeries((prev) => {
      const next = new Set(prev);
      if (next.has(seriesId)) next.delete(seriesId);
      else next.add(seriesId);
      return next;
    });
  };

  const handleSubmit = () => {
    onSubmit?.(quantities);
  };

  const markedHaveCount = Object.values(quantities).filter((qty) => qty > 0).length;

  return (
    <section className="quick-pin-picker" aria-labelledby="quick-pin-picker-title">
      <div className="getting-started__section-heading">
        <span>Quick start</span>
        <h2 id="quick-pin-picker-title">Which pins do you have?</h2>
        <p>
          Anything left unmarked counts as Need. Mark Have or Have spares for pins you own — then
          find collectors who can trade.
        </p>
      </div>

      <label className="quick-pin-picker__search">
        <span className="getting-started__sr-only">Search pins</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search pins or series"
          autoComplete="off"
        />
      </label>

      <p className="quick-pin-picker__summary" aria-live="polite">
        {markedHaveCount} marked Have
        {normalizedSearch
          ? ` · ${visibleSeries.reduce((sum, s) => sum + s.matchCount, 0)} matches`
          : ""}
      </p>

      <div className="quick-pin-picker__series-list">
        {visibleSeries.map((series) => {
          const fullSeries = seriesList.find((entry) => entry.id === series.id) ?? series;
          const isOpen = effectiveExpanded.has(series.id);
          return (
            <section key={series.id} className="quick-pin-picker__series">
              <div className="quick-pin-picker__series-header">
                <button
                  type="button"
                  className="quick-pin-picker__series-toggle"
                  aria-expanded={isOpen}
                  onClick={() => toggleSeries(series.id)}
                >
                  <span aria-hidden="true">{isOpen ? "▾" : "▸"}</span>
                  <span>
                    {series.label}
                    <small>
                      {series.matchCount}
                      {normalizedSearch ? " match" : " pin"}
                      {series.matchCount === 1 ? "" : "s"}
                    </small>
                  </span>
                </button>
                <div className="quick-pin-picker__series-actions">
                  <button
                    type="button"
                    className="quick-pin-picker__bulk"
                    onClick={() => setSeriesQuantities(fullSeries, 1)}
                  >
                    Have all
                  </button>
                  <button
                    type="button"
                    className="quick-pin-picker__bulk"
                    onClick={() => setSeriesQuantities(fullSeries, 0)}
                  >
                    Need all
                  </button>
                </div>
              </div>

              {isOpen ? (
                <ul className="quick-pin-picker__pin-list">
                  {series.pins.map((pin) => {
                    const qty = quantities[pin.skuId] ?? 0;
                    const mode = modeFromQuantity(qty);
                    const spares = Math.max(1, qty - 1);
                    return (
                      <li key={pin.skuId} className="quick-pin-picker__pin">
                        <div className="quick-pin-picker__pin-name">
                          <strong>{pin.name}</strong>
                          <span>{pin.skuId}</span>
                        </div>
                        <fieldset className="quick-pin-picker__modes">
                          <legend className="getting-started__sr-only">{pin.name} ownership</legend>
                          <button
                            type="button"
                            aria-pressed={mode === MODE_NEED}
                            className={mode === MODE_NEED ? "is-active" : undefined}
                            onClick={() => setPinQuantity(pin.skuId, 0)}
                          >
                            Need
                          </button>
                          <button
                            type="button"
                            aria-pressed={mode === MODE_HAVE}
                            className={mode === MODE_HAVE ? "is-active" : undefined}
                            onClick={() => setPinQuantity(pin.skuId, 1)}
                          >
                            Have
                          </button>
                          <button
                            type="button"
                            aria-pressed={mode === MODE_SPARES}
                            className={mode === MODE_SPARES ? "is-active" : undefined}
                            onClick={() =>
                              setPinQuantity(pin.skuId, quantityFromMode(MODE_SPARES, spares || 1))
                            }
                          >
                            Have spares
                          </button>
                        </fieldset>
                        {mode === MODE_SPARES ? (
                          <div className="quick-pin-picker__spares">
                            <span>Spares</span>
                            <button
                              type="button"
                              aria-label={`Decrease spares for ${pin.name}`}
                              onClick={() => setPinQuantity(pin.skuId, Math.max(2, qty - 1))}
                            >
                              −
                            </button>
                            <output aria-live="polite">{spares}</output>
                            <button
                              type="button"
                              aria-label={`Increase spares for ${pin.name}`}
                              onClick={() => setPinQuantity(pin.skuId, Math.min(MAX_QTY, qty + 1))}
                            >
                              +
                            </button>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </section>
          );
        })}
      </div>

      {error ? <p className="getting-started__error">{error}</p> : null}

      <div className="getting-started__actions">
        <button
          type="button"
          className="getting-started__button is-primary"
          disabled={saving || collectionLoading}
          onClick={handleSubmit}
        >
          {saving ? "Saving…" : "Find my trades"}
        </button>
        {!isSignedIn ? (
          <p className="quick-pin-picker__consent">
            You&apos;ll create a free account so other collectors can trade with you.
          </p>
        ) : null}
      </div>
    </section>
  );
}
