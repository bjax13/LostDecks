import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { isDoubledCollectibleDetailPath } from "../../../lib/collectibleDetailPath";
import { TestMemoryRouter } from "../../../test/router.jsx";
import CollectibleTable from "./CollectibleTable.jsx";

vi.mock("./AddToCollectionButton.jsx", () => ({
  default: ({ ownedBySkuId }) => (
    <button type="button" className="add-to-collection" data-testid="add-btn">
      {ownedBySkuId?.["LT24-ELS-01-DUN"] ? `Dun · x${ownedBySkuId["LT24-ELS-01-DUN"]}` : "Add"}
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
};

describe("CollectibleTable (unit)", () => {
  it("renders table with collectible rows", () => {
    render(
      <TestMemoryRouter>
        <CollectibleTable collectibles={[mockCollectible]} />
      </TestMemoryRouter>,
    );
    expect(screen.getByText("LT24-ELS-01")).toBeInTheDocument();
    expect(screen.getByText("Story #01")).toBeInTheDocument();
  });

  it("shows a details link at the end of the row and navigates to the collectible", async () => {
    render(
      <TestMemoryRouter initialEntries={["/collectibles"]}>
        <Routes>
          <Route
            path="/collectibles"
            element={<CollectibleTable collectibles={[mockCollectible]} />}
          />
          <Route path="/collectibles/:id" element={<div data-testid="detail">Detail</div>} />
        </Routes>
      </TestMemoryRouter>,
    );

    const row = screen.getByText("LT24-ELS-01").closest("tr");
    const detailsLink = within(row).getByRole("link", { name: "View details for Story #01" });
    expect(detailsLink).toHaveTextContent("details ›");
    expect(detailsLink).toHaveAttribute("href", "/collectibles/LT24-ELS-01");
    expect(isDoubledCollectibleDetailPath(detailsLink.getAttribute("href"))).toBe(false);
    expect(detailsLink.closest(".add-to-collection")).toBeNull();
    expect(row.querySelector("td:last-child")).toContainElement(detailsLink);

    await userEvent.click(detailsLink);
    expect(screen.getByTestId("detail")).toBeInTheDocument();
  });

  it("navigates when row is clicked", async () => {
    render(
      <TestMemoryRouter initialEntries={["/collectibles"]}>
        <Routes>
          <Route
            path="/collectibles"
            element={<CollectibleTable collectibles={[mockCollectible]} />}
          />
          <Route path="/collectibles/:id" element={<div data-testid="detail">Detail</div>} />
        </Routes>
      </TestMemoryRouter>,
    );
    const row = screen.getByText("LT24-ELS-01").closest("tr");
    await userEvent.click(row);
    expect(screen.getByTestId("detail")).toBeInTheDocument();
  });

  it("does not navigate when add-to-collection is clicked", async () => {
    render(
      <TestMemoryRouter initialEntries={["/collectibles"]}>
        <Routes>
          <Route
            path="/collectibles"
            element={<CollectibleTable collectibles={[mockCollectible]} />}
          />
          <Route path="/collectibles/:id" element={<div data-testid="detail">Detail</div>} />
        </Routes>
      </TestMemoryRouter>,
    );
    const addBtn = screen.getByTestId("add-btn");
    await userEvent.click(addBtn);
    expect(screen.queryByTestId("detail")).not.toBeInTheDocument();
  });

  it("forwards ownedBySkuId to the add button", () => {
    render(
      <TestMemoryRouter>
        <CollectibleTable
          collectibles={[mockCollectible]}
          ownedBySkuId={{ "LT24-ELS-01-DUN": 2 }}
        />
      </TestMemoryRouter>,
    );
    expect(screen.getByTestId("add-btn")).toHaveTextContent("Dun · x2");
  });

  it("hides card-only columns and labels series when the list is pins", () => {
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
        <CollectibleTable collectibles={[pin]} />
      </TestMemoryRouter>,
    );

    expect(screen.getByRole("columnheader", { name: "Series" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Story" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Rarity" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Finishes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Binder" })).not.toBeInTheDocument();

    const row = screen.getByText("PIN-CPS1-00").closest("tr");
    expect(row).toHaveTextContent("Character Pin Series 1");
    expect(within(row).getByRole("link", { name: "View details for Brandon" })).toHaveAttribute(
      "href",
      "/collectibles/PIN-CPS1-00",
    );
    expect(row).toHaveTextContent("Brandon");
    expect(row).not.toHaveTextContent("Mythic");
    expect(row).not.toHaveTextContent("DUN");
    expect(row).not.toHaveTextContent("FOIL");
    expect(row).not.toHaveTextContent("Page 1");
  });

  it("keeps card columns and blanks card-only fields on pin rows in a mixed list", () => {
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
      binder: { page: 2, row: 2, col: 2, position: "B" },
    };
    render(
      <TestMemoryRouter>
        <CollectibleTable collectibles={[mockCollectible, pin]} />
      </TestMemoryRouter>,
    );

    expect(screen.getByRole("columnheader", { name: "Story" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Rarity" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Finishes" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Binder" })).toBeInTheDocument();

    const cardRow = screen.getByText("LT24-ELS-01").closest("tr");
    expect(cardRow).toHaveTextContent("Elsecaller");
    expect(cardRow).toHaveTextContent("Common");
    expect(cardRow).toHaveTextContent("DUN");
    expect(cardRow).toHaveTextContent("FOIL");

    const pinRow = screen.getByText("PIN-CPS1-00").closest("tr");
    expect(pinRow).toHaveTextContent("Character Pin Series 1");
    expect(pinRow).not.toHaveTextContent("Mythic");
    expect(pinRow).not.toHaveTextContent("DUN");
    expect(pinRow).not.toHaveTextContent("FOIL");
    expect(pinRow).not.toHaveTextContent("Page 2");
  });
});
