import { describe, expect, it } from "vitest";
import {
  SITE_FEEDBACK_CONTACTS,
  SITE_FEEDBACK_EMAIL,
  SITE_FEEDBACK_GUILD,
  SITE_FEEDBACK_MAILTO,
  SITE_FEEDBACK_MAILTO_SUBJECT,
} from "./siteFeedback.js";

describe("site feedback contacts", () => {
  it("uses the ShardStash inbox and Discord usernames", () => {
    expect(SITE_FEEDBACK_EMAIL).toBe("shardstashinfo@gmail.com");
    expect(SITE_FEEDBACK_MAILTO_SUBJECT).toBe("ShardStash feedback");
    expect(SITE_FEEDBACK_MAILTO).toBe(
      "mailto:shardstashinfo@gmail.com?subject=ShardStash%20feedback",
    );
    expect(SITE_FEEDBACK_GUILD).toBe("Sanderson Collectors Guild");
    expect(SITE_FEEDBACK_CONTACTS).toEqual(["gimpy_12", "1bjax"]);
  });
});
