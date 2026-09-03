import { renderHook } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSkuRecord = vi.hoisted(() => vi.fn());

vi.mock("../../../data/collectibles", () => ({
  collectiblesIndex: [
    { id: "CARD-STORY", category: "story", rarity: "Rare", story: "ELS" },
    { id: "CARD-HERALD", category: "herald", rarity: "Legendary", story: null },
  ],
  datasetStories: [{ code: "ELS", title: "Elantris" }],
  getSkuRecord: mockGetSkuRecord,
}));

import { MATCH_SCOPE_ANY } from "../constants";
import { useMatchesExplorer } from "./useMatchesExplorer.js";

const MATCHES = [
  {
    userId: "user-story",
    displayName: "Story Collector",
    pairs: [{ theirSkuId: "SKU-STORY", yourSkuId: "SKU-NEED-A" }],
  },
  {
    userId: "user-herald",
    displayName: "Herald Collector",
    pairs: [{ theirSkuId: "SKU-HERALD", yourSkuId: "SKU-NEED-B" }],
  },
];

describe("useMatchesExplorer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSkuRecord.mockImplementation((skuId) => {
      if (skuId === "SKU-STORY") {
        return {
          skuId,
          card: {
            id: "CARD-STORY",
            category: "story",
            rarity: "Rare",
            story: "ELS",
            storyTitle: "Elantris",
            number: 1,
            displayName: "Elantris #01",
            searchTokens: "card-story els elantris elantris #01",
          },
        };
      }
      if (skuId === "SKU-HERALD") {
        return {
          skuId,
          card: {
            id: "CARD-HERALD",
            category: "herald",
            rarity: "Legendary",
            story: null,
            storyTitle: "Heraldic Order",
            number: 2,
            displayName: "Jezrien",
            searchTokens: "card-herald jezrien herald legendary",
          },
        };
      }
      if (skuId === "SKU-NEED-A" || skuId === "SKU-NEED-B") {
        return {
          skuId,
          card: {
            id: skuId,
            category: "pin",
            rarity: null,
            story: null,
            storyTitle: "Pins",
            number: null,
            displayName: "Need Pin",
            searchTokens: "need pin",
          },
        };
      }
      return null;
    });
  });

  it("defaults to show any valid trade and keeps all counterparties", () => {
    const { result } = renderHook(() => useMatchesExplorer({ matches: MATCHES }));
    expect(result.current.categoryFilter).toBe(MATCH_SCOPE_ANY);
    expect(result.current.matches).toHaveLength(2);
    expect(result.current.totalMatches).toBe(2);
  });

  it("bypasses attribute filters while show any valid trade is selected", () => {
    const { result } = renderHook(() => useMatchesExplorer({ matches: MATCHES }));

    act(() => {
      result.current.setStoryFilter("ELS");
      result.current.setRarityFilter("Legendary");
    });

    expect(result.current.matches).toHaveLength(2);
  });

  it("filters by category using either side of a trade pair", () => {
    const { result } = renderHook(() => useMatchesExplorer({ matches: MATCHES }));

    act(() => {
      result.current.setCategoryFilter("herald");
    });

    expect(result.current.matches).toHaveLength(1);
    expect(result.current.matches[0].userId).toBe("user-herald");
  });

  it("filters by story using either side of a trade pair", () => {
    const { result } = renderHook(() => useMatchesExplorer({ matches: MATCHES }));

    act(() => {
      result.current.setCategoryFilter("all");
      result.current.setStoryFilter("ELS");
    });

    expect(result.current.matches.every((match) => match.userId === "user-story")).toBe(true);
  });

  it("searches by collector name or either-side card tokens", () => {
    const { result } = renderHook(() => useMatchesExplorer({ matches: MATCHES }));

    act(() => {
      result.current.setSearchTerm("jezrien");
    });
    expect(result.current.matches).toHaveLength(1);
    expect(result.current.matches[0].userId).toBe("user-herald");

    act(() => {
      result.current.setSearchTerm("story collector");
    });
    expect(result.current.matches).toHaveLength(1);
    expect(result.current.matches[0].userId).toBe("user-story");
  });

  it("resets back to show any valid trade", () => {
    const { result } = renderHook(() => useMatchesExplorer({ matches: MATCHES }));

    act(() => {
      result.current.setSearchTerm("herald");
      result.current.setCategoryFilter("story");
      result.current.setStoryFilter("ELS");
      result.current.resetFilters();
    });

    expect(result.current.searchTerm).toBe("");
    expect(result.current.categoryFilter).toBe(MATCH_SCOPE_ANY);
    expect(result.current.storyFilter).toBe("all");
    expect(result.current.matches).toHaveLength(2);
  });

  it("sorts by collector name", () => {
    const { result } = renderHook(() => useMatchesExplorer({ matches: MATCHES }));

    act(() => {
      result.current.setSortField("displayName");
      result.current.setSortDirection("asc");
    });

    expect(result.current.matches.map((match) => match.displayName)).toEqual([
      "Herald Collector",
      "Story Collector",
    ]);
  });
});
