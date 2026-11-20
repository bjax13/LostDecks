import { describe, expect, it } from "vitest";
import {
  filterCollectorsByLocation,
  readStoredMatchLocationFilter,
  serverLocationFilter,
  writeStoredMatchLocationFilter,
} from "./matchLocationFilter.js";

const caller = { country: "US", region: "US-UT" };

const collectors = [
  { userId: "utah", country: "US", region: "US-UT" },
  { userId: "texas", country: "US", region: "US-TX" },
  { userId: "country-only", country: "US", region: "" },
  { userId: "ontario", country: "CA", region: "CA-ON" },
  { userId: "mismatched-region", country: "CA", region: "US-UT" },
  { userId: "nowhere", country: "", region: "" },
];

function ids(rows) {
  return rows.map((row) => row.userId);
}

describe("match location filter", () => {
  it("shows everyone when the filter is off, including collectors with no location", () => {
    expect(ids(filterCollectorsByLocation("off", caller, collectors))).toEqual(ids(collectors));
    expect(ids(filterCollectorsByLocation(undefined, caller, collectors))).toEqual(ids(collectors));
    expect(ids(filterCollectorsByLocation("nope", caller, collectors))).toEqual(ids(collectors));
  });

  it("keeps collectors in the same country and drops everyone without a country", () => {
    expect(ids(filterCollectorsByLocation("country", caller, collectors))).toEqual([
      "utah",
      "texas",
      "country-only",
    ]);
  });

  it("requires both country and state, and drops collectors with no state", () => {
    expect(ids(filterCollectorsByLocation("state", caller, collectors))).toEqual(["utah"]);
    expect(
      filterCollectorsByLocation("state", caller, [
        { userId: "same-region-other-country", country: "CA", region: "US-UT" },
      ]),
    ).toEqual([]);
    expect(
      filterCollectorsByLocation("state", caller, [
        { userId: "no-state", country: "US", region: "" },
      ]),
    ).toEqual([]);
  });

  it("does not exclude anyone when the viewer has not set the location that filter needs", () => {
    expect(
      ids(filterCollectorsByLocation("country", { country: "", region: "" }, collectors)),
    ).toEqual(ids(collectors));
    expect(
      ids(filterCollectorsByLocation("state", { country: "US", region: "" }, collectors)),
    ).toEqual(ids(collectors));
  });

  it("stores the checkbox choice per user and defaults to off", () => {
    const storage = new Map();
    const memoryStorage = {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, value),
    };

    expect(readStoredMatchLocationFilter("user-1", memoryStorage)).toEqual({
      country: false,
      state: false,
    });

    writeStoredMatchLocationFilter("user-1", { country: true, state: false }, memoryStorage);
    expect(readStoredMatchLocationFilter("user-1", memoryStorage)).toEqual({
      country: true,
      state: false,
    });
    expect(readStoredMatchLocationFilter("user-2", memoryStorage)).toEqual({
      country: false,
      state: false,
    });

    expect(serverLocationFilter({ country: false, state: false }, caller)).toBe("off");
    expect(serverLocationFilter({ country: true, state: false }, caller)).toBe("country");
    expect(serverLocationFilter({ country: true, state: true }, caller)).toBe("state");
    expect(
      serverLocationFilter({ country: true, state: true }, { country: "US", region: "" }),
    ).toBe("country");
    expect(serverLocationFilter({ country: true, state: false }, { country: "", region: "" })).toBe(
      "off",
    );
  });
});
