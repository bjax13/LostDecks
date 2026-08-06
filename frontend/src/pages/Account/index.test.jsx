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
  DEFAULT_DISCORD_CHANNEL: "Sanderson Collectors Guild",
  DEFAULT_USER_PREFERENCES: {
    matchingOptOut: false,
    matchContactSharing: "trueEmail",
    tradingEmail: "",
    discordHandle: "",
    discordChannel: "Sanderson Collectors Guild",
  },
  MATCH_CONTACT_SHARING: {
    TRUE_EMAIL: "trueEmail",
    TRADING_EMAIL: "tradingEmail",
    DISCORD: "discord",
  },
  MAX_TRADING_EMAIL_LENGTH: 320,
  MAX_DISCORD_HANDLE_LENGTH: 100,
  MAX_DISCORD_CHANNEL_LENGTH: 100,
  isValidTradingEmail: (value) =>
    typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()),
  subscribeUserPreferences: mockSubscribeUserPreferences,
  updateUserPreferences: mockUpdateUserPreferences,
}));

import AccountPage from "./index.jsx";

const MOCK_USER = {
  uid: "abc-123",
  displayName: "Jane Doe",
  email: "jane@example.com",
};

function renderAccountPage() {
  return render(<AccountPage />);
}

describe("AccountPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: MOCK_USER, loading: false });
    mockSubscribeUserPreferences.mockImplementation((_uid, onNext) => {
      onNext({
        matchingOptOut: false,
        matchContactSharing: "trueEmail",
        tradingEmail: "",
        discordHandle: "",
        discordChannel: "Sanderson Collectors Guild",
      });
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
    expect(screen.getByText(/view your account profile/i)).toBeInTheDocument();
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
    expect(screen.getAllByText("jane@example.com").length).toBeGreaterThanOrEqual(1);
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

  it("renders contact sharing radios with inline trading and discord fields", () => {
    renderAccountPage();

    expect(
      screen.getByText(/When something I have matches someone else, share with them/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "My true email" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "My trading email" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "My Discord information" })).not.toBeChecked();
    expect(screen.getByLabelText("Trading email")).toBeInTheDocument();
    expect(screen.getByLabelText("Discord name")).toBeInTheDocument();
    expect(screen.getByLabelText("Discord channel")).toHaveValue("Sanderson Collectors Guild");
    expect(
      screen.getByLabelText(
        "When a match is found this private email is displayed instead of your true email",
      ),
    ).toBeInTheDocument();
  });

  it("blocks selecting trading email or discord when those fields are empty", async () => {
    const user = userEvent.setup();
    renderAccountPage();

    await user.click(screen.getByRole("radio", { name: "My trading email" }));

    expect(screen.getByRole("radio", { name: "My true email" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "My trading email" })).not.toBeChecked();
    expect(
      screen.getByText("Trading email is empty. Fill it in, then choose this option again."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Enter a trading email before selecting this option."),
    ).toBeInTheDocument();
    expect(mockUpdateUserPreferences).not.toHaveBeenCalledWith("abc-123", {
      matchContactSharing: "tradingEmail",
    });

    await user.click(screen.getByRole("radio", { name: "My Discord information" }));

    expect(screen.getByRole("radio", { name: "My true email" })).toBeChecked();
    expect(
      screen.getByText(
        "Discord information is incomplete. Add a Discord name, then choose this option again.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Enter a Discord name before selecting this option."),
    ).toBeInTheDocument();
    expect(mockUpdateUserPreferences).not.toHaveBeenCalledWith("abc-123", {
      matchContactSharing: "discord",
    });
  });

  it("persists contact sharing preference and inline field values", async () => {
    const user = userEvent.setup();
    renderAccountPage();

    const tradingEmailInput = screen.getByLabelText("Trading email");
    await user.clear(tradingEmailInput);
    await user.type(tradingEmailInput, "trade@example.com");
    await user.tab();

    expect(mockUpdateUserPreferences).toHaveBeenCalledWith("abc-123", {
      tradingEmail: "trade@example.com",
    });

    await user.click(screen.getByRole("radio", { name: "My trading email" }));
    expect(mockUpdateUserPreferences).toHaveBeenCalledWith("abc-123", {
      matchContactSharing: "tradingEmail",
    });

    const discordNameInput = screen.getByLabelText("Discord name");
    await user.clear(discordNameInput);
    await user.type(discordNameInput, "kaladin");
    await user.tab();

    expect(mockUpdateUserPreferences).toHaveBeenCalledWith("abc-123", {
      discordHandle: "kaladin",
    });

    await user.click(screen.getByRole("radio", { name: "My Discord information" }));
    expect(mockUpdateUserPreferences).toHaveBeenCalledWith("abc-123", {
      matchContactSharing: "discord",
    });
  });
});
