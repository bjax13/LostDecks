import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import CollectibleGrid from "./CollectibleGrid.jsx";

vi.mock("./AddToCollectionButton.jsx", () => ({
  default: ({ collectible }) => (
    <button type="button" className="card-actions add-to-collection" data-testid="add-btn">
      Add {collectible.id}
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
      <MemoryRouter>
        <CollectibleGrid collectibles={[mockCollectible]} />
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: /Story #01/i });
    expect(link).toHaveAttribute("href", "/collectibles/LT24-ELS-01");
  });

  it("prevents navigation when clicking add-to-collection button", async () => {
    render(
      <MemoryRouter>
        <CollectibleGrid collectibles={[mockCollectible]} />
      </MemoryRouter>,
    );
    const addBtn = screen.getByTestId("add-btn");
    await userEvent.click(addBtn);
    expect(window.location.pathname).toBe("/");
  });
});
