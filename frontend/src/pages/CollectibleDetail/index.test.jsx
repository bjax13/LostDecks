import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CollectibleDetailPage from "./index.jsx";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: vi.fn(() => ({ user: null })),
}));

vi.mock("../../data/collectibles", () => ({
  getCollectibleRecord: vi.fn(() => null),
  getSkuRecord: vi.fn(() => null),
  resolveSkuId: (collectible, finish) => {
    if (!collectible?.id) return null;
    if (collectible.collectibleType === "pin" || collectible.category === "pin") {
      return collectible.id;
    }
    if (!finish) return null;
    return `${collectible.id}-${String(finish).toUpperCase()}`;
  },
}));

vi.mock("./hooks/useCollectibleCollectionEntry", () => ({
  useCollectibleCollectionEntry: vi.fn(() => ({
    entry: null,
    loading: false,
    error: null,
  })),
}));

vi.mock("../Collectibles/components/AddToCollectionButton", () => ({
  formatFinishLabel: (finish) => {
    const lower = String(finish ?? "").toLowerCase();
    return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
  },
  default: ({ collectible }) => <div data-testid="add-to-collection">{collectible?.id}</div>,
}));

vi.mock("../Collectibles/hooks/useCollectionQuantityMutations", () => ({
  useCollectionQuantityMutations: () => ({
    setCollectionTradeFlag: vi.fn(),
  }),
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

import { useAuth } from "../../contexts/AuthContext";
import { getCollectibleRecord, getSkuRecord } from "../../data/collectibles";
import { useCollectibleCollectionEntry } from "./hooks/useCollectibleCollectionEntry";

const CARD = {
  id: "LT24-ELS-01",
  category: "story",
  story: "ELS",
  storyTitle: "Elsewhen",
  number: 1,
  rarity: "Common",
  binder: { page: 1, row: 1, col: 1, position: 1 },
  displayName: "Elsewhen #01",
  detail: "Story card",
  finishes: ["DUN", "FOIL"],
};

const USER = { uid: "user-123", email: "test@example.com" };

function renderWithRoute(path, routePath = "/collectibles/:collectibleId") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={routePath} element={<CollectibleDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function setDefaults({
  card = null,
  skuRecord = null,
  user = null,
  entry = null,
  loading = false,
} = {}) {
  getCollectibleRecord.mockReturnValue(card);
  getSkuRecord.mockReturnValue(skuRecord);
  useAuth.mockReturnValue({ user });
  useCollectibleCollectionEntry.mockReturnValue({ entry, loading, error: null });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* ---------- Not-found state ---------- */

describe("CollectibleDetailPage – card not found", () => {
  it("shows error when collectibleId resolves to no card", () => {
    setDefaults();
    renderWithRoute("/collectibles/BOGUS");

    expect(screen.getByRole("heading", { name: /collectible not found/i })).toBeInTheDocument();
    expect(screen.getByText(/doesn't exist/i)).toBeInTheDocument();
  });

  it("renders a back button that navigates to /collectibles", async () => {
    setDefaults();
    const user = userEvent.setup();
    renderWithRoute("/collectibles/BOGUS");

    await user.click(screen.getByRole("button", { name: /back to collectibles/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/collectibles");
  });
});

/* ---------- Detail view – unauthenticated ---------- */

describe("CollectibleDetailPage – detail view (no user)", () => {
  beforeEach(() => {
    setDefaults({ card: CARD });
  });

  it("renders card header with display name and detail", () => {
    renderWithRoute("/collectibles/LT24-ELS-01");

    expect(screen.getByRole("heading", { name: CARD.displayName })).toBeInTheDocument();
    expect(screen.getByText(CARD.detail)).toBeInTheDocument();
  });

  it("renders the card ID", () => {
    renderWithRoute("/collectibles/LT24-ELS-01");
    expect(document.querySelector(".card-detail__id")).toHaveTextContent(CARD.id);
  });

  it("shows story, number, and rarity in the details section", () => {
    renderWithRoute("/collectibles/LT24-ELS-01");

    expect(screen.getByText("Elsewhen")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("Common")).toBeInTheDocument();
  });

  it("displays em-dash when optional fields are missing", () => {
    const cardNoOptionals = {
      ...CARD,
      storyTitle: null,
      number: null,
      rarity: null,
    };
    setDefaults({ card: cardNoOptionals });
    renderWithRoute("/collectibles/LT24-ELS-01");

    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it("does not render the collection section when logged out", () => {
    renderWithRoute("/collectibles/LT24-ELS-01");
    expect(screen.queryByText(/your collection/i)).not.toBeInTheDocument();
  });

  it("renders a back button that calls navigate(-1)", async () => {
    const u = userEvent.setup();
    renderWithRoute("/collectibles/LT24-ELS-01");

    await u.click(screen.getByRole("button", { name: /← back/i }));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});

/* ---------- SKU route ---------- */

describe("CollectibleDetailPage – SKU route", () => {
  it("prefers skuRecord.card when both collectibleId and skuId are present", () => {
    const skuCard = { ...CARD, displayName: "SKU Variant" };
    setDefaults({
      skuRecord: { skuId: "LT24-ELS-01-DUN", cardId: "LT24-ELS-01", finish: "DUN", card: skuCard },
    });

    render(
      <MemoryRouter initialEntries={["/collectibles/LT24-ELS-01/sku/LT24-ELS-01-DUN"]}>
        <Routes>
          <Route
            path="/collectibles/:collectibleId/sku/:skuId"
            element={<CollectibleDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "SKU Variant" })).toBeInTheDocument();
  });

  it("shows SKU ID in the detail stats when skuId param is present", () => {
    setDefaults({
      card: CARD,
      skuRecord: { skuId: "LT24-ELS-01-DUN", cardId: "LT24-ELS-01", finish: "DUN", card: CARD },
    });

    render(
      <MemoryRouter initialEntries={["/collectibles/LT24-ELS-01/sku/LT24-ELS-01-DUN"]}>
        <Routes>
          <Route
            path="/collectibles/:collectibleId/sku/:skuId"
            element={<CollectibleDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("SKU")).toBeInTheDocument();
    expect(screen.getByText("LT24-ELS-01-DUN")).toBeInTheDocument();
  });

  it("shows finish from skuRecord in the detail stats", () => {
    setDefaults({
      card: CARD,
      user: USER,
      skuRecord: { skuId: "LT24-ELS-01-DUN", cardId: "LT24-ELS-01", finish: "DUN", card: CARD },
    });

    render(
      <MemoryRouter initialEntries={["/collectibles/LT24-ELS-01/sku/LT24-ELS-01-DUN"]}>
        <Routes>
          <Route
            path="/collectibles/:collectibleId/sku/:skuId"
            element={<CollectibleDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Finish (Current)")).toBeInTheDocument();
    const pills = screen.getAllByText("DUN");
    expect(pills.length).toBeGreaterThanOrEqual(1);
  });
});

/* ---------- Finish derived from collectionEntry ---------- */

describe("CollectibleDetailPage – finish from collectionEntry", () => {
  it("uppercases finish from collectionEntry when no skuRecord finish", () => {
    setDefaults({
      card: CARD,
      user: USER,
      entry: { quantity: 1, finish: "foil" },
    });
    renderWithRoute("/collectibles/LT24-ELS-01");

    expect(screen.getByText("Finish (Current)")).toBeInTheDocument();
    const pills = screen.getAllByText("FOIL");
    expect(pills.length).toBeGreaterThanOrEqual(1);
  });

  it("does not show finish row when both skuRecord and entry have no finish", () => {
    setDefaults({ card: CARD, user: USER, entry: { quantity: 1 } });
    renderWithRoute("/collectibles/LT24-ELS-01");

    expect(screen.queryByText("Finish (Current)")).not.toBeInTheDocument();
  });
});

/* ---------- Collection section – logged-in user ---------- */

describe("CollectibleDetailPage – collection section", () => {
  it("shows loading state while collection data loads", () => {
    setDefaults({ card: CARD, user: USER, loading: true });
    renderWithRoute("/collectibles/LT24-ELS-01");

    expect(screen.getByText(/your collection/i)).toBeInTheDocument();
    expect(screen.getByText(/loading collection data/i)).toBeInTheDocument();
  });

  it("shows a trade status switch for each finish when nothing is owned", () => {
    setDefaults({ card: CARD, user: USER });
    renderWithRoute("/collectibles/LT24-ELS-01");

    expect(screen.getAllByRole("radio", { name: "ISO" })).toHaveLength(2);
    expect(screen.getAllByRole("radio", { name: "UFT" })[0]).toBeDisabled();
    expect(screen.getAllByText(/own at least 1 to mark up for trade/i).length).toBeGreaterThan(0);
  });

  it("renders AddToCollectionButton for authenticated users", () => {
    setDefaults({ card: CARD, user: USER });
    renderWithRoute("/collectibles/LT24-ELS-01");

    expect(screen.getAllByTestId("add-to-collection")).toHaveLength(2);
  });
});

/* ---------- normalizeQuantity (tested through rendered quantity) ---------- */

describe("normalizeQuantity (via component)", () => {
  beforeEach(() => {
    setDefaults({ card: CARD, user: USER });
  });

  it("reads entry.quantity", () => {
    useCollectibleCollectionEntry.mockReturnValue({
      entry: { skuId: "LT24-ELS-01-DUN", quantity: 5 },
      entries: [{ skuId: "LT24-ELS-01-DUN", quantity: 5 }],
      loading: false,
      error: null,
    });
    renderWithRoute("/collectibles/LT24-ELS-01");
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("falls back to entry.count when quantity is absent", () => {
    useCollectibleCollectionEntry.mockReturnValue({
      entry: { skuId: "LT24-ELS-01-DUN", count: 3 },
      entries: [{ skuId: "LT24-ELS-01-DUN", count: 3 }],
      loading: false,
      error: null,
    });
    renderWithRoute("/collectibles/LT24-ELS-01");
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("falls back to entry.copies", () => {
    useCollectibleCollectionEntry.mockReturnValue({
      entry: { skuId: "LT24-ELS-01-DUN", copies: 7 },
      entries: [{ skuId: "LT24-ELS-01-DUN", copies: 7 }],
      loading: false,
      error: null,
    });
    renderWithRoute("/collectibles/LT24-ELS-01");
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("falls back to entry.total", () => {
    useCollectibleCollectionEntry.mockReturnValue({
      entry: { skuId: "LT24-ELS-01-DUN", total: 12 },
      entries: [{ skuId: "LT24-ELS-01-DUN", total: 12 }],
      loading: false,
      error: null,
    });
    renderWithRoute("/collectibles/LT24-ELS-01");
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("returns 0 for entry with no recognized numeric field", () => {
    useCollectibleCollectionEntry.mockReturnValue({
      entry: { skuId: "LT24-ELS-01-DUN", foo: "bar" },
      entries: [{ skuId: "LT24-ELS-01-DUN", foo: "bar" }],
      loading: false,
      error: null,
    });
    renderWithRoute("/collectibles/LT24-ELS-01");
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
  });

  it("skips NaN and falls through to next candidate", () => {
    useCollectibleCollectionEntry.mockReturnValue({
      entry: { skuId: "LT24-ELS-01-DUN", quantity: Number.NaN, count: 4 },
      entries: [{ skuId: "LT24-ELS-01-DUN", quantity: Number.NaN, count: 4 }],
      loading: false,
      error: null,
    });
    renderWithRoute("/collectibles/LT24-ELS-01");
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("skips Infinity and falls through to next candidate", () => {
    useCollectibleCollectionEntry.mockReturnValue({
      entry: { skuId: "LT24-ELS-01-DUN", quantity: Number.POSITIVE_INFINITY, copies: 2 },
      entries: [{ skuId: "LT24-ELS-01-DUN", quantity: Number.POSITIVE_INFINITY, copies: 2 }],
      loading: false,
      error: null,
    });
    renderWithRoute("/collectibles/LT24-ELS-01");
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("returns 0 when entry is null", () => {
    useCollectibleCollectionEntry.mockReturnValue({
      entry: null,
      loading: false,
      error: null,
    });
    renderWithRoute("/collectibles/LT24-ELS-01");
    expect(screen.queryByText("Quantity Owned")).not.toBeInTheDocument();
  });
});

/* ---------- Notes display ---------- */

describe("Notes display (via component)", () => {
  it("renders notes when present and non-empty", () => {
    setDefaults({
      card: CARD,
      user: USER,
      entry: { quantity: 1, notes: "  My favorite card  " },
    });
    renderWithRoute("/collectibles/LT24-ELS-01");
    expect(screen.getByText("My favorite card")).toBeInTheDocument();
  });

  it("does not render notes section when notes is empty string", () => {
    setDefaults({
      card: CARD,
      user: USER,
      entry: { quantity: 1, notes: "   " },
    });
    renderWithRoute("/collectibles/LT24-ELS-01");
    expect(screen.queryByText("Notes")).not.toBeInTheDocument();
  });

  it("does not render notes section when notes is not a string", () => {
    setDefaults({
      card: CARD,
      user: USER,
      entry: { quantity: 1, notes: 42 },
    });
    renderWithRoute("/collectibles/LT24-ELS-01");
    expect(screen.queryByText("Notes")).not.toBeInTheDocument();
  });

  it("does not render notes section when notes is absent", () => {
    setDefaults({
      card: CARD,
      user: USER,
      entry: { quantity: 1 },
    });
    renderWithRoute("/collectibles/LT24-ELS-01");
    expect(screen.queryByText("Notes")).not.toBeInTheDocument();
  });
});

/* ---------- resolveTimestamp + formatDate (via "Last Updated" label) ---------- */

describe("resolveTimestamp + formatDate (via component)", () => {
  it("renders formatted date from entry.updatedAt (Date instance)", () => {
    const date = new Date("2025-06-15T14:30:00Z");
    setDefaults({
      card: CARD,
      user: USER,
      entry: { quantity: 1, updatedAt: date },
    });
    renderWithRoute("/collectibles/LT24-ELS-01");

    expect(screen.getByText("Last Updated")).toBeInTheDocument();
  });

  it("falls back to entry.acquiredAt when updatedAt is absent", () => {
    const date = new Date("2025-01-10T10:00:00Z");
    setDefaults({
      card: CARD,
      user: USER,
      entry: { quantity: 1, acquiredAt: date },
    });
    renderWithRoute("/collectibles/LT24-ELS-01");

    expect(screen.getByText("Last Updated")).toBeInTheDocument();
  });

  it("falls back to entry.createdAt when updatedAt and acquiredAt are absent", () => {
    const date = new Date("2024-12-25T00:00:00Z");
    setDefaults({
      card: CARD,
      user: USER,
      entry: { quantity: 1, createdAt: date },
    });
    renderWithRoute("/collectibles/LT24-ELS-01");

    expect(screen.getByText("Last Updated")).toBeInTheDocument();
  });

  it("handles Firestore-like timestamp with toDate()", () => {
    const jsDate = new Date("2025-03-01T12:00:00Z");
    const firestoreTs = { toDate: () => jsDate };
    setDefaults({
      card: CARD,
      user: USER,
      entry: { quantity: 1, updatedAt: firestoreTs },
    });
    renderWithRoute("/collectibles/LT24-ELS-01");

    expect(screen.getByText("Last Updated")).toBeInTheDocument();
  });

  it("falls through when toDate() throws", () => {
    const badTs = {
      toDate: () => {
        throw new Error("corrupt");
      },
    };
    setDefaults({
      card: CARD,
      user: USER,
      entry: { quantity: 1, updatedAt: badTs },
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderWithRoute("/collectibles/LT24-ELS-01");

    expect(warnSpy).toHaveBeenCalledWith(
      "Failed to convert Firestore timestamp",
      expect.any(Error),
    );
    expect(screen.queryByText("Last Updated")).not.toBeInTheDocument();
    warnSpy.mockRestore();
  });

  it("converts string timestamps", () => {
    setDefaults({
      card: CARD,
      user: USER,
      entry: { quantity: 1, updatedAt: "2025-06-15T14:30:00Z" },
    });
    renderWithRoute("/collectibles/LT24-ELS-01");

    expect(screen.getByText("Last Updated")).toBeInTheDocument();
  });

  it("returns null for invalid date strings", () => {
    setDefaults({
      card: CARD,
      user: USER,
      entry: { quantity: 1, updatedAt: "not-a-date" },
    });
    renderWithRoute("/collectibles/LT24-ELS-01");

    expect(screen.queryByText("Last Updated")).not.toBeInTheDocument();
  });

  it("does not render Last Updated when no timestamp fields exist", () => {
    setDefaults({
      card: CARD,
      user: USER,
      entry: { quantity: 1 },
    });
    renderWithRoute("/collectibles/LT24-ELS-01");

    expect(screen.queryByText("Last Updated")).not.toBeInTheDocument();
  });

  it("does not render Last Updated when entry is null", () => {
    setDefaults({ card: CARD, user: USER, entry: null });
    renderWithRoute("/collectibles/LT24-ELS-01");

    expect(screen.queryByText("Last Updated")).not.toBeInTheDocument();
  });
});

/* ---------- formatDate edge case – Intl failure falls back to ISO ---------- */

describe("formatDate – Intl fallback", () => {
  it("falls back to toISOString when DateTimeFormat#format throws", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const Original = Intl.DateTimeFormat;
    try {
      globalThis.Intl.DateTimeFormat = class BrokenDateTimeFormat extends Original {
        format() {
          throw new Error("Intl unavailable");
        }
      };

      const date = new Date("2025-06-15T14:30:00Z");
      setDefaults({
        card: CARD,
        user: USER,
        entry: { quantity: 1, updatedAt: date },
      });
      renderWithRoute("/collectibles/LT24-ELS-01");

      expect(screen.getByText("Last Updated")).toBeInTheDocument();
      expect(screen.getByText(date.toISOString())).toBeInTheDocument();
      expect(warnSpy).toHaveBeenCalledWith("Failed to format date", expect.any(Error));
    } finally {
      globalThis.Intl.DateTimeFormat = Original;
      warnSpy.mockRestore();
    }
  });
});

/* ---------- useCollectibleCollectionEntry receives correct args ---------- */

describe("useCollectibleCollectionEntry invocation", () => {
  it("passes ownerUid, collectibleId, and skuId to the hook", () => {
    setDefaults({ card: CARD, user: USER });
    renderWithRoute("/collectibles/LT24-ELS-01");

    expect(useCollectibleCollectionEntry).toHaveBeenCalledWith(
      "user-123",
      "LT24-ELS-01",
      undefined,
    );
  });

  it("passes null ownerUid when user is not authenticated", () => {
    setDefaults({ card: CARD });
    renderWithRoute("/collectibles/LT24-ELS-01");

    expect(useCollectibleCollectionEntry).toHaveBeenCalledWith(null, "LT24-ELS-01", undefined);
  });

  it("passes skuId to hook when on SKU route", () => {
    setDefaults({
      card: CARD,
      user: USER,
      skuRecord: { skuId: "LT24-ELS-01-DUN", cardId: "LT24-ELS-01", finish: "DUN", card: CARD },
    });

    render(
      <MemoryRouter initialEntries={["/collectibles/LT24-ELS-01/sku/LT24-ELS-01-DUN"]}>
        <Routes>
          <Route
            path="/collectibles/:collectibleId/sku/:skuId"
            element={<CollectibleDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(useCollectibleCollectionEntry).toHaveBeenCalledWith(
      "user-123",
      "LT24-ELS-01",
      "LT24-ELS-01-DUN",
    );
  });
});

/* ---------- Data layer invocation ---------- */

describe("CollectibleDetailPage – data layer", () => {
  it("calls getCollectibleRecord with collectibleId from URL", () => {
    setDefaults({ card: CARD });
    renderWithRoute("/collectibles/LT24-ELS-01");

    expect(getCollectibleRecord).toHaveBeenCalledWith("LT24-ELS-01");
  });

  it("calls getSkuRecord with skuId when on SKU route", () => {
    setDefaults({
      card: CARD,
      skuRecord: { skuId: "LT24-ELS-01-DUN", cardId: "LT24-ELS-01", finish: "DUN", card: CARD },
    });

    render(
      <MemoryRouter initialEntries={["/collectibles/LT24-ELS-01/sku/LT24-ELS-01-DUN"]}>
        <Routes>
          <Route
            path="/collectibles/:collectibleId/sku/:skuId"
            element={<CollectibleDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(getSkuRecord).toHaveBeenCalledWith("LT24-ELS-01-DUN");
  });

  it("uses cardRecord when skuRecord.card is null", () => {
    setDefaults({
      card: CARD,
      skuRecord: { skuId: "LT24-ELS-01-DUN", cardId: "LT24-ELS-01", card: null },
    });

    render(
      <MemoryRouter initialEntries={["/collectibles/LT24-ELS-01/sku/LT24-ELS-01-DUN"]}>
        <Routes>
          <Route
            path="/collectibles/:collectibleId/sku/:skuId"
            element={<CollectibleDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: CARD.displayName })).toBeInTheDocument();
  });
});

/* ---------- Edge cases ---------- */

describe("CollectibleDetailPage – edge cases", () => {
  it("shows not found when collectibleId param is missing (optional segment)", () => {
    setDefaults();
    render(
      <MemoryRouter initialEntries={["/collectibles"]}>
        <Routes>
          <Route path="/collectibles/:collectibleId?" element={<CollectibleDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /collectible not found/i })).toBeInTheDocument();
  });

  it("shows 'No finishes recorded' when card has no finishes", () => {
    const cardNoFinishes = { ...CARD, finishes: [] };
    setDefaults({ card: cardNoFinishes });
    renderWithRoute("/collectibles/LT24-ELS-01");

    expect(screen.getByText("No finishes recorded")).toBeInTheDocument();
  });

  it("shows 'No finishes recorded' when card.finishes is null", () => {
    const cardNoFinishes = { ...CARD, finishes: null };
    setDefaults({ card: cardNoFinishes });
    renderWithRoute("/collectibles/LT24-ELS-01");

    expect(screen.getByText("No finishes recorded")).toBeInTheDocument();
  });

  it("displays binder location in details section", () => {
    setDefaults({ card: CARD });
    renderWithRoute("/collectibles/LT24-ELS-01");

    expect(screen.getByText("Binder Location")).toBeInTheDocument();
  });
});

/* ---------- resolveTimestamp with null entry ---------- */

describe("resolveTimestamp – null entry", () => {
  it("returns null when entry is null (Last Updated not shown)", () => {
    setDefaults({ card: CARD, user: USER, entry: null });
    renderWithRoute("/collectibles/LT24-ELS-01");

    expect(screen.queryByText("Last Updated")).not.toBeInTheDocument();
  });
});

/* ---------- formatDate with null ---------- */

describe("CollectibleDetailPage – Dragonsteel store link", () => {
  const exactPin = {
    id: "PIN-CPS1-00",
    collectibleType: "pin",
    category: "pin",
    storyTitle: "Character Pin Series 1",
    number: 0,
    displayName: "Brandon",
    detail: "Character Pin Series 1 · US",
    country: "US",
    catalogName: "Sanderson Collectors Guild Pins",
    storeUrl: "https://www.dragonsteelbooks.com/products/brandon-character-pin-series-1-000",
    storeMatch: "exact",
  };
  const bundlePin = {
    id: "PIN-MBWA-01",
    collectibleType: "pin",
    category: "pin",
    storyTitle: "Mistborn Word Art",
    number: 1,
    displayName: "Hemalurgy",
    detail: "Mistborn Word Art · US",
    country: "US",
    catalogName: "Sanderson Collectors Guild Pins",
    storeUrl: "https://www.dragonsteelbooks.com/products/mistborn-word-art-pin-set",
    storeMatch: "bundle",
  };
  const unmappedPin = {
    id: "PIN-CF-01",
    collectibleType: "pin",
    category: "pin",
    storyTitle: "ChasmFriends",
    number: 1,
    displayName: "Shredhead",
    detail: "ChasmFriends enamel pin",
    country: "US",
    catalogName: "ChasmFriends Pins",
  };

  it("shows Dragonsteel store for an exact pin match", () => {
    setDefaults({ card: exactPin });
    renderWithRoute("/collectibles/PIN-CPS1-00");

    const link = screen.getByRole("link", { name: "Dragonsteel store" });
    expect(link).toHaveAttribute("href", exactPin.storeUrl);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(
      screen.queryByRole("link", { name: "Sold in a bundle on the Dragonsteel store" }),
    ).not.toBeInTheDocument();
  });

  it("labels a bundle match as sold in a bundle", () => {
    setDefaults({ card: bundlePin });
    renderWithRoute("/collectibles/PIN-MBWA-01");

    const link = screen.getByRole("link", { name: "Sold in a bundle on the Dragonsteel store" });
    expect(link).toHaveAttribute("href", bundlePin.storeUrl);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.queryByRole("link", { name: "Dragonsteel store" })).not.toBeInTheDocument();
  });

  it("shows no store link or label for an unmapped pin", () => {
    setDefaults({ card: unmappedPin });
    renderWithRoute("/collectibles/PIN-CF-01");

    expect(screen.getByRole("heading", { name: "Shredhead" })).toBeInTheDocument();
    expect(screen.getByText("CF")).toBeInTheDocument();
    expect(screen.getByText(/No photo yet\. Have this pin\?/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Send us a photo." })).toHaveAttribute(
      "href",
      "/about",
    );
    expect(screen.queryByRole("link", { name: "Dragonsteel store" })).not.toBeInTheDocument();
    expect(screen.queryByText("Store")).not.toBeInTheDocument();
    expect(screen.queryByText(/dragonsteel/i)).not.toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });

  it("shows no Dragonsteel store link on a card page", () => {
    setDefaults({
      card: {
        ...CARD,
        collectibleType: "card",
        storeUrl: "https://www.dragonsteelbooks.com/products/dragonsteel-pin",
        storeMatch: "exact",
      },
    });
    renderWithRoute("/collectibles/LT24-ELS-01");

    expect(screen.getByRole("heading", { name: CARD.displayName })).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText("No photo yet. Have this pin?")).not.toBeInTheDocument();
    expect(screen.queryByText("Store")).not.toBeInTheDocument();
    expect(screen.queryByText("Dragonsteel store")).not.toBeInTheDocument();
  });

  it("ignores a pin store URL that is not https on www.dragonsteelbooks.com", () => {
    setDefaults({
      card: {
        ...exactPin,
        storeUrl: "http://www.dragonsteelbooks.com/products/brandon-character-pin-series-1-000",
      },
    });
    renderWithRoute("/collectibles/PIN-CPS1-00");

    expect(screen.queryByRole("link", { name: "Dragonsteel store" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Send us a photo." })).toHaveAttribute(
      "href",
      "/about",
    );
    expect(screen.queryByText("Store")).not.toBeInTheDocument();
  });
});

describe("CollectibleDetailPage – archived store link", () => {
  const mBotArchive =
    "https://web.archive.org/web/20220520175820/https://www.dragonsteelbooks.com/products/m-bot-pin";
  const bundleArchive =
    "https://web.archive.org/web/20231124201557/https://www.dragonsteelbooks.com/products/cytoverse-defiant-ships-pin-bundle";
  const exactArchiveLabel = "Archived Dragonsteel store page (Wayback Machine, May 2022)";
  const bundleArchiveLabel = "Archived bundle page (Wayback Machine, Nov 2023)";

  const livePin = {
    id: "PIN-CPS4-01",
    collectibleType: "pin",
    category: "pin",
    storyTitle: "Character Pin Series 4",
    number: 1,
    displayName: "Sazed",
    detail: "Character Pin Series 4 · US",
    country: "US",
    catalogName: "Sanderson Collectors Guild Pins",
    storeUrl: "https://www.dragonsteelbooks.com/products/dcp-series-4-001-sazed",
    storeMatch: "exact",
    archiveUrl: mBotArchive,
    archiveMatch: "exact",
  };
  const archivePin = {
    id: "PIN-CYTO-06",
    collectibleType: "pin",
    category: "pin",
    storyTitle: "Cytoverse",
    number: 6,
    displayName: "M-Bot",
    detail: "Cytoverse · US",
    country: "US",
    catalogName: "Sanderson Collectors Guild Pins",
    archiveUrl: mBotArchive,
    archiveMatch: "exact",
  };
  const bundlePin = {
    id: "PIN-CYTDS-01",
    collectibleType: "pin",
    category: "pin",
    storyTitle: "Cytoverse Defiant Ships",
    number: 1,
    displayName: "Kitsen Ship",
    detail: "Cytoverse Defiant Ships · US",
    country: "US",
    catalogName: "Sanderson Collectors Guild Pins",
    archiveUrl: bundleArchive,
    archiveMatch: "bundle",
  };
  const unlinkedPin = {
    id: "PIN-CONV-04",
    collectibleType: "pin",
    category: "pin",
    storyTitle: "Convention",
    number: 4,
    displayName: "Dragonsteel 2023",
    detail: "Convention · US",
    country: "US",
    catalogName: "Sanderson Collectors Guild Pins",
  };

  function blankLinks() {
    return screen.getAllByRole("link").filter((link) => link.getAttribute("target") === "_blank");
  }

  it("keeps the live store link and does not also show the archive link", () => {
    setDefaults({ card: livePin });
    renderWithRoute("/collectibles/PIN-CPS4-01");

    const link = screen.getByRole("link", { name: "Dragonsteel store" });
    expect(link).toHaveAttribute("href", livePin.storeUrl);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(blankLinks()).toHaveLength(1);
    expect(screen.queryByRole("link", { name: exactArchiveLabel })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Wayback Machine/ })).not.toBeInTheDocument();
    expect(document.querySelector('a[href*="web.archive.org"]')).toBeNull();
  });

  it("shows one archived Dragonsteel link with the capture month and year", () => {
    setDefaults({ card: archivePin });
    renderWithRoute("/collectibles/PIN-CYTO-06");

    const link = screen.getByRole("link", { name: exactArchiveLabel });
    expect(link).toHaveAttribute("href", mBotArchive);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(blankLinks()).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: exactArchiveLabel })).toHaveLength(1);
    expect(screen.queryByRole("link", { name: "Dragonsteel store" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: bundleArchiveLabel })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Sold in a bundle/ })).not.toBeInTheDocument();
  });

  it("labels a bundle capture as an archived bundle page", () => {
    setDefaults({ card: bundlePin });
    renderWithRoute("/collectibles/PIN-CYTDS-01");

    const link = screen.getByRole("link", { name: bundleArchiveLabel });
    expect(link).toHaveAttribute("href", bundleArchive);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(blankLinks()).toHaveLength(1);
    expect(screen.queryByRole("link", { name: exactArchiveLabel })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Dragonsteel store" })).not.toBeInTheDocument();
  });

  it("shows no store or archive link when a pin has neither", () => {
    setDefaults({ card: unlinkedPin });
    renderWithRoute("/collectibles/PIN-CONV-04");

    expect(screen.getByRole("heading", { name: "Dragonsteel 2023" })).toBeInTheDocument();
    expect(screen.queryByText("Store")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Wayback Machine/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Dragonsteel store" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Sold in a bundle/ })).not.toBeInTheDocument();
    expect(document.querySelector('a[target="_blank"]')).toBeNull();
  });

  it("does not show an archive link on a card page", () => {
    setDefaults({
      card: {
        ...CARD,
        collectibleType: "card",
        archiveUrl: mBotArchive,
        archiveMatch: "exact",
      },
    });
    renderWithRoute("/collectibles/LT24-ELS-01");

    expect(screen.getByRole("heading", { name: CARD.displayName })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: exactArchiveLabel })).not.toBeInTheDocument();
    expect(screen.queryByText("Store")).not.toBeInTheDocument();
    expect(document.querySelector('a[href*="web.archive.org"]')).toBeNull();
  });

  it("does not show a reseller archive link", () => {
    setDefaults({
      card: {
        ...archivePin,
        archiveUrl: "https://web.archive.org/web/20220520175820/https://www.ebay.com/itm/m-bot-pin",
      },
    });
    renderWithRoute("/collectibles/PIN-CYTO-06");

    expect(screen.queryByRole("link", { name: /Wayback Machine/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Store")).not.toBeInTheDocument();
    expect(document.querySelector('a[target="_blank"]')).toBeNull();
  });
});

describe("formatDate – null input", () => {
  it("returns null when no timestamp in entry (formatDate receives null)", () => {
    setDefaults({
      card: CARD,
      user: USER,
      entry: { quantity: 1, notes: "x" },
    });
    renderWithRoute("/collectibles/LT24-ELS-01");

    expect(screen.queryByText("Last Updated")).not.toBeInTheDocument();
  });
});
