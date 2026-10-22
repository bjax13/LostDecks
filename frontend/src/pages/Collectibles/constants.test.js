import { describe, expect, it } from "vitest";
import { categoryLabels, defaultSort, sortOptions } from "./constants.js";

describe("collectibles constants", () => {
  it("exposes category labels", () => {
    expect(categoryLabels.story).toBe("Story");
    expect(categoryLabels.herald).toBe("Herald");
    expect(categoryLabels.nonsense).toBe("Nonsense");
    expect(categoryLabels.pin).toBe("Pin");
  });

  it("lists sort options with value and label", () => {
    expect(sortOptions.length).toBeGreaterThan(0);
    for (const opt of sortOptions) {
      expect(typeof opt.value).toBe("string");
      expect(typeof opt.label).toBe("string");
    }
  });

  it("defaults to grouped category, story, and card number", () => {
    expect(defaultSort).toEqual({ field: "grouped", direction: "asc" });
    expect(sortOptions.map((opt) => opt.value)).toEqual([
      "grouped",
      "number",
      "id",
      "category",
      "story",
      "rarity",
    ]);
    expect(sortOptions[0].label).toBe("Grouped");
  });
});
