import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TestMemoryRouter } from "../../test/router.jsx";
import OffersPage from "./index.jsx";

vi.mock("../../components/Auth/AuthGuard", () => ({
  default: ({ children, fallback }) => (
    <div data-testid="auth-guard">
      <span data-testid="fallback">{fallback}</span>
      <span data-testid="children">{children}</span>
    </div>
  ),
}));

describe("OffersPage (unit)", () => {
  it("renders Marketplace Offers heading when AuthGuard renders children", () => {
    render(
      <TestMemoryRouter>
        <OffersPage />
      </TestMemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Marketplace Offers" })).toBeInTheDocument();
    expect(screen.getByText(/View and manage your trade offers/)).toBeInTheDocument();
  });
});
