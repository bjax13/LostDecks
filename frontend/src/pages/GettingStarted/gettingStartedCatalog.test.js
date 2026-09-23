import { describe, expect, it } from "vitest";
import { datasetSkus } from "../../data/collectibles";
import {
  buildCollectionRows,
  COLLECTIBLE_TYPE_BOTH,
  COLLECTIBLE_TYPE_CARDS,
  COLLECTIBLE_TYPE_PINS,
  createCoverageState,
  DEFAULT_MANUAL_QUANTITY,
  deriveReviewStateFromEntries,
  filterGettingStartedTree,
  formatCollectionQuantityNoun,
  formatCollectionQuantitySummary,
  formatGroupQuantitySummary,
  formatQuantitySummary,
  formatReviewGroupLabel,
  formatSkuNumberLabel,
  formatSkuQuantityAriaLabel,
  getCollectionQuantityStats,
  getCondensedSkuListStyle,
  getDefaultExpandedReviewIds,
  getGroupQuantityStats,
  getSectionQuantityStats,
  getSkuFinishLabel,
  getSkuVariantLabel,
  gettingStartedTree,
  includesCards,
  includesPins,
  resolveSkuQuantity,
} from "./gettingStartedCatalog";

describe("gettingStartedCatalog", () => {
  it("organizes every catalog SKU into the ISO-style sections exactly once", () => {
    expect(gettingStartedTree.map((section) => section.label)).toEqual([
      "Story Foils",
      "Story Dun",
      "Heralds (Foil)",
      "Heralds (Dun)",
      "Nonsense (Dun)",
      "Nonsense (Foil)",
      "Pin Collections",
    ]);

    const treeSkuIds = gettingStartedTree.flatMap((section) =>
      section.children.flatMap((group) => group.skus.map((sku) => sku.skuId)),
    );
    const catalogSkuIds = datasetSkus.map((sku) => sku.skuId);

    expect(new Set(treeSkuIds)).toEqual(new Set(catalogSkuIds));
    expect(treeSkuIds).toHaveLength(catalogSkuIds.length);
  });

  it("groups ChasmFriends Pins under Pin Collections with a ChasmFriends group title", () => {
    const pinsSection = gettingStartedTree.find((section) => section.id === "pins");
    expect(pinsSection?.label).toBe("Pin Collections");
    expect(pinsSection?.children).toHaveLength(1);
    expect(pinsSection?.children[0].label).toBe("ChasmFriends");
    expect(pinsSection?.children[0].skus.map((sku) => sku.skuId)).toEqual([
      "PIN-CF-01",
      "PIN-CF-02",
      "PIN-CF-03",
      "PIN-CF-04",
      "PIN-CF-05",
    ]);
    expect(formatReviewGroupLabel(pinsSection.children[0], pinsSection)).toBe("ChasmFriends Pins");
  });

  it("filters the review tree by collectible type", () => {
    const pinsOnly = filterGettingStartedTree(gettingStartedTree, COLLECTIBLE_TYPE_PINS);
    expect(pinsOnly.map((section) => section.id)).toEqual(["pins"]);

    const cardsOnly = filterGettingStartedTree(gettingStartedTree, COLLECTIBLE_TYPE_CARDS);
    expect(cardsOnly.map((section) => section.id)).not.toContain("pins");
    expect(cardsOnly).toHaveLength(gettingStartedTree.length - 1);

    const both = filterGettingStartedTree(gettingStartedTree, COLLECTIBLE_TYPE_BOTH);
    expect(both).toEqual(gettingStartedTree);
    expect(includesPins(COLLECTIBLE_TYPE_PINS)).toBe(true);
    expect(includesPins(COLLECTIBLE_TYPE_CARDS)).toBe(false);
    expect(includesCards(COLLECTIBLE_TYPE_CARDS)).toBe(true);
    expect(includesCards(COLLECTIBLE_TYPE_PINS)).toBe(false);
    expect(formatCollectionQuantityNoun(COLLECTIBLE_TYPE_PINS)).toBe("pins");
    expect(formatCollectionQuantityNoun(COLLECTIBLE_TYPE_BOTH)).toBe("items");
    expect(formatCollectionQuantityNoun(COLLECTIBLE_TYPE_CARDS)).toBe("cards");
  });

  it("omits unused detail from tree SKU objects", () => {
    const cardSku = gettingStartedTree[0].children[0].skus[0];
    expect(cardSku).not.toHaveProperty("detail");
    expect(cardSku).toEqual(
      expect.objectContaining({
        skuId: expect.any(String),
        cardId: expect.any(String),
        label: expect.any(String),
        finish: expect.any(String),
        card: expect.any(Object),
      }),
    );

    const pinSku = gettingStartedTree.find((section) => section.id === "pins").children[0].skus[0];
    expect(pinSku.finish).toBeNull();
    expect(pinSku.label).toBe("Shreadad");
  });

  it("starts many-card collectors at all and few-card collectors at none", () => {
    expect(new Set(Object.values(createCoverageState("all")))).toEqual(new Set(["all"]));
    expect(new Set(Object.values(createCoverageState("none")))).toEqual(new Set(["none"]));

    const pinsTree = filterGettingStartedTree(gettingStartedTree, COLLECTIBLE_TYPE_PINS);
    const pinsCoverage = createCoverageState("none", pinsTree);
    expect(Object.keys(pinsCoverage)).toEqual([pinsTree[0].children[0].id]);
  });

  it("formats compact review labels without SKU ids", () => {
    const sku = gettingStartedTree[0].children[0].skus[0];
    expect(formatSkuNumberLabel(sku)).toBe(`#${sku.card.number}`);
    expect(getSkuVariantLabel(sku)).toBeNull();
    expect(getSkuFinishLabel(sku)).toBe("Foil");
  });

  it("formats pin review labels by name instead of number", () => {
    const pinSkus = gettingStartedTree.find((section) => section.id === "pins").children[0].skus;
    expect(pinSkus.map((sku) => formatSkuNumberLabel(sku))).toEqual([
      "Shreadad",
      "Howlerina",
      "Burp Slurper",
      "Darren",
      "Cleverclaws",
    ]);
    expect(
      formatSkuQuantityAriaLabel({
        groupTitle: "ChasmFriends Pins",
        numberLabel: "Shreadad",
      }),
    ).toBe("ChasmFriends Pins Shreadad quantity");
  });

  it("disambiguates nonsense SKUs that share a card number within a group", () => {
    const nonsenseDunSection = gettingStartedTree.find((section) => section.id === "nonsense-dun");
    const elsGroup = nonsenseDunSection.children.find((group) =>
      group.skus.some((sku) => sku.card.story === "ELS"),
    );
    const skusByVariant = Object.fromEntries(
      elsGroup.skus
        .filter((sku) => sku.card.number === 24 || sku.card.number === 54)
        .map((sku) => [sku.card.variantName ?? "standard", sku]),
    );

    expect(formatSkuNumberLabel(skusByVariant.Dance)).toBe("#24");
    expect(getSkuVariantLabel(skusByVariant.Dance, elsGroup.skus)).toBe("dance");
    expect(formatSkuNumberLabel(skusByVariant.Stolen)).toBe("#24");
    expect(getSkuVariantLabel(skusByVariant.Stolen, elsGroup.skus)).toBe("stolen");
    expect(formatSkuNumberLabel(skusByVariant.Traded)).toBe("#24");
    expect(getSkuVariantLabel(skusByVariant.Traded, elsGroup.skus)).toBe("traded");
    expect(formatSkuNumberLabel(skusByVariant.Mouse)).toBe("#54");
    expect(getSkuVariantLabel(skusByVariant.Mouse, elsGroup.skus)).toBe("mouse");
    expect(formatSkuNumberLabel(skusByVariant.Whale)).toBe("#54");
    expect(getSkuVariantLabel(skusByVariant.Whale, elsGroup.skus)).toBe("whale");
    expect(
      formatSkuQuantityAriaLabel({
        groupTitle: "Elsecaller Nonsense (Dun)",
        numberLabel: "#54",
        variantLabel: "mouse",
      }),
    ).toBe("Elsecaller Nonsense (Dun) Mouse #54 quantity");
  });

  it("keeps a single nonsense number unmarked when it is unique in the group", () => {
    const nonsenseDunSection = gettingStartedTree.find((section) => section.id === "nonsense-dun");
    const elsGroup = nonsenseDunSection.children.find((group) =>
      group.skus.some((sku) => sku.card.story === "ELS"),
    );
    const uniqueSku = elsGroup.skus.find((sku) => sku.card.number === 50);

    expect(formatSkuNumberLabel(uniqueSku)).toBe("#50");
    expect(getSkuVariantLabel(uniqueSku, elsGroup.skus)).toBeNull();
  });

  it("returns full variant names when first letters would collide within a shared number", () => {
    const nonsenseDunSection = gettingStartedTree.find((section) => section.id === "nonsense-dun");
    const elsGroup = nonsenseDunSection.children.find((group) =>
      group.skus.some((sku) => sku.card.story === "ELS"),
    );
    const skusByVariant = Object.fromEntries(
      elsGroup.skus
        .filter((sku) => sku.card.number === 34)
        .map((sku) => [sku.card.variantName, sku]),
    );

    expect(formatSkuNumberLabel(skusByVariant.Pirates)).toBe("#34");
    expect(getSkuVariantLabel(skusByVariant.Pirates, elsGroup.skus)).toBe("pirates");
    expect(formatSkuNumberLabel(skusByVariant.Scadrial)).toBe("#34");
    expect(getSkuVariantLabel(skusByVariant.Scadrial, elsGroup.skus)).toBe("scadrial");
    expect(formatSkuNumberLabel(skusByVariant.Sew)).toBe("#34");
    expect(getSkuVariantLabel(skusByVariant.Sew, elsGroup.skus)).toBe("sew");
  });

  it("computes column-major condensed SKU grid CSS variables", () => {
    expect(getCondensedSkuListStyle(0)).toEqual({
      "--sku-rows": "1",
      "--sku-cols": "1",
      "--sku-rows-narrow": "1",
      "--sku-cols-narrow": "1",
    });
    expect(getCondensedSkuListStyle(12)).toEqual({
      "--sku-rows": "3",
      "--sku-cols": "4",
      "--sku-rows-narrow": "6",
      "--sku-cols-narrow": "2",
    });
    expect(getCondensedSkuListStyle(11)).toEqual({
      "--sku-rows": "3",
      "--sku-cols": "4",
      "--sku-rows-narrow": "6",
      "--sku-cols-narrow": "2",
    });
    expect(getCondensedSkuListStyle(5)).toEqual({
      "--sku-rows": "1",
      "--sku-cols": "5",
      "--sku-rows-narrow": "3",
      "--sku-cols-narrow": "2",
    });
  });

  it("includes the section finish in review group titles", () => {
    const foilSection = gettingStartedTree[0];
    const dunSection = gettingStartedTree[1];
    const foilGroup = foilSection.children[0];
    const dunGroup = dunSection.children[0];

    expect(formatReviewGroupLabel(foilGroup, foilSection)).toBe(`${foilGroup.label} Story Foils`);
    expect(formatReviewGroupLabel(dunGroup, dunSection)).toBe(`${dunGroup.label} Story Dun`);
  });

  it("expands all sections and only Some groups by default", () => {
    const coverage = createCoverageState("all");
    const storyFoilGroup = gettingStartedTree[0].children[0];
    const storyDunGroup = gettingStartedTree[1].children[0];
    coverage[storyFoilGroup.id] = "some";

    const expanded = getDefaultExpandedReviewIds(coverage);

    expect(expanded.has("story-foils")).toBe(true);
    expect(expanded.has("story-dun")).toBe(true);
    expect(expanded.has(storyFoilGroup.id)).toBe(true);
    expect(expanded.has(storyDunGroup.id)).toBe(false);
  });

  it("resolves SKU quantities from map overrides then coverage defaults", () => {
    expect(DEFAULT_MANUAL_QUANTITY).toBe(0);
    expect(resolveSkuQuantity("sku-a", "all", {}, DEFAULT_MANUAL_QUANTITY)).toBe(1);
    expect(resolveSkuQuantity("sku-a", "none", {}, DEFAULT_MANUAL_QUANTITY)).toBe(0);
    expect(resolveSkuQuantity("sku-a", "some", {}, DEFAULT_MANUAL_QUANTITY)).toBe(0);
    expect(resolveSkuQuantity("sku-a", "some", {}, 1)).toBe(1);
    expect(resolveSkuQuantity("sku-a", "all", { "sku-a": 2 }, DEFAULT_MANUAL_QUANTITY)).toBe(2);
    expect(resolveSkuQuantity("sku-a", "none", { "sku-a": 5 }, DEFAULT_MANUAL_QUANTITY)).toBe(5);
    expect(resolveSkuQuantity("sku-a", "all", { "sku-a": "" }, DEFAULT_MANUAL_QUANTITY)).toBe(1);
    expect(resolveSkuQuantity("sku-a", "all", { "sku-a": "bad" }, DEFAULT_MANUAL_QUANTITY)).toBe(1);
    expect(resolveSkuQuantity("sku-a", "some", { "sku-a": "bad" }, 0)).toBe(0);
  });

  it("sums per-SKU quantities and counts unique SKUs for a group", () => {
    const allGroup = gettingStartedTree[0].children[0];
    const someGroup = gettingStartedTree[1].children[0];
    const coverage = {
      [allGroup.id]: "all",
      [someGroup.id]: "some",
    };
    const skuCount = allGroup.skus.length;

    expect(getGroupQuantityStats(allGroup, coverage, {}, 0)).toEqual({
      total: skuCount,
      unique: skuCount,
      possible: skuCount,
    });
    expect(getGroupQuantityStats(someGroup, coverage, {}, 0)).toEqual({
      total: 0,
      unique: 0,
      possible: someGroup.skus.length,
    });
    expect(getGroupQuantityStats(someGroup, coverage, {}, 1)).toEqual({
      total: someGroup.skus.length,
      unique: someGroup.skus.length,
      possible: someGroup.skus.length,
    });

    const changedSku = someGroup.skus[0].skuId;
    const anotherSku = someGroup.skus[1].skuId;
    expect(
      getGroupQuantityStats(someGroup, coverage, { [changedSku]: 3, [anotherSku]: "" }, 0),
    ).toEqual({ total: 3, unique: 1, possible: someGroup.skus.length });
    expect(
      getGroupQuantityStats(someGroup, coverage, { [changedSku]: "bad", [anotherSku]: 2 }, 0),
    ).toEqual({ total: 2, unique: 1, possible: someGroup.skus.length });

    // All coverage still honors explicit map overrides for display/stats.
    const overrideSku = allGroup.skus[0].skuId;
    expect(getGroupQuantityStats(allGroup, coverage, { [overrideSku]: 2 }, 0)).toEqual({
      total: skuCount + 1,
      unique: skuCount,
      possible: skuCount,
    });
    expect(formatGroupQuantitySummary(allGroup, coverage, {}, 0)).toBe(
      `${skuCount} total ${skuCount}/${skuCount} unique`,
    );
    expect(formatQuantitySummary({ total: 3, unique: 1, possible: 5 })).toBe("3 total 1/5 unique");
  });

  it("aggregates per-group quantity stats across a section", () => {
    const storyFoilsSection = gettingStartedTree[0];
    const allGroup = storyFoilsSection.children[0];
    const someGroup = storyFoilsSection.children[1];
    const coverage = {
      [allGroup.id]: "all",
      [someGroup.id]: "some",
    };

    const possibleInSection = storyFoilsSection.children.reduce(
      (sum, group) => sum + group.skus.length,
      0,
    );

    expect(getSectionQuantityStats(storyFoilsSection, coverage, {}, 0)).toEqual({
      total: allGroup.skus.length,
      unique: allGroup.skus.length,
      possible: possibleInSection,
    });
    expect(formatQuantitySummary(getSectionQuantityStats(storyFoilsSection, coverage, {}, 0))).toBe(
      `${allGroup.skus.length} total ${allGroup.skus.length}/${possibleInSection} unique`,
    );

    const changedSku = someGroup.skus[0].skuId;
    expect(getSectionQuantityStats(storyFoilsSection, coverage, { [changedSku]: 2 }, 0)).toEqual({
      total: allGroup.skus.length + 2,
      unique: allGroup.skus.length + 1,
      possible: possibleInSection,
    });
  });

  it("aggregates per-section quantity stats across the full collection tree", () => {
    const coverage = createCoverageState("all");
    const someGroup = gettingStartedTree[0].children[1];
    coverage[someGroup.id] = "some";
    const changedSku = someGroup.skus[0].skuId;
    const totalSkus = gettingStartedTree.reduce(
      (count, section) =>
        count + section.children.reduce((sum, group) => sum + group.skus.length, 0),
      0,
    );

    expect(getCollectionQuantityStats(gettingStartedTree, coverage, {}, 1)).toEqual({
      total: totalSkus,
      unique: totalSkus,
      possible: totalSkus,
    });
    expect(formatCollectionQuantitySummary(gettingStartedTree, coverage, {}, 1)).toBe(
      `${totalSkus} total ${totalSkus}/${totalSkus} unique cards`,
    );
    expect(
      formatCollectionQuantitySummary(gettingStartedTree, coverage, {}, 1, COLLECTIBLE_TYPE_PINS),
    ).toBe(`${totalSkus} total ${totalSkus}/${totalSkus} unique pins`);
    expect(
      getCollectionQuantityStats(gettingStartedTree, coverage, { [changedSku]: 0 }, 1),
    ).toEqual({
      total: totalSkus - 1,
      unique: totalSkus - 1,
      possible: totalSkus,
    });
  });

  it("derives review coverage and quantities from saved collection entries", () => {
    const allGroup = gettingStartedTree[0].children[0];
    const skuWithQty = allGroup.skus[0].skuId;

    const { coverage, quantities } = deriveReviewStateFromEntries(
      [{ skuId: skuWithQty, quantity: 2 }],
      gettingStartedTree,
    );

    expect(quantities[skuWithQty]).toBe("2");
    expect(coverage[allGroup.id]).toBe("some");

    const emptyGroup = gettingStartedTree[1].children[0];
    expect(coverage[emptyGroup.id]).toBe("none");
  });

  it("turns coverage and manual quantities into bulk collection rows", () => {
    const coverage = createCoverageState("none");
    const allGroup = gettingStartedTree[0].children[0];
    const someGroup = gettingStartedTree[1].children[0];
    coverage[allGroup.id] = "all";
    coverage[someGroup.id] = "some";
    const changedSku = someGroup.skus[0].skuId;
    const allOverrideSku = allGroup.skus[0].skuId;

    const rows = buildCollectionRows(
      coverage,
      { [changedSku]: 3, [allOverrideSku]: 2 },
      DEFAULT_MANUAL_QUANTITY,
    );
    const bySku = new Map(rows.map((row) => [row.skuId, row.quantity]));

    // All-coverage with map override must emit the override, not hardcoded "1".
    expect(bySku.get(allOverrideSku)).toBe("2");
    expect(bySku.get(allGroup.skus[1].skuId)).toBe("1");
    expect(bySku.get(changedSku)).toBe("3");
    expect(bySku.get(someGroup.skus[1].skuId)).toBe("0");

    const pinsTree = filterGettingStartedTree(gettingStartedTree, COLLECTIBLE_TYPE_PINS);
    const pinsCoverage = createCoverageState("all", pinsTree);
    const pinRows = buildCollectionRows(pinsCoverage, {}, DEFAULT_MANUAL_QUANTITY, pinsTree);
    expect(pinRows.map((row) => row.skuId)).toEqual([
      "PIN-CF-01",
      "PIN-CF-02",
      "PIN-CF-03",
      "PIN-CF-04",
      "PIN-CF-05",
    ]);
  });
});
