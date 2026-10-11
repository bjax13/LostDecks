import { describe, expect, it } from "vitest";
import { SITE_NAME, SITE_URL } from "./brand.js";

describe("SITE_NAME", () => {
  it("is ShardStash", () => {
    expect(SITE_NAME).toBe("ShardStash");
  });
});

describe("SITE_URL", () => {
  it("is the production Hosting origin", () => {
    expect(SITE_URL).toBe("https://shardstash.web.app");
  });
});
