import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/marketplace/tradesClient", () => ({
  updateTradeStatus: vi.fn(),
}));

vi.mock("../hooks/useMyTrades", () => ({
  default: vi.fn(),
}));

import { updateTradeStatus } from "../../../lib/marketplace/tradesClient";
import useMyTrades from "../hooks/useMyTrades";
import TradesPanel from "./TradesPanel.jsx";

const USER = { uid: "user-1" };

function makeTrade(overrides = {}) {
  return {
    id: "trade-1",
    buyerUid: "user-1",
    sellerUid: "user-2",
    buyerDisplayName: "Alice",
    sellerDisplayName: "Bob",
    priceCents: 1500,
    currency: "USD",
    type: "BUY",
    cardId: "card-42",
    cardDisplayName: "Lightning Dragon",
    status: "PENDING",
    participants: ["user-1", "user-2"],
    ...overrides,
  };
}

beforeEach(() => {
  useMyTrades.mockReturnValue({ trades: [], loading: false, error: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TradesPanel", () => {
  describe("loading state", () => {
    it("shows a loading message while trades are loading", () => {
      useMyTrades.mockReturnValue({ trades: [], loading: true, error: null });
      render(<TradesPanel user={USER} />);
      expect(screen.getByText("Loading trades…")).toBeInTheDocument();
    });

    it("does not show the empty state while loading", () => {
      useMyTrades.mockReturnValue({ trades: [], loading: true, error: null });
      render(<TradesPanel user={USER} />);
      expect(screen.queryByText("No trades yet.")).not.toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("shows an error message when the hook returns an error", () => {
      useMyTrades.mockReturnValue({
        trades: [],
        loading: false,
        error: new Error("boom"),
      });
      render(<TradesPanel user={USER} />);
      expect(screen.getByText("Failed to load trades.")).toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("shows a message when there are no trades", () => {
      useMyTrades.mockReturnValue({ trades: [], loading: false, error: null });
      render(<TradesPanel user={USER} />);
      expect(screen.getByText("No trades yet.")).toBeInTheDocument();
    });
  });

  describe("trade rendering", () => {
    it("renders the section heading and hint", () => {
      render(<TradesPanel user={USER} />);
      expect(screen.getByRole("heading", { name: "My Trades" })).toBeInTheDocument();
      expect(
        screen.getByText(/Trades are created when you accept a market listing/),
      ).toBeInTheDocument();
    });

    it("displays a trade where the user is the buyer", () => {
      useMyTrades.mockReturnValue({
        trades: [makeTrade()],
        loading: false,
        error: null,
      });
      render(<TradesPanel user={USER} />);
      expect(screen.getByText(/Buyer/)).toBeInTheDocument();
      expect(screen.getByText(/\$15\.00/)).toBeInTheDocument();
      expect(screen.getByText(/BUY/)).toBeInTheDocument();
      expect(screen.getByText(/Lightning Dragon \(card-42\)/)).toBeInTheDocument();
      expect(screen.getByText(/With: Bob/)).toBeInTheDocument();
    });

    it("displays a trade where the user is the seller", () => {
      useMyTrades.mockReturnValue({
        trades: [makeTrade({ buyerUid: "someone-else", sellerUid: "user-1" })],
        loading: false,
        error: null,
      });
      render(<TradesPanel user={USER} />);
      expect(screen.getByText(/Seller/)).toBeInTheDocument();
      expect(screen.getByText(/With: Alice/)).toBeInTheDocument();
    });

    it("falls back to 'Anonymous' when counterparty has no display name", () => {
      useMyTrades.mockReturnValue({
        trades: [makeTrade({ sellerDisplayName: null })],
        loading: false,
        error: null,
      });
      render(<TradesPanel user={USER} />);
      expect(screen.getByText(/With: Anonymous/)).toBeInTheDocument();
    });

    it("shows only cardId when cardDisplayName is missing", () => {
      useMyTrades.mockReturnValue({
        trades: [makeTrade({ cardDisplayName: null })],
        loading: false,
        error: null,
      });
      render(<TradesPanel user={USER} />);
      expect(screen.getByText(/Card: card-42/)).toBeInTheDocument();
      expect(screen.queryByText(/Lightning Dragon/)).not.toBeInTheDocument();
    });
  });

  describe("formatMoney via rendered output", () => {
    it("formats cents into USD currency string", () => {
      useMyTrades.mockReturnValue({
        trades: [makeTrade({ priceCents: 999, currency: "USD" })],
        loading: false,
        error: null,
      });
      render(<TradesPanel user={USER} />);
      expect(screen.getByText(/\$9\.99/)).toBeInTheDocument();
    });

    it("handles a non-number priceCents gracefully (treats as 0)", () => {
      useMyTrades.mockReturnValue({
        trades: [makeTrade({ priceCents: null })],
        loading: false,
        error: null,
      });
      render(<TradesPanel user={USER} />);
      expect(screen.getByText(/\$0\.00/)).toBeInTheDocument();
    });

    it("falls back for an invalid currency code", () => {
      useMyTrades.mockReturnValue({
        trades: [makeTrade({ priceCents: 500, currency: "INVALID" })],
        loading: false,
        error: null,
      });
      render(<TradesPanel user={USER} />);
      expect(screen.getByText(/INVALID 5\.00/)).toBeInTheDocument();
    });

    it("formats EUR correctly", () => {
      useMyTrades.mockReturnValue({
        trades: [makeTrade({ priceCents: 2050, currency: "EUR" })],
        loading: false,
        error: null,
      });
      render(<TradesPanel user={USER} />);
      expect(screen.getByText(/20[.,]50/)).toBeInTheDocument();
    });
  });

  describe("PENDING trade actions", () => {
    it("shows action buttons only for PENDING trades", () => {
      useMyTrades.mockReturnValue({
        trades: [makeTrade({ status: "PENDING" })],
        loading: false,
        error: null,
      });
      render(<TradesPanel user={USER} />);
      expect(screen.getByRole("button", { name: "Mark completed" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Cancel trade" })).toBeInTheDocument();
    });

    it("does not show action buttons for COMPLETED trades", () => {
      useMyTrades.mockReturnValue({
        trades: [makeTrade({ status: "COMPLETED" })],
        loading: false,
        error: null,
      });
      render(<TradesPanel user={USER} />);
      expect(screen.queryByRole("button", { name: "Mark completed" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Cancel trade" })).not.toBeInTheDocument();
    });

    it("does not show action buttons for CANCELLED trades", () => {
      useMyTrades.mockReturnValue({
        trades: [makeTrade({ status: "CANCELLED" })],
        loading: false,
        error: null,
      });
      render(<TradesPanel user={USER} />);
      expect(screen.queryByRole("button", { name: "Mark completed" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Cancel trade" })).not.toBeInTheDocument();
    });
  });

  describe("handleUpdateStatus", () => {
    it("calls updateTradeStatus with COMPLETED when 'Mark completed' is clicked", async () => {
      const trade = makeTrade();
      useMyTrades.mockReturnValue({ trades: [trade], loading: false, error: null });
      updateTradeStatus.mockResolvedValue({});

      const user = userEvent.setup();
      render(<TradesPanel user={USER} />);
      await user.click(screen.getByRole("button", { name: "Mark completed" }));

      expect(updateTradeStatus).toHaveBeenCalledWith({
        tradeId: "trade-1",
        status: "COMPLETED",
      });
    });

    it("calls updateTradeStatus with CANCELLED when 'Cancel trade' is clicked", async () => {
      const trade = makeTrade();
      useMyTrades.mockReturnValue({ trades: [trade], loading: false, error: null });
      updateTradeStatus.mockResolvedValue({});

      const user = userEvent.setup();
      render(<TradesPanel user={USER} />);
      await user.click(screen.getByRole("button", { name: "Cancel trade" }));

      expect(updateTradeStatus).toHaveBeenCalledWith({
        tradeId: "trade-1",
        status: "CANCELLED",
      });
    });

    it("shows an alert and logs when updateTradeStatus rejects", async () => {
      const trade = makeTrade();
      useMyTrades.mockReturnValue({ trades: [trade], loading: false, error: null });
      updateTradeStatus.mockRejectedValue(new Error("Network failure"));

      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const user = userEvent.setup();
      render(<TradesPanel user={USER} />);
      await user.click(screen.getByRole("button", { name: "Mark completed" }));

      expect(alertSpy).toHaveBeenCalledWith("Network failure");
      expect(errorSpy).toHaveBeenCalledWith(
        "Failed to update trade status",
        expect.any(Error),
      );
    });

    it("alerts a generic message when the error has no message", async () => {
      const trade = makeTrade();
      useMyTrades.mockReturnValue({ trades: [trade], loading: false, error: null });
      updateTradeStatus.mockRejectedValue(undefined);

      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});

      const user = userEvent.setup();
      render(<TradesPanel user={USER} />);
      await user.click(screen.getByRole("button", { name: "Cancel trade" }));

      expect(alertSpy).toHaveBeenCalledWith("Failed to update trade status");
    });
  });

  describe("multiple trades", () => {
    it("renders all trades in the list", () => {
      useMyTrades.mockReturnValue({
        trades: [
          makeTrade({ id: "t-1", cardId: "c-1", cardDisplayName: "Card A" }),
          makeTrade({ id: "t-2", cardId: "c-2", cardDisplayName: "Card B", status: "COMPLETED" }),
          makeTrade({ id: "t-3", cardId: "c-3", cardDisplayName: "Card C", status: "CANCELLED" }),
        ],
        loading: false,
        error: null,
      });
      render(<TradesPanel user={USER} />);

      const items = screen.getAllByRole("listitem");
      expect(items).toHaveLength(3);

      expect(within(items[0]).getByText(/Card A/)).toBeInTheDocument();
      expect(within(items[1]).getByText(/Card B/)).toBeInTheDocument();
      expect(within(items[2]).getByText(/Card C/)).toBeInTheDocument();

      expect(within(items[0]).getByRole("button", { name: "Mark completed" })).toBeInTheDocument();
      expect(within(items[1]).queryByRole("button", { name: "Mark completed" })).not.toBeInTheDocument();
      expect(within(items[2]).queryByRole("button", { name: "Mark completed" })).not.toBeInTheDocument();
    });
  });

  describe("hook invocation", () => {
    it("passes user.uid to useMyTrades", () => {
      render(<TradesPanel user={{ uid: "abc-123" }} />);
      expect(useMyTrades).toHaveBeenCalledWith("abc-123");
    });

    it("passes undefined when user is null", () => {
      render(<TradesPanel user={null} />);
      expect(useMyTrades).toHaveBeenCalledWith(undefined);
    });

    it("passes undefined when user object has no uid", () => {
      render(<TradesPanel user={{}} />);
      expect(useMyTrades).toHaveBeenCalledWith(undefined);
    });

    it("passes undefined when user is undefined", () => {
      render(<TradesPanel />);
      expect(useMyTrades).toHaveBeenCalledWith(undefined);
    });
  });

  describe("formatMoney edge cases", () => {
    it("uses default USD when currency is undefined", () => {
      useMyTrades.mockReturnValue({
        trades: [makeTrade({ priceCents: 1000, currency: undefined })],
        loading: false,
        error: null,
      });
      render(<TradesPanel user={USER} />);
      expect(screen.getByText(/\$10\.00/)).toBeInTheDocument();
    });

    it("handles priceCents of zero", () => {
      useMyTrades.mockReturnValue({
        trades: [makeTrade({ priceCents: 0 })],
        loading: false,
        error: null,
      });
      render(<TradesPanel user={USER} />);
      expect(screen.getByText(/\$0\.00/)).toBeInTheDocument();
    });

    it("treats non-number priceCents (string) as zero", () => {
      useMyTrades.mockReturnValue({
        trades: [makeTrade({ priceCents: "1500" })],
        loading: false,
        error: null,
      });
      render(<TradesPanel user={USER} />);
      expect(screen.getByText(/\$0\.00/)).toBeInTheDocument();
    });

    it("treats undefined priceCents as zero", () => {
      useMyTrades.mockReturnValue({
        trades: [makeTrade({ priceCents: undefined })],
        loading: false,
        error: null,
      });
      render(<TradesPanel user={USER} />);
      expect(screen.getByText(/\$0\.00/)).toBeInTheDocument();
    });
  });

  describe("display edge cases", () => {
    it("shows Anonymous when user is seller and buyer has no display name", () => {
      useMyTrades.mockReturnValue({
        trades: [
          makeTrade({
            buyerUid: "other",
            sellerUid: "user-1",
            buyerDisplayName: null,
            sellerDisplayName: "Me",
          }),
        ],
        loading: false,
        error: null,
      });
      render(<TradesPanel user={USER} />);
      expect(screen.getByText(/With: Anonymous/)).toBeInTheDocument();
    });

    it("shows only cardId when cardDisplayName is empty string", () => {
      useMyTrades.mockReturnValue({
        trades: [makeTrade({ cardDisplayName: "" })],
        loading: false,
        error: null,
      });
      render(<TradesPanel user={USER} />);
      expect(screen.getByText(/Card: card-42/)).toBeInTheDocument();
      expect(screen.queryByText(/\(card-42\)/)).not.toBeInTheDocument();
    });
  });

  describe("handleUpdateStatus error handling", () => {
    it("alerts generic message when error has empty string message", async () => {
      const trade = makeTrade();
      useMyTrades.mockReturnValue({ trades: [trade], loading: false, error: null });
      updateTradeStatus.mockRejectedValue(new Error(""));

      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});

      const user = userEvent.setup();
      render(<TradesPanel user={USER} />);
      await user.click(screen.getByRole("button", { name: "Mark completed" }));

      expect(alertSpy).toHaveBeenCalledWith("Failed to update trade status");
    });

    it("alerts generic message when rejected value is non-Error object", async () => {
      const trade = makeTrade();
      useMyTrades.mockReturnValue({ trades: [trade], loading: false, error: null });
      updateTradeStatus.mockRejectedValue({ someProperty: "value" });

      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});

      const user = userEvent.setup();
      render(<TradesPanel user={USER} />);
      await user.click(screen.getByRole("button", { name: "Cancel trade" }));

      expect(alertSpy).toHaveBeenCalledWith("Failed to update trade status");
    });
  });

  describe("section structure", () => {
    it("renders with account-section class", () => {
      render(<TradesPanel user={USER} />);
      const section = document.querySelector("section.account-section");
      expect(section).toBeInTheDocument();
    });

    it("error message has muted class", () => {
      useMyTrades.mockReturnValue({
        trades: [],
        loading: false,
        error: new Error("boom"),
      });
      render(<TradesPanel user={USER} />);
      const muted = document.querySelector(".muted");
      expect(muted).toBeInTheDocument();
      expect(muted).toHaveTextContent("Failed to load trades.");
    });

    it("empty state message has muted class", () => {
      useMyTrades.mockReturnValue({ trades: [], loading: false, error: null });
      render(<TradesPanel user={USER} />);
      const muted = document.querySelectorAll(".muted");
      expect(muted.length).toBeGreaterThan(0);
      expect(screen.getByText("No trades yet.")).toHaveClass("muted");
    });

    it("trade list has account-summary class", () => {
      useMyTrades.mockReturnValue({
        trades: [makeTrade()],
        loading: false,
        error: null,
      });
      render(<TradesPanel user={USER} />);
      const list = document.querySelector("ul.account-summary");
      expect(list).toBeInTheDocument();
    });
  });
});
