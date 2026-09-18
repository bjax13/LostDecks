import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  SITE_FEEDBACK_CONTACTS,
  SITE_FEEDBACK_EMAIL,
  SITE_FEEDBACK_MAILTO,
  SITE_FEEDBACK_PLACES,
} from "../siteFeedback.js";
import { TestMemoryRouter } from "../test/router.jsx";
import SiteFeedbackContact from "./SiteFeedbackContact.jsx";

describe("SiteFeedbackContact", () => {
  it("exposes a mailto path and Discord usernames as plain text", () => {
    const { container } = render(
      <TestMemoryRouter>
        <SiteFeedbackContact />
      </TestMemoryRouter>,
    );

    expect(screen.getByRole("link", { name: SITE_FEEDBACK_EMAIL })).toHaveAttribute(
      "href",
      SITE_FEEDBACK_MAILTO,
    );
    expect(screen.getByText(/Discord:/)).toBeInTheDocument();
    expect(container.textContent).toContain(SITE_FEEDBACK_CONTACTS[0]);
    expect(container.textContent).toContain(SITE_FEEDBACK_CONTACTS[1]);
    expect(container.textContent).toContain(SITE_FEEDBACK_PLACES[0]);
    expect(container.textContent).toContain(SITE_FEEDBACK_PLACES[1]);
    expect(screen.queryByRole("link", { name: SITE_FEEDBACK_CONTACTS[0] })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: SITE_FEEDBACK_CONTACTS[1] })).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/discord\.gg/i);
    expect(container.textContent).not.toMatch(/[—–]/);
  });
});
