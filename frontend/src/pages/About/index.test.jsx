import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  SITE_FEEDBACK_CONTACTS,
  SITE_FEEDBACK_EMAIL,
  SITE_FEEDBACK_GUILD,
  SITE_FEEDBACK_MAILTO,
} from "../../siteFeedback.js";
import { TestMemoryRouter } from "../../test/router.jsx";
import AboutPage from "./index.jsx";

describe("About page", () => {
  it("renders the About blurb with Story Deck, ChasmFriends, and ShardStash copy", () => {
    render(
      <TestMemoryRouter>
        <AboutPage />
      </TestMemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "About" })).toBeInTheDocument();
    expect(screen.getByText(/ShardStash has two jobs: track what you own/i)).toBeInTheDocument();
    expect(screen.getByText(/Story Deck set/)).toBeInTheDocument();
    expect(screen.getByText(/grab-bag ChasmFriends/)).toBeInTheDocument();
    expect(screen.queryByText(/Lost Tales Marketplace/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Lost Decks/i)).not.toBeInTheDocument();
  });

  it("offers email mailto and Discord usernames without requiring sign-in", () => {
    render(
      <TestMemoryRouter>
        <AboutPage />
      </TestMemoryRouter>,
    );

    const page = screen.getByRole("main");
    expect(screen.getByRole("link", { name: SITE_FEEDBACK_EMAIL })).toHaveAttribute(
      "href",
      SITE_FEEDBACK_MAILTO,
    );
    expect(page).toHaveTextContent(`Email ideas or bugs to ${SITE_FEEDBACK_EMAIL}`);
    expect(page).toHaveTextContent(SITE_FEEDBACK_GUILD);
    expect(page).toHaveTextContent(SITE_FEEDBACK_CONTACTS[0]);
    expect(page).toHaveTextContent(SITE_FEEDBACK_CONTACTS[1]);
  });
});
