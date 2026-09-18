import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import InfoBubble from "./InfoBubble.jsx";

const HELP_TEXT = "Helpful details about this setting.";

function renderBubble() {
  return render(<InfoBubble label="About this setting">{HELP_TEXT}</InfoBubble>);
}

describe("InfoBubble", () => {
  it("keeps help text hidden until the trigger is used", () => {
    renderBubble();

    expect(screen.getByRole("button", { name: "About this setting" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByText(HELP_TEXT)).not.toBeVisible();
  });

  it("reveals help text on click so tap works without hover", async () => {
    const user = userEvent.setup();
    renderBubble();

    await user.click(screen.getByRole("button", { name: "About this setting" }));

    expect(screen.getByRole("button", { name: "About this setting" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText(HELP_TEXT)).toBeVisible();
  });

  it("reveals help text on hover", async () => {
    const user = userEvent.setup();
    renderBubble();

    await user.hover(screen.getByRole("button", { name: "About this setting" }));

    expect(screen.getByText(HELP_TEXT)).toBeVisible();
  });

  it("reveals help text on keyboard focus", async () => {
    const user = userEvent.setup();
    renderBubble();

    await user.tab();

    expect(screen.getByRole("button", { name: "About this setting" })).toHaveFocus();
    expect(screen.getByText(HELP_TEXT)).toBeVisible();
  });

  it("hides help text when hover ends", async () => {
    const user = userEvent.setup();
    renderBubble();

    const trigger = screen.getByRole("button", { name: "About this setting" });
    await user.hover(trigger);
    expect(screen.getByText(HELP_TEXT)).toBeVisible();

    await user.unhover(trigger);

    expect(screen.getByText(HELP_TEXT)).not.toBeVisible();
  });

  it("hides help text on Escape", async () => {
    const user = userEvent.setup();
    renderBubble();

    await user.click(screen.getByRole("button", { name: "About this setting" }));
    expect(screen.getByText(HELP_TEXT)).toBeVisible();

    await user.keyboard("{Escape}");

    expect(screen.getByText(HELP_TEXT)).not.toBeVisible();
    expect(screen.getByRole("button", { name: "About this setting" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("unpins help text when pointerdown happens outside", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <InfoBubble label="About this setting">{HELP_TEXT}</InfoBubble>
        <button type="button">Outside</button>
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "About this setting" }));
    expect(screen.getByText(HELP_TEXT)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Outside" }));

    expect(screen.getByText(HELP_TEXT)).not.toBeVisible();
  });
});
