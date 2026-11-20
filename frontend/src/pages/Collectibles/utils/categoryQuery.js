/** Option values for the Collectibles Category control. */
const CATEGORY_FILTERS = new Set(["all", "story", "herald", "nonsense", "pin"]);

/**
 * Public `category` query aliases that are not the option value.
 * The Pins option value is `pin`; shared links use `pins`.
 */
const CATEGORY_QUERY_ALIASES = {
  pins: "pin",
};

/**
 * Map a `category` search param onto the Category control.
 * Unknown values fall back to all categories.
 */
export function categoryFilterFromQuery(raw) {
  if (typeof raw !== "string") return "all";
  const key = raw.trim().toLowerCase();
  if (CATEGORY_FILTERS.has(key)) return key;
  return CATEGORY_QUERY_ALIASES[key] ?? "all";
}

/**
 * Search param value for a Category control value.
 * `all` omits the param. Pins is written as `pins` so the link matches the label.
 */
export function categoryQueryForFilter(filter) {
  if (filter === "pin") return "pins";
  if (typeof filter === "string" && CATEGORY_FILTERS.has(filter) && filter !== "all") {
    return filter;
  }
  return null;
}
