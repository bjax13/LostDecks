import { renderHook } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { useCollectiblesExplorer } from "./useCollectiblesExplorer.js";

describe("useCollectiblesExplorer (unit)", () => {
  it("returns collectibles and filters", () => {
    const { result } = renderHook(() => useCollectiblesExplorer());
    expect(result.current.collectibles.length).toBeGreaterThan(0);
    expect(result.current.totalCollectibles).toBe(result.current.collectibles.length);
    expect(result.current.searchTerm).toBe("");
    expect(result.current.categoryFilter).toBe("all");
  });

  it("filters by search term", () => {
    const { result } = renderHook(() => useCollectiblesExplorer());
    act(() => result.current.setSearchTerm("ELS"));
    expect(result.current.collectibles.length).toBeLessThanOrEqual(result.current.totalCollectibles);
    if (result.current.collectibles.length > 0) {
      expect(
        result.current.collectibles.some((c) =>
          c.searchTokens?.includes("els") || c.id?.includes("ELS"),
        ),
      ).toBe(true);
    }
  });

  it("filters by category", () => {
    const { result } = renderHook(() => useCollectiblesExplorer());
    act(() => result.current.setCategoryFilter("story"));
    expect(result.current.collectibles.every((c) => c.category === "story")).toBe(true);
  });

  it("filters by story", () => {
    const { result } = renderHook(() => useCollectiblesExplorer());
    const stories = result.current.stories;
    if (stories.length > 0) {
      act(() => result.current.setStoryFilter(stories[0].code));
      expect(
        result.current.collectibles.every((c) => c.story === stories[0].code || c.category === "herald"),
      ).toBe(true);
    }
  });

  it("filters by heralds", () => {
    const { result } = renderHook(() => useCollectiblesExplorer());
    act(() => result.current.setStoryFilter("heralds"));
    expect(result.current.collectibles.every((c) => c.category === "herald")).toBe(true);
  });

  it("resets filters", () => {
    const { result } = renderHook(() => useCollectiblesExplorer());
    act(() => result.current.setSearchTerm("test"));
    act(() => result.current.setCategoryFilter("herald"));
    act(() => result.current.resetFilters());
    expect(result.current.searchTerm).toBe("");
    expect(result.current.categoryFilter).toBe("all");
    expect(result.current.storyFilter).toBe("all");
  });

  it("sorts by different fields", () => {
    const { result } = renderHook(() => useCollectiblesExplorer());
    act(() => result.current.setSortField("id"));
    expect(result.current.sortField).toBe("id");
    act(() => result.current.setSortField("category"));
    expect(result.current.sortField).toBe("category");
  });

  it("toggles sort direction", () => {
    const { result } = renderHook(() => useCollectiblesExplorer());
    const initial = result.current.sortDirection;
    act(() => result.current.setSortDirection((prev) => (prev === "asc" ? "desc" : "asc")));
    expect(result.current.sortDirection).not.toBe(initial);
  });

  it("filters by rarity", () => {
    const { result } = renderHook(() => useCollectiblesExplorer());
    const rarities = result.current.rarityOptions;
    if (rarities.length > 0) {
      act(() => result.current.setRarityFilter(rarities[0]));
      expect(result.current.collectibles.every((c) => c.rarity === rarities[0])).toBe(true);
    }
  });

  it("filters by rarity none for nonsense cards", () => {
    const { result } = renderHook(() => useCollectiblesExplorer());
    act(() => result.current.setRarityFilter("none"));
    expect(result.current.collectibles.every((c) => !c.rarity)).toBe(true);
  });

  it("sorts by story", () => {
    const { result } = renderHook(() => useCollectiblesExplorer());
    act(() => result.current.setSortField("story"));
    expect(result.current.sortField).toBe("story");
  });

  it("sorts by rarity", () => {
    const { result } = renderHook(() => useCollectiblesExplorer());
    act(() => result.current.setSortField("rarity"));
    expect(result.current.sortField).toBe("rarity");
  });
});
