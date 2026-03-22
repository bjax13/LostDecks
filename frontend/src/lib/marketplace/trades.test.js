import { describe, expect, it } from "vitest";
import { TRADES_PATH } from "./trades.js";

describe("trades (unit)", () => {
  it("exports TRADES_PATH constant", () => {
    expect(TRADES_PATH).toBe("trades");
  });
});
