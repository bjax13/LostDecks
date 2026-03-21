import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AddToCollectionButton from "./AddToCollectionButton.jsx";

const openAuthModal = vi.fn();
const addToCollection = vi.fn(() => Promise.resolve());
const reset = vi.fn();

const hookState = vi.hoisted(() => ({
  user: null,
  status: "idle",
  error: null,
}));

vi.mock("../../../contexts/AuthModalContext.jsx", () => ({
  useAuthModal: () => ({ openAuthModal }),
}));

vi.mock("../hooks/useAddToCollection.js", () => ({
  useAddToCollection: () => ({
    addToCollection,
    status: hookState.status,
    error: hookState.error,
    user: hookState.user,
    reset,
  }),
}));

const sampleCard = {
  id: "card-1",
  finishes: ["DUN", "FOIL"],
};

describe("AddToCollectionButton", () => {
  beforeEach(() => {
    hookState.user = null;
    hookState.status = "idle";
    hookState.error = null;
    vi.clearAllMocks();
  });

  it("opens the auth modal when signed out", async () => {
    const user = userEvent.setup();
    render(<AddToCollectionButton collectible={sampleCard} />);

    await user.click(screen.getByRole("button", { name: /^add dun$/i }));

    expect(openAuthModal).toHaveBeenCalledWith({ reason: "add-to-collection" });
    expect(addToCollection).not.toHaveBeenCalled();
  });

  it("calls addToCollection when signed in", async () => {
    hookState.user = { uid: "u1" };
    const user = userEvent.setup();
    render(<AddToCollectionButton collectible={sampleCard} />);

    await user.click(screen.getByRole("button", { name: /^add foil$/i }));

    expect(addToCollection).toHaveBeenCalledWith({
      card: sampleCard,
      finish: "FOIL",
      quantity: 1,
    });
    expect(openAuthModal).not.toHaveBeenCalled();
  });

  it("shows a message when no finishes exist", () => {
    render(<AddToCollectionButton collectible={{ id: "x", finishes: [] }} />);

    expect(screen.getByText(/no finishes available/i)).toBeInTheDocument();
  });
});
