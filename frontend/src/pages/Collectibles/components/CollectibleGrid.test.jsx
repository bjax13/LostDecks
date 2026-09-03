import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TestMemoryRouter } from "../../../test/router.jsx";
import CollectibleGrid from "./CollectibleGrid.jsx";

vi.mock("./AddToCollectionButton.jsx", () => ({
  default: ({ collectible, ownedBySkuId }) => (
    <button type="button" className="card-actions add-to-collection" data-testid="add-btn">
      Add {collectible.id}
      {ownedBySkuId?.["LT24-ELS-01-DUN"] ? ` · x${ownedBySkuId["LT24-ELS-01-DUN"]}` : ""}
    </button>
  ),
}));

const mockCollectible = {
  id: "LT24-ELS-01",
  category: "story",
  displayName: "Story #01",
  detail: "Story card",
  storyTitle: "Elsecaller",
  number: 1,
  rarity: "Common",
  finishes: ["DUN", "FOIL"],
  binder: null,
  searchTokens: "lt24-els-01",
};

function renderGrid(props = {}) {
  return render(
    <TestMemoryRouter>
      <CollectibleGrid collectibles={[mockCollectible]} {...props} />
    </TestMemoryRouter>,
  );
}

describe("CollectibleGrid (unit)", () => {
  it("shows glance fields and hides details until expanded", async () => {
    renderGrid();

    const details = document.querySelector(".card-details");
    expect(details).not.toHaveAttribute("open");
    expect(document.querySelector(".category-pill")).toHaveTextContent("Story");
    expect(screen.getByRole("heading", { name: "Story #01" })).toBeVisible();
    expect(screen.getByTestId("add-btn")).toBeVisible();

    await userEvent.click(screen.getByRole("heading", { name: "Story #01" }));

    expect(details).toHaveAttribute("open");
    expect(screen.getByRole("link", { name: "LT24-ELS-01" })).toHaveAttribute(
      "href",
      "/collectibles/LT24-ELS-01",
    );
    expect(screen.getByText("Story card")).toBeVisible();
    expect(screen.getByText("Elsecaller")).toBeVisible();
    expect(screen.getByText("Common")).toBeVisible();
    expect(screen.getByText("DUN")).toBeVisible();
    expect(screen.getByText("FOIL")).toBeVisible();
    expect(screen.getByText("Not in binder mosaic")).toBeVisible();
  });

  it("does not expand details when add-to-collection is clicked", async () => {
    renderGrid();
    await userEvent.click(screen.getByTestId("add-btn"));
    expect(document.querySelector(".card-details")).not.toHaveAttribute("open");
    expect(screen.getByTestId("add-btn")).toBeVisible();
  });

  it("forwards ownedBySkuId to the add button", () => {
    renderGrid({ ownedBySkuId: { "LT24-ELS-01-DUN": 3 } });
    expect(screen.getByTestId("add-btn")).toHaveTextContent("Add LT24-ELS-01 · x3");
  });
});
