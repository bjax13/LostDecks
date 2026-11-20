/**
 * Viewer-side match location filter.
 * Filtering of other collectors happens in functions/matches.js (same rules).
 * This module decides whether a row would pass, and remembers the viewer's
 * checkbox choice in localStorage. Location itself is stored on userPreferences.
 */

export const MATCH_LOCATION_FILTER_NOTICE_BEFORE = "Set your country (and state) on your ";
export const MATCH_LOCATION_FILTER_NOTICE_LINK = "Account page";
export const MATCH_LOCATION_FILTER_NOTICE_AFTER = " to use this filter.";
export const MATCH_LOCATION_FILTER_NOTICE = `${MATCH_LOCATION_FILTER_NOTICE_BEFORE}${MATCH_LOCATION_FILTER_NOTICE_LINK}${MATCH_LOCATION_FILTER_NOTICE_AFTER}`;

export const MATCH_LOCATION_FILTER_NOTE = "Only showing collectors who've set a location.";

export const DEFAULT_MATCH_LOCATION_FILTER_CHOICE = Object.freeze({
  country: false,
  state: false,
});

const STORAGE_PREFIX = "shardstash.matchLocationFilter.";

function readCode(value) {
  return typeof value === "string" ? value : "";
}

/**
 * @param {"off" | "country" | "state" | string | null | undefined} filter
 * @param {{ country?: string, region?: string } | null | undefined} caller
 * @param {{ country?: string, region?: string } | null | undefined} other
 */
export function passesMatchLocationFilter(filter, caller, other) {
  const mode = filter === "country" || filter === "state" ? filter : "off";
  const callerCountry = readCode(caller?.country);
  const callerRegion = readCode(caller?.region);
  const otherCountry = readCode(other?.country);
  const otherRegion = readCode(other?.region);

  if (mode === "off") {
    return true;
  }

  if (mode === "country") {
    if (!callerCountry) {
      return true;
    }
    if (!otherCountry) {
      return false;
    }
    return otherCountry === callerCountry;
  }

  if (!callerCountry || !callerRegion) {
    return true;
  }
  if (!otherCountry || !otherRegion) {
    return false;
  }
  return otherCountry === callerCountry && otherRegion === callerRegion;
}

export function filterCollectorsByLocation(filter, caller, collectors) {
  const list = Array.isArray(collectors) ? collectors : [];
  return list.filter((collector) => passesMatchLocationFilter(filter, caller, collector));
}

export function matchLocationFilterStorageKey(userId) {
  return `${STORAGE_PREFIX}${userId}`;
}

export function readStoredMatchLocationFilter(userId, storage) {
  const target = storage ?? (typeof localStorage === "undefined" ? null : localStorage);
  if (!userId || !target) {
    return { ...DEFAULT_MATCH_LOCATION_FILTER_CHOICE };
  }

  try {
    const raw = target.getItem(matchLocationFilterStorageKey(userId));
    if (!raw) {
      return { ...DEFAULT_MATCH_LOCATION_FILTER_CHOICE };
    }
    const parsed = JSON.parse(raw);
    return {
      country: parsed?.country === true,
      state: parsed?.state === true,
    };
  } catch {
    return { ...DEFAULT_MATCH_LOCATION_FILTER_CHOICE };
  }
}

export function writeStoredMatchLocationFilter(userId, choice, storage) {
  const target = storage ?? (typeof localStorage === "undefined" ? null : localStorage);
  if (!userId || !target) {
    return;
  }

  const next = {
    country: choice?.country === true,
    state: choice?.state === true,
  };

  try {
    target.setItem(matchLocationFilterStorageKey(userId), JSON.stringify(next));
  } catch {
    // Ignore quota and private-mode failures. The checkbox still works this visit.
  }
}

/** State wins when both boxes are on, because it already requires the country. */
export function serverLocationFilter(choice, location) {
  if (choice?.state && location?.country && location?.region) {
    return "state";
  }
  if (choice?.country && location?.country) {
    return "country";
  }
  return "off";
}
