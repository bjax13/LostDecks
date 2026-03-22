import { useNavigate } from "react-router-dom";
import { datasetMeta } from "../../data/collectibles";
import { categoryLabels } from "../Collectibles/constants";

export function normalizeQuantity(entry) {
  const candidates = [entry.quantity, entry.count, entry.copies, entry.total];
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return 1;
}

export function resolveTimestamp(entry) {
  const possible = entry.updatedAt ?? entry.acquiredAt ?? entry.createdAt ?? null;
  if (!possible) {
    return null;
  }

  if (typeof possible.toDate === "function") {
    try {
      return possible.toDate();
    } catch (err) {
      console.warn("Failed to convert Firestore timestamp", err);
    }
  }

  if (possible instanceof Date) {
    return possible;
  }

  const date = new Date(possible);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(date, formatter) {
  if (!date) {
    return null;
  }
  try {
    return formatter.format(date);
  } catch (err) {
    console.warn("Failed to format date", err);
    return date.toISOString();
  }
}

export function SummaryStat({ label, value, sublabel }) {
  return (
    <div className="collection-summary__stat">
      <span className="collection-summary__stat-label">{label}</span>
      <span className="collection-summary__stat-value">{value}</span>
      {sublabel ? <span className="collection-summary__stat-sub">{sublabel}</span> : null}
    </div>
  );
}

export function CollectionSummary({ summary }) {
  const completionPercent = Math.round(summary.completionRate * 100);

  const finishEntries = Object.entries(summary.finishCounts).sort(([a], [b]) => a.localeCompare(b));
  const categoryEntries = Object.entries(summary.categoryCounts).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const storyProgress = summary.progressBreakdowns?.stories ?? [];
  const heraldProgress = summary.progressBreakdowns?.heralds ?? [];

  return (
    <section className="collection-summary" aria-label="Collection summary">
      <div className="collection-summary__grid">
        <SummaryStat
          label="Unique Cards"
          value={`${summary.uniqueCardCount} / ${datasetMeta.totalUniqueCards}`}
          sublabel="Tracked in your set"
        />
        <SummaryStat
          label="Total Copies"
          value={summary.totalQuantity}
          sublabel="Across all finishes"
        />
        <SummaryStat
          label="Distinct SKUs"
          value={summary.uniqueSkuCount}
          sublabel="Unique printings tracked"
        />
      </div>

      <div className="collection-summary__progress">
        <div className="collection-summary__progress-track">
          <div
            className="collection-summary__progress-bar"
            style={{ width: `${completionPercent}%` }}
          />
        </div>
        <span className="collection-summary__progress-label">
          {completionPercent}% of the Stormlight Lost Tales set catalogued
        </span>
      </div>

      {(storyProgress.length > 0 || heraldProgress.length > 0) && (
        <div className="collection-summary__subset-progress">
          {storyProgress.map((story) => (
            <div key={story.code} className="collection-summary__subset-card">
              <h3 className="collection-summary__subset-heading">{story.title}</h3>
              <ul className="collection-summary__subset-list">
                {story.items.map((item) => (
                  <li key={item.key} className="collection-summary__subset-item">
                    <div className="collection-summary__subset-meta">
                      <span>{item.label}</span>
                      <span>
                        {item.owned} / {item.total}
                      </span>
                    </div>
                    <div
                      className="collection-summary__subset-track"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={item.percent}
                    >
                      <div
                        className="collection-summary__subset-bar"
                        style={{ width: `${item.percent}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {heraldProgress.length > 0 ? (
            <div className="collection-summary__subset-card">
              <h3 className="collection-summary__subset-heading">Heralds</h3>
              <ul className="collection-summary__subset-list">
                {heraldProgress.map((item) => (
                  <li key={item.key} className="collection-summary__subset-item">
                    <div className="collection-summary__subset-meta">
                      <span>{item.label}</span>
                      <span>
                        {item.owned} / {item.total}
                      </span>
                    </div>
                    <div
                      className="collection-summary__subset-track"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={item.percent}
                    >
                      <div
                        className="collection-summary__subset-bar"
                        style={{ width: `${item.percent}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {(finishEntries.length > 0 || categoryEntries.length > 0) && (
        <div className="collection-summary__breakdowns">
          {finishEntries.length > 0 && (
            <div className="collection-summary__list">
              <span className="collection-summary__list-title">Finishes</span>
              {finishEntries.map(([finish, count]) => (
                <span key={finish} className="collection-summary__chip">
                  <span>{finish}</span>
                  <span className="collection-summary__chip-count">{count}</span>
                </span>
              ))}
            </div>
          )}
          {categoryEntries.length > 0 && (
            <div className="collection-summary__list">
              <span className="collection-summary__list-title">Categories</span>
              {categoryEntries.map(([category, count]) => (
                <span key={category} className="collection-summary__chip">
                  <span>{categoryLabels[category] ?? category}</span>
                  <span className="collection-summary__chip-count">{count}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export function CollectionTable({ entries }) {
  const navigate = useNavigate();

  const handleRowClick = (entry, event) => {
    // Don't navigate if clicking on interactive elements
    if (event.target.closest("button, a, input, select, textarea")) {
      return;
    }

    if (entry.skuId && entry.cardId) {
      navigate(`/collectibles/${entry.cardId}/${entry.skuId}`);
    } else if (entry.cardId) {
      navigate(`/collectibles/${entry.cardId}`);
    }
    // If neither exists, don't navigate
  };

  return (
    <div className="collection-table__wrapper">
      <table className="collection-table">
        <thead>
          <tr>
            <th scope="col">Card</th>
            <th scope="col">Category</th>
            <th scope="col">Finish</th>
            <th scope="col">Quantity</th>
            <th scope="col">Last Updated</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.id}
              className={entry.cardId || entry.skuId ? "collection-table__row--clickable" : ""}
              onClick={(e) => handleRowClick(entry, e)}
            >
              <td>
                <div className="collection-table__card">
                  <span className="collection-table__card-name">{entry.displayName}</span>
                  <div className="collection-table__card-meta">
                    {entry.cardId ? <span>{entry.cardId}</span> : null}
                    {entry.storyTitle ? <span>{entry.storyTitle}</span> : null}
                    {entry.binderLabel ? <span>{entry.binderLabel}</span> : null}
                  </div>
                  {entry.detail ? (
                    <span className="collection-table__card-detail">{entry.detail}</span>
                  ) : null}
                </div>
              </td>
              <td>
                <span className="collection-table__badge">{entry.categoryLabel}</span>
              </td>
              <td>
                <div className="collection-table__finish">
                  {entry.finish ? (
                    <span className="collection-table__finish-chip">{entry.finish}</span>
                  ) : (
                    <span>—</span>
                  )}
                  {entry.skuId ? (
                    <span className="collection-table__sku">{entry.skuId}</span>
                  ) : null}
                </div>
              </td>
              <td>
                <span className="collection-table__quantity">{entry.quantity}</span>
              </td>
              <td>
                <div className="collection-table__updated">
                  <span>{entry.updatedAtLabel ?? "—"}</span>
                  {entry.notes ? (
                    <span className="collection-table__notes">{entry.notes}</span>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
