import { renderHook } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { collectiblesIndex } from "../../../data/collectibles.js";
import { compareCollectibles } from "../utils/compareCollectibles.js";
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
    expect(result.current.collectibles.length).toBeLessThanOrEqual(
      result.current.totalCollectibles,
    );
    if (result.current.collectibles.length > 0) {
      expect(
        result.current.collectibles.some(
          (c) => c.searchTokens?.includes("els") || c.id?.includes("ELS"),
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
        result.current.collectibles.every(
          (c) => c.story === stories[0].code || c.category === "herald",
        ),
      ).toBe(true);
    }
  });

  it("filters by heralds", () => {
    const { result } = renderHook(() => useCollectiblesExplorer());
    act(() => result.current.setStoryFilter("heralds"));
    expect(result.current.collectibles.every((c) => c.category === "herald")).toBe(true);
  });

  it("exposes pin series as sub category options when Category is Pins", () => {
    const { result } = renderHook(() => useCollectiblesExplorer());
    act(() => result.current.setCategoryFilter("pin"));
    expect(result.current.isPinSubCategory).toBe(true);
    expect(result.current.stories.length).toBeGreaterThan(0);
    expect(result.current.stories.every((s) => s.code && s.title === s.code)).toBe(true);
    expect(result.current.storyFilter).toBe("all");
  });

  it("filters pins by series via Sub Category", () => {
    const { result } = renderHook(() => useCollectiblesExplorer());
    act(() => result.current.setCategoryFilter("pin"));
    const series = result.current.stories[0]?.code;
    expect(series).toBeTruthy();
    act(() => result.current.setStoryFilter(series));
    expect(result.current.collectibles.length).toBeGreaterThan(0);
    expect(
      result.current.collectibles.every(
        (c) => c.category === "pin" && (c.series ?? c.storyTitle) === series,
      ),
    ).toBe(true);
  });

  it("keeps story list sub category options for All categories", () => {
    const { result } = renderHook(() => useCollectiblesExplorer());
    expect(result.current.isPinSubCategory).toBe(false);
    expect(result.current.stories.some((s) => s.code && s.title && s.code !== s.title)).toBe(true);
  });

  it("resets Sub Category when Category changes", () => {
    const { result } = renderHook(() => useCollectiblesExplorer());
    act(() => result.current.setCategoryFilter("pin"));
    act(() => result.current.setStoryFilter(result.current.stories[0].code));
    expect(result.current.storyFilter).not.toBe("all");
    act(() => result.current.setCategoryFilter("story"));
    expect(result.current.storyFilter).toBe("all");
    expect(result.current.isPinSubCategory).toBe(false);
  });

  it("hides Sub Category and clears filter when Category is Heralds", () => {
    const { result } = renderHook(() => useCollectiblesExplorer());
    act(() => result.current.setStoryFilter(result.current.stories[0].code));
    expect(result.current.storyFilter).not.toBe("all");
    act(() => result.current.setCategoryFilter("herald"));
    expect(result.current.showSubCategory).toBe(false);
    expect(result.current.storyFilter).toBe("all");
    expect(result.current.collectibles.every((c) => c.category === "herald")).toBe(true);
  });

  it("resets filters", () => {
    const { result } = renderHook(() => useCollectiblesExplorer());
    act(() => result.current.setSearchTerm("test"));
    act(() => result.current.setCategoryFilter("herald"));
    act(() => result.current.setSortField("number"));
    act(() => result.current.setSortDirection("desc"));
    act(() => result.current.resetFilters());
    expect(result.current.searchTerm).toBe("");
    expect(result.current.categoryFilter).toBe("all");
    expect(result.current.storyFilter).toBe("all");
    expect(result.current.rarityFilter).toBe("all");
    expect(result.current.sortField).toBe("grouped");
    expect(result.current.sortDirection).toBe("asc");
  });

  it("sorts the catalog by category, story, and card number by default", () => {
    const { result } = renderHook(() => useCollectiblesExplorer());
    const expected = [...collectiblesIndex].sort((a, b) =>
      compareCollectibles(a, b, "grouped", "asc"),
    );
    const groupedIds = result.current.collectibles.map((collectible) => collectible.id);
    expect(result.current.sortField).toBe("grouped");
    expect(result.current.sortDirection).toBe("asc");
    expect(groupedIds).toEqual(expected.map((collectible) => collectible.id));

    act(() => result.current.setSortField("number"));
    expect(result.current.collectibles.map((collectible) => collectible.id)).not.toEqual(
      groupedIds,
    );
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
