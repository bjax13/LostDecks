import { describe, expect, it } from "vitest";
import {
  SITE_FEEDBACK_CONTACTS,
  SITE_FEEDBACK_EMAIL,
  SITE_FEEDBACK_MAILTO,
  SITE_FEEDBACK_MAILTO_SUBJECT,
  SITE_FEEDBACK_PLACES,
} from "./siteFeedback.js";

describe("site feedback contacts", () => {
  it("uses the ShardStash inbox, Discord usernames, and Discord places", () => {
    expect(SITE_FEEDBACK_EMAIL).toBe("shardstashinfo@gmail.com");
    expect(SITE_FEEDBACK_MAILTO_SUBJECT).toBe("ShardStash feedback");
    expect(SITE_FEEDBACK_MAILTO).toBe(
      "mailto:shardstashinfo@gmail.com?subject=ShardStash%20feedback",
    );
    expect(SITE_FEEDBACK_PLACES).toEqual(["Sanderson Collectors Guild", "Story Deck Bazaar"]);
    expect(SITE_FEEDBACK_CONTACTS).toEqual(["gimpy_12", "1bjax"]);
    expect(SITE_FEEDBACK_PLACES.join(" ")).not.toMatch(/https?:\/\//);
    expect(SITE_FEEDBACK_CONTACTS.join(" ")).not.toMatch(/https?:\/\//);
    expect(SITE_FEEDBACK_PLACES.join(" ")).not.toMatch(/discord\.gg/i);
  });
});
