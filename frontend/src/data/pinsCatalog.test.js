import { describe, expect, it } from "vitest";
import { gettingStartedTree } from "../pages/GettingStarted/gettingStartedCatalog";
import {
  collectiblesIndex,
  datasetSkus,
  getCollectibleRecord,
  getSkuRecord,
  isRetiredPinId,
} from "./collectibles.js";

const RETIRED_IDS = [
  "PIN-CPS4-03",
  "PIN-CPS4-04",
  "PIN-CPS4-06",
  "PIN-CPS4-08",
  "PIN-CPS4-09",
  "PIN-CPS4-10",
  "PIN-CPS4-11",
  "PIN-CPS4-12",
  "PIN-CPS4-13",
  "PIN-CYTO-01",
];

describe("pin catalog listing", () => {
  it("keeps retired pins out of browse, search, and the getting-started picker", () => {
    const listedIds = new Set(collectiblesIndex.map((item) => item.id));
    const skuIds = new Set(datasetSkus.map((sku) => sku.skuId));
    const pickerIds = new Set(
      gettingStartedTree.flatMap((section) =>
        section.children.flatMap((group) => group.skus.map((sku) => sku.skuId)),
      ),
    );

    for (const id of RETIRED_IDS) {
      expect(listedIds.has(id)).toBe(false);
      expect(skuIds.has(id)).toBe(false);
      expect(pickerIds.has(id)).toBe(false);
      expect(isRetiredPinId(id)).toBe(true);
      expect(collectiblesIndex.some((item) => item.searchTokens.includes(id.toLowerCase()))).toBe(
        false,
      );
    }

    expect(isRetiredPinId("PIN-CPS4-01")).toBe(false);
    expect(isRetiredPinId("PIN-CAMP-01")).toBe(false);
  });

  it("still resolves retired pins and uses the cleaned display names", () => {
    expect(getCollectibleRecord("PIN-CPS4-03")?.displayName).toBe("Series 4 - Pin 3 -");
    expect(getSkuRecord("PIN-CPS4-03")?.card?.displayName).toBe("Series 4 - Pin 3 -");
    expect(getCollectibleRecord("PIN-CPS4-13")?.displayName).toBe("Series 4 - Pin 0 -");
    expect(getCollectibleRecord("PIN-CYTO-01")?.displayName).toBe("DDF Two-Tone");

    expect(getCollectibleRecord("PIN-CPS4-05")?.displayName).toBe("Captain Tress");
    expect(getCollectibleRecord("PIN-CYTO-02")?.displayName).toBe("DDF Two-Tone (US)");
    expect(getCollectibleRecord("PIN-CYTO-03")?.displayName).toBe("DDF Two-Tone (UK)");
    expect(getCollectibleRecord("PIN-CONV-09")?.displayName).toBe(
      "Dragonsteel Nexus 2025 - Premium",
    );
    expect(getCollectibleRecord("PIN-LOGO-03")?.displayName).toBe("Dragonsteel Logo - Red");
    expect(getCollectibleRecord("PIN-OTHER-02")?.displayName).toBe("Aviar - Emberdark");
    expect(getCollectibleRecord("PIN-SHELF-06")?.displayName).toBe("Emberdark");
    expect(getCollectibleRecord("PIN-SHELF-01")?.displayName).toBe("Tress");
    expect(getCollectibleRecord("PIN-OTHER-10")?.displayName).toBe("Words of Radiance Backer Pin");
    expect(getCollectibleRecord("PIN-WHOP-03")?.displayName).toBe("Dragonsteel Nexus Worldhopper");
    expect(getCollectibleRecord("PIN-CAMP-01")?.displayName).toBe("Fires of December");
    expect(getCollectibleRecord("PIN-CPS4-01")?.displayName).toBe("Sazed");
    expect(getCollectibleRecord("PIN-CPS4-07")?.displayName).toBe("Maya");
  });
});
