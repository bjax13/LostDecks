import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TestMemoryRouter } from "../../test/router.jsx";
import CollectiblesPage from "./index.jsx";

const mockOpenAuthModal = vi.hoisted(() => vi.fn());

vi.mock("../../contexts/AuthContext", () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({ user: null, loading: false }),
}));

vi.mock("../../contexts/AuthModalContext", () => ({
  AuthModalProvider: ({ children }) => children,
  useAuthModal: () => ({
    isOpen: false,
    openAuthModal: mockOpenAuthModal,
    closeAuthModal: vi.fn(),
    context: null,
  }),
}));

const { testCollectibles, testDatasetMeta, testDatasetStories } = vi.hoisted(() => {
  const collectibles = [
    {
      id: "LT24-ELS-01",
      category: "story",
      story: "ELS",
      storyTitle: "Test Story",
      number: 1,
      rarity: "Rare",
      binder: { page: 1, row: 1, col: 1, position: "A" },
      displayName: "Test Story #01",
      detail: "Story card",
      finishes: ["DUN"],
      searchTokens: "lt24-els-01 els test story #01",
    },
    {
      id: "LT24-H-01",
      category: "herald",
      story: null,
      storyTitle: "Heraldic Order",
      number: 1,
      rarity: "Mythic",
      binder: null,
      displayName: "Herald One",
      detail: "Herald of the Almighty",
      finishes: [],
      searchTokens: "lt24-h-01 herald one mythic",
    },
    {
      id: "LT24-NS-ELS-01",
      category: "nonsense",
      story: "ELS",
      storyTitle: "Test Story",
      number: 1,
      rarity: null,
      binder: null,
      displayName: "Test Story Nonsense #01",
      detail: "Standard Variant",
      finishes: ["FOIL"],
      searchTokens: "lt24-ns-els-01 els standard variant",
    },
  ];

  return {
    testCollectibles: collectibles,
    testDatasetMeta: { setName: "Test Deck" },
    testDatasetStories: [{ code: "ELS", title: "Test Story" }],
  };
});

vi.mock("../../data/collectibles", () => ({
  collectiblesIndex: testCollectibles,
  datasetMeta: testDatasetMeta,
  datasetStories: testDatasetStories,
  toSkuId(cardId, finish) {
    if (!cardId || !finish) return null;
    return `${cardId}-${String(finish).toUpperCase()}`;
  },
}));

function renderWithRouter(ui) {
  return render(<TestMemoryRouter>{ui}</TestMemoryRouter>);
}

function setupUser() {
  return userEvent.setup({ delay: null });
}

describe("CollectiblesPage (integration)", () => {
  it("renders header and collectibles content", () => {
    renderWithRouter(<CollectiblesPage />);
    expect(screen.getByRole("heading", { name: "Collectibles" })).toBeInTheDocument();
    expect(screen.getByText(/Browse the/)).toBeInTheDocument();
  });

  it("toggles between grid and table view", async () => {
    const user = setupUser();
    renderWithRouter(<CollectiblesPage />);
    expect(screen.getByRole("button", { name: "Grid view" })).toHaveClass("active");
    await user.click(screen.getByRole("button", { name: "Table view" }));
    expect(screen.getByRole("button", { name: "Table view" })).toHaveClass("active");
  });

  it("renders collectible cards in grid by default", () => {
    renderWithRouter(<CollectiblesPage />);
    expect(document.querySelector(".cards-grid")).toBeInTheDocument();
  });

  it("toggles sort direction when sort button clicked", async () => {
    const user = setupUser();
    renderWithRouter(<CollectiblesPage />);
    const sortBtn = screen.getByRole("button", { name: /Sort ascending/i });
    await user.click(sortBtn);
    expect(screen.getByRole("button", { name: /Sort descending/i })).toBeInTheDocument();
  });

  it("renders table when table view selected", async () => {
    const user = setupUser();
    renderWithRouter(<CollectiblesPage />);
    await user.click(screen.getByRole("button", { name: "Table view" }));
    expect(document.querySelector("table")).toBeInTheDocument();
  });
});
