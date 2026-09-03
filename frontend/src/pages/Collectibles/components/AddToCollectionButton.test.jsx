import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../Collectibles.css";
import AddToCollectionButton, {
  formatFinishLabel,
  formatOwnedAddLabel,
  formatOwnedQuantityLabel,
} from "./AddToCollectionButton.jsx";

vi.mock("firebase/firestore", () => ({
  addDoc: vi.fn(),
  collection: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _methodName: "serverTimestamp" })),
  updateDoc: vi.fn(),
  where: vi.fn(),
}));

const openAuthModal = vi.fn();

vi.mock("../../../contexts/AuthModalContext.jsx", () => ({
  useAuthModal: () => ({ openAuthModal }),
}));

const mockUser = { uid: "test-user" };

const hookState = {
  status: "idle",
  error: null,
  user: mockUser,
  reset: vi.fn(),
  addToCollection: vi.fn(),
  decrementFromCollection: vi.fn(),
  removeFromCollection: vi.fn(),
};

vi.mock("../hooks/useCollectionQuantityMutations", () => ({
  useCollectionQuantityMutations: () => hookState,
}));

vi.mock("../utils/ownedQuantities", () => ({
  getOwnedQuantity: (ownedBySkuId, collectible, finish) => {
    if (!ownedBySkuId || !collectible?.id) return 0;
    if (collectible.collectibleType === "pin" || collectible.category === "pin") {
      return ownedBySkuId[collectible.id] ?? 0;
    }
    if (!finish) return 0;
    return ownedBySkuId[`${collectible.id}-${String(finish).toUpperCase()}`] ?? 0;
  },
}));

vi.mock("../../../data/collectibles", () => ({
  resolveSkuId(collectible, finish = null) {
    if (!collectible?.id) return null;
    if (collectible.collectibleType === "pin" || collectible.category === "pin") {
      return collectible.id;
    }
    if (!finish) return null;
    return `${collectible.id}-${String(finish).toUpperCase()}`;
  },
}));

const baseCollectible = {
  id: "LT24-ELS-01",
  finishes: ["DUN", "FOIL"],
};

function renderButton(props = {}) {
  return render(<AddToCollectionButton collectible={baseCollectible} {...props} />);
}

describe("formatFinishLabel", () => {
  it("returns empty string for missing or non-string values", () => {
    expect(formatFinishLabel(null)).toBe("");
    expect(formatFinishLabel(undefined)).toBe("");
    expect(formatFinishLabel("")).toBe("");
    expect(formatFinishLabel(123)).toBe("");
  });

  it("capitalizes the first letter of a lowercase string", () => {
    expect(formatFinishLabel("dun")).toBe("Dun");
    expect(formatFinishLabel("FOIL")).toBe("Foil");
    expect(formatFinishLabel("MiXeD")).toBe("Mixed");
  });
});

describe("formatOwnedAddLabel", () => {
  it("returns default add labels when nothing is owned", () => {
    expect(formatOwnedAddLabel({ label: "Dun", ownedQuantity: 0 })).toBe("Add Dun");
    expect(formatOwnedAddLabel({ label: "Add to collection", ownedQuantity: 0, isPin: true })).toBe(
      "Add to collection",
    );
  });

  it("returns compact owned labels when quantity is positive", () => {
    expect(formatOwnedAddLabel({ label: "Dun", ownedQuantity: 2 })).toBe("Dun · x2");
    expect(formatOwnedAddLabel({ label: "Add to collection", ownedQuantity: 3, isPin: true })).toBe(
      "Owned · x3",
    );
  });
});

describe("formatOwnedQuantityLabel", () => {
  it("formats finish and pin quantity labels", () => {
    expect(formatOwnedQuantityLabel({ label: "Dun", ownedQuantity: 2 })).toBe("Dun · x2");
    expect(formatOwnedQuantityLabel({ label: "Owned", ownedQuantity: 1, isPin: true })).toBe(
      "Owned · x1",
    );
  });
});

describe("AddToCollectionButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hookState.status = "idle";
    hookState.error = null;
    hookState.user = mockUser;
    hookState.reset = vi.fn();
    hookState.addToCollection = vi.fn().mockResolvedValue({
      skuId: "LT24-ELS-01-DUN",
      quantity: 1,
      deleted: false,
    });
    hookState.decrementFromCollection = vi.fn().mockResolvedValue({
      skuId: "LT24-ELS-01-DUN",
      quantity: 1,
      deleted: false,
    });
    hookState.removeFromCollection = vi.fn().mockResolvedValue({
      skuId: "LT24-ELS-01-DUN",
      quantity: 0,
      deleted: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("applies variant class for card (default) and table", () => {
    const { container: cardRoot, unmount: u1 } = renderButton();
    expect(cardRoot.querySelector(".add-to-collection--card")).toBeInTheDocument();
    u1();

    const { container: tableRoot } = render(
      <AddToCollectionButton collectible={baseCollectible} variant="table" />,
    );
    expect(tableRoot.querySelector(".add-to-collection--table")).toBeInTheDocument();
  });

  it("shows no finishes message when finishes are missing or empty for cards", () => {
    renderButton({ collectible: { id: "x", finishes: [], collectibleType: "card" } });
    expect(screen.getByText("No finishes available")).toBeInTheDocument();

    renderButton({ collectible: { id: "y", collectibleType: "card" } });
    expect(screen.getAllByText("No finishes available")).toHaveLength(2);
  });

  it("renders a single add button for pins", async () => {
    const user = userEvent.setup();
    renderButton({
      collectible: {
        id: "PIN-CF-01",
        collectibleType: "pin",
        category: "pin",
        finishes: [],
      },
    });

    expect(screen.queryByText("No finishes available")).not.toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Add to collection" });
    await user.click(button);
    expect(hookState.addToCollection).toHaveBeenCalledWith({
      card: expect.objectContaining({ id: "PIN-CF-01", collectibleType: "pin" }),
      finish: null,
      quantity: 1,
    });
  });

  it("renders stepper controls when owned quantity is positive", async () => {
    const user = userEvent.setup();
    const onQuantityChange = vi.fn();
    renderButton({
      ownedBySkuId: {
        "LT24-ELS-01-DUN": 2,
        "LT24-ELS-01-FOIL": 1,
      },
      onQuantityChange,
    });

    expect(screen.getByText("Dun · x2")).toBeInTheDocument();
    expect(screen.getByText("Foil · x1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Increase Dun · x2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decrease Dun · x2" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Increase Dun · x2" }));
    expect(hookState.addToCollection).toHaveBeenCalledWith({
      card: baseCollectible,
      finish: "DUN",
      quantity: 1,
    });
    expect(onQuantityChange).toHaveBeenCalledWith({
      skuId: "LT24-ELS-01-DUN",
      quantity: 1,
      deleted: false,
    });

    await user.click(screen.getByRole("button", { name: "Decrease Dun · x2" }));
    expect(hookState.decrementFromCollection).toHaveBeenCalledWith({
      card: baseCollectible,
      finish: "DUN",
      quantity: 1,
      deleteWhenZero: true,
    });
  });

  it("keeps card-variant qty steppers on one compact chip row", () => {
    const { container } = renderButton({
      ownedBySkuId: {
        "LT24-ELS-01-DUN": 2,
        "LT24-ELS-01-FOIL": 1,
      },
    });

    const stepper = container.querySelector(".add-to-collection__stepper");
    const stepButton = container.querySelector(".add-to-collection__button--step");
    const quantity = container.querySelector(".add-to-collection__quantity");
    expect(getComputedStyle(stepper).flexWrap).toBe("nowrap");
    expect(getComputedStyle(stepButton).padding).toBe("0.4rem 0.55rem");
    expect(getComputedStyle(quantity).fontSize).toBe("0.68rem");
  });

  it("keeps soft-zero steppers visible and passes deleteWhenZero false", async () => {
    const user = userEvent.setup();
    const onQuantityChange = vi.fn();
    hookState.decrementFromCollection = vi.fn().mockResolvedValue({
      skuId: "LT24-ELS-01-DUN",
      quantity: 0,
      deleted: false,
    });

    renderButton({
      ownedBySkuId: { "LT24-ELS-01-DUN": 0 },
      deleteWhenZero: false,
      onQuantityChange,
    });

    expect(screen.getByText("Dun · x0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decrease Dun · x0" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Increase Dun · x0" }));
    expect(hookState.addToCollection).toHaveBeenCalledWith({
      card: baseCollectible,
      finish: "DUN",
      quantity: 1,
    });
  });

  it("shows owned quantity stepper for pins", async () => {
    const user = userEvent.setup();
    renderButton({
      collectible: {
        id: "PIN-CF-01",
        collectibleType: "pin",
        category: "pin",
        finishes: [],
      },
      ownedBySkuId: { "PIN-CF-01": 4 },
    });

    expect(screen.getByText("Owned · x4")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Decrease Owned · x4" }));
    expect(hookState.decrementFromCollection).toHaveBeenCalledWith({
      card: expect.objectContaining({ id: "PIN-CF-01" }),
      finish: null,
      quantity: 1,
      deleteWhenZero: true,
    });
  });

  it("renders empty state when neither collectible nor card is provided", () => {
    render(<AddToCollectionButton />);
    expect(screen.getByText("No finishes available")).toBeInTheDocument();
  });

  it("accepts card prop as an alias for collectible", () => {
    render(<AddToCollectionButton card={{ ...baseCollectible, id: "from-card" }} />);
    expect(screen.getByRole("button", { name: "Add Dun" })).toBeInTheDocument();
  });

  it("opens auth modal when unauthenticated user clicks add", async () => {
    const user = userEvent.setup();
    hookState.user = null;
    renderButton();

    await user.click(screen.getByRole("button", { name: "Add Dun" }));
    expect(openAuthModal).toHaveBeenCalledWith({ reason: "add-to-collection" });
    expect(hookState.addToCollection).not.toHaveBeenCalled();
  });

  it("opens auth modal when decrement is clicked while signed out", async () => {
    const user = userEvent.setup();
    hookState.user = null;
    renderButton({ ownedBySkuId: { "LT24-ELS-01-DUN": 2 } });

    await user.click(screen.getByRole("button", { name: "Decrease Dun · x2" }));
    expect(openAuthModal).toHaveBeenCalledWith({ reason: "add-to-collection" });
    expect(hookState.decrementFromCollection).not.toHaveBeenCalled();
  });

  it("opens auth modal when addToCollection throws auth-required", async () => {
    const user = userEvent.setup();
    const err = new Error("Authentication required");
    err.code = "auth-required";
    hookState.addToCollection = vi.fn().mockRejectedValue(err);
    renderButton();

    await user.click(screen.getByRole("button", { name: "Add Foil" }));
    await waitFor(() => {
      expect(openAuthModal).toHaveBeenCalledWith({ reason: "add-to-collection" });
    });
  });

  it("shows inline error when addToCollection throws a non-auth error", async () => {
    const user = userEvent.setup();
    hookState.addToCollection = vi.fn().mockRejectedValue(new Error("network down"));
    renderButton();

    await user.click(screen.getByRole("button", { name: "Add Dun" }));
    expect(
      await screen.findByText("Couldn't update collection. Please try again."),
    ).toBeInTheDocument();
  });

  it("shows success feedback with formatted finish after hook reports success", async () => {
    const user = userEvent.setup();
    hookState.addToCollection = vi.fn(async () => {
      hookState.status = "success";
      return { skuId: "LT24-ELS-01-DUN", quantity: 1, deleted: false };
    });
    const { rerender } = renderButton();

    await user.click(screen.getByRole("button", { name: "Add Dun" }));
    rerender(<AddToCollectionButton collectible={baseCollectible} />);

    expect(await screen.findByText("Added Dun to your collection!")).toBeInTheDocument();
  });

  it("shows decrement success feedback", async () => {
    const user = userEvent.setup();
    hookState.decrementFromCollection = vi.fn(async () => {
      hookState.status = "success";
      return { skuId: "LT24-ELS-01-DUN", quantity: 1, deleted: false };
    });
    const { rerender } = renderButton({ ownedBySkuId: { "LT24-ELS-01-DUN": 2 } });

    await user.click(screen.getByRole("button", { name: "Decrease Dun · x2" }));
    rerender(
      <AddToCollectionButton
        collectible={baseCollectible}
        ownedBySkuId={{ "LT24-ELS-01-DUN": 2 }}
      />,
    );

    expect(await screen.findByText("Removed one Dun.")).toBeInTheDocument();
  });

  it("shows generic success when status is success before a finish was recorded", () => {
    hookState.status = "success";
    renderButton();
    expect(screen.getByText("Added to your collection!")).toBeInTheDocument();
  });

  it("shows error feedback when hook status is error", () => {
    hookState.status = "error";
    hookState.error = new Error("Firestore failed");
    renderButton();
    expect(screen.getByText("Couldn't update collection. Please try again.")).toBeInTheDocument();
  });

  it("shows error detail line when status is error with a non-auth error code", () => {
    const err = new Error("Permission denied");
    err.code = "permission-denied";
    hookState.status = "error";
    hookState.error = err;
    renderButton();
    expect(screen.getByText("Permission denied")).toBeInTheDocument();
    expect(screen.getByText("Couldn't update collection. Please try again.")).toBeInTheDocument();
  });

  it("uses fallback text when error has code but no message", () => {
    hookState.status = "error";
    hookState.error = { code: "failed-precondition", message: undefined };
    renderButton();
    expect(screen.getByText("Unexpected error")).toBeInTheDocument();
  });

  it("does not show error detail line for auth-required hook errors", () => {
    const err = new Error("Need login");
    err.code = "auth-required";
    hookState.status = "error";
    hookState.error = err;
    renderButton();
    expect(screen.queryByText("Need login")).not.toBeInTheDocument();
  });

  it("shows loading label for the clicked finish while add is in flight", async () => {
    const user = userEvent.setup();
    let resolveAdd;
    hookState.addToCollection = vi.fn(() => {
      hookState.status = "loading";
      return new Promise((r) => {
        resolveAdd = r;
      });
    });
    const { rerender } = renderButton();

    const clickPromise = user.click(screen.getByRole("button", { name: "Add Dun" }));
    await waitFor(() => {
      expect(hookState.addToCollection).toHaveBeenCalled();
    });
    rerender(<AddToCollectionButton collectible={baseCollectible} />);

    expect(screen.getByRole("button", { name: "Adding Dun…" })).toBeDisabled();

    hookState.status = "success";
    resolveAdd({ skuId: "LT24-ELS-01-DUN", quantity: 1, deleted: false });
    await clickPromise;
    rerender(<AddToCollectionButton collectible={baseCollectible} />);

    expect(await screen.findByText("Added Dun to your collection!")).toBeInTheDocument();
  });

  it("clears success feedback and calls reset after timeout", async () => {
    vi.useFakeTimers();
    hookState.addToCollection = vi.fn(() => {
      hookState.status = "success";
      return Promise.resolve({ skuId: "LT24-ELS-01-FOIL", quantity: 1, deleted: false });
    });
    const { rerender } = renderButton();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add Foil" }));
      await Promise.resolve();
    });
    rerender(<AddToCollectionButton collectible={baseCollectible} />);

    expect(screen.getByText("Added Foil to your collection!")).toBeInTheDocument();

    await act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(screen.queryByText("Added Foil to your collection!")).not.toBeInTheDocument();
    expect(hookState.reset).toHaveBeenCalled();
  });

  it("calls reset when collectible changes", () => {
    const { rerender } = renderButton({ collectible: { id: "a", finishes: ["DUN"] } });
    expect(hookState.reset).toHaveBeenCalled();
    hookState.reset.mockClear();

    rerender(<AddToCollectionButton collectible={{ id: "b", finishes: ["DUN"] }} />);
    expect(hookState.reset).toHaveBeenCalled();
  });

  it("calls reset on unmount", () => {
    hookState.reset.mockClear();
    const { unmount } = renderButton();
    unmount();
    expect(hookState.reset).toHaveBeenCalled();
  });

  it("invokes addToCollection with card, finish, and quantity", async () => {
    const user = userEvent.setup();
    hookState.addToCollection = vi.fn(async () => {
      hookState.status = "success";
      return { skuId: "LT24-ELS-01-DUN", quantity: 1, deleted: false };
    });
    const { rerender } = renderButton();

    await user.click(screen.getByRole("button", { name: "Add Dun" }));
    expect(hookState.addToCollection).toHaveBeenCalledWith({
      card: baseCollectible,
      finish: "DUN",
      quantity: 1,
    });
    rerender(<AddToCollectionButton collectible={baseCollectible} />);
  });
});
