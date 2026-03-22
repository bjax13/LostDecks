import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ListingRow from "./ListingRow.jsx";

describe("ListingRow (unit)", () => {
  const baseListing = {
    id: "l1",
    type: "ASK",
    priceCents: 999,
    currency: "USD",
    cardId: "LT24-ELS-01",
    createdByDisplayName: "Alice",
  };

  it("renders Ask label for ASK type", () => {
    render(<ListingRow listing={baseListing} canAccept onAccept={() => {}} onCancel={() => {}} />);
    expect(screen.getByText("Ask")).toBeInTheDocument();
  });

  it("renders Bid label for BID type", () => {
    render(
      <ListingRow
        listing={{ ...baseListing, type: "BID" }}
        canAccept
        onAccept={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText("Bid")).toBeInTheDocument();
  });

  it("formats price as currency", () => {
    render(<ListingRow listing={baseListing} canAccept onAccept={() => {}} onCancel={() => {}} />);
    expect(screen.getByText("$9.99")).toBeInTheDocument();
  });

  it("uses cardLabel when provided", () => {
    render(
      <ListingRow
        listing={baseListing}
        cardLabel="Story #01"
        canAccept
        onAccept={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText(/Story #01/)).toBeInTheDocument();
  });

  it("shows Anonymous when createdByDisplayName missing", () => {
    render(
      <ListingRow
        listing={{ ...baseListing, createdByDisplayName: null }}
        canAccept
        onAccept={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText(/Anonymous/)).toBeInTheDocument();
  });

  it("calls onAccept when Accept clicked and canAccept", async () => {
    const onAccept = vi.fn();
    render(<ListingRow listing={baseListing} canAccept onAccept={onAccept} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(onAccept).toHaveBeenCalledWith(baseListing);
  });

  it("shows Cancel button when canCancel", () => {
    const onCancel = vi.fn();
    render(<ListingRow listing={baseListing} canCancel onAccept={() => {}} onCancel={onCancel} />);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("calls onCancel when Cancel clicked", async () => {
    const onCancel = vi.fn();
    render(<ListingRow listing={baseListing} canCancel onAccept={() => {}} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledWith(baseListing);
  });

  it("disables Accept when not canAccept", () => {
    const { container } = render(
      <ListingRow
        listing={baseListing}
        canAccept={false}
        onAccept={() => {}}
        onCancel={() => {}}
      />,
    );
    const acceptBtn = container.querySelector(".market-listing__actions button");
    expect(acceptBtn).toBeDisabled();
  });

  it("falls back to currency + amount when Intl fails", () => {
    const originalNumberFormat = Intl.NumberFormat;
    Intl.NumberFormat = () => {
      throw new Error("Intl not available");
    };
    render(
      <ListingRow
        listing={{ ...baseListing, currency: "XYZ" }}
        canAccept
        onAccept={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText(/XYZ/)).toBeInTheDocument();
    Intl.NumberFormat = originalNumberFormat;
  });
});
