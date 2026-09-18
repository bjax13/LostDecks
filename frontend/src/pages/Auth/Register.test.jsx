import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TestMemoryRouter } from "../../test/router.jsx";
import Register from "./Register.jsx";

const mockRegister = vi.fn();
let mockError = null;

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    register: mockRegister,
    error: mockError,
    clearError: vi.fn(),
  }),
}));

vi.mock("../../components/Auth/SocialLoginButtons", () => ({
  default: ({ onSuccess }) => (
    <button type="button" onClick={() => onSuccess?.()}>
      Google
    </button>
  ),
}));

function renderRegister(entry = "/auth/register") {
  return render(
    <TestMemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/auth/register" element={<Register />} />
        <Route path="/" element={<div>Home page</div>} />
        <Route path="/collections" element={<div>Collection page</div>} />
        <Route path="/account" element={<div>Account page</div>} />
      </Routes>
    </TestMemoryRouter>,
  );
}

async function fillAndSubmit(user) {
  await user.click(screen.getByLabelText(/Display Name/i));
  await user.paste("Test User");
  await user.click(screen.getByLabelText(/Email/i));
  await user.paste("new@example.com");
  await user.click(screen.getByLabelText(/Password/i));
  await user.paste("secret123");
  await user.click(screen.getByRole("button", { name: "Sign Up" }));
}

describe("Register (unit)", () => {
  let user;

  beforeEach(() => {
    vi.clearAllMocks();
    mockError = null;
    user = userEvent.setup({ delay: null });
  });

  it("renders registration form", () => {
    renderRegister();
    expect(
      screen.getByRole("heading", { name: /Create your ShardStash account/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
  });

  it("calls register on submit", async () => {
    mockRegister.mockResolvedValue(undefined);
    renderRegister();
    await fillAndSubmit(user);
    expect(mockRegister).toHaveBeenCalledWith("new@example.com", "secret123", {
      displayName: "Test User",
    });
  });

  it("navigates to home after successful registration", async () => {
    mockRegister.mockResolvedValue(undefined);
    renderRegister();
    await fillAndSubmit(user);
    await waitFor(() => {
      expect(screen.getByText("Home page")).toBeInTheDocument();
    });
    expect(screen.queryByText("Collection page")).not.toBeInTheDocument();
  });

  it("honors state.from after successful registration", async () => {
    mockRegister.mockResolvedValue(undefined);
    renderRegister({
      pathname: "/auth/register",
      state: { from: { pathname: "/account" } },
    });
    await fillAndSubmit(user);
    await waitFor(() => {
      expect(screen.getByText("Account page")).toBeInTheDocument();
    });
  });

  it("navigates to home after successful Google registration sign-in", async () => {
    renderRegister();
    await user.click(screen.getByRole("button", { name: "Google" }));
    expect(screen.getByText("Home page")).toBeInTheDocument();
  });
});
