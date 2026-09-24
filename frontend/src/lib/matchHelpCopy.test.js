import { describe, expect, it } from "vitest";
import {
  ACCOUNT_MATCHING_HELP,
  MATCH_KEEP_HELP,
  MATCHES_KEEP_TIP,
  MATCHES_PAGE_HELP,
} from "./matchHelpCopy.js";

describe("matchHelpCopy", () => {
  it("explains matches with per-type keep instead of a fixed 2+ rule", () => {
    expect(MATCHES_KEEP_TIP).toBe(
      "Each collector sets how many to keep per type (default 1). Matches use that for both needs and extras.",
    );
    expect(MATCHES_PAGE_HELP).toBe(
      "A match is another collector with extras for an item you still need, where you also have extras for an item they still need, in the same lane: dun cards, foil cards, or pins. Each collector sets how many to keep per type (default 1). Matches use that for both needs and extras. Both of you must have included in Matches turned on. Open a collector to see both piles and the contact info they chose to share.",
    );
    expect(MATCHES_PAGE_HELP).not.toMatch(/a item/);
    expect(MATCHES_PAGE_HELP).not.toMatch(/—/);
    expect(MATCHES_PAGE_HELP).not.toMatch(/2\+/);
    expect(MATCHES_KEEP_TIP).not.toMatch(/—/);
  });

  it("uses the approved Account matching help text", () => {
    expect(MATCH_KEEP_HELP).toBe(
      "You're looking until you hit this number. Only copies above it are tradeable.",
    );
    expect(ACCOUNT_MATCHING_HELP).toBe(
      '"Include me in Matches" puts your collection in trade discovery. Matches show extras, copies above what each collector keeps, when the other still needs them. The lane boxes choose which kinds of items you\'re interested in trading, and both collectors must leave a lane on for it to count. Contact options only control what a match sees for you, not who you match with.',
    );
    expect(ACCOUNT_MATCHING_HELP).not.toMatch(/—/);
    expect(ACCOUNT_MATCHING_HELP).not.toMatch(/2\+/);
    expect(MATCH_KEEP_HELP).not.toMatch(/—/);
  });
});
