import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { TestMemoryRouter } from "../../../test/router.jsx";
import CollectibleTable from "./CollectibleTable.jsx";

vi.mock("./AddToCollectionButton.jsx", () => ({
  default: () => (
    <button type="button" className="add-to-collection" data-testid="add-btn">
      Add
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
});
