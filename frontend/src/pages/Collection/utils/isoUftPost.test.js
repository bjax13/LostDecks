import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildIsoUftPost,
  buildIsoUftPostTree,
  DEFAULT_EXCLUDED_SECTION_IDS,
  formatIsoUftPost,
  getDefaultExcludedIds,
} from "./isoUftPost.js";

const collectiblesState = vi.hoisted(() => ({
  skus: [],
  stories: [{ title: "Zeta" }, { title: "Alpha" }],
  cardById: {},
}));

vi.mock("../../../data/collectibles", () => ({
  get datasetSkus() {
    return collectiblesState.skus;
  },
  get datasetStories() {
    return collectiblesState.stories;
  },
  getCollectibleRecord: (cardId) => collectiblesState.cardById[cardId] ?? null,
}));

describe("isoUftPost", () => {
  beforeEach(() => {
    collectiblesState.stories = [{ title: "Zeta" }, { title: "Alpha" }];
    collectiblesState.skus = [
      { skuId: "owned-story-foil", cardId: "c-owned-sf", finish: "FOIL" },
      { skuId: "iso-story-foil", cardId: "c-iso-sf", finish: "FOIL" },
      { skuId: "uft-story-foil", cardId: "c-uft-sf", finish: "FOIL" },
      { skuId: "iso-herald-dun", cardId: "c-iso-hd", finish: "DUN" },
      { skuId: "uft-nonsense-variant", cardId: "c-uft-ns", finish: "FOIL" },
      { skuId: "uft-nonsense-plain", cardId: "c-uft-ns2", finish: "DUN" },
    ];
    collectiblesState.cardById = {
      "c-owned-sf": { category: "story", number: 8, storyTitle: "Alpha" },
      "c-iso-sf": { category: "story", number: 9, storyTitle: "Alpha" },
      "c-uft-sf": { category: "story", number: 10, storyTitle: "Zeta" },
      "c-iso-hd": {
        category: "herald",
        number: Number.NaN,
        displayName: "Test Herald",
        storyTitle: "Alpha",
      },
      "c-uft-ns": {
        category: "nonsense",
        number: 7,
        detail: "variant:  Sparkle ",
        storyTitle: "Zeta",
      },
      "c-uft-ns2": {
        category: "nonsense",
        number: 8,
        detail: "  standard variant  ",
        storyTitle: "Alpha",
      },
    };
  });

  const entries = [
    { skuId: "owned-story-foil", quantity: 1 },
    { skuId: "uft-story-foil", quantity: 3 },
    { skuId: "uft-nonsense-variant", count: 2 },
    { skuId: "uft-nonsense-plain", total: 4 },
    { skuId: "", quantity: 1 },
    { quantity: 2 },
    { skuId: "skip-zero", quantity: 0 },
  ];

  it("builds a nested tree with modes, sections, and story leaves", () => {
    const { tree, skippedEntries } = buildIsoUftPostTree(entries);

    expect(skippedEntries).toBe(2);
    expect(tree).toHaveLength(2);
    expect(tree[0]).toMatchObject({ id: "iso", label: "ISO" });
    expect(tree[1]).toMatchObject({ id: "uft", label: "UFT" });

    const isoStoryFoils = tree[0].children.find((section) => section.id === "iso:story-foils");
    expect(isoStoryFoils).toMatchObject({ label: "Story Foils" });
    expect(isoStoryFoils.children).toEqual([
      expect.objectContaining({
        id: "iso:story-foils:Alpha",
        label: "Alpha",
        line: "Alpha Foils: 9",
      }),
    ]);

    const uftSections = tree[1].children.map((section) => section.id);
    expect(uftSections).toEqual(
      expect.arrayContaining(["uft:story-foils", "uft:nonsense-foil", "uft:nonsense-dun"]),
    );

    const isoSectionIds = tree[0].children.map((section) => section.id);
    expect(isoSectionIds).toEqual(["iso:story-foils"]);
    expect(isoSectionIds).not.toContain("iso:heralds-dun");
  });

  it("does not list unowned SKUs from stories or finishes the user has not started", () => {
    collectiblesState.skus = [
      { skuId: "chm-01-dun", cardId: "c-chm-01", finish: "DUN" },
      { skuId: "chm-01-foil", cardId: "c-chm-01", finish: "FOIL" },
      { skuId: "chm-02-dun", cardId: "c-chm-02", finish: "DUN" },
      { skuId: "els-01-dun", cardId: "c-els-01", finish: "DUN" },
      { skuId: "herald-dun", cardId: "c-herald", finish: "DUN" },
    ];
    collectiblesState.cardById = {
      "c-chm-01": { category: "story", number: 1, storyTitle: "Chasm" },
      "c-chm-02": { category: "story", number: 2, storyTitle: "Chasm" },
      "c-els-01": { category: "story", number: 1, storyTitle: "Elsecaller" },
      "c-herald": { category: "herald", number: 1, displayName: "Herald", storyTitle: "Heralds" },
    };

    const { tree } = buildIsoUftPostTree([{ skuId: "chm-01-dun", quantity: 1 }]);
    const isoSectionIds = tree[0].children.map((section) => section.id);
    expect(isoSectionIds).toEqual(["iso:story-dun"]);

    expect(tree[0].children[0].children).toEqual([
      expect.objectContaining({
        id: "iso:story-dun:Chasm",
        line: "Chasm Dun: 2",
      }),
    ]);
    expect(tree[1].children).toHaveLength(0);
  });

  it("lists only extras as UFT and keeps owned SKUs out of ISO", () => {
    collectiblesState.skus = [
      { skuId: "chm-01-dun", cardId: "c-chm-01", finish: "DUN" },
      { skuId: "chm-02-dun", cardId: "c-chm-02", finish: "DUN" },
      { skuId: "chm-03-dun", cardId: "c-chm-03", finish: "DUN" },
    ];
    collectiblesState.cardById = {
      "c-chm-01": { category: "story", number: 1, storyTitle: "Chasm" },
      "c-chm-02": { category: "story", number: 2, storyTitle: "Chasm" },
      "c-chm-03": { category: "story", number: 3, storyTitle: "Chasm" },
    };

    const { text } = buildIsoUftPost([
      { skuId: "chm-01-dun", quantity: 1 },
      { skuId: "chm-02-dun", quantity: 3 },
    ]);

    const [isoBlock, uftBlock] = text.split("UFT:");
    expect(isoBlock).toMatch(/Chasm Dun: 3\b/);
    expect(isoBlock).not.toMatch(/Chasm Dun:.*\b1\b/);
    expect(isoBlock).not.toMatch(/Chasm Dun:.*\b2\b/);
    expect(uftBlock).toMatch(/Chasm Dun: 2\b/);
    expect(uftBlock).not.toMatch(/Chasm Dun:.*\b1\b/);
    expect(uftBlock).not.toMatch(/Chasm Dun:.*\b3\b/);
  });

  it("omits empty sections from the tree", () => {
    collectiblesState.skus = [{ skuId: "uft-story-foil", cardId: "c-uft-sf", finish: "FOIL" }];
    collectiblesState.cardById = {
      "c-uft-sf": { category: "story", number: 10, storyTitle: "Zeta" },
    };

    const { tree } = buildIsoUftPostTree([{ skuId: "uft-story-foil", quantity: 3 }]);
    expect(tree[0].children).toHaveLength(0);
    expect(tree[1].children).toHaveLength(1);
    expect(tree[1].children[0].id).toBe("uft:story-foils");
  });

  it("formats the full post matching legacy output", () => {
    const { tree } = buildIsoUftPostTree(entries);
    const text = formatIsoUftPost(tree);

    expect(text).toContain("ISO:");
    expect(text).toContain("Story Foils:");
    expect(text).toMatch(/Alpha Foils: 9/);
    expect(text).toContain("UFT:");
    expect(text).toContain("Story Foils:");
    expect(text).toMatch(/Zeta Foils: 10/);
    expect(text).toMatch(/7\s+Sparkle/);
    expect(text).toMatch(/Alpha Nonsense: 8/);
  });

  it("omits an entire mode when excluded", () => {
    const { tree } = buildIsoUftPostTree(entries);
    const text = formatIsoUftPost(tree, new Set(["iso"]));

    expect(text).not.toContain("ISO:");
    expect(text).toContain("UFT:");
  });

  it("omits a section and its story lines when the section is excluded", () => {
    const { tree } = buildIsoUftPostTree(entries);
    const text = formatIsoUftPost(tree, new Set(["iso:story-foils", "iso:heralds-dun"]));

    const [isoBlock] = text.split("UFT:");
    expect(isoBlock).toContain("ISO:");
    expect(isoBlock).not.toContain("Story Foils:");
    expect(isoBlock).not.toMatch(/Alpha Foils:/);
    expect(isoBlock).not.toContain("Heralds (Dun):");
    expect(isoBlock).toContain("None needed yet.");
    expect(text).toContain("UFT:");
    expect(text).toContain("Story Foils:");
  });

  it("omits only an excluded story leaf", () => {
    const { tree } = buildIsoUftPostTree(entries);
    const text = formatIsoUftPost(tree, new Set(["uft:story-foils:Zeta"]));

    expect(text).toContain("UFT:");
    expect(text).not.toMatch(/Zeta Foils:/);
    expect(text).toMatch(/7\s+Sparkle/);
  });

  it("shows fallback when a mode is included but all sections are excluded", () => {
    const { tree } = buildIsoUftPostTree(entries);
    const excluded = new Set([
      "iso:story-foils",
      "iso:heralds-dun",
      "uft:story-foils",
      "uft:nonsense-foil",
      "uft:nonsense-dun",
    ]);
    const text = formatIsoUftPost(tree, excluded);

    expect(text).toContain("ISO:");
    expect(text).toContain("None needed yet.");
    expect(text).toContain("UFT:");
    expect(text).toContain("None available yet.");
  });

  it("buildIsoUftPost wrapper applies exclusions and returns skippedEntries", () => {
    const { text, skippedEntries } = buildIsoUftPost(entries, {
      excludedIds: new Set(["iso"]),
    });

    expect(skippedEntries).toBe(2);
    expect(text).not.toContain("ISO:");
    expect(text).toContain("UFT:");
  });

  it("getDefaultExcludedIds excludes only UFT Story Dun by default", () => {
    expect(DEFAULT_EXCLUDED_SECTION_IDS).toEqual(["uft:story-dun"]);
    expect(getDefaultExcludedIds()).toEqual(new Set(["uft:story-dun"]));
  });

  it("omits UFT Story Dun when default exclusions are applied", () => {
    collectiblesState.skus = [
      { skuId: "uft-story-dun", cardId: "c-uft-sd", finish: "DUN" },
      { skuId: "uft-story-foil", cardId: "c-uft-sf", finish: "FOIL" },
    ];
    collectiblesState.cardById = {
      "c-uft-sd": { category: "story", number: 3, storyTitle: "Alpha" },
      "c-uft-sf": { category: "story", number: 10, storyTitle: "Zeta" },
    };

    const { tree } = buildIsoUftPostTree([{ skuId: "uft-story-dun", quantity: 2 }]);
    const text = formatIsoUftPost(tree, getDefaultExcludedIds());

    expect(text).toContain("UFT:");
    expect(text).not.toContain("Story Dun:");
    expect(text).not.toMatch(/Alpha Dun:/);
  });
});
