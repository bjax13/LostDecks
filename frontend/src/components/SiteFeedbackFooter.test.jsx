import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import SiteFeedbackFooter, {
  SITE_FEEDBACK_CONTACTS,
  SITE_FEEDBACK_GUILD,
} from "./SiteFeedbackFooter.jsx";

describe("SiteFeedbackFooter", () => {
  it("shows a Feedback control without opening the panel", () => {
    render(<SiteFeedbackFooter />);

    expect(screen.getByRole("button", { name: "Feedback" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Send site feedback" })).not.toBeInTheDocument();
  });

  it("opens site-feedback copy with the guild name and both Discord usernames", async () => {
    const user = userEvent.setup();
    render(<SiteFeedbackFooter />);

    await user.click(screen.getByRole("button", { name: "Feedback" }));

    const dialog = screen.getByRole("dialog", { name: "Send site feedback" });
    expect(dialog).toHaveTextContent("product and site feedback");
    expect(dialog).toHaveTextContent("not trade match contact");
    expect(dialog).toHaveTextContent(SITE_FEEDBACK_GUILD);
    expect(dialog).toHaveTextContent(SITE_FEEDBACK_CONTACTS[0]);
    expect(dialog).toHaveTextContent(SITE_FEEDBACK_CONTACTS[1]);
  });

  it("closes the panel from Close, Escape, and the backdrop", async () => {
    const user = userEvent.setup();
    render(<SiteFeedbackFooter />);

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
    render(<SiteFeedbackFooter />);

    await user.click(screen.getByRole("button", { name: "Feedback" }));
    await user.click(screen.getByRole("dialog", { name: "Send site feedback" }));

    expect(screen.getByRole("dialog", { name: "Send site feedback" })).toBeInTheDocument();
  });
});
