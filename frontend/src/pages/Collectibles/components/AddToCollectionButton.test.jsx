import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AddToCollectionButton, { formatFinishLabel } from "./AddToCollectionButton.jsx";

vi.mock("firebase/firestore", () => ({
  addDoc: vi.fn(),
  collection: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _methodName: "serverTimestamp" })),
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
};

vi.mock("../hooks/useAddToCollection", () => ({
  useAddToCollection: () => hookState,
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

describe("AddToCollectionButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hookState.status = "idle";
    hookState.error = null;
    hookState.user = mockUser;
    hookState.reset = vi.fn();
    hookState.addToCollection = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("applies variant class for card (default) and table", () => {
    const { container: cardRoot, unmount: u1 } = renderButton();
    expect(cardRoot.querySelector(".add-to-collection--card")).toBeInTheDocument();
    u1();

    const { container: tableRoot } = render(<AddToCollectionButton collectible={baseCollectible} variant="table" />);
    expect(tableRoot.querySelector(".add-to-collection--table")).toBeInTheDocument();
  });

  it("shows no finishes message when finishes are missing or empty", () => {
    renderButton({ collectible: { id: "x", finishes: [] } });
    expect(screen.getByText("No finishes available")).toBeInTheDocument();

    renderButton({ collectible: { id: "y" } });
    expect(screen.getAllByText("No finishes available")).toHaveLength(2);
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
      await screen.findByText("Couldn't add collectible. Please try again."),
    ).toBeInTheDocument();
  });

  it("shows success feedback with formatted finish after hook reports success", async () => {
    const user = userEvent.setup();
    hookState.addToCollection = vi.fn(async () => {
      hookState.status = "success";
    });
    const { rerender } = renderButton();

    await user.click(screen.getByRole("button", { name: "Add Dun" }));
    rerender(<AddToCollectionButton collectible={baseCollectible} />);

    expect(await screen.findByText("Added Dun to your collection!")).toBeInTheDocument();
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
    expect(screen.getByText("Couldn't add collectible. Please try again.")).toBeInTheDocument();
  });

  it("shows error detail line when status is error with a non-auth error code", () => {
    const err = new Error("Permission denied");
    err.code = "permission-denied";
    hookState.status = "error";
    hookState.error = err;
    renderButton();
    expect(screen.getByText("Permission denied")).toBeInTheDocument();
    expect(screen.getByText("Couldn't add collectible. Please try again.")).toBeInTheDocument();
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
    resolveAdd();
    await clickPromise;
    rerender(<AddToCollectionButton collectible={baseCollectible} />);

    expect(await screen.findByText("Added Dun to your collection!")).toBeInTheDocument();
  });

  it("clears success feedback and calls reset after timeout", async () => {
    vi.useFakeTimers();
    hookState.addToCollection = vi.fn(() => {
      hookState.status = "success";
      return Promise.resolve();
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
