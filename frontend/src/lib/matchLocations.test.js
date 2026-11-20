import { describe, expect, it } from "vitest";
import {
  buildLocationList,
  filterLocationOptions,
  locationSelectionForCountry,
  MATCH_COUNTRIES,
  normalizeMatchCountry,
  normalizeMatchRegion,
  resolveLocationOption,
  subdivisionsForCountry,
} from "./matchLocations.js";

describe("match location lists", () => {
  it("stores ISO country codes and includes the countries that have subdivisions", () => {
    const codes = MATCH_COUNTRIES.map((country) => country.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toEqual(expect.arrayContaining(["US", "CA", "AU", "GB"]));
    for (const country of MATCH_COUNTRIES) {
      expect(country.code).toMatch(/^[A-Z]{2}$/);
      expect(country.name.trim()).toBe(country.name);
    }
    expect(MATCH_COUNTRIES.find((country) => country.code === "US")?.name).toBe("United States");
    expect(MATCH_COUNTRIES.find((country) => country.code === "GB")?.name).toBe("United Kingdom");
  });

  it("lists subdivisions only for the US, Canada, Australia, and the UK", () => {
    expect(subdivisionsForCountry("US")).toHaveLength(51);
    expect(subdivisionsForCountry("CA")).toHaveLength(13);
    expect(subdivisionsForCountry("AU")).toHaveLength(8);
    expect(subdivisionsForCountry("GB")).toHaveLength(4);
    expect(subdivisionsForCountry("FR")).toEqual([]);
    expect(subdivisionsForCountry("JP")).toEqual([]);
    expect(subdivisionsForCountry("")).toEqual([]);

    expect(subdivisionsForCountry("US").map((region) => region.name)).toEqual(
      expect.arrayContaining(["California", "District of Columbia", "Utah"]),
    );
    expect(subdivisionsForCountry("CA").map((region) => region.code)).toContain("CA-ON");
    expect(subdivisionsForCountry("AU").map((region) => region.code)).toContain("AU-NSW");
    expect(subdivisionsForCountry("GB").map((region) => region.name)).toEqual(
      expect.arrayContaining(["England", "Scotland", "Wales", "Northern Ireland"]),
    );

    for (const countryCode of ["US", "CA", "AU", "GB"]) {
      for (const region of subdivisionsForCountry(countryCode)) {
        expect(region.code).toMatch(/^[A-Z]{2}-[A-Z0-9]{1,3}$/);
        expect(region.code.startsWith(`${countryCode}-`)).toBe(true);
      }
    }
  });

  it("accepts known codes only and clears state when the country changes", () => {
    expect(normalizeMatchCountry(" us ")).toBe("US");
    expect(normalizeMatchCountry("UK")).toBe("");
    expect(normalizeMatchCountry("California")).toBe("");
    expect(normalizeMatchRegion("US", "us-ut")).toBe("US-UT");
    expect(normalizeMatchRegion("CA", "US-UT")).toBe("");
    expect(normalizeMatchRegion("FR", "FR-75")).toBe("");
    expect(normalizeMatchRegion("", "US-UT")).toBe("");

    expect(locationSelectionForCountry("US")).toEqual({ matchCountry: "US", matchRegion: "" });
    expect(locationSelectionForCountry("CA")).toEqual({ matchCountry: "CA", matchRegion: "" });
    expect(locationSelectionForCountry("")).toEqual({ matchCountry: "", matchRegion: "" });
    expect(locationSelectionForCountry("not a country")).toEqual({
      matchCountry: "",
      matchRegion: "",
    });
  });

  it("pins the United States first and filters names without case", () => {
    const countries = filterLocationOptions(MATCH_COUNTRIES, "", { pinCode: "US" });
    expect(countries[0]).toMatchObject({ code: "US", name: "United States" });
    expect(countries[1]).toMatchObject({ code: "AF", name: "Afghanistan" });
    const restNames = countries.slice(1).map((country) => country.name);
    expect(restNames).toEqual([...restNames].sort((a, b) => a.localeCompare(b, "en")));

    expect(
      filterLocationOptions(MATCH_COUNTRIES, "UNI", { pinCode: "US" }).map((c) => c.name),
    ).toEqual(["United States", "United Arab Emirates", "United Kingdom", "Tunisia"]);
    expect(filterLocationOptions(MATCH_COUNTRIES, "cAn").map((country) => country.name)).toEqual([
      "Canada",
      "Central African Republic",
      "Dominican Republic",
      "Vatican City",
    ]);
    expect(filterLocationOptions(MATCH_COUNTRIES, "zzzz")).toEqual([]);
    expect(filterLocationOptions(MATCH_COUNTRIES, "gb").map((country) => country.code)).toEqual([
      "GB",
    ]);
  });

  it("ranks state names that start with the query ahead of other partial matches", () => {
    const states = subdivisionsForCountry("US");
    expect(filterLocationOptions(states, "ut").map((region) => region.name)).toEqual([
      "Utah",
      "Connecticut",
      "South Carolina",
      "South Dakota",
    ]);
    expect(filterLocationOptions(states, "US-UT").map((region) => region.code)).toEqual(["US-UT"]);
    expect(resolveLocationOption(states, " utah ")).toMatchObject({ code: "US-UT" });
    expect(resolveLocationOption(states, "us-ut")).toMatchObject({ code: "US-UT" });
    expect(resolveLocationOption(states, "Narnia")).toBeNull();
    expect(resolveLocationOption(states, "  ")).toBeNull();
  });

  it("keeps Not set available and still shows the United States first when unfiltered", () => {
    const list = buildLocationList(MATCH_COUNTRIES, "", { pinCode: "US", clearLabel: "Not set" });
    expect(list.slice(0, 3).map((option) => option.name)).toEqual([
      "United States",
      "Not set",
      "Afghanistan",
    ]);
    expect(list[1].code).toBe("");

    expect(
      buildLocationList(MATCH_COUNTRIES, "can", { pinCode: "US" }).map((option) => option.name),
    ).toEqual(["Canada", "Central African Republic", "Dominican Republic", "Vatican City"]);

    const states = buildLocationList(subdivisionsForCountry("US"), "");
    expect(states[0]).toMatchObject({ code: "", name: "Not set" });
    expect(states[1].name).toBe("Alabama");
  });
});
