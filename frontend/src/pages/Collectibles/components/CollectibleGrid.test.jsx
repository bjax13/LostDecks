import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TestMemoryRouter } from "../../../test/router.jsx";
import "../Collectibles.css";
import CollectibleGrid from "./CollectibleGrid.jsx";

vi.mock("./AddToCollectionButton.jsx", () => ({
  default: ({ collectible, ownedBySkuId = {}, deleteWhenZero = true, onQuantityChange }) => {
    const skuId = `${collectible.id}-DUN`;
    const ownedQuantity = ownedBySkuId[skuId] ?? 0;
    const showStepper = ownedQuantity > 0 || Object.hasOwn(ownedBySkuId, skuId);
    const quantityLabel = `Dun · x${ownedQuantity}`;
    return (
      <div
        className="add-to-collection add-to-collection--card"
        data-testid={`add-${collectible.id}`}
        data-delete-when-zero={String(deleteWhenZero)}
      >
        {showStepper ? (
          <div className="add-to-collection__stepper">
            <button
              type="button"
              aria-label={`Decrease ${quantityLabel}`}
              onClick={() =>
                onQuantityChange?.({
                  skuId,
                  quantity: Math.max(0, ownedQuantity - 1),
                  deleted: false,
                })
              }
            >
              −
            </button>
            <span>{quantityLabel}</span>
            <button
              type="button"
              aria-label={`Increase ${quantityLabel}`}
              onClick={() =>
                onQuantityChange?.({ skuId, quantity: ownedQuantity + 1, deleted: false })
              }
            >
              +
            </button>
          </div>
        ) : (
          <button
            type="button"
            data-testid="add-btn"
            onClick={() => onQuantityChange?.({ skuId, quantity: 1, deleted: false })}
          >
            Add {collectible.id}
          </button>
        )}
      </div>
    );
  },
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
    expect(screen.getByText("Dun · x3")).toBeVisible();
    expect(screen.getByRole("button", { name: "Increase Dun · x3" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Decrease Dun · x3" })).toBeVisible();
  });

  it("keeps qty steppers in card-actions at glance and does not expand siblings", async () => {
    const sibling = {
      ...mockCollectible,
      id: "LT24-ELS-02",
      displayName: "Story #02",
    };
    const onQuantityChange = vi.fn();
    render(
      <TestMemoryRouter>
        <CollectibleGrid
          collectibles={[mockCollectible, sibling]}
          ownedBySkuId={{ "LT24-ELS-01-DUN": 2 }}
          deleteWhenZero={false}
          onQuantityChange={onQuantityChange}
        />
      </TestMemoryRouter>,
    );

    const tiles = [...document.querySelectorAll(".card-tile")];
    expect(tiles[0].querySelector(".card-actions")).toContainElement(
      screen.getByRole("button", { name: "Increase Dun · x2" }),
    );
    expect(tiles[0].querySelector(".card-details")).not.toHaveAttribute("open");
    expect(tiles[1].querySelector(".card-details")).not.toHaveAttribute("open");
    expect(screen.getByTestId("add-LT24-ELS-01")).toHaveAttribute("data-delete-when-zero", "false");
    expect(screen.getByTestId("add-btn")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Decrease Dun · x2" }));
    expect(onQuantityChange).toHaveBeenCalledWith({
      skuId: "LT24-ELS-01-DUN",
      quantity: 1,
      deleted: false,
    });
    await userEvent.click(screen.getByRole("button", { name: "Increase Dun · x2" }));
    expect(onQuantityChange).toHaveBeenCalledWith({
      skuId: "LT24-ELS-01-DUN",
      quantity: 3,
      deleted: false,
    });

    expect(tiles[0].querySelector(".card-details")).not.toHaveAttribute("open");
    expect(tiles[1].querySelector(".card-details")).not.toHaveAttribute("open");
  });

  it("keeps add in card-actions and does not expand a soft-zero sibling", async () => {
    const sibling = {
      ...mockCollectible,
      id: "LT24-ELS-02",
      displayName: "Story #02",
    };
    const onQuantityChange = vi.fn();
    render(
      <TestMemoryRouter>
        <CollectibleGrid
          collectibles={[mockCollectible, sibling]}
          ownedBySkuId={{ "LT24-ELS-02-DUN": 0 }}
          onQuantityChange={onQuantityChange}
        />
      </TestMemoryRouter>,
    );

    const tiles = [...document.querySelectorAll(".card-tile")];
    expect(screen.getByText("Dun · x0")).toBeVisible();
    expect(screen.getByRole("button", { name: "Decrease Dun · x0" })).toBeVisible();
    expect(tiles[0].querySelector(".card-actions")).toContainElement(screen.getByTestId("add-btn"));

    await userEvent.click(screen.getByTestId("add-btn"));
    expect(onQuantityChange).toHaveBeenCalledWith({
      skuId: "LT24-ELS-01-DUN",
      quantity: 1,
      deleted: false,
    });
    expect(tiles[0].querySelector(".card-details")).not.toHaveAttribute("open");
    expect(tiles[1].querySelector(".card-details")).not.toHaveAttribute("open");
  });

  it("pins actions to the card bottom and keeps collapsed siblings at glance size", async () => {
    const longTitle = {
      ...mockCollectible,
      id: "LT24-ELS-02",
      displayName: "The Chasmfriends get a Pet! #01 with a much longer title",
    };
    render(
      <TestMemoryRouter>
        <CollectibleGrid collectibles={[mockCollectible, longTitle]} />
      </TestMemoryRouter>,
    );

    const grid = document.querySelector(".cards-grid");
    const tiles = [...document.querySelectorAll(".card-tile")];
    expect(tiles).toHaveLength(2);
    expect(getComputedStyle(grid).alignItems).toBe("start");
    expect(getComputedStyle(tiles[0].querySelector(".card-actions")).marginTop).toBe("auto");
    expect(getComputedStyle(tiles[0].querySelector("h2")).webkitLineClamp).toBe("2");

    await userEvent.click(screen.getByRole("heading", { name: "Story #01" }));

    expect(tiles[0].querySelector(".card-details")).toHaveAttribute("open");
    expect(tiles[1].querySelector(".card-details")).not.toHaveAttribute("open");
  });
});
