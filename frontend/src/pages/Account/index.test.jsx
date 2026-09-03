import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseAuth = vi.hoisted(() => vi.fn());
const mockSubscribeUserPreferences = vi.hoisted(() => vi.fn());
const mockUpdateUserPreferences = vi.hoisted(() => vi.fn());

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: mockUseAuth,
}));

vi.mock("../../components/Auth/AuthGuard", () => ({
  default: ({ children, fallback }) => {
    const { loading } = mockUseAuth();
    return loading ? fallback : children;
  },
}));

vi.mock("../../lib/userPreferences", () => ({
  DEFAULT_USER_PREFERENCES: { matchingOptOut: false },
  subscribeUserPreferences: mockSubscribeUserPreferences,
  updateUserPreferences: mockUpdateUserPreferences,
}));

import AccountPage from "./index.jsx";

const MOCK_USER = {
  uid: "abc-123",
  displayName: "Jane Doe",
  email: "jane@example.com",
};

const mockUpdateDisplayName = vi.hoisted(() => vi.fn());

function renderAccountPage() {
  return render(<AccountPage />);
}

describe("AccountPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateDisplayName.mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      user: MOCK_USER,
      loading: false,
      updateDisplayName: mockUpdateDisplayName,
    });
    mockSubscribeUserPreferences.mockImplementation((_uid, onNext) => {
      onNext({ matchingOptOut: false });
      return () => {};
    });
    mockUpdateUserPreferences.mockResolvedValue(undefined);
  });

  // ── Rendering / AuthGuard integration ──────────────────────────────────

  it("shows the loading fallback while auth is loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    renderAccountPage();
    expect(screen.getByText("Loading account…")).toBeInTheDocument();
  });

  it("renders the page header and hint when authenticated", () => {
    renderAccountPage();
    expect(screen.getByRole("heading", { name: "Account Settings" })).toBeInTheDocument();
    expect(screen.getByText(/view and update your account profile/i)).toBeInTheDocument();
  });

  it("renders within an account-page section", () => {
    const { container } = renderAccountPage();
    const accountPage = container.querySelector(".account-page");
    expect(accountPage).toBeInTheDocument();
    expect(accountPage).toHaveClass("account-page");
  });

  // ── Profile overview ────────────────────────────────────────────────────

  it("displays the user display name and email", () => {
    renderAccountPage();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
  });

  it("renders the Profile overview heading when user exists", () => {
    renderAccountPage();
    expect(screen.getByRole("heading", { name: "Profile overview" })).toBeInTheDocument();
  });

  it("renders profile summary with Display name and Primary email labels", () => {
    renderAccountPage();
    expect(screen.getByText("Display name")).toBeInTheDocument();
    expect(screen.getByText("Primary email")).toBeInTheDocument();
  });

  it('shows "Not set" when the user has no displayName', () => {
    mockUseAuth.mockReturnValue({
      user: { ...MOCK_USER, displayName: null },
      loading: false,
    });
    renderAccountPage();
    expect(screen.getByText("Not set")).toBeInTheDocument();
  });

  it('shows "Not set" when displayName is an empty string', () => {
    mockUseAuth.mockReturnValue({
      user: { ...MOCK_USER, displayName: "" },
      loading: false,
    });
    renderAccountPage();
    expect(screen.getByText("Not set")).toBeInTheDocument();
  });

  it("labels an anonymous guest session when email is missing", () => {
    mockUseAuth.mockReturnValue({
      user: { uid: "anon-1", isAnonymous: true, displayName: null, email: null },
      loading: false,
    });
    renderAccountPage();
    expect(screen.getByText("Guest session")).toBeInTheDocument();
  });

  it("disables match inclusion for guest sessions", () => {
    mockUseAuth.mockReturnValue({
      user: { uid: "anon-1", isAnonymous: true, displayName: null, email: null },
      loading: false,
    });
    renderAccountPage();
    expect(
      screen.getByText("Guest sessions are not included in trade matching."),
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Include me in Matches" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Include me in Matches" })).not.toBeChecked();
  });

  it('shows "Not set" for a non-guest user with no email', () => {
    mockUseAuth.mockReturnValue({
      user: { uid: "abc-123", displayName: "Jane Doe", email: null, isAnonymous: false },
      loading: false,
    });
    renderAccountPage();
    expect(screen.getByText("Not set")).toBeInTheDocument();
  });

  it("hides profile overview when user is null", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    renderAccountPage();
    expect(screen.queryByText("Profile overview")).not.toBeInTheDocument();
  });

  it("renders the match preferences toggle", () => {
    renderAccountPage();
    expect(screen.getByRole("heading", { name: "Match preferences" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Include me in Matches" })).toBeChecked();
  });

  it("persists the toggle when changed", async () => {
    const user = userEvent.setup();
    renderAccountPage();

    await user.click(screen.getByRole("checkbox", { name: "Include me in Matches" }));

    expect(mockUpdateUserPreferences).toHaveBeenCalledTimes(1);
    expect(mockUpdateUserPreferences).toHaveBeenCalledWith("abc-123", { matchingOptOut: true });
  });

  it("lets a signed-in user edit and save a new display name", async () => {
    mockUpdateDisplayName.mockImplementation(async (name) => {
      mockUseAuth.mockReturnValue({
        user: { ...MOCK_USER, displayName: name },
        loading: false,
        updateDisplayName: mockUpdateDisplayName,
      });
    });
    const user = userEvent.setup();
    renderAccountPage();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const input = screen.getByRole("textbox", { name: "Display name" });
    await user.clear(input);
    await user.type(input, "Jane Smith");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(mockUpdateDisplayName).toHaveBeenCalledWith("Jane Smith");
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("Display name updated.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("cancels display name editing without saving", async () => {
    const user = userEvent.setup();
    renderAccountPage();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const input = screen.getByRole("textbox", { name: "Display name" });
    await user.clear(input);
    await user.type(input, "Someone Else");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mockUpdateDisplayName).not.toHaveBeenCalled();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Display name" })).not.toBeInTheDocument();
  });

  it("does not call updateDisplayName when the name is unchanged", async () => {
    const user = userEvent.setup();
    renderAccountPage();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(mockUpdateDisplayName).not.toHaveBeenCalled();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.queryByText("Display name updated.")).not.toBeInTheDocument();
  });

  it("rejects a blank display name without saving", async () => {
    const user = userEvent.setup();
    renderAccountPage();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const input = screen.getByRole("textbox", { name: "Display name" });
    await user.clear(input);
    await user.type(input, "   ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(mockUpdateDisplayName).not.toHaveBeenCalled();
    expect(screen.getByText("Display name cannot be empty.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Display name" })).toBeInTheDocument();
  });

  it("keeps the editor open when saving the display name fails", async () => {
    mockUpdateDisplayName.mockRejectedValue(new Error("network"));
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderAccountPage();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const input = screen.getByRole("textbox", { name: "Display name" });
    await user.clear(input);
    await user.type(input, "Jane Smith");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("network")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Display name" })).toBeInTheDocument();
  });

  it("lets a user set a display name when none is stored", async () => {
    mockUseAuth.mockReturnValue({
      user: { ...MOCK_USER, displayName: null },
      loading: false,
      updateDisplayName: mockUpdateDisplayName,
    });
    mockUpdateDisplayName.mockImplementation(async (name) => {
      mockUseAuth.mockReturnValue({
        user: { ...MOCK_USER, displayName: name },
        loading: false,
        updateDisplayName: mockUpdateDisplayName,
      });
    });
    const user = userEvent.setup();
    renderAccountPage();

    expect(screen.getByText("Not set")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.type(screen.getByRole("textbox", { name: "Display name" }), "Collector");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(mockUpdateDisplayName).toHaveBeenCalledWith("Collector");
    expect(screen.getByText("Collector")).toBeInTheDocument();
    expect(screen.getByText("Display name updated.")).toBeInTheDocument();
  });
});
