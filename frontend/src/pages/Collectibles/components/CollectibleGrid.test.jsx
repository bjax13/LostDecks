import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { isDoubledCollectibleDetailPath } from "../../../lib/collectibleDetailPath";
import { TestMemoryRouter } from "../../../test/router.jsx";
import "../Collectibles.css";
import CollectibleGrid from "./CollectibleGrid.jsx";

function Pathname() {
  return <div data-testid="pathname">{useLocation().pathname}</div>;
}

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
    const detailsLink = screen.getByRole("link", { name: "View details for Story #01" });
    expect(detailsLink).toBeVisible();
    expect(detailsLink).toHaveTextContent("details ›");
    expect(detailsLink).toHaveAttribute("href", "/collectibles/LT24-ELS-01");
    expect(detailsLink.closest("summary")).toBeNull();
    expect(detailsLink.closest(".card-actions")).toBeNull();

    await userEvent.click(screen.getByRole("heading", { name: "Story #01" }));

    expect(details).toHaveAttribute("open");
    const skuLink = screen.getByRole("link", { name: "LT24-ELS-01" });
    expect(skuLink).toHaveAttribute("href", "/collectibles/LT24-ELS-01");
    expect(skuLink).toHaveClass("card-id--link");
    const skuStyle = getComputedStyle(skuLink);
    expect(skuStyle.color).toBe("rgb(207, 168, 255)");
    expect(`${skuStyle.textDecorationLine} ${skuStyle.textDecoration}`).toMatch(/underline/);
    expect(screen.getByText("Story card")).toBeVisible();
    expect(screen.getByText("Elsecaller")).toBeVisible();
    expect(screen.getByText("Common")).toBeVisible();
    expect(screen.getByText("DUN")).toBeVisible();
    expect(screen.getByText("FOIL")).toBeVisible();
    expect(screen.getByText("Not in binder mosaic")).toBeVisible();
  });

  it("follows the details link on a collapsed card without expanding it", async () => {
    render(
      <TestMemoryRouter initialEntries={["/collectibles"]}>
        <CollectibleGrid collectibles={[mockCollectible]} />
        <Pathname />
      </TestMemoryRouter>,
    );

    const details = document.querySelector(".card-details");
    expect(details).not.toHaveAttribute("open");
    await userEvent.click(screen.getByRole("link", { name: "View details for Story #01" }));

    expect(details).not.toHaveAttribute("open");
    expect(screen.getByTestId("pathname")).toHaveTextContent("/collectibles/LT24-ELS-01");
    expect(isDoubledCollectibleDetailPath("/collectibles/LT24-ELS-01")).toBe(false);
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

  it("renders pin list and expanded entries without card-only fields", async () => {
    const pin = {
      id: "PIN-CPS1-00",
      collectibleType: "pin",
      category: "pin",
      displayName: "Brandon",
      detail: "Character Pin Series 1",
      storyTitle: "Character Pin Series 1",
      number: 0,
      rarity: "Mythic",
      finishes: ["DUN", "FOIL"],
      binder: { page: 1, row: 1, col: 1, position: "A" },
      country: "US",
      release: "Year of Sanderson Box, later Dragonsteel store",
    };
    render(
      <TestMemoryRouter>
        <CollectibleGrid collectibles={[mockCollectible, pin]} />
      </TestMemoryRouter>,
    );

    const pinTile = screen.getByRole("heading", { name: "Brandon" }).closest(".card-tile");
    expect(pinTile.querySelector(".category-pill")).toHaveTextContent("Pin");
    const pinDetails = within(pinTile).getByRole("link", { name: "View details for Brandon" });
    expect(pinDetails).toHaveAttribute("href", "/collectibles/PIN-CPS1-00");
    expect(isDoubledCollectibleDetailPath(pinDetails.getAttribute("href"))).toBe(false);
    expect(pinTile.querySelector(".card-details")).not.toContainElement(pinDetails);
    expect(pinTile.querySelector(".card-details")).not.toHaveAttribute("open");
    expect(pinTile).not.toHaveTextContent("Rarity");
    expect(pinTile).not.toHaveTextContent("Finishes");
    expect(pinTile).not.toHaveTextContent("Binder");
    expect(pinTile).not.toHaveTextContent("DUN");
    expect(pinTile).not.toHaveTextContent("FOIL");

    await userEvent.click(screen.getByRole("heading", { name: "Brandon" }));

    expect(pinTile.querySelector(".card-details")).toHaveAttribute("open");
    expect(pinTile.querySelector(".card-stats")).toHaveClass("card-stats--pin");
    expect(pinTile.querySelector("dt")).toHaveTextContent("Series");
    expect(pinTile).toHaveTextContent("Character Pin Series 1");
    expect(pinTile).toHaveTextContent("Country");
    expect(pinTile).toHaveTextContent("US");
    expect(pinTile).toHaveTextContent("Release");
    expect(pinTile).toHaveTextContent("Year of Sanderson Box, later Dragonsteel store");
    expect(pinTile).not.toHaveTextContent("Story");
    expect(pinTile).not.toHaveTextContent("Rarity");
    expect(pinTile).not.toHaveTextContent("Finishes");
    expect(pinTile).not.toHaveTextContent("Binder");
    expect(pinTile).not.toHaveTextContent("DUN");
    expect(pinTile).not.toHaveTextContent("FOIL");
    expect(pinTile).not.toHaveTextContent("Mythic");
    expect(pinTile).not.toHaveTextContent("Not in binder mosaic");
    expect(pinTile).not.toHaveTextContent("Page 1");

    const cardTile = screen.getByRole("heading", { name: "Story #01" }).closest(".card-tile");
    await userEvent.click(screen.getByRole("heading", { name: "Story #01" }));
    expect(cardTile.querySelector(".card-stats")).not.toHaveClass("card-stats--pin");
    expect(cardTile.querySelector("dt")).toHaveTextContent("Story");
    expect(cardTile).toHaveTextContent("Story");
    expect(cardTile).toHaveTextContent("Rarity");
    expect(cardTile).toHaveTextContent("Common");
    expect(cardTile).toHaveTextContent("DUN");
    expect(cardTile).toHaveTextContent("FOIL");
    expect(cardTile).toHaveTextContent("Finishes");
    expect(cardTile).toHaveTextContent("Binder location");
    expect(cardTile).not.toHaveTextContent("Series");
    expect(cardTile).not.toHaveTextContent("Country");
    expect(cardTile).not.toHaveTextContent("Release");
  });

  it("keeps a fixed pin photo slot in the collapsed header and expands it in place", async () => {
    const pin = {
      id: "PIN-CPS2-01",
      collectibleType: "pin",
      category: "pin",
      displayName: "Kaladin",
      detail: "Character Pin Series 2",
      storyTitle: "Character Pin Series 2",
      number: 1,
      finishes: [],
      binder: null,
    };
    render(
      <TestMemoryRouter initialEntries={["/collectibles"]}>
        <CollectibleGrid collectibles={[pin, mockCollectible]} />
        <Pathname />
      </TestMemoryRouter>,
    );

    const pinTile = screen.getByRole("heading", { name: "Kaladin" }).closest(".card-tile");
    const details = pinTile.querySelector(".card-details");
    expect(details).not.toHaveAttribute("open");
    const slot = within(pinTile).getByRole("img", { name: "no photo yet" });
    expect(slot).toHaveTextContent("CPS2");
    expect(slot.closest("summary")).not.toBeNull();
    expect(slot.querySelector("img")).toBeNull();
    expect(getComputedStyle(slot).width).toBe("64px");
    expect(getComputedStyle(slot).height).toBe("64px");

    const cardTile = screen.getByRole("heading", { name: "Story #01" }).closest(".card-tile");
    expect(cardTile.querySelector(".pin-image")).toBeNull();

    await userEvent.click(slot);
    expect(details).toHaveAttribute("open");
    expect(screen.getByTestId("pathname")).toHaveTextContent("/collectibles");
    expect(screen.getByRole("link", { name: "View details for Kaladin" })).toHaveAttribute(
      "href",
      "/collectibles/PIN-CPS2-01",
    );
  });

  it("omits blank pin release and country on the expanded entry", async () => {
    const pin = {
      id: "PIN-CF-01",
      collectibleType: "pin",
      category: "pin",
      displayName: "Shredhead",
      detail: "ChasmFriends enamel pin",
      storyTitle: "ChasmFriends",
      number: 1,
      country: null,
      release: null,
      finishes: [],
      binder: null,
    };
    render(
      <TestMemoryRouter>
        <CollectibleGrid collectibles={[pin]} />
      </TestMemoryRouter>,
    );

    await userEvent.click(screen.getByRole("heading", { name: "Shredhead" }));
    const pinTile = screen.getByRole("heading", { name: "Shredhead" }).closest(".card-tile");
    expect(pinTile).toHaveTextContent("Series");
    expect(pinTile).toHaveTextContent("ChasmFriends");
    expect(pinTile).not.toHaveTextContent("Country");
    expect(pinTile).not.toHaveTextContent("Release");
    expect(pinTile).not.toHaveTextContent("Rarity");
  });
});
