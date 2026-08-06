import { describe, expect, it } from "vitest";
import {
  DEFAULT_DISCORD_CHANNEL,
  DEFAULT_USER_PREFERENCES,
  isValidTradingEmail,
  MATCH_CONTACT_SHARING,
  normalizeMatchContactSharing,
  normalizeUserPreferences,
} from "./userPreferences.js";

describe("userPreferences normalization", () => {
  it("returns defaults for missing or invalid data", () => {
    expect(normalizeUserPreferences(null)).toEqual(DEFAULT_USER_PREFERENCES);
    expect(normalizeUserPreferences(undefined)).toEqual(DEFAULT_USER_PREFERENCES);
    expect(normalizeUserPreferences("nope")).toEqual(DEFAULT_USER_PREFERENCES);
  });

  it("normalizes contact sharing fields and trims strings", () => {
    expect(
      normalizeUserPreferences({
        matchingOptOut: true,
        matchContactSharing: "tradingEmail",
        tradingEmail: "  trade@example.com  ",
        discordHandle: "  stormlight  ",
        discordChannel: "  Cosmere Trades  ",
      }),
    ).toEqual({
      matchingOptOut: true,
      matchContactSharing: MATCH_CONTACT_SHARING.TRADING_EMAIL,
      tradingEmail: "trade@example.com",
      discordHandle: "stormlight",
      discordChannel: "Cosmere Trades",
    });
  });

  it("falls back to default discord channel and contact sharing", () => {
    expect(
      normalizeUserPreferences({
        matchContactSharing: "sms",
        discordChannel: "   ",
      }),
    ).toEqual({
      matchingOptOut: false,
      matchContactSharing: MATCH_CONTACT_SHARING.TRUE_EMAIL,
      tradingEmail: "",
      discordHandle: "",
      discordChannel: DEFAULT_DISCORD_CHANNEL,
    });
  });

  it("validates trading emails lightly", () => {
    expect(isValidTradingEmail("trade@example.com")).toBe(true);
    expect(isValidTradingEmail(" not-an-email ")).toBe(false);
    expect(isValidTradingEmail("")).toBe(false);
    expect(normalizeMatchContactSharing("discord")).toBe(MATCH_CONTACT_SHARING.DISCORD);
  });
});
