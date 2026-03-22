import { renderHook } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useAuthGuard } from "./useAuthGuard.js";

const mockUseAuth = vi.fn();

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

function wrapper({ initialEntries = ["/test"] }) {
  return ({ children }) => (
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/test" element={children} />
        <Route path="/collection" element={children} />
      </Routes>
    </MemoryRouter>
  );
}

describe("useAuthGuard (unit)", () => {
  it("returns isAuthenticated true when user exists", () => {
    mockUseAuth.mockReturnValue({ user: { uid: "u1" }, loading: false });
    const { result } = renderHook(() => useAuthGuard(), {
      wrapper: wrapper({}),
    });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.redirectState).toEqual({ from: expect.any(Object) });
  });

  it("returns isAuthenticated false when user is null", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    const { result } = renderHook(() => useAuthGuard(), {
      wrapper: wrapper({}),
    });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it("returns loading true when auth is loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    const { result } = renderHook(() => useAuthGuard(), {
      wrapper: wrapper({}),
    });
    expect(result.current.loading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("includes current location in redirectState", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    const { result } = renderHook(() => useAuthGuard(), {
      wrapper: wrapper({ initialEntries: ["/collection"] }),
    });
    expect(result.current.redirectState.from).toMatchObject({ pathname: "/collection" });
  });
});
