import { describe, expect, it, vi } from "vitest";
import {
  buildShareDocument,
  generateShareId,
  isShareStale,
  SHARE_STALE_MS,
} from "./tradeShares.js";
import { DEFAULT_MATCH_KEEP_BY_LANE } from "./userPreferences.js";

describe("tradeShares", () => {
  it("generateShareId returns URL-safe ids", () => {
    vi.spyOn(crypto, "getRandomValues").mockImplementation((bytes) => {
      bytes.fill(7);
      return bytes;
    });
    const id = generateShareId();
    expect(id.length).toBe(9);
    expect(id).toMatch(/^[0-9A-Za-z]+$/);
  });

  it("buildShareDocument omits private fields and includes ISO/UFT lists", () => {
    const doc = buildShareDocument({
      ownerUid: "user-123",
      displayName: " Pat ",
      entries: [],
      matchKeep: DEFAULT_MATCH_KEEP_BY_LANE,
      discordHandle: "  gimpy_12 ",
    });

    expect(doc.displayName).toBe("Pat");
    expect(doc.ownerUid).toBe("user-123");
    expect(doc.version).toBe(1);
    expect(doc.iso).toEqual([]);
    expect(doc.uft).toEqual([]);
    expect(doc.discordHandle).toBe("gimpy_12");
    expect(doc).not.toHaveProperty("email");
  });

  it("isShareStale is true after 30 days", () => {
    const now = Date.now();
    const staleDate = new Date(now - SHARE_STALE_MS - 1);
    expect(isShareStale(staleDate, now)).toBe(true);
    expect(isShareStale(new Date(now - 1_000), now)).toBe(false);
  });
});
