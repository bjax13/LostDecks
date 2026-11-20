import { describe, expect, it } from "vitest";
import { categoryFilterFromQuery, categoryQueryForFilter } from "./categoryQuery.js";

describe("categoryFilterFromQuery", () => {
  it("maps Category option values", () => {
    expect(categoryFilterFromQuery("story")).toBe("story");
    expect(categoryFilterFromQuery("herald")).toBe("herald");
    expect(categoryFilterFromQuery("nonsense")).toBe("nonsense");
    expect(categoryFilterFromQuery("pin")).toBe("pin");
    expect(categoryFilterFromQuery("all")).toBe("all");
  });

  it("maps the public pins alias onto the Pins option", () => {
    expect(categoryFilterFromQuery("pins")).toBe("pin");
    expect(categoryFilterFromQuery(" Pins ")).toBe("pin");
    expect(categoryFilterFromQuery("PIN")).toBe("pin");
  });

  it("falls back to all categories for missing or unknown values", () => {
    expect(categoryFilterFromQuery(null)).toBe("all");
    expect(categoryFilterFromQuery(undefined)).toBe("all");
    expect(categoryFilterFromQuery("")).toBe("all");
    expect(categoryFilterFromQuery("relics")).toBe("all");
  });
});

describe("categoryQueryForFilter", () => {
  it("writes pins for the Pins option and omits all", () => {
    expect(categoryQueryForFilter("pin")).toBe("pins");
    expect(categoryQueryForFilter("all")).toBeNull();
    expect(categoryQueryForFilter("story")).toBe("story");
    expect(categoryQueryForFilter("herald")).toBe("herald");
    expect(categoryQueryForFilter("nonsense")).toBe("nonsense");
  });

  it("omits values that are not a Category option", () => {
    expect(categoryQueryForFilter("pins")).toBeNull();
    expect(categoryQueryForFilter("")).toBeNull();
    expect(categoryQueryForFilter(null)).toBeNull();
  });
});
