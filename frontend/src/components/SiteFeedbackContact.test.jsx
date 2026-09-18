import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  SITE_FEEDBACK_CONTACTS,
  SITE_FEEDBACK_EMAIL,
  SITE_FEEDBACK_MAILTO,
} from "../siteFeedback.js";
import { TestMemoryRouter } from "../test/router.jsx";
import SiteFeedbackContact from "./SiteFeedbackContact.jsx";

describe("SiteFeedbackContact", () => {
  it("exposes a mailto path and Discord usernames", () => {
    render(
      <TestMemoryRouter>
        <SiteFeedbackContact />
      </TestMemoryRouter>,
    );

    expect(screen.getByRole("link", { name: SITE_FEEDBACK_EMAIL })).toHaveAttribute(
      "href",
      SITE_FEEDBACK_MAILTO,
    );
    expect(screen.getByText(/Discord:/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(SITE_FEEDBACK_CONTACTS[0]))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(SITE_FEEDBACK_CONTACTS[1]))).toBeInTheDocument();
  });
});
