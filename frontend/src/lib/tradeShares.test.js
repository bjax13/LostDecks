import { describe, expect, it, vi } from "vitest";
import * as isoUftPost from "../pages/Collection/utils/isoUftPost.js";
import {
  encodeIsoSkuList,
  isValidShareIsoField,
  parseIsoSkuField,
  parseUftSkuField,
} from "./shareListEncoding.js";
import {
  buildShareDocument,
  generateShareId,
  isShareStale,
  SHARE_DOC_VERSION,
  SHARE_STALE_MS,
} from "./tradeShares.js";
import { DEFAULT_MATCH_KEEP_BY_LANE } from "./userPreferences.js";

describe("tradeShares", () => {
  it("generateShareId returns URL-safe ids of the requested length", () => {
    const id = generateShareId(12);
    expect(id.length).toBe(12);
    expect(id).toMatch(/^[0-9A-Za-z]+$/);
  });

  it("buildShareDocument stores comma-separated iso and uft strings", () => {
    vi.spyOn(isoUftPost, "buildIsoUftSkuLists").mockReturnValue({
      iso: ["LT24-ELS-01-DUN", "LT24-LOP-02-FOIL"],
      uft: [{ skuId: "LT24-LOP-02-FOIL", quantity: 2 }],
      skippedEntries: [],
    });
    const doc = buildShareDocument({
      ownerUid: "user-123",
      displayName: " Pat ",
      entries: [],
      matchKeep: DEFAULT_MATCH_KEEP_BY_LANE,
      discordHandle: "  gimpy_12 ",
    });

    expect(doc.displayName).toBe("Pat");
    expect(doc.ownerUid).toBe("user-123");
    expect(doc.version).toBe(SHARE_DOC_VERSION);
    expect(doc.iso).toBe(encodeIsoSkuList(["LT24-ELS-01-DUN", "LT24-LOP-02-FOIL"]));
    expect(doc.uft).toBe("LT24-LOP-02-FOIL:2");
    expect(isValidShareIsoField(doc.iso)).toBe(true);
    expect(parseIsoSkuField(doc.iso).length).toBe(2);
    expect(parseUftSkuField(doc.uft).length).toBe(1);
    expect(doc.discordHandle).toBe("gimpy_12");
    expect(doc).not.toHaveProperty("email");
    vi.restoreAllMocks();
  });

  it("isShareStale is true after 30 days", () => {
    const now = Date.now();
    const staleDate = new Date(now - SHARE_STALE_MS - 1);
    expect(isShareStale(staleDate, now)).toBe(true);
    expect(isShareStale(new Date(now - 1_000), now)).toBe(false);
  });
});
