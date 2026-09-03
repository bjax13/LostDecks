import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CollectionQuantityControls from "./CollectionQuantityControls.jsx";

const mockAdjust = vi.fn();

vi.mock("../utils/adjustCollectionQuantity", () => ({
  adjustCollectionEntryQuantity: (...args) => mockAdjust(...args),
}));

const entry = {
  id: "doc-1",
  displayName: "Elsewhen #01",
  skuId: "LT24-ELS-01-DUN",
  quantity: 2,
};

describe("CollectionQuantityControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdjust.mockResolvedValue({ deleted: false, quantity: 1, entryId: "doc-1" });
  });

  it("renders the current quantity and a decrease control", () => {
    render(<CollectionQuantityControls entry={entry} />);

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decrease Elsewhen #01 quantity" })).toBeEnabled();
  });

  it("decrements the row entry by one copy", async () => {
    const user = userEvent.setup();
    render(<CollectionQuantityControls entry={entry} />);

    await user.click(screen.getByRole("button", { name: "Decrease Elsewhen #01 quantity" }));

    expect(mockAdjust).toHaveBeenCalledWith({ entry, delta: -1 });
  });

  it("disables decrease when quantity is 0", () => {
    render(<CollectionQuantityControls entry={{ ...entry, quantity: 0 }} />);

    expect(screen.getByRole("button", { name: "Decrease Elsewhen #01 quantity" })).toBeDisabled();
  });

  it("shows an error when the update fails", async () => {
    const user = userEvent.setup();
    mockAdjust.mockRejectedValueOnce(new Error("permission-denied"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<CollectionQuantityControls entry={entry} />);
    await user.click(screen.getByRole("button", { name: "Decrease Elsewhen #01 quantity" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't update quantity");
    errorSpy.mockRestore();
  });
});
