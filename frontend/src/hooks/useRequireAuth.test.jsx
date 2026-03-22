import { renderHook } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { TestMemoryRouter } from "../test/router.jsx";
import { useRequireAuth } from "./useRequireAuth.js";

const mockUseAuth = vi.fn();
const mockNavigate = vi.fn();

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function wrapper({ initialEntries = ["/protected"] }) {
  return ({ children }) => (
    <TestMemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/protected" element={children} />
        <Route path="/auth/login" element={<div>Login page</div>} />
      </Routes>
    </TestMemoryRouter>
  );
}

describe("useRequireAuth (unit)", () => {
  it("returns user and loading when user exists", () => {
    const mockUser = { uid: "u1" };
    mockUseAuth.mockReturnValue({ user: mockUser, loading: false });
    const { result } = renderHook(() => useRequireAuth(), {
      wrapper: wrapper({}),
    });
    expect(result.current.user).toBe(mockUser);
    expect(result.current.loading).toBe(false);
  });

  it("redirects to /auth/login when not loading and no user", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    mockNavigate.mockClear();
    renderHook(() => useRequireAuth(), {
      wrapper: wrapper({}),
    });
    expect(mockNavigate).toHaveBeenCalledWith("/auth/login", {
      replace: true,
      state: { from: expect.any(Object) },
    });
  });

  it("uses custom redirectTo when provided", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    mockNavigate.mockClear();
    renderHook(() => useRequireAuth("/custom-login"), {
      wrapper: wrapper({}),
    });
    expect(mockNavigate).toHaveBeenCalledWith("/custom-login", {
      replace: true,
      state: { from: expect.any(Object) },
    });
  });

  it("does not redirect while loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    mockNavigate.mockClear();
    const { result } = renderHook(() => useRequireAuth(), {
      wrapper: wrapper({}),
    });
    expect(result.current.loading).toBe(true);
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
