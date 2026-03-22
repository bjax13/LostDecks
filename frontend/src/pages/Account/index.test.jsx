import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseAuth = vi.hoisted(() => vi.fn());

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: mockUseAuth,
}));

vi.mock("../../components/Auth/AuthGuard", () => ({
  default: ({ children, fallback }) => {
    const { loading } = mockUseAuth();
    return loading ? fallback : children;
  },
}));

vi.mock("./components/TradesPanel", () => ({
  default: ({ user }) => (
    <div data-testid="trades-panel">TradesPanel:{user?.uid}</div>
  ),
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
  });

  // ── Rendering / AuthGuard integration ──────────────────────────────────

  it("shows the loading fallback while auth is loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    renderAccountPage();
    expect(screen.getByText("Loading account…")).toBeInTheDocument();
  });

  it("renders the page header and hint when authenticated", () => {
    renderAccountPage();
    expect(
      screen.getByRole("heading", { name: "Account Settings" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/keep your contact details up to date/i),
    ).toBeInTheDocument();
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
    expect(
      screen.getByRole("heading", { name: "Profile overview" }),
    ).toBeInTheDocument();
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

  // ── TradesPanel ─────────────────────────────────────────────────────────

  it("renders TradesPanel with the current user", () => {
    renderAccountPage();
    const panel = screen.getByTestId("trades-panel");
    expect(panel).toHaveTextContent("TradesPanel:abc-123");
  });

  it("does not render TradesPanel when user is null", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    renderAccountPage();
    expect(screen.queryByTestId("trades-panel")).not.toBeInTheDocument();
  });

  // ── Additional contact info form ────────────────────────────────────────

  describe("additional contact info form", () => {
    it("renders the Additional contact information section heading", () => {
      renderAccountPage();
      expect(
        screen.getByRole("heading", { name: "Additional contact information" }),
      ).toBeInTheDocument();
    });

    it("renders all form fields with correct placeholders", () => {
      renderAccountPage();
      expect(
        screen.getByPlaceholderText("Add a phone number"),
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Street, city, state, ZIP"),
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Add a backup email"),
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Optional additional backup email"),
      ).toBeInTheDocument();
    });

    it("renders form fields with correct labels", () => {
      renderAccountPage();
      expect(screen.getByLabelText("Phone number")).toBeInTheDocument();
      expect(screen.getByLabelText("Mailing address")).toBeInTheDocument();
      expect(screen.getByLabelText("Backup email (primary)")).toBeInTheDocument();
      expect(
        screen.getByLabelText("Backup email (secondary)"),
      ).toBeInTheDocument();
    });

    it("updates the phone number field on input", async () => {
      const user = userEvent.setup();
      renderAccountPage();
      const input = screen.getByLabelText("Phone number");
      await user.type(input, "555-1234");
      expect(input).toHaveValue("555-1234");
    });

    it("updates the mailing address field on input", async () => {
      const user = userEvent.setup();
      renderAccountPage();
      const textarea = screen.getByLabelText("Mailing address");
      await user.type(textarea, "123 Main St");
      expect(textarea).toHaveValue("123 Main St");
    });

    it("updates the primary backup email field on input", async () => {
      const user = userEvent.setup();
      renderAccountPage();
      const input = screen.getByLabelText("Backup email (primary)");
      await user.type(input, "backup@example.com");
      expect(input).toHaveValue("backup@example.com");
    });

    it("updates the secondary backup email field on input", async () => {
      const user = userEvent.setup();
      renderAccountPage();
      const input = screen.getByLabelText("Backup email (secondary)");
      await user.type(input, "alt@example.com");
      expect(input).toHaveValue("alt@example.com");
    });

    it("preserves all field values when updating multiple fields (merge behavior)", async () => {
      const user = userEvent.setup();
      renderAccountPage();

      await user.type(screen.getByLabelText("Phone number"), "555-1234");
      await user.type(screen.getByLabelText("Mailing address"), "123 Main St");
      await user.type(
        screen.getByLabelText("Backup email (primary)"),
        "backup@example.com",
      );
      await user.type(
        screen.getByLabelText("Backup email (secondary)"),
        "alt@example.com",
      );

      expect(screen.getByLabelText("Phone number")).toHaveValue("555-1234");
      expect(screen.getByLabelText("Mailing address")).toHaveValue("123 Main St");
      expect(screen.getByLabelText("Backup email (primary)")).toHaveValue(
        "backup@example.com",
      );
      expect(screen.getByLabelText("Backup email (secondary)")).toHaveValue(
        "alt@example.com",
      );
    });

    it('shows "Saved locally" feedback after form submission', async () => {
      const user = userEvent.setup();
      renderAccountPage();
      await user.click(screen.getByRole("button", { name: "Save contact info" }));
      expect(
        screen.getByText("Saved locally — sync options coming soon."),
      ).toBeInTheDocument();
    });

    it("clears the saved feedback when a field is changed after submission", async () => {
      const user = userEvent.setup();
      renderAccountPage();

      await user.click(screen.getByRole("button", { name: "Save contact info" }));
      expect(
        screen.getByText("Saved locally — sync options coming soon."),
      ).toBeInTheDocument();

      await user.type(screen.getByLabelText("Phone number"), "x");
      expect(
        screen.queryByText("Saved locally — sync options coming soon."),
      ).not.toBeInTheDocument();
    });

    it("does not show saved feedback before submission", () => {
      renderAccountPage();
      expect(
        screen.queryByText("Saved locally — sync options coming soon."),
      ).not.toBeInTheDocument();
    });

    it("form submit does not navigate away (default prevented)", async () => {
      const user = userEvent.setup();
      renderAccountPage();
      const form = screen.getByRole("button", { name: "Save contact info" })
        .closest("form");
      const submitSpy = vi.fn((e) => e.preventDefault());
      form.addEventListener("submit", submitSpy);

      await user.click(screen.getByRole("button", { name: "Save contact info" }));
      expect(submitSpy).toHaveBeenCalledTimes(1);
    });

    it("calls preventDefault on form submit event", async () => {
      const user = userEvent.setup();
      renderAccountPage();
      const form = screen
        .getByRole("button", { name: "Save contact info" })
        .closest("form");
      let submittedEvent;
      form.addEventListener("submit", (e) => {
        submittedEvent = e;
      });

      await user.click(screen.getByRole("button", { name: "Save contact info" }));

      expect(submittedEvent).toBeDefined();
      expect(submittedEvent.defaultPrevented).toBe(true);
    });

    it("submits with prefilled data and shows feedback", async () => {
      const user = userEvent.setup();
      renderAccountPage();

      await user.type(screen.getByLabelText("Phone number"), "555-9999");
      await user.click(screen.getByRole("button", { name: "Save contact info" }));

      expect(
        screen.getByText("Saved locally — sync options coming soon."),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Phone number")).toHaveValue("555-9999");
    });
  });

  // ── Notification preferences ────────────────────────────────────────────

  describe("notification preferences", () => {
    it("renders the notification preferences heading", () => {
      renderAccountPage();
      expect(
        screen.getByRole("heading", { name: "Notification preferences" }),
      ).toBeInTheDocument();
    });

    it("renders all notification option labels", () => {
      renderAccountPage();
      expect(
        screen.getByText(/email me when cards I need are offered/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/notify me about upcoming community events/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/alerts for direct trade messages/i),
      ).toBeInTheDocument();
    });

    it("has all notification checkboxes in a disabled fieldset", () => {
      renderAccountPage();
      const fieldset = screen.getByRole("group", {
        name: "Notification controls preview",
      });
      expect(fieldset).toBeDisabled();

      const checkboxes = within(fieldset).getAllByRole("checkbox");
      expect(checkboxes).toHaveLength(3);
    });

    it("has the first notification checkbox checked by default", () => {
      renderAccountPage();
      const fieldset = screen.getByRole("group", {
        name: "Notification controls preview",
      });
      const checkboxes = within(fieldset).getAllByRole("checkbox");
      expect(checkboxes[0]).toBeChecked();
      expect(checkboxes[1]).not.toBeChecked();
      expect(checkboxes[2]).not.toBeChecked();
    });
  });
});
