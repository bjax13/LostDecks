import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TestMemoryRouter } from "../../test/router.jsx";
import "./Collectibles.css";
import CollectiblesPage from "./index.jsx";

const mockOpenAuthModal = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({ user: null }));
const collectionState = vi.hoisted(() => ({
  entries: [],
  loading: false,
  error: null,
}));
const mutationsState = vi.hoisted(() => ({
  addToCollection: vi.fn(),
  decrementFromCollection: vi.fn(),
  removeFromCollection: vi.fn(),
  purgeZeroQuantityEntries: vi.fn(),
  status: "idle",
  error: null,
  user: null,
  reset: vi.fn(),
}));

vi.mock("../../contexts/AuthContext", () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({ user: authState.user, loading: false }),
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

vi.mock("../Collection/hooks/useUserCollection", () => ({
  useUserCollection: () => collectionState,
}));

vi.mock("./hooks/useCollectionQuantityMutations", () => ({
  useCollectionQuantityMutations: () => ({
    ...mutationsState,
    user: authState.user,
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
  resolveSkuId(collectible, finish = null) {
    if (!collectible?.id) return null;
    if (collectible.collectibleType === "pin" || collectible.category === "pin") {
      return collectible.id;
    }
    if (!finish) return null;
    return `${collectible.id}-${String(finish).toUpperCase()}`;
  },
}));

function renderWithRouter(ui) {
  return render(<TestMemoryRouter>{ui}</TestMemoryRouter>);
}

function setupUser() {
  return userEvent.setup({ delay: null });
}

describe("CollectiblesPage (integration)", () => {
  beforeEach(() => {
    authState.user = null;
    collectionState.entries = [];
    collectionState.loading = false;
    collectionState.error = null;
    mutationsState.addToCollection = vi.fn().mockResolvedValue({
      skuId: "LT24-ELS-01-DUN",
      quantity: 1,
      deleted: false,
    });
    mutationsState.decrementFromCollection = vi.fn().mockResolvedValue({
      skuId: "LT24-ELS-01-DUN",
      quantity: 1,
      deleted: false,
    });
    mutationsState.removeFromCollection = vi.fn().mockResolvedValue({
      skuId: "LT24-ELS-01-DUN",
      quantity: 0,
      deleted: true,
    });
    mutationsState.purgeZeroQuantityEntries = vi.fn().mockResolvedValue({ deleted: 0 });
    mutationsState.status = "idle";
    mutationsState.error = null;
    mutationsState.reset = vi.fn();
  });

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

  it("keeps catalog details collapsed until a card is expanded", async () => {
    const user = setupUser();
    renderWithRouter(<CollectiblesPage />);

    expect(screen.getByRole("heading", { name: "Test Story #01" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Add Dun" })).toBeVisible();
    const firstCard = screen.getByRole("heading", { name: "Test Story #01" }).closest(".card-tile");
    const details = firstCard.querySelector(".card-details");
    expect(details).not.toHaveAttribute("open");

    await user.click(screen.getByRole("heading", { name: "Test Story #01" }));

    expect(details).toHaveAttribute("open");
    expect(screen.getByRole("link", { name: "LT24-ELS-01" })).toBeVisible();
    expect(firstCard.querySelector(".card-stats")).toHaveTextContent("Rare");
    expect(firstCard).toHaveTextContent("Page 1");
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

  it("keeps default add labels when signed out", () => {
    renderWithRouter(<CollectiblesPage />);
    expect(screen.getByRole("button", { name: "Add Dun" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Foil" })).toBeInTheDocument();
  });

  it("adds from compact card-actions without expanding glance details", async () => {
    const user = setupUser();
    authState.user = { uid: "user-1" };

    renderWithRouter(<CollectiblesPage />);

    const storyCard = screen.getByRole("heading", { name: "Test Story #01" }).closest(".card-tile");
    const siblingCard = screen
      .getByRole("heading", { name: "Test Story Nonsense #01" })
      .closest(".card-tile");
    const addDun = screen.getByRole("button", { name: "Add Dun" });

    expect(storyCard.querySelector(".card-actions")).toContainElement(addDun);
    expect(storyCard.querySelector(".card-details")).not.toHaveAttribute("open");
    expect(siblingCard.querySelector(".card-details")).not.toHaveAttribute("open");
    expect(getComputedStyle(document.querySelector(".cards-grid")).alignItems).toBe("start");
    expect(getComputedStyle(storyCard.querySelector(".card-actions")).marginTop).toBe("auto");

    await user.click(addDun);

    expect(mutationsState.addToCollection).toHaveBeenCalledWith(
      expect.objectContaining({ finish: "DUN", quantity: 1 }),
    );
    expect(storyCard.querySelector(".card-details")).not.toHaveAttribute("open");
    expect(siblingCard.querySelector(".card-details")).not.toHaveAttribute("open");
  });

  it("increments and decrements compact-card qty without expanding siblings", async () => {
    const user = setupUser();
    authState.user = { uid: "user-1" };
    collectionState.entries = [
      { id: "e1", skuId: "LT24-ELS-01-DUN", quantity: 2 },
      { id: "e2", skuId: "LT24-NS-ELS-01-FOIL", quantity: 1 },
    ];
    mutationsState.addToCollection = vi.fn().mockResolvedValue({
      skuId: "LT24-ELS-01-DUN",
      quantity: 3,
      deleted: false,
    });
    mutationsState.decrementFromCollection = vi.fn().mockResolvedValue({
      skuId: "LT24-ELS-01-DUN",
      quantity: 1,
      deleted: false,
    });

    renderWithRouter(<CollectiblesPage />);

    const storyCard = screen.getByRole("heading", { name: "Test Story #01" }).closest(".card-tile");
    const siblingCard = screen
      .getByRole("heading", { name: "Test Story Nonsense #01" })
      .closest(".card-tile");
    const increase = screen.getByRole("button", { name: "Increase Dun · x2" });
    const decrease = screen.getByRole("button", { name: "Decrease Dun · x2" });

    expect(storyCard.querySelector(".card-actions")).toContainElement(increase);
    expect(storyCard.querySelector(".card-actions")).toContainElement(decrease);
    expect(storyCard.querySelector(".add-to-collection__stepper")).toBeVisible();
    expect(storyCard.querySelector(".card-details")).not.toHaveAttribute("open");
    expect(siblingCard.querySelector(".card-details")).not.toHaveAttribute("open");

    await user.click(increase);
    expect(mutationsState.addToCollection).toHaveBeenCalledWith(
      expect.objectContaining({ finish: "DUN", quantity: 1 }),
    );
    await user.click(decrease);
    expect(mutationsState.decrementFromCollection).toHaveBeenCalledWith(
      expect.objectContaining({ finish: "DUN", quantity: 1, deleteWhenZero: false }),
    );

    expect(storyCard.querySelector(".card-details")).not.toHaveAttribute("open");
    expect(siblingCard.querySelector(".card-details")).not.toHaveAttribute("open");
  });

  it("shows owned quantity steppers for signed-in users in grid and table", async () => {
    const user = setupUser();
    authState.user = { uid: "user-1" };
    collectionState.entries = [
      { id: "e1", skuId: "LT24-ELS-01-DUN", quantity: 2 },
      { id: "e2", skuId: "LT24-NS-ELS-01-FOIL", quantity: 1 },
    ];

    renderWithRouter(<CollectiblesPage />);
    expect(screen.getByText("Dun · x2")).toBeInTheDocument();
    expect(screen.getByText("Foil · x1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Increase Dun · x2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decrease Dun · x2" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Table view" }));
    expect(screen.getByText("Dun · x2")).toBeInTheDocument();
    expect(screen.getByText("Foil · x1")).toBeInTheDocument();
  });

  it("soft-zeros stay visible after decrement and hard-delete is deferred", async () => {
    const user = setupUser();
    authState.user = { uid: "user-1" };
    collectionState.entries = [
      { id: "e1", ownerUid: "user-1", skuId: "LT24-ELS-01-DUN", quantity: 1 },
    ];
    mutationsState.decrementFromCollection = vi.fn().mockResolvedValue({
      skuId: "LT24-ELS-01-DUN",
      quantity: 0,
      deleted: false,
    });

    renderWithRouter(<CollectiblesPage />);
    await user.click(screen.getByRole("button", { name: "Decrease Dun · x1" }));

    expect(mutationsState.decrementFromCollection).toHaveBeenCalledWith(
      expect.objectContaining({
        finish: "DUN",
        quantity: 1,
        deleteWhenZero: false,
      }),
    );
    expect(await screen.findByText("Dun · x0")).toBeInTheDocument();
    expect(mutationsState.purgeZeroQuantityEntries).not.toHaveBeenCalled();
  });

  it("increments after soft-zero and clears the zero override", async () => {
    const user = setupUser();
    authState.user = { uid: "user-1" };
    collectionState.entries = [
      { id: "e1", ownerUid: "user-1", skuId: "LT24-ELS-01-DUN", quantity: 1 },
    ];
    mutationsState.decrementFromCollection = vi.fn().mockResolvedValue({
      skuId: "LT24-ELS-01-DUN",
      quantity: 0,
      deleted: false,
    });
    mutationsState.addToCollection = vi.fn().mockResolvedValue({
      skuId: "LT24-ELS-01-DUN",
      quantity: 1,
      deleted: false,
    });

    renderWithRouter(<CollectiblesPage />);
    await user.click(screen.getByRole("button", { name: "Decrease Dun · x1" }));
    expect(await screen.findByText("Dun · x0")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Increase Dun · x0" }));
    expect(mutationsState.addToCollection).toHaveBeenCalled();
  });

  it("purges zero-quantity entries once after collection load", async () => {
    authState.user = { uid: "user-1" };
    collectionState.entries = [
      { id: "zero-1", ownerUid: "user-1", skuId: "LT24-ELS-01-DUN", quantity: 0 },
      { id: "keep-1", ownerUid: "user-1", skuId: "LT24-NS-ELS-01-FOIL", quantity: 2 },
    ];
    mutationsState.purgeZeroQuantityEntries = vi.fn().mockResolvedValue({ deleted: 1 });

    renderWithRouter(<CollectiblesPage />);

    await waitFor(() => {
      expect(mutationsState.purgeZeroQuantityEntries).toHaveBeenCalledWith([
        expect.objectContaining({ id: "zero-1", quantity: 0 }),
      ]);
    });
  });
});
