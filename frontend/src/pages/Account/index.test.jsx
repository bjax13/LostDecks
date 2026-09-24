import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_MATCHING_HELP, MATCH_KEEP_HELP } from "../../lib/matchHelpCopy.js";

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
    matchLanes: { dun: true, foil: true, pins: true },
    matchKeep: { dun: 1, foil: 1, pins: 1 },
    matchContactSharing: "trueEmail",
    tradingEmail: "",
    discordHandle: "",
    discordChannel: "Sanderson Collectors Guild",
  },
  MATCH_KEEP_OPTIONS: [1, 2, 3],
  normalizeMatchKeep: (value) => {
    const source = value && typeof value === "object" ? value : {};
    const count = (entry) => (entry === 1 || entry === 2 || entry === 3 ? entry : 1);
    return { dun: count(source.dun), foil: count(source.foil), pins: count(source.pins) };
  },
  MATCH_CONTACT_SHARING: {
    TRUE_EMAIL: "trueEmail",
    TRADING_EMAIL: "tradingEmail",
    DISCORD: "discord",
  },
  MATCH_LANE_IDS: ["dun", "foil", "pins"],
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
      onNext({
        matchingOptOut: false,
        matchLanes: { dun: true, foil: true, pins: true },
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

  it("exposes matching help copy from an info bubble near match preferences", async () => {
    const user = userEvent.setup();
    renderAccountPage();

    const trigger = screen.getByRole("button", { name: "About matching settings" });
    expect(trigger).toBeInTheDocument();
    expect(screen.getByText(ACCOUNT_MATCHING_HELP)).not.toBeVisible();

    await user.click(trigger);

    expect(screen.getByText(ACCOUNT_MATCHING_HELP)).toBeVisible();
  });

  it("defaults match lane checkboxes to checked when participating", () => {
    renderAccountPage();

    expect(screen.getByRole("checkbox", { name: "Dun cards" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Foil cards" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Pins" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Dun cards" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "Foil cards" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "Pins" })).toBeEnabled();
  });

  it("disables lane checkboxes when the collector is excluded from matching", () => {
    mockSubscribeUserPreferences.mockImplementation((_uid, onNext) => {
      onNext({
        matchingOptOut: true,
        matchLanes: { dun: true, foil: false, pins: true },
        matchContactSharing: "trueEmail",
        tradingEmail: "",
        discordHandle: "",
        discordChannel: "Sanderson Collectors Guild",
      });
      return () => {};
    });

    renderAccountPage();

    expect(screen.getByRole("checkbox", { name: "Include me in Matches" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Dun cards" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Foil cards" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Pins" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Foil cards" })).not.toBeChecked();
  });

  it("persists a lane toggle when participating", async () => {
    const user = userEvent.setup();
    renderAccountPage();

    await user.click(screen.getByRole("checkbox", { name: "Dun cards" }));

    expect(mockUpdateUserPreferences).toHaveBeenCalledWith("abc-123", {
      matchLanes: { dun: false, foil: true, pins: true },
    });
    expect(screen.getByRole("checkbox", { name: "Dun cards" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Foil cards" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Pins" })).toBeChecked();
  });

  it("defaults each lane keep to 1 and shares one help line", () => {
    renderAccountPage();

    for (const laneName of ["Dun cards", "Foil cards", "Pins"]) {
      const checkbox = screen.getByRole("checkbox", { name: laneName });
      const keep = screen.getByRole("combobox", { name: `Keep ${laneName}` });
      expect(checkbox.closest(".account-lane-row")).toContainElement(keep);
      expect(keep).toHaveValue("1");
      expect(
        within(keep)
          .getAllByRole("option")
          .map((option) => option.textContent),
      ).toEqual(["1", "2", "3"]);
    }

    expect(screen.getByText(MATCH_KEEP_HELP)).toBeInTheDocument();
  });

  it("persists a per-lane keep change", async () => {
    const user = userEvent.setup();
    renderAccountPage();

    const dunKeep = screen.getByRole("combobox", { name: "Keep Dun cards" });
    await user.selectOptions(dunKeep, "2");

    expect(mockUpdateUserPreferences).toHaveBeenCalledWith("abc-123", {
      matchKeep: { dun: 2, foil: 1, pins: 1 },
    });
    expect(dunKeep).toHaveValue("2");
    expect(screen.getByRole("combobox", { name: "Keep Foil cards" })).toHaveValue("1");
  });

  it("loads a saved keep above 1", () => {
    mockSubscribeUserPreferences.mockImplementation((_uid, onNext) => {
      onNext({
        matchingOptOut: false,
        matchLanes: { dun: true, foil: true, pins: true },
        matchKeep: { dun: 1, foil: 3, pins: 2 },
        matchContactSharing: "trueEmail",
        tradingEmail: "",
        discordHandle: "",
        discordChannel: "Sanderson Collectors Guild",
      });
      return () => {};
    });

    renderAccountPage();

    expect(screen.getByRole("combobox", { name: "Keep Foil cards" })).toHaveValue("3");
    expect(screen.getByRole("combobox", { name: "Keep Pins" })).toHaveValue("2");
    expect(screen.getByRole("combobox", { name: "Keep Dun cards" })).toHaveValue("1");
  });

  it("disables keep controls while excluded from matching", async () => {
    const user = userEvent.setup();
    mockSubscribeUserPreferences.mockImplementation((_uid, onNext) => {
      onNext({
        matchingOptOut: true,
        matchLanes: { dun: true, foil: true, pins: true },
        matchKeep: { dun: 1, foil: 1, pins: 1 },
        matchContactSharing: "trueEmail",
        tradingEmail: "",
        discordHandle: "",
        discordChannel: "Sanderson Collectors Guild",
      });
      return () => {};
    });

    renderAccountPage();

    const pinsKeep = screen.getByRole("combobox", { name: "Keep Pins" });
    expect(pinsKeep).toBeDisabled();
    await user.selectOptions(pinsKeep, "3");

    expect(mockUpdateUserPreferences).not.toHaveBeenCalled();
    expect(pinsKeep).toHaveValue("1");
  });

  it("does not persist lane changes while excluded from matching", async () => {
    const user = userEvent.setup();
    mockSubscribeUserPreferences.mockImplementation((_uid, onNext) => {
      onNext({
        matchingOptOut: true,
        matchLanes: { dun: true, foil: true, pins: true },
        matchContactSharing: "trueEmail",
        tradingEmail: "",
        discordHandle: "",
        discordChannel: "Sanderson Collectors Guild",
      });
      return () => {};
    });

    renderAccountPage();
    await user.click(screen.getByRole("checkbox", { name: "Pins" }));

    expect(mockUpdateUserPreferences).not.toHaveBeenCalled();
    expect(screen.getByRole("checkbox", { name: "Pins" })).toBeChecked();
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

  it("resets sharing to true email when the selected trading email is cleared", async () => {
    const user = userEvent.setup();
    mockSubscribeUserPreferences.mockImplementation((_uid, onNext) => {
      onNext({
        matchingOptOut: false,
        matchLanes: { dun: true, foil: true, pins: true },
        matchContactSharing: "tradingEmail",
        tradingEmail: "trade@example.com",
        discordHandle: "kaladin",
        discordChannel: "Sanderson Collectors Guild",
      });
      return () => {};
    });

    renderAccountPage();

    expect(screen.getByRole("radio", { name: "My trading email" })).toBeChecked();

    await user.clear(screen.getByLabelText("Trading email"));
    await user.tab();

    expect(screen.getByRole("radio", { name: "My true email" })).toBeChecked();
    expect(mockUpdateUserPreferences).toHaveBeenCalledWith("abc-123", {
      tradingEmail: "",
      matchContactSharing: "trueEmail",
    });
    expect(
      screen.getByText(
        "Trading email is empty, so Matches will use your true email until you fill this in and select this option again.",
      ),
    ).toBeInTheDocument();
  });

  it("resets sharing to true email when the selected Discord name is cleared", async () => {
    const user = userEvent.setup();
    mockSubscribeUserPreferences.mockImplementation((_uid, onNext) => {
      onNext({
        matchingOptOut: false,
        matchLanes: { dun: true, foil: true, pins: true },
        matchContactSharing: "discord",
        tradingEmail: "",
        discordHandle: "kaladin",
        discordChannel: "Sanderson Collectors Guild",
      });
      return () => {};
    });

    renderAccountPage();

    expect(screen.getByRole("radio", { name: "My Discord information" })).toBeChecked();

    await user.clear(screen.getByLabelText("Discord name"));
    await user.tab();

    expect(screen.getByRole("radio", { name: "My true email" })).toBeChecked();
    expect(mockUpdateUserPreferences).toHaveBeenCalledWith("abc-123", {
      discordHandle: "",
      matchContactSharing: "trueEmail",
    });
  });
});
