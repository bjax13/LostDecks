import { render, screen, waitFor, within } from "@testing-library/react";
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

const mockCancelListing = vi.fn();
const mockAcceptListing = vi.fn();
const mockCreateListing = vi.fn();
vi.mock("../../lib/marketplace/listings", () => ({
  cancelListing: (...args) => mockCancelListing(...args),
  acceptListing: (...args) => mockAcceptListing(...args),
  createListing: (...args) => mockCreateListing(...args),
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

function dialogEl() {
  return screen.getByRole("dialog", { name: "Create listing for a card" });
}

function submitCreateInDialog() {
  return within(dialogEl()).getByRole("button", { name: "Create listing" });
}

const BUYER = { uid: "buyer-uid", email: "buyer@example.com", displayName: "Buyer" };
const SELLER = { uid: "seller-uid", email: "seller@example.com", displayName: "Seller" };

const listingAsk = {
  id: "listing-ask-1",
  type: "ASK",
  priceCents: 999,
  currency: "USD",
  cardId: "LT24-ELS-01",
  createdByUid: "seller-uid",
  createdByDisplayName: "Seller",
};

const listingBid = {
  id: "listing-bid-1",
  type: "BID",
  priceCents: 500,
  currency: "USD",
  cardId: "LT24-HLD-05",
  createdByUid: "buyer-uid",
  createdByDisplayName: "Buyer",
};

const listingUnknownCard = {
  id: "listing-unknown",
  type: "ASK",
  priceCents: 100,
  currency: "USD",
  cardId: "UNKNOWN-CARD-ID",
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
  mockUseAuth.mockReturnValue({ user: BUYER });
  mockUseOpenListings.mockReturnValue({
    listings: [listingAsk, listingBid],
    loading: false,
    error: null,
  });
  mockCancelListing.mockResolvedValue(undefined);
  mockAcceptListing.mockResolvedValue({ ok: true });
  mockCreateListing.mockResolvedValue({ id: "new-listing" });
});

describe("MarketPage (integration)", () => {
  it("renders header, description, and primary actions", () => {
    renderMarket();
    expect(screen.getByRole("heading", { name: "Market" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Browse active buy (bid) and sell (ask) listings for Lost Tales collectibles.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create listing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Browse collectibles" })).toBeInTheDocument();
    expect(mockUseOpenListings).toHaveBeenCalledWith();
  });

  it("shows loading state", () => {
    mockUseOpenListings.mockReturnValue({ listings: [], loading: true, error: null });
    renderMarket();
    expect(screen.getByText("Loading listings…")).toBeInTheDocument();
  });

  it("shows error banner when hook reports error", () => {
    mockUseOpenListings.mockReturnValue({
      listings: [],
      loading: false,
      error: new Error("network"),
    });
    renderMarket();
    expect(screen.getByText("Failed to load listings.")).toBeInTheDocument();
  });

  it("shows empty copy when there are no listings at all", () => {
    mockUseOpenListings.mockReturnValue({ listings: [], loading: false, error: null });
    renderMarket();
    expect(screen.getByText("No open listings yet.")).toBeInTheDocument();
  });

  it("shows filtered-empty copy when listings exist but filter excludes all", async () => {
    mockUseOpenListings.mockReturnValue({ listings: [listingAsk], loading: false, error: null });
    renderMarket();
    await userEvent.selectOptions(screen.getByLabelText("Type"), "BID");
    expect(screen.getByText("No open listings found.")).toBeInTheDocument();
  });

  it("navigates to collectibles from Browse collectibles", async () => {
    renderMarket();
    await userEvent.click(screen.getByRole("button", { name: "Browse collectibles" }));
    expect(mockNavigate).toHaveBeenCalledWith("/collectibles");
  });

  it("prompts sign-in when logged out", () => {
    mockUseAuth.mockReturnValue({ user: null });
    renderMarket();
    expect(
      screen.getByText("Sign in to create listings or accept an existing listing."),
    ).toBeInTheDocument();
  });

  it("renders listings with type filter and search", async () => {
    renderMarket();
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);

    await userEvent.selectOptions(screen.getByLabelText("Type"), "ASK");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("Ask")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Type"), "ALL");
    const search = screen.getByPlaceholderText(/Search collectibles/i);
    await userEvent.clear(search);
    await userEvent.type(search, "Elsecaller");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("shows card CTA when search matches a collectible id exactly", async () => {
    renderMarket();
    const search = screen.getByPlaceholderText(/Search collectibles/i);
    await userEvent.type(search, "LT24-ELS-01");
    expect(screen.getByText(/Matched card id:/)).toHaveTextContent("LT24-ELS-01");
    expect(
      screen.getByRole("button", { name: "Create listing for this card" }),
    ).toBeInTheDocument();
  });

  it("calls acceptListing when buyer accepts another user's ask", async () => {
    renderMarket();
    const row = screen.getByText(/Elsecaller/).closest("li");
    await userEvent.click(within(row).getByRole("button", { name: "Accept" }));
    await waitFor(() => {
      expect(mockAcceptListing).toHaveBeenCalledWith({ listingId: listingAsk.id });
    });
  });

  it("calls cancelListing when owner cancels their listing", async () => {
    mockUseAuth.mockReturnValue({ user: SELLER });
    mockUseOpenListings.mockReturnValue({ listings: [listingAsk], loading: false, error: null });
    renderMarket();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(mockCancelListing).toHaveBeenCalledWith({
        listingId: listingAsk.id,
        cancelledByUid: SELLER.uid,
      });
    });
  });

  it("alerts when acceptListing fails", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    mockAcceptListing.mockRejectedValueOnce(new Error("cannot accept"));
    renderMarket();
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("cannot accept");
    });
    alertSpy.mockRestore();
  });

  it("alerts when cancelListing fails", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    mockUseAuth.mockReturnValue({ user: SELLER });
    mockUseOpenListings.mockReturnValue({ listings: [listingAsk], loading: false, error: null });
    mockCancelListing.mockRejectedValueOnce(new Error("cancel failed"));
    renderMarket();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("cancel failed");
    });
    alertSpy.mockRestore();
  });

  it("opens and closes create modal via backdrop and close control", async () => {
    renderMarket();
    await userEvent.click(screen.getAllByRole("button", { name: "Create listing" })[0]);
    expect(screen.getByRole("dialog", { name: "Create listing for a card" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "×" }));
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Create listing for a card" }),
      ).not.toBeInTheDocument();
    });

    await userEvent.click(screen.getAllByRole("button", { name: "Create listing" })[0]);
    await userEvent.click(document.body.querySelector(".market-create-modal__backdrop"));
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Create listing for a card" }),
      ).not.toBeInTheDocument();
    });
  });

  it("closes create modal on Escape", async () => {
    renderMarket();
    await userEvent.click(screen.getAllByRole("button", { name: "Create listing" })[0]);
    await userEvent.click(screen.getByRole("heading", { name: "Create listing" }));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Create listing for a card" }),
      ).not.toBeInTheDocument();
    });
  });

  it("validates create form: missing card and invalid price", async () => {
    renderMarket();
    await userEvent.click(screen.getAllByRole("button", { name: "Create listing" })[0]);

    const cardInput = screen.getByPlaceholderText("Search by card name or id");
    await userEvent.clear(cardInput);
    await userEvent.type(cardInput, "not-a-real-card-id-xyz");
    await userEvent.clear(screen.getByPlaceholderText("10.00"));
    await userEvent.type(screen.getByPlaceholderText("10.00"), "0");
    await userEvent.click(submitCreateInDialog());

    expect(await screen.findByText("Select a card first.")).toBeInTheDocument();

    await userEvent.clear(cardInput);
    await userEvent.type(cardInput, "LT24-ELS-01");
    await userEvent.click(submitCreateInDialog());
    expect(await screen.findByText("Enter a valid price.")).toBeInTheDocument();

    await userEvent.clear(screen.getByPlaceholderText("10.00"));
    await userEvent.type(screen.getByPlaceholderText("10.00"), "not-a-number");
    await userEvent.click(submitCreateInDialog());
    expect(await screen.findByText("Enter a valid price.")).toBeInTheDocument();
    expect(mockCreateListing).not.toHaveBeenCalled();
  });

  it("creates listing when card id is entered with mixed casing", async () => {
    renderMarket();
    await userEvent.click(screen.getAllByRole("button", { name: "Create listing" })[0]);
    await userEvent.type(screen.getByPlaceholderText("Search by card name or id"), "lt24-els-01");
    await userEvent.type(screen.getByPlaceholderText("10.00"), "4");
    await userEvent.click(submitCreateInDialog());
    await waitFor(() => {
      expect(mockCreateListing).toHaveBeenCalledWith(
        expect.objectContaining({ cardId: "LT24-ELS-01", priceCents: 400 }),
      );
    });
  });

  it("creates listing with resolved card id and shows success", async () => {
    renderMarket();
    await userEvent.click(screen.getAllByRole("button", { name: "Create listing" })[0]);

    const cardInput = screen.getByPlaceholderText("Search by card name or id");
    await userEvent.clear(cardInput);
    await userEvent.type(cardInput, "LT24-ELS-01");
    await userEvent.clear(screen.getByPlaceholderText("10.00"));
    await userEvent.type(screen.getByPlaceholderText("10.00"), "12.50");
    await userEvent.click(submitCreateInDialog());

    await waitFor(() => {
      expect(mockCreateListing).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "BID",
          cardId: "LT24-ELS-01",
          priceCents: 1250,
          currency: "USD",
          quantity: 1,
          createdByUid: BUYER.uid,
          createdByDisplayName: BUYER.displayName,
        }),
      );
    });
    expect(await screen.findByText("Listing created.")).toBeInTheDocument();
  });

  it("navigates to login when submitting create form logged out", async () => {
    mockUseAuth.mockReturnValue({ user: null });
    renderMarket();
    await userEvent.click(screen.getAllByRole("button", { name: "Create listing" })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Sign in to create listing" }));
    expect(mockNavigate).toHaveBeenCalledWith("/auth/login", {
      state: { from: { pathname: "/market" } },
    });
    expect(mockCreateListing).not.toHaveBeenCalled();
  });

  it("sets create error when createListing throws", async () => {
    mockCreateListing.mockRejectedValueOnce(new Error("write failed"));
    renderMarket();
    await userEvent.click(screen.getAllByRole("button", { name: "Create listing" })[0]);
    await userEvent.type(screen.getByPlaceholderText("Search by card name or id"), "LT24-ELS-01");
    await userEvent.type(screen.getByPlaceholderText("10.00"), "5");
    await userEvent.click(submitCreateInDialog());
    expect(await screen.findByText("Failed to create listing.")).toBeInTheDocument();
  });

  it("selects card from picker with mouse and keyboard", async () => {
    renderMarket();
    await userEvent.click(screen.getAllByRole("button", { name: "Create listing" })[0]);
    const cardInput = screen.getByPlaceholderText("Search by card name or id");
    await userEvent.type(cardInput, "El");

    const option = await screen.findByRole("option", { name: /Elsecaller #01/i });
    await userEvent.click(option);
    expect(cardInput).toHaveValue("LT24-ELS-01");

    await userEvent.clear(cardInput);
    await userEvent.type(cardInput, "El");
    await userEvent.keyboard("{Enter}");
    await waitFor(() => {
      expect(cardInput).toHaveValue("LT24-ELS-01");
    });

    await userEvent.clear(cardInput);
    await userEvent.type(cardInput, "El");
    await userEvent.keyboard("{ArrowDown}{ArrowUp}{Enter}");
    await waitFor(() => {
      expect(cardInput).toHaveValue("LT24-ELS-01");
    });
  });

  it("closes card picker on Escape from combobox without closing modal", async () => {
    renderMarket();
    await userEvent.click(screen.getAllByRole("button", { name: "Create listing" })[0]);
    const cardInput = screen.getByPlaceholderText("Search by card name or id");
    await userEvent.type(cardInput, "El");
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
    cardInput.focus();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("dialog", { name: "Create listing for a card" })).toBeInTheDocument();
  });

  it("shows no results message in card picker for nonsense query", async () => {
    renderMarket();
    await userEvent.click(screen.getAllByRole("button", { name: "Create listing" })[0]);
    await userEvent.type(screen.getByPlaceholderText("Search by card name or id"), "zz");
    expect(await screen.findByText("No matching collectibles found.")).toBeInTheDocument();
  });

  it("changes listing type in create form", async () => {
    renderMarket();
    await userEvent.click(screen.getAllByRole("button", { name: "Create listing" })[0]);
    await userEvent.selectOptions(within(dialogEl()).getByLabelText("Type"), "ASK");
    await userEvent.type(
      within(dialogEl()).getByPlaceholderText("Search by card name or id"),
      "LT24-ELS-01",
    );
    await userEvent.type(within(dialogEl()).getByPlaceholderText("10.00"), "3");
    await userEvent.click(submitCreateInDialog());
    await waitFor(() => {
      expect(mockCreateListing).toHaveBeenCalledWith(expect.objectContaining({ type: "ASK" }));
    });
  });

  it("opens card picker with ArrowDown when fewer than two search characters", async () => {
    renderMarket();
    await userEvent.click(screen.getAllByRole("button", { name: "Create listing" })[0]);
    const cardInput = screen.getByPlaceholderText("Search by card name or id");
    await userEvent.type(cardInput, "E");
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.clear(cardInput);
    await userEvent.type(cardInput, "El");
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
  });

  it("renders listing row without collectible metadata when card id is unknown", () => {
    mockUseOpenListings.mockReturnValue({
      listings: [listingUnknownCard],
      loading: false,
      error: null,
    });
    mockUseAuth.mockReturnValue({ user: SELLER });
    renderMarket();
    expect(screen.getByText(/UNKNOWN-CARD-ID/)).toBeInTheDocument();
  });

  it("closes card picker when clicking outside picker", async () => {
    renderMarket();
    await userEvent.click(screen.getAllByRole("button", { name: "Create listing" })[0]);
    await userEvent.type(screen.getByPlaceholderText("Search by card name or id"), "El");
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("heading", { name: "Create listing" }));
    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });
});
