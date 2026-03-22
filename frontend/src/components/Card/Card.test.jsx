import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import Card from "./Card.jsx";

describe("Card (integration)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("locks a hover flip so the card stays flipped", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Card
        frontContent={<span>Front</span>}
        backContent={<span>Back face</span>}
        isNonsense={false}
      />,
    );
    const card = container.firstElementChild;
    expect(card).toBeTruthy();

    await user.hover(card);
    expect(card).toHaveClass("flipped");

    await user.click(card);
    expect(card).toHaveClass("flipped", "locked");

    await user.unhover(card);
    expect(card).toHaveClass("flipped", "locked");
  });

  it("clears hover flip when pointer leaves while unlocked", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Card frontContent={<span>Front</span>} backContent={<span>Back</span>} isNonsense={false} />,
    );
    const card = container.firstElementChild;

    await user.hover(card);
    expect(card).toHaveClass("flipped");
    await user.unhover(card);
    expect(card).not.toHaveClass("flipped");
  });

  it("locks the unflipped state when clicked without hovering and notifies onFlip", () => {
    const onFlip = vi.fn();
    const { container } = render(
      <Card
        frontContent={<span>Front</span>}
        backContent={<span>Back</span>}
        onFlip={onFlip}
        isNonsense={false}
      />,
    );
    const card = container.firstElementChild;

    // fireEvent.click avoids user-event's implicit pointer enter, which would flip via hover first
    fireEvent.click(card);
    expect(card).toHaveClass("locked");
    expect(card).not.toHaveClass("flipped");
    expect(onFlip).toHaveBeenCalledWith(false);
  });

  it("locks and unlocks without onFlip callback", () => {
    const { container } = render(
      <Card frontContent={<span>Front</span>} backContent={<span>Back</span>} isNonsense={false} />,
    );
    const card = container.firstElementChild;

    fireEvent.click(card);
    expect(card).toHaveClass("locked");

    fireEvent.click(card);
    expect(card).not.toHaveClass("locked");
  });

  it("calls onClick on each card click", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { container } = render(
      <Card
        frontContent={<span>Front</span>}
        backContent={<span>Back</span>}
        onClick={onClick}
        isNonsense={false}
      />,
    );
    const card = container.firstElementChild;

    await user.click(card);
    await user.click(card);
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("unlocks on second click and calls onFlip(false)", async () => {
    const user = userEvent.setup();
    const onFlip = vi.fn();
    const { container } = render(
      <Card
        frontContent={<span>Front</span>}
        backContent={<span>Back</span>}
        onFlip={onFlip}
        isNonsense={false}
      />,
    );
    const card = container.firstElementChild;

    await user.hover(card);
    await user.click(card);
    expect(onFlip).toHaveBeenLastCalledWith(true);

    await user.click(card);
    expect(card).not.toHaveClass("locked");
    expect(onFlip).toHaveBeenLastCalledWith(false);
  });

  it("uses controlled isFlipped when locking without hover", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Card
        frontContent={<span>Front</span>}
        backContent={<span>Back</span>}
        isFlipped={true}
        isNonsense={false}
      />,
    );
    const card = container.firstElementChild;

    await user.click(card);
    expect(card).toHaveClass("flipped", "locked");
  });

  it("ignores hover enter and leave while locked", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Card frontContent={<span>Front</span>} backContent={<span>Back</span>} isNonsense={false} />,
    );
    const card = container.firstElementChild;

    fireEvent.click(card);
    expect(card).not.toHaveClass("flipped");

    await user.hover(card);
    expect(card).not.toHaveClass("flipped");

    await user.unhover(card);
    expect(card).not.toHaveClass("flipped");
  });

  it("activates the card on Enter and Space", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { container } = render(
      <Card
        frontContent={<span>Front</span>}
        backContent={<span>Back</span>}
        onClick={onClick}
        isNonsense={false}
      />,
    );
    const card = container.firstElementChild;
    card.focus();

    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);

    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("does not activate on unrelated keys", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { container } = render(
      <Card
        frontContent={<span>Front</span>}
        backContent={<span>Back</span>}
        onClick={onClick}
        isNonsense={false}
      />,
    );
    const card = container.firstElementChild;
    card.focus();

    await user.keyboard("a");
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders nonsense stamp with a fixed position when provided", () => {
    render(
      <Card
        frontContent={<span>Front</span>}
        backContent={<span>Back</span>}
        isNonsense
        nonsensePosition={2}
      />,
    );
    const stamp = screen.getByText("NONSENSE");
    expect(stamp).toBeInTheDocument();
    expect(stamp.closest(".card-stamp")).toHaveStyle({
      top: "15%",
      left: "50%",
    });
  });

  it("picks a random stamp slot when nonsensePosition is omitted", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    render(<Card frontContent={<span>Front</span>} backContent={<span>Back</span>} isNonsense />);
    const stamp = screen.getByText("NONSENSE");
    expect(stamp.closest(".card-stamp")).toHaveStyle({ top: "15%", left: "15%" });
  });

  it("uses fallback stamp layout for unknown nonsense positions", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    render(
      <Card
        frontContent={<span>Front</span>}
        backContent={<span>Back</span>}
        isNonsense
        nonsensePosition={0}
      />,
    );
    const stamp = screen.getByText("NONSENSE");
    expect(stamp.closest(".card-stamp")).toBeTruthy();
    expect(stamp.closest(".card-stamp").style.transform).toMatch(/rotate/);
  });

  it("applies non-default theme CSS variables", () => {
    const { container } = render(
      <Card
        frontContent={<span>Front</span>}
        backContent={<span>Back</span>}
        theme="elsecaller"
        isNonsense={false}
      />,
    );
    const card = container.firstElementChild;
    expect(card.style.getPropertyValue("--card-primary").trim()).toBe("#8C5AC8");
  });
});
