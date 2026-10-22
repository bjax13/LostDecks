import { describe, expect, it } from "vitest";
import { compareCollectibles } from "./compareCollectibles.js";

function card(overrides) {
  return {
    id: "id",
    category: "story",
    storyTitle: "Alpha",
    number: 1,
    rarity: "Common",
    ...overrides,
  };
}

function sorted(items, sortField = "grouped", sortDirection = "asc") {
  return [...items].sort((a, b) => compareCollectibles(a, b, sortField, sortDirection));
}

describe("compareCollectibles", () => {
  describe("grouped", () => {
    const items = [
      card({ id: "pin-2", category: "pin", storyTitle: "Pins", number: 2 }),
      card({ id: "zeta", category: "zeta", storyTitle: "Zed", number: 1 }),
      card({ id: "ns-b-2", category: "nonsense", storyTitle: "Beta", number: 2 }),
      card({ id: "story-b-1", category: "story", storyTitle: "Beta", number: 1 }),
      card({ id: "herald-2", category: "herald", storyTitle: "Heraldic Order", number: 2 }),
      card({ id: "alpha-cat", category: "alpha", storyTitle: "Misc", number: 9 }),
      card({ id: "story-a-2", category: "story", storyTitle: "Alpha", number: 2 }),
      card({ id: "story-a-1", category: "story", storyTitle: "alpha", number: 1 }),
      card({ id: "ns-a-1b", category: "nonsense", storyTitle: "Alpha", number: 1 }),
      card({ id: "ns-a-1a", category: "nonsense", storyTitle: "Alpha", number: 1 }),
      card({ id: "herald-1", category: "herald", storyTitle: "Heraldic Order", number: 1 }),
      card({ id: "pin-1", category: "pin", storyTitle: "Pins", number: 1 }),
      card({ id: "story-b-missing", category: "story", storyTitle: "Beta", number: null }),
      card({ id: "relic-b", category: "relic", storyTitle: "Beta", number: 1 }),
      card({ id: "relic-a2", category: "relic", storyTitle: "Alpha", number: 2 }),
      card({ id: "relic-a1", category: "relic", storyTitle: "Alpha", number: 1 }),
    ];

    const ascendingIds = [
      "story-a-1",
      "story-a-2",
      "story-b-1",
      "story-b-missing",
      "herald-1",
      "herald-2",
      "ns-a-1a",
      "ns-a-1b",
      "ns-b-2",
      "pin-1",
      "pin-2",
      "alpha-cat",
      "relic-a1",
      "relic-a2",
      "relic-b",
      "zeta",
    ];

    it("orders by category, then story name, then card number", () => {
      expect(sorted(items).map((item) => item.id)).toEqual(ascendingIds);
    });

    it("reverses the whole order when direction is descending", () => {
      expect(sorted(items, "grouped", "desc").map((item) => item.id)).toEqual(
        [...ascendingIds].reverse(),
      );
    });
  });

  it("sorts by card number, then id", () => {
    const items = [
      card({ id: "b", number: 2 }),
      card({ id: "c", number: 1 }),
      card({ id: "a", number: 1 }),
    ];
    expect(sorted(items, "number").map((item) => item.id)).toEqual(["a", "c", "b"]);
    expect(sorted(items, "number", "desc").map((item) => item.id)).toEqual(["b", "c", "a"]);
  });

  it("sorts by card id", () => {
    const items = [card({ id: "b" }), card({ id: "a" })];
    expect(sorted(items, "id").map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("sorts category labels alphabetically, then id", () => {
    const items = [
      card({ id: "s", category: "story" }),
      card({ id: "p", category: "pin" }),
      card({ id: "h2", category: "herald" }),
      card({ id: "h1", category: "herald" }),
      card({ id: "n", category: "nonsense" }),
    ];
    expect(sorted(items, "category").map((item) => item.id)).toEqual(["h1", "h2", "n", "p", "s"]);
  });

  it("sorts by story title, then id", () => {
    const items = [
      card({ id: "b", storyTitle: "Beta" }),
      card({ id: "a2", storyTitle: "Alpha" }),
      card({ id: "a1", storyTitle: "Alpha" }),
    ];
    expect(sorted(items, "story").map((item) => item.id)).toEqual(["a1", "a2", "b"]);
  });

  it("sorts by rarity and leaves cards without a rarity last", () => {
    const items = [
      card({ id: "rare", rarity: "Rare" }),
      card({ id: "none", rarity: null }),
      card({ id: "common", rarity: "Common" }),
    ];
    expect(sorted(items, "rarity").map((item) => item.id)).toEqual(["common", "rare", "none"]);
  });
});
