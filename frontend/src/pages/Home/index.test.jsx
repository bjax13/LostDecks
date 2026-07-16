import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { datasetMeta } from "../../data/collectibles";
import { TestMemoryRouter } from "../../test/router.jsx";
import Home from "./index.jsx";

const mockOpenAuthModal = vi.hoisted(() => vi.fn());
const mockUseAuth = vi.hoisted(() => vi.fn());
const mockUseUserCollection = vi.hoisted(() => vi.fn());

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../../contexts/AuthModalContext", () => ({
  useAuthModal: () => ({
    isOpen: false,
    openAuthModal: mockOpenAuthModal,
    closeAuthModal: vi.fn(),
    context: null,
  }),
}));

vi.mock("../Collection/hooks/useUserCollection", () => ({
  useUserCollection: (ownerUid) => mockUseUserCollection(ownerUid),
}));

vi.mock("firebase/firestore", () => ({
  collection: () => ({}),
  query: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn(),
}));

vi.mock("../../lib/firebase", () => ({
  db: {},
}));

function renderHome() {
  return render(
    <TestMemoryRouter initialEntries={["/"]}>
      <Home />
    </TestMemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: null, loading: false });
  mockUseUserCollection.mockReturnValue({ entries: [], loading: false, error: null });
});

describe("Home page", () => {
  it("renders all section headings", () => {
    renderHome();

    expect(
      screen.getByRole("heading", { level: 1, name: /track your collectibles in one place/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Supported Collections" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What You Can Do Today" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Collection Snapshot" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Start tracking your collection" }),
    ).toBeInTheDocument();
  });

  it("shows Story Deck tile with set name from datasetMeta", () => {
    renderHome();
    expect(screen.getByText(datasetMeta.setName)).toBeInTheDocument();
  });

  describe("guest", () => {
    it("calls openAuthModal when Sign In is clicked", async () => {
      const user = userEvent.setup({ delay: null });
      renderHome();

      await user.click(screen.getByRole("button", { name: "Sign In" }));
      expect(mockOpenAuthModal).toHaveBeenCalledWith({ reason: "home-sign-in" });
    });

    it("calls openAuthModal when Get Started is clicked", async () => {
      const user = userEvent.setup({ delay: null });
      renderHome();

      await user.click(screen.getByRole("button", { name: "Get Started" }));
      expect(mockOpenAuthModal).toHaveBeenCalledWith({ reason: "home-get-started" });
    });

    it("links View Collectibles in hero to /collectibles", () => {
      renderHome();
      const hero = screen
        .getByRole("heading", { level: 1, name: /track your collectibles in one place/i })
        .closest("section");
      expect(hero).toBeTruthy();
      expect(within(hero).getByRole("link", { name: "View Collectibles" })).toHaveAttribute(
        "href",
        "/collectibles",
      );
    });

    it("shows sign-in hints in snapshot stats", () => {
      renderHome();
      const snapshot = screen
        .getByRole("heading", { name: "Collection Snapshot" })
        .closest("section");
      expect(snapshot).toBeTruthy();
      const hints = within(snapshot).getAllByText("Sign in");
      expect(hints.length).toBeGreaterThan(0);
    });
  });

  describe("signed in", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { uid: "user-1", displayName: "Collector" },
        loading: false,
      });
      mockUseUserCollection.mockReturnValue({
        entries: [
          { id: "e1", skuId: "LT24-ELS-01-DUN", quantity: 2 },
          { id: "e2", skuId: "LT24-ELS-01-FOIL", quantity: 1 },
          { id: "e3", skuId: "LT24-ELS-02-DUN", quantity: 1 },
        ],
        loading: false,
        error: null,
      });
    });

    it("hides Sign In and shows welcome message", () => {
      renderHome();
      expect(screen.queryByRole("button", { name: "Sign In" })).not.toBeInTheDocument();
      expect(screen.getByText(/welcome back, collector/i)).toBeInTheDocument();
    });

    it("shows computed snapshot stats for owned cards and foils", () => {
      renderHome();
      const snapshot = screen
        .getByRole("heading", { name: "Collection Snapshot" })
        .closest("section");
      expect(snapshot).toBeTruthy();
      expect(within(snapshot).getByText("2 / 215")).toBeInTheDocument();
      expect(within(snapshot).getByText("1 / 215")).toBeInTheDocument();
      expect(within(snapshot).getByText("0 / 5")).toBeInTheDocument();
    });

    it("shows Get Started as View Collection link", () => {
      renderHome();
      expect(screen.queryByRole("button", { name: "Get Started" })).not.toBeInTheDocument();
      const footer = screen
        .getByRole("heading", { name: "Start tracking your collection" })
        .closest("section");
      expect(footer).toBeTruthy();
      expect(within(footer).getByRole("link", { name: "View Collection" })).toHaveAttribute(
        "href",
        "/collections",
      );
    });
  });

  it("renders pins tile as an active link to collectibles", () => {
    renderHome();
    const section = screen
      .getByRole("heading", { name: "Supported Collections" })
      .closest("section");
    expect(section).toBeTruthy();
    const pinsTile = within(section).getByRole("link", { name: /Chasm Friend Pins/i });
    expect(pinsTile).toHaveAttribute("href", "/collectibles");
    expect(within(pinsTile).getByText("Browse pins")).toBeInTheDocument();
    expect(within(pinsTile).queryByText("Coming soon")).not.toBeInTheDocument();
  });

  it("links feature tiles to expected routes", () => {
    renderHome();
    expect(screen.getByRole("link", { name: /track what you own/i })).toHaveAttribute(
      "href",
      "/collections",
    );
    expect(screen.getByRole("link", { name: /see what's missing/i })).toHaveAttribute(
      "href",
      "/collections",
    );
    expect(screen.getByRole("link", { name: "Browse Items" })).toHaveAttribute(
      "href",
      "/collectibles",
    );
  });

  it("shows loading skeleton while collection is fetching for signed-in user", () => {
    mockUseAuth.mockReturnValue({
      user: { uid: "user-1" },
      loading: false,
    });
    mockUseUserCollection.mockReturnValue({
      entries: [],
      loading: true,
      error: null,
    });

    renderHome();
    expect(screen.getByTestId("snapshot-loading")).toBeInTheDocument();
  });
});
