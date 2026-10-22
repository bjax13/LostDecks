import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPendingPicks,
  loadPendingPicks,
  mergePickRows,
  savePendingPicks,
} from "./pendingPicks.js";

describe("pendingPicks", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("saves and loads pending picks with utm source", () => {
    expect(
      savePendingPicks(
        { "pin-cf-01": 2, "PIN-CF-02": 1 },
        { utm_source: "qr", utm_campaign: "nexus-2026" },
      ),
    ).toBe(true);

    const loaded = loadPendingPicks({ now: Date.now() });
    expect(loaded).toMatchObject({
      version: 1,
      source: { utm_source: "qr", utm_campaign: "nexus-2026" },
      quantities: { "PIN-CF-01": 2, "PIN-CF-02": 1 },
    });
    expect(typeof loaded.savedAt).toBe("number");
  });

  it("returns null and clears when older than 7 days", () => {
    savePendingPicks({ "PIN-CF-01": 1 });
    const raw = JSON.parse(window.localStorage.getItem("pendingPinPicks"));
    raw.savedAt = Date.now() - 8 * 24 * 60 * 60 * 1000;
    window.localStorage.setItem("pendingPinPicks", JSON.stringify(raw));

    expect(loadPendingPicks({ now: Date.now() })).toBeNull();
    expect(window.localStorage.getItem("pendingPinPicks")).toBeNull();
  });

  it("returns null for malformed payloads", () => {
    window.localStorage.setItem("pendingPinPicks", "{not-json");
    expect(loadPendingPicks()).toBeNull();
    expect(window.localStorage.getItem("pendingPinPicks")).toBeNull();
  });

  it("handles localStorage failures without throwing", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(savePendingPicks({ "PIN-CF-01": 1 })).toBe(false);

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadPendingPicks()).toBeNull();

    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(clearPendingPicks()).toBe(false);
  });

  it("clears pending picks", () => {
    savePendingPicks({ "PIN-CF-01": 1 });
    expect(clearPendingPicks()).toBe(true);
    expect(loadPendingPicks()).toBeNull();
  });
});

describe("mergePickRows", () => {
  it("emits only SKUs where pick raises quantity", () => {
    const rows = mergePickRows({ "PIN-CF-01": 2, "PIN-CF-02": 1, "PIN-CF-03": 0, "PIN-CF-04": 1 }, [
      { skuId: "PIN-CF-01", quantity: 1 },
      { skuId: "PIN-CF-02", quantity: 3 },
      { skuId: "PIN-CF-04", quantity: 1 },
    ]);
    expect(rows).toEqual([{ skuId: "PIN-CF-01", quantity: 2 }]);
  });

  it("never lowers quantities or emits zeros", () => {
    expect(mergePickRows({ "PIN-CF-01": 0 }, [{ skuId: "PIN-CF-01", quantity: 5 }])).toEqual([]);
    expect(mergePickRows({ "PIN-CF-01": 1 }, [{ skuId: "PIN-CF-01", quantity: 4 }])).toEqual([]);
  });
});
