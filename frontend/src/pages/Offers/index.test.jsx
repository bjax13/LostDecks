import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
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
      <MemoryRouter>
        <OffersPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Marketplace Offers" })).toBeInTheDocument();
    expect(screen.getByText(/View and manage your trade offers/)).toBeInTheDocument();
  });
});
