import { describe, expect, it } from "vitest";
import { SITE_NAME } from "./brand.js";

describe("SITE_NAME", () => {
  it("is ShardStash", () => {
    expect(SITE_NAME).toBe("ShardStash");
  });
});
