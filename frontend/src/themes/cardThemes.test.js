import { describe, expect, it } from "vitest";
import { getAvailableThemes, getTheme } from "./cardThemes.js";

describe("cardThemes (unit)", () => {
  describe("getTheme", () => {
    it("returns default theme when given 'default'", () => {
      const theme = getTheme("default");
      expect(theme).toBeDefined();
      expect(theme.primary).toBe("#8A2BE2");
      expect(theme.accent).toBe("#ffd700");
    });

    it("returns theme by name when given theme name directly", () => {
      const theme = getTheme("elsecaller");
      expect(theme).toBeDefined();
      expect(theme.primary).toBe("#8C5AC8");
    });

    it("maps story code ELS to elsecaller theme", () => {
      const theme = getTheme("ELS");
      expect(theme.primary).toBe("#8C5AC8");
    });

    it("maps story code LOP to lopen theme", () => {
      const theme = getTheme("LOP");
      expect(theme.primary).toBe("#E5B84B");
    });

    it("maps story code CHM to chasm theme", () => {
      const theme = getTheme("CHM");
      expect(theme.primary).toBe("#FFCE4B");
    });

    it("returns default theme for unknown story code", () => {
      const theme = getTheme("UNKNOWN");
      expect(theme.primary).toBe("#8A2BE2");
    });
  });

  describe("getAvailableThemes", () => {
    it("returns array of theme names", () => {
      const themes = getAvailableThemes();
      expect(Array.isArray(themes)).toBe(true);
      expect(themes).toContain("default");
      expect(themes).toContain("elsecaller");
      expect(themes).toContain("lopen");
      expect(themes).toContain("chasm");
    });
  });
});
