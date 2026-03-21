import { describe, expect, it } from "vitest";
import { categoryLabels, sortOptions } from "./constants.js";

describe("collectibles constants", () => {
  it("exposes category labels", () => {
    expect(categoryLabels.story).toBe("Story");
    expect(categoryLabels.herald).toBe("Herald");
    expect(categoryLabels.nonsense).toBe("Nonsense");
  });

  it("lists sort options with value and label", () => {
    expect(sortOptions.length).toBeGreaterThan(0);
    for (const opt of sortOptions) {
      expect(typeof opt.value).toBe("string");
      expect(typeof opt.label).toBe("string");
    }
  });
});
