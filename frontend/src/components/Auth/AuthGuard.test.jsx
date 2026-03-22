import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import AuthGuard from "./AuthGuard.jsx";

const mockUseAuth = vi.fn();

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("AuthGuard (unit)", () => {
  it("renders fallback when loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthGuard fallback={<p>Loading…</p>}>
          <div>Protected</div>
        </AuthGuard>
      </MemoryRouter>,
    );
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText("Protected")).not.toBeInTheDocument();
  });

  it("redirects to login when not loading and no user", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route
            path="/protected"
            element={
              <AuthGuard>
                <div>Protected</div>
              </AuthGuard>
            }
          />
          <Route path="/auth/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Login page")).toBeInTheDocument();
    expect(screen.queryByText("Protected")).not.toBeInTheDocument();
  });

  it("renders children when user is authenticated", () => {
    mockUseAuth.mockReturnValue({ user: { uid: "u1" }, loading: false });
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthGuard>
          <div>Protected</div>
        </AuthGuard>
      </MemoryRouter>,
    );
    expect(screen.getByText("Protected")).toBeInTheDocument();
  });

  it("uses custom redirectTo when provided", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route
            path="/protected"
            element={
              <AuthGuard redirectTo="/custom-login">
                <div>Protected</div>
              </AuthGuard>
            }
          />
          <Route path="/custom-login" element={<div>Custom login</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Custom login")).toBeInTheDocument();
  });
});
