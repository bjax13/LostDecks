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

describe("CollectibleGrid (unit)", () => {
  it("renders collectible cards as links", () => {
    render(
      <TestMemoryRouter>
        <CollectibleGrid collectibles={[mockCollectible]} />
      </TestMemoryRouter>,
    );
    const link = screen.getByRole("link", { name: /Story #01/i });
    expect(link).toHaveAttribute("href", "/collectibles/LT24-ELS-01");
  });

  it("prevents navigation when clicking add-to-collection button", async () => {
    render(
      <TestMemoryRouter>
        <CollectibleGrid collectibles={[mockCollectible]} />
      </TestMemoryRouter>,
    );
    const addBtn = screen.getByTestId("add-btn");
    await userEvent.click(addBtn);
    expect(window.location.pathname).toBe("/");
  });

  it("forwards ownedBySkuId to the add button", () => {
    render(
      <TestMemoryRouter>
        <CollectibleGrid collectibles={[mockCollectible]} ownedBySkuId={{ "LT24-ELS-01-DUN": 3 }} />
      </TestMemoryRouter>,
    );
    expect(screen.getByTestId("add-btn")).toHaveTextContent("Add LT24-ELS-01 · x3");
  });
});
