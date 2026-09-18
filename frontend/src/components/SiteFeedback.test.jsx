import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  SITE_FEEDBACK_CONTACTS,
  SITE_FEEDBACK_EMAIL,
  SITE_FEEDBACK_MAILTO,
  SITE_FEEDBACK_PLACES,
} from "../siteFeedback.js";
import { TestMemoryRouter } from "../test/router.jsx";
import SiteFeedback from "./SiteFeedback.jsx";

function renderFooter() {
  return render(
    <TestMemoryRouter>
      <SiteFeedback />
    </TestMemoryRouter>,
  );
}

describe("SiteFeedback", () => {
  it("shows a document-end footer with About and Feedback without opening the panel", () => {
    renderFooter();

    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveClass("site-footer");
    expect(window.getComputedStyle(footer).position).not.toBe("fixed");
    expect(window.getComputedStyle(footer).position).not.toBe("sticky");
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
    expect(screen.getByRole("button", { name: "Feedback" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Send site feedback" })).not.toBeInTheDocument();
  });

  it("opens site-feedback copy with mailto and both Discord usernames", async () => {
    const user = userEvent.setup();
    renderFooter();

    await user.click(screen.getByRole("button", { name: "Feedback" }));

    const dialog = screen.getByRole("dialog", { name: "Send site feedback" });
    expect(dialog).toHaveTextContent("product and site feedback");
    expect(dialog).toHaveTextContent("not trade match contact");
    expect(dialog).toHaveTextContent(SITE_FEEDBACK_PLACES[0]);
    expect(dialog).toHaveTextContent(SITE_FEEDBACK_PLACES[1]);
    expect(dialog).toHaveTextContent(SITE_FEEDBACK_CONTACTS[0]);
    expect(dialog).toHaveTextContent(SITE_FEEDBACK_CONTACTS[1]);
    expect(screen.getByRole("link", { name: SITE_FEEDBACK_EMAIL })).toHaveAttribute(
      "href",
      SITE_FEEDBACK_MAILTO,
    );
    expect(screen.queryByRole("link", { name: SITE_FEEDBACK_CONTACTS[0] })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: SITE_FEEDBACK_CONTACTS[1] })).not.toBeInTheDocument();
    expect(dialog.textContent).not.toMatch(/discord\.gg/i);
  });

  it("closes the panel from Close, Escape, and the backdrop", async () => {
    const user = userEvent.setup();
    renderFooter();

    await user.click(screen.getByRole("button", { name: "Feedback" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Send site feedback" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Feedback" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Send site feedback" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Feedback" }));
    await user.click(document.querySelector(".site-feedback-modal__backdrop"));
    expect(screen.queryByRole("dialog", { name: "Send site feedback" })).not.toBeInTheDocument();
  });

  it("does not close when the dialog surface is clicked", async () => {
    const user = userEvent.setup();
    renderFooter();

    await user.click(screen.getByRole("button", { name: "Feedback" }));
    await user.click(screen.getByRole("dialog", { name: "Send site feedback" }));

    expect(screen.getByRole("dialog", { name: "Send site feedback" })).toBeInTheDocument();
  });
});
