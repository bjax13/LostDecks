import { describe, expect, it } from "vitest";
import { ACCOUNT_MATCHING_HELP, MATCHES_PAGE_HELP } from "./matchHelpCopy.js";

describe("matchHelpCopy", () => {
  it("uses the approved Matches help text with the a/an typo fixed", () => {
    expect(MATCHES_PAGE_HELP).toBe(
      'A match is another collector who has 2+ of an item you own zero of, and you have 2+ of an item they own zero of, in the same lane: Dun cards pair with dun cards, Foil with foil, pin with pins. Both of you must have your "included in Matches" account setting turned on. Open a collector to see both trade matches and the contact info they chose to share.',
    );
    expect(MATCHES_PAGE_HELP).not.toMatch(/a item/);
    expect(MATCHES_PAGE_HELP).not.toMatch(/—/);
  });

  it("uses the approved Account matching help text", () => {
    expect(ACCOUNT_MATCHING_HELP).toBe(
      '"Include me in Matches" puts your collection in trade discovery. This does not expose your whole collection, it just allows people to see items you have 2+ of if they have 2+ of a similar item to trade. The lane boxes choose which kinds of items you\'re interested in trading, and both collectors must leave a lane on for it to count. Contact options only control what a match sees for you, not who you match with.',
    );
    expect(ACCOUNT_MATCHING_HELP).not.toMatch(/—/);
  });
});
