import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MarketPage from "./index.jsx";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockUseAuth = vi.fn();
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: (...args) => mockUseAuth(...args),
}));

const mockUseOpenListings = vi.fn();
vi.mock("./hooks/useOpenListings", () => ({
  default: (...args) => mockUseOpenListings(...args),
}));

vi.mock("../../lib/marketplace/listings", () => ({
  cancelListing: vi.fn(),
  acceptListing: vi.fn(),
  createListing: vi.fn(),
}));

/**
 * Real ListingRow disables Accept when logged out, so handleAccept/handleCancel
 * login redirects never run from the UI. Stub rows so we can invoke those handlers.
 */
vi.mock("./components/ListingRow", () => ({
  default: function ListingRowStub({ listing, onAccept, onCancel }) {
    return (
      <li>
        <button type="button" onClick={() => onAccept?.(listing)}>
          Test accept listing
        </button>
        <button type="button" onClick={() => onCancel?.(listing)}>
          Test cancel listing
        </button>
      </li>
    );
  },
}));

vi.mock("firebase/firestore", () => ({
  addDoc: vi.fn(),
  collection: vi.fn(),
  doc: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
  orderBy: vi.fn(),
  query: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(),
  where: vi.fn(),
}));

const listingAsk = {
  id: "listing-ask-1",
  type: "ASK",
  priceCents: 999,
  currency: "USD",
  cardId: "LT24-ELS-01",
  createdByUid: "seller-uid",
  createdByDisplayName: "Seller",
};

function renderMarket() {
  return render(
    <MemoryRouter>
      <MarketPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: null });
  mockUseOpenListings.mockReturnValue({
    listings: [listingAsk],
    loading: false,
    error: null,
  });
});

describe("MarketPage unauthenticated listing actions", () => {
  it("redirects to login when accept handler runs without a user", async () => {
    renderMarket();
    await userEvent.click(screen.getByRole("button", { name: "Test accept listing" }));
    expect(mockNavigate).toHaveBeenCalledWith("/auth/login", {
      state: { from: { pathname: "/market" } },
    });
  });

  it("redirects to login when cancel handler runs without a user", async () => {
    renderMarket();
    await userEvent.click(screen.getByRole("button", { name: "Test cancel listing" }));
    expect(mockNavigate).toHaveBeenCalledWith("/auth/login", {
      state: { from: { pathname: "/market" } },
    });
  });
});
