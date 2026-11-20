import { renderHook } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSkuRecord = vi.hoisted(() => vi.fn());

vi.mock("../../../data/collectibles", () => ({
  getSkuRecord: mockGetSkuRecord,
  isRetiredPinId: (skuId) => skuId === "PIN-CPS4-03",
}));

import { MATCH_LANE_ALL } from "../constants";
import { countTradeItems, useMatchesExplorer } from "./useMatchesExplorer.js";

const MATCHES = [
  {
    userId: "user-dun",
    displayName: "Dun Collector",
    lanes: [
      {
        id: "dun",
        theyCanSend: [{ skuId: "LT24-HLD-01-DUN", owned: 2, extras: 1 }],
        youCanSend: [
          { skuId: "LT24-ELS-01-DUN", owned: 3, extras: 2 },
          { skuId: "LT24-CHM-01-DUN", owned: 2, extras: 1 },
        ],
      },
    ],
  },
  {
    userId: "user-pin",
    displayName: "Pin Collector",
    lanes: [
      {
        id: "pins",
        theyCanSend: [{ skuId: "PIN-CF-02", owned: 2, extras: 1 }],
        youCanSend: [{ skuId: "PIN-CF-01", owned: 2, extras: 1 }],
      },
    ],
  },
];

describe("useMatchesExplorer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSkuRecord.mockImplementation((skuId) => {
      const names = {
        "LT24-HLD-01-DUN": "Jezrien",
        "LT24-ELS-01-DUN": "Elsecaller #01",
        "PIN-CF-02": "Howlerina",
        "PIN-CF-01": "Shredhead",
      };
      return {
        skuId,
        card: {
          id: skuId,
          displayName: names[skuId] ?? skuId,
          searchTokens: `${names[skuId] ?? skuId} ${skuId}`.toLowerCase(),
        },
      };
    });
  });

  it("defaults to all lanes and keeps all counterparties", () => {
    const { result } = renderHook(() => useMatchesExplorer({ matches: MATCHES }));
    expect(result.current.laneFilter).toBe(MATCH_LANE_ALL);
    expect(result.current.matches).toHaveLength(2);
    expect(result.current.totalMatches).toBe(2);
  });

  it("filters counterparties to a live lane and hides other lanes", () => {
    const { result } = renderHook(() => useMatchesExplorer({ matches: MATCHES }));

    act(() => {
      result.current.setLaneFilter("dun");
    });

    expect(result.current.matches).toHaveLength(1);
    expect(result.current.matches[0].userId).toBe("user-dun");
    expect(result.current.matches[0].lanes.map((lane) => lane.id)).toEqual(["dun"]);
  });

  it("searches by collector name or pile item tokens", () => {
    const { result } = renderHook(() => useMatchesExplorer({ matches: MATCHES }));

    act(() => {
      result.current.setSearchTerm("howlerina");
    });
    expect(result.current.matches).toHaveLength(1);
    expect(result.current.matches[0].userId).toBe("user-pin");

    act(() => {
      result.current.setSearchTerm("dun collector");
    });
    expect(result.current.matches).toHaveLength(1);
    expect(result.current.matches[0].userId).toBe("user-dun");
  });

  it("resets back to all lanes", () => {
    const { result } = renderHook(() => useMatchesExplorer({ matches: MATCHES }));

    act(() => {
      result.current.setSearchTerm("herald");
      result.current.setLaneFilter("pins");
      result.current.resetFilters();
    });

    expect(result.current.searchTerm).toBe("");
    expect(result.current.laneFilter).toBe(MATCH_LANE_ALL);
    expect(result.current.matches).toHaveLength(2);
  });

  it("sorts by collector name", () => {
    const { result } = renderHook(() => useMatchesExplorer({ matches: MATCHES }));

    act(() => {
      result.current.setSortField("displayName");
      result.current.setSortDirection("asc");
    });

    expect(result.current.matches.map((match) => match.displayName)).toEqual([
      "Dun Collector",
      "Pin Collector",
    ]);
  });

  it("sorts by trade count across live piles", () => {
    const { result } = renderHook(() => useMatchesExplorer({ matches: MATCHES }));

    act(() => {
      result.current.setSortField("tradeCount");
      result.current.setSortDirection("desc");
    });

    expect(result.current.matches.map((match) => match.userId)).toEqual(["user-dun", "user-pin"]);
    expect(countTradeItems(MATCHES[0])).toBe(3);
    expect(countTradeItems(MATCHES[1])).toBe(2);
  });

  it("drops retired pin skus from match piles", () => {
    const { result } = renderHook(() =>
      useMatchesExplorer({
        matches: [
          {
            userId: "mixed",
            displayName: "Mixed",
            lanes: [
              {
                id: "pins",
                theyCanSend: [
                  { skuId: "PIN-CPS4-03", owned: 2, extras: 1 },
                  { skuId: "PIN-CF-01", owned: 2, extras: 1 },
                ],
                youCanSend: [{ skuId: "PIN-CPS4-03", owned: 1, extras: 1 }],
              },
            ],
          },
          {
            userId: "only-retired",
            displayName: "Only Retired",
            lanes: [
              {
                id: "pins",
                theyCanSend: [{ skuId: "PIN-CPS4-03", owned: 2, extras: 1 }],
                youCanSend: [],
              },
            ],
          },
        ],
      }),
    );

    expect(result.current.totalMatches).toBe(1);
    expect(result.current.matches).toHaveLength(1);
    expect(result.current.matches[0].lanes[0].theyCanSend.map((item) => item.skuId)).toEqual([
      "PIN-CF-01",
    ]);
    expect(result.current.matches[0].lanes[0].youCanSend).toEqual([]);
  });
});
