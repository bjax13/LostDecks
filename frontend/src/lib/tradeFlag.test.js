import { describe, expect, it } from "vitest";
import { pileTradeFlagTag } from "./tradeFlag.js";

describe("pileTradeFlagTag", () => {
  it("uses the pile prefix and joins both flags into one label", () => {
    expect(pileTradeFlagTag("they", ["uft", "iso"])).toBe("They can send you · ISO · UFT");
    expect(pileTradeFlagTag("you", ["iso", "uft"])).toBe("You can send them · ISO · UFT");
  });

  it("keeps a single flag on the pile it belongs to", () => {
    expect(pileTradeFlagTag("they", ["iso"])).toBe("They can send you · ISO");
    expect(pileTradeFlagTag("you", ["uft"])).toBe("You can send them · UFT");
  });
});
