import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "../../contexts/AuthContext";
import { AuthModalProvider } from "../../contexts/AuthModalContext";
import { TestMemoryRouter } from "../../test/router.jsx";
import CollectiblesPage from "./index.jsx";

function renderWithRouter(ui) {
  return render(
    <AuthProvider>
      <AuthModalProvider>
        <TestMemoryRouter>{ui}</TestMemoryRouter>
      </AuthModalProvider>
    </AuthProvider>,
  );
}

describe("CollectiblesPage (integration)", () => {
  it("renders header and collectibles content", () => {
    renderWithRouter(<CollectiblesPage />);
    expect(screen.getByRole("heading", { name: "Collectibles" })).toBeInTheDocument();
    expect(screen.getByText(/Browse the/)).toBeInTheDocument();
  });

  it("toggles between grid and table view", { timeout: 15000 }, async () => {
    renderWithRouter(<CollectiblesPage />);
    expect(screen.getByRole("button", { name: "Grid view" })).toHaveClass("active");
    await userEvent.click(screen.getByRole("button", { name: "Table view" }));
    expect(screen.getByRole("button", { name: "Table view" })).toHaveClass("active");
  });

  it("renders collectible cards in grid by default", () => {
    renderWithRouter(<CollectiblesPage />);
    expect(document.querySelector(".cards-grid")).toBeInTheDocument();
  });

  it("toggles sort direction when sort button clicked", { timeout: 15000 }, async () => {
    renderWithRouter(<CollectiblesPage />);
    const sortBtn = screen.getByRole("button", { name: /Sort ascending/i });
    await userEvent.click(sortBtn);
    expect(screen.getByRole("button", { name: /Sort descending/i })).toBeInTheDocument();
  });

  it("renders table when table view selected", { timeout: 15000 }, async () => {
    renderWithRouter(<CollectiblesPage />);
    await userEvent.click(screen.getByRole("button", { name: "Table view" }));
    expect(document.querySelector("table")).toBeInTheDocument();
  });
});
