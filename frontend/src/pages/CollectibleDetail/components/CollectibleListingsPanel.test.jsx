import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CollectibleListingsPanel from "./CollectibleListingsPanel";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockUseAuth = vi.fn();
vi.mock("../../../contexts/AuthContext", () => ({
  useAuth: (...args) => mockUseAuth(...args),
}));

const mockUseOpenListings = vi.fn();
vi.mock("../../Market/hooks/useOpenListings", () => ({
  default: (...args) => mockUseOpenListings(...args),
}));

const mockCancelListing = vi.fn();
const mockAcceptListing = vi.fn();
vi.mock("../../../lib/marketplace/listings", () => ({
  cancelListing: (...args) => mockCancelListing(...args),
  acceptListing: (...args) => mockAcceptListing(...args),
}));

const mockGetCollectibleRecord = vi.fn();
vi.mock("../../../data/collectibles", () => ({
  getCollectibleRecord: (...args) => mockGetCollectibleRecord(...args),
}));

let rowPropsLog = [];
vi.mock("../../Market/components/ListingRow", () => ({
  default: (props) => {
    rowPropsLog.push(props);
    return (
      <li data-testid={`row-${props.listing.id}`}>
        <span data-testid="card-label">{props.cardLabel ?? props.listing.cardId}</span>
        <button type="button" onClick={() => props.onCancel?.(props.listing)}>
          Cancel
        </button>
        <button type="button" onClick={() => props.onAccept?.(props.listing)}>
          Accept
        </button>
      </li>
    );
  },
}));

function renderPanel(props = {}) {
  rowPropsLog = [];
  return render(
    <MemoryRouter>
      <CollectibleListingsPanel collectibleId="LT24-ELS-01" {...props} />
    </MemoryRouter>,
  );
}

const OWNER = { uid: "owner-uid" };
const BUYER = { uid: "buyer-uid" };

const baseListing = {
  id: "listing-1",
  type: "ASK",
  priceCents: 1500,
  currency: "USD",
  cardId: "LT24-ELS-01",
  createdByUid: "owner-uid",
  createdByDisplayName: "OwnerUser",
};

beforeEach(() => {
  rowPropsLog = [];
  mockNavigate.mockReset();
  mockCancelListing.mockReset();
  mockAcceptListing.mockReset();
  mockGetCollectibleRecord.mockReset();
  mockUseAuth.mockReturnValue({ user: BUYER });
  mockUseOpenListings.mockReturnValue({ listings: [], loading: false, error: null });
  mockGetCollectibleRecord.mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CollectibleListingsPanel", () => {
  // ── Early-return branches ──────────────────────────────────────

  describe("loading state", () => {
    it("shows a loading message", () => {
      mockUseOpenListings.mockReturnValue({ listings: [], loading: true, error: null });
      renderPanel();
      expect(screen.getByText("Loading listings…")).toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("shows an error message", () => {
      mockUseOpenListings.mockReturnValue({
        listings: [],
        loading: false,
        error: new Error("boom"),
      });
      renderPanel();
      expect(screen.getByText("Failed to load listings.")).toBeInTheDocument();
    });
  });

  describe("empty listings", () => {
    it("shows an empty-state message", () => {
      renderPanel();
      expect(screen.getByText("No open listings for this collectible yet.")).toBeInTheDocument();
    });
  });

  // ── Hook wiring ────────────────────────────────────────────────

  describe("hook invocation", () => {
    it("passes collectibleId as cardId to useOpenListings", () => {
      renderPanel({ collectibleId: "LT24-HLD-05" });
      expect(mockUseOpenListings).toHaveBeenCalledWith({ cardId: "LT24-HLD-05" });
    });
  });

  // ── List rendering ─────────────────────────────────────────────

  describe("rendering listings", () => {
    const twoListings = [
      { ...baseListing, id: "listing-1" },
      { ...baseListing, id: "listing-2", createdByUid: "someone-else" },
    ];

    it("renders one ListingRow per listing", () => {
      mockUseOpenListings.mockReturnValue({ listings: twoListings, loading: false, error: null });
      renderPanel();
      expect(screen.getAllByRole("listitem")).toHaveLength(2);
    });

    it("wraps rows in a <ul> with class market-list", () => {
      mockUseOpenListings.mockReturnValue({ listings: twoListings, loading: false, error: null });
      const { container } = renderPanel();
      expect(container.querySelector("ul.market-list")).toBeInTheDocument();
    });
  });

  // ── collectibleLabel derivation ────────────────────────────────

  describe("collectibleLabel", () => {
    beforeEach(() => {
      mockUseOpenListings.mockReturnValue({
        listings: [baseListing],
        loading: false,
        error: null,
      });
    });

    it("uses displayName + id when getCollectibleRecord returns a record", () => {
      mockGetCollectibleRecord.mockReturnValue({ displayName: "Elysium #01" });
      renderPanel();
      expect(rowPropsLog[0].cardLabel).toBe("Elysium #01 (LT24-ELS-01)");
    });

    it("passes undefined when getCollectibleRecord returns null", () => {
      mockGetCollectibleRecord.mockReturnValue(null);
      renderPanel();
      expect(rowPropsLog[0].cardLabel).toBeUndefined();
    });

    it("passes undefined when displayName is falsy", () => {
      mockGetCollectibleRecord.mockReturnValue({ displayName: "" });
      renderPanel();
      expect(rowPropsLog[0].cardLabel).toBeUndefined();
    });
  });

  // ── canAccept / canCancel props ────────────────────────────────

  describe("canAccept / canCancel props", () => {
    beforeEach(() => {
      mockUseOpenListings.mockReturnValue({
        listings: [baseListing],
        loading: false,
        error: null,
      });
    });

    it("sets canCancel=true, canAccept=false when user owns the listing", () => {
      mockUseAuth.mockReturnValue({ user: OWNER });
      renderPanel();
      expect(rowPropsLog[0].canCancel).toBe(true);
      expect(rowPropsLog[0].canAccept).toBe(false);
    });

    it("sets canCancel=false, canAccept=true when user does not own the listing", () => {
      mockUseAuth.mockReturnValue({ user: BUYER });
      renderPanel();
      expect(rowPropsLog[0].canCancel).toBe(false);
      expect(rowPropsLog[0].canAccept).toBe(true);
    });

    it("sets both to false when user is null", () => {
      mockUseAuth.mockReturnValue({ user: null });
      renderPanel();
      expect(rowPropsLog[0].canCancel).toBe(false);
      expect(rowPropsLog[0].canAccept).toBe(false);
    });
  });

  // ── handleCancel ───────────────────────────────────────────────

  describe("handleCancel", () => {
    beforeEach(() => {
      mockUseOpenListings.mockReturnValue({
        listings: [baseListing],
        loading: false,
        error: null,
      });
    });

    it("calls cancelListing with listing id and user uid", async () => {
      mockUseAuth.mockReturnValue({ user: OWNER });
      mockCancelListing.mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderPanel();
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(mockCancelListing).toHaveBeenCalledWith({
        listingId: "listing-1",
        cancelledByUid: "owner-uid",
      });
    });

    it("redirects to login when user is null", async () => {
      mockUseAuth.mockReturnValue({ user: null });
      const user = userEvent.setup();
      renderPanel();
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(mockNavigate).toHaveBeenCalledWith("/auth/login", {
        state: { from: { pathname: "/collectibles/LT24-ELS-01" } },
      });
      expect(mockCancelListing).not.toHaveBeenCalled();
    });

    it("alerts with error message on failure", async () => {
      mockUseAuth.mockReturnValue({ user: OWNER });
      mockCancelListing.mockRejectedValue(new Error("Network error"));
      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
      const user = userEvent.setup();
      renderPanel();
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith("Network error");
      });
    });

    it("alerts with fallback message when error has no message", async () => {
      mockUseAuth.mockReturnValue({ user: OWNER });
      mockCancelListing.mockRejectedValue({});
      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
      const user = userEvent.setup();
      renderPanel();
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith("Failed to cancel listing");
      });
    });

    it("calls console.error on failure", async () => {
      mockUseAuth.mockReturnValue({ user: OWNER });
      mockCancelListing.mockRejectedValue(new Error("Network error"));
      vi.spyOn(window, "alert").mockImplementation(() => {});
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const user = userEvent.setup();
      renderPanel();
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith("Failed to cancel listing", expect.any(Error));
      });
    });

    it("calls cancelListing with correct listing when multiple listings and clicking second row", async () => {
      const twoListings = [
        { ...baseListing, id: "listing-1", createdByUid: "owner-uid" },
        { ...baseListing, id: "listing-2", createdByUid: "owner-uid" },
      ];
      mockUseOpenListings.mockReturnValue({
        listings: twoListings,
        loading: false,
        error: null,
      });
      mockUseAuth.mockReturnValue({ user: OWNER });
      mockCancelListing.mockResolvedValue(undefined);
      mockGetCollectibleRecord.mockReturnValue({ displayName: "Card" });
      const user = userEvent.setup();
      renderPanel();
      const cancelButtons = screen.getAllByRole("button", { name: "Cancel" });
      await user.click(cancelButtons[1]);
      expect(mockCancelListing).toHaveBeenCalledWith({
        listingId: "listing-2",
        cancelledByUid: "owner-uid",
      });
    });
  });

  // ── handleAccept ───────────────────────────────────────────────

  describe("handleAccept", () => {
    beforeEach(() => {
      mockUseOpenListings.mockReturnValue({
        listings: [baseListing],
        loading: false,
        error: null,
      });
    });

    it("calls acceptListing with the listing id", async () => {
      mockUseAuth.mockReturnValue({ user: BUYER });
      mockAcceptListing.mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderPanel();
      await user.click(screen.getByRole("button", { name: "Accept" }));
      expect(mockAcceptListing).toHaveBeenCalledWith({ listingId: "listing-1" });
    });

    it("redirects to login when user is null", async () => {
      mockUseAuth.mockReturnValue({ user: null });
      const user = userEvent.setup();
      renderPanel();
      await user.click(screen.getByRole("button", { name: "Accept" }));
      expect(mockNavigate).toHaveBeenCalledWith("/auth/login", {
        state: { from: { pathname: "/collectibles/LT24-ELS-01" } },
      });
      expect(mockAcceptListing).not.toHaveBeenCalled();
    });

    it("alerts with error message on failure", async () => {
      mockUseAuth.mockReturnValue({ user: BUYER });
      mockAcceptListing.mockRejectedValue(new Error("Insufficient funds"));
      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
      const user = userEvent.setup();
      renderPanel();
      await user.click(screen.getByRole("button", { name: "Accept" }));
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith("Insufficient funds");
      });
    });

    it("alerts with fallback message when error has no message", async () => {
      mockUseAuth.mockReturnValue({ user: BUYER });
      mockAcceptListing.mockRejectedValue(null);
      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
      const user = userEvent.setup();
      renderPanel();
      await user.click(screen.getByRole("button", { name: "Accept" }));
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith("Failed to accept listing");
      });
    });

    it("calls console.error on failure", async () => {
      mockUseAuth.mockReturnValue({ user: BUYER });
      mockAcceptListing.mockRejectedValue(new Error("Insufficient funds"));
      vi.spyOn(window, "alert").mockImplementation(() => {});
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const user = userEvent.setup();
      renderPanel();
      await user.click(screen.getByRole("button", { name: "Accept" }));
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith("Failed to accept listing", expect.any(Error));
      });
    });

    it("calls acceptListing with correct listing when multiple listings and clicking second row", async () => {
      const twoListings = [
        { ...baseListing, id: "listing-1", createdByUid: "other-uid" },
        { ...baseListing, id: "listing-2", createdByUid: "other-uid" },
      ];
      mockUseOpenListings.mockReturnValue({
        listings: twoListings,
        loading: false,
        error: null,
      });
      mockUseAuth.mockReturnValue({ user: BUYER });
      mockAcceptListing.mockResolvedValue(undefined);
      mockGetCollectibleRecord.mockReturnValue({ displayName: "Card" });
      const user = userEvent.setup();
      renderPanel();
      const acceptButtons = screen.getAllByRole("button", { name: "Accept" });
      await user.click(acceptButtons[1]);
      expect(mockAcceptListing).toHaveBeenCalledWith({ listingId: "listing-2" });
    });
  });

  // ── Redirect uses collectibleId ─────────────────────────────────

  describe("redirect pathname", () => {
    beforeEach(() => {
      mockUseOpenListings.mockReturnValue({
        listings: [baseListing],
        loading: false,
        error: null,
      });
    });

    it("uses collectibleId in login redirect from handleCancel", async () => {
      mockUseAuth.mockReturnValue({ user: null });
      const user = userEvent.setup();
      renderPanel({ collectibleId: "LT24-HLD-99" });
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(mockNavigate).toHaveBeenCalledWith("/auth/login", {
        state: { from: { pathname: "/collectibles/LT24-HLD-99" } },
      });
    });

    it("uses collectibleId in login redirect from handleAccept", async () => {
      mockUseAuth.mockReturnValue({ user: null });
      const user = userEvent.setup();
      renderPanel({ collectibleId: "LT24-CST-42" });
      await user.click(screen.getByRole("button", { name: "Accept" }));
      expect(mockNavigate).toHaveBeenCalledWith("/auth/login", {
        state: { from: { pathname: "/collectibles/LT24-CST-42" } },
      });
    });
  });

  // ── getCollectibleRecord ────────────────────────────────────────

  describe("getCollectibleRecord", () => {
    beforeEach(() => {
      mockUseOpenListings.mockReturnValue({
        listings: [baseListing],
        loading: false,
        error: null,
      });
    });

    it("is called with collectibleId", () => {
      renderPanel({ collectibleId: "LT24-XYZ-99" });
      expect(mockGetCollectibleRecord).toHaveBeenCalledWith("LT24-XYZ-99");
    });

    it("is not called when listings are empty", () => {
      mockUseOpenListings.mockReturnValue({ listings: [], loading: false, error: null });
      renderPanel({ collectibleId: "LT24-ABC" });
      expect(mockGetCollectibleRecord).not.toHaveBeenCalled();
    });

    it("is not called when loading", () => {
      mockUseOpenListings.mockReturnValue({ listings: [], loading: true, error: null });
      renderPanel({ collectibleId: "LT24-ABC" });
      expect(mockGetCollectibleRecord).not.toHaveBeenCalled();
    });

    it("is not called when error", () => {
      mockUseOpenListings.mockReturnValue({
        listings: [],
        loading: false,
        error: new Error("load failed"),
      });
      renderPanel({ collectibleId: "LT24-ABC" });
      expect(mockGetCollectibleRecord).not.toHaveBeenCalled();
    });
  });

  // ── ListingRow receives correct listing per row ──────────────────

  describe("ListingRow listing data", () => {
    const twoListings = [
      { ...baseListing, id: "listing-a", createdByUid: "owner-uid", createdByDisplayName: "Alice" },
      { ...baseListing, id: "listing-b", createdByUid: "buyer-uid", createdByDisplayName: "Bob" },
    ];

    beforeEach(() => {
      mockUseOpenListings.mockReturnValue({
        listings: twoListings,
        loading: false,
        error: null,
      });
      mockGetCollectibleRecord.mockReturnValue({ displayName: "Elysium #01" });
    });

    it("passes each listing to its ListingRow", () => {
      renderPanel();
      expect(rowPropsLog[0].listing).toEqual(twoListings[0]);
      expect(rowPropsLog[1].listing).toEqual(twoListings[1]);
    });

    it("passes onAccept and onCancel to each row", () => {
      renderPanel();
      expect(typeof rowPropsLog[0].onAccept).toBe("function");
      expect(typeof rowPropsLog[0].onCancel).toBe("function");
      expect(typeof rowPropsLog[1].onAccept).toBe("function");
      expect(typeof rowPropsLog[1].onCancel).toBe("function");
    });
  });
});
