import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { datasetMeta } from "../../data/collectibles";
import { TestMemoryRouter } from "../../test/router.jsx";
import CollectionPage, {
  CollectionSummary,
  CollectionTable,
  formatDate,
  normalizeQuantity,
  resolveTimestamp,
  SummaryStat,
} from "./index.jsx";

const mockUseAuth = vi.fn();
const mockUseUserCollection = vi.fn();
const mockNavigate = vi.fn();

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("./hooks/useUserCollection", () => ({
  useUserCollection: (ownerUid) => mockUseUserCollection(ownerUid),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("firebase/firestore", () => ({
  collection: () => ({}),
  doc: (_, id) => ({ id }),
  serverTimestamp: () => ({}),
  writeBatch: () => ({
    delete: vi.fn(),
    set: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  }),
  onSnapshot: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

vi.mock("../../lib/firebase", () => ({
  db: {},
}));

function renderCollectionPage() {
  return render(
    <TestMemoryRouter initialEntries={["/collection"]}>
      <CollectionPage />
    </TestMemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: { uid: "test-user" }, loading: false });
  mockUseUserCollection.mockReturnValue({ entries: [], loading: false, error: null });
});

describe("normalizeQuantity", () => {
  it("prefers the first finite numeric candidate field in order", () => {
    expect(normalizeQuantity({ quantity: 2, count: 9 })).toBe(2);
    expect(normalizeQuantity({ count: 4, copies: 1 })).toBe(4);
    expect(normalizeQuantity({ copies: 3, total: 7 })).toBe(3);
    expect(normalizeQuantity({ total: 8 })).toBe(8);
  });

  it("ignores non-finite numbers and falls back to 1", () => {
    expect(normalizeQuantity({ quantity: Number.NaN, count: 5 })).toBe(5);
    expect(normalizeQuantity({ quantity: Number.POSITIVE_INFINITY })).toBe(1);
    expect(normalizeQuantity({ quantity: "2" })).toBe(1);
    expect(normalizeQuantity({})).toBe(1);
  });
});

describe("resolveTimestamp", () => {
  it("returns null when no timestamp field is present", () => {
    expect(resolveTimestamp({})).toBeNull();
  });

  it("uses Firestore toDate when available", () => {
    const date = new Date("2019-04-01T00:00:00.000Z");
    const entry = {
      updatedAt: {
        toDate: () => date,
      },
    };
    expect(resolveTimestamp(entry)).toBe(date);
  });

  it("returns null and warns when toDate throws", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const entry = {
      updatedAt: {
        toDate: () => {
          throw new Error("boom");
        },
      },
    };
    expect(resolveTimestamp(entry)).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("accepts Date instances and parseable date strings", () => {
    const d = new Date("2018-01-02T00:00:00.000Z");
    expect(resolveTimestamp({ acquiredAt: d })).toBe(d);
    expect(resolveTimestamp({ createdAt: "2017-03-04T00:00:00.000Z" })).toEqual(
      new Date("2017-03-04T00:00:00.000Z"),
    );
  });

  it("returns null for unparseable values", () => {
    expect(resolveTimestamp({ updatedAt: "not-a-date" })).toBeNull();
  });

  it("prefers updatedAt over acquiredAt and createdAt", () => {
    const first = new Date("2020-01-01T00:00:00.000Z");
    const second = new Date("2021-01-01T00:00:00.000Z");
    expect(
      resolveTimestamp({
        updatedAt: first,
        acquiredAt: second,
        createdAt: second,
      }),
    ).toBe(first);
  });
});

describe("formatDate", () => {
  it("returns null for a missing date", () => {
    expect(formatDate(null, new Intl.DateTimeFormat("en-US"))).toBeNull();
  });

  it("returns the formatter output when format succeeds", () => {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const d = new Date(Date.UTC(2022, 5, 15));
    expect(formatDate(d, formatter)).toBe(formatter.format(d));
  });

  it("falls back to ISO string when format throws", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const throwingFormatter = {
      format: () => {
        throw new Error("format failed");
      },
    };
    const d = new Date("2021-08-20T12:00:00.000Z");
    expect(formatDate(d, throwingFormatter)).toBe(d.toISOString());
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("SummaryStat", () => {
  it("renders label and value", () => {
    render(
      <div>
        <SummaryStat label="Test Label" value="42" />
      </div>,
    );
    expect(screen.getByText("Test Label")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders sublabel when provided", () => {
    render(
      <div>
        <SummaryStat label="A" value="1" sublabel="extra" />
      </div>,
    );
    expect(screen.getByText("extra")).toBeInTheDocument();
  });
});

describe("CollectionSummary", () => {
  it("omits subset progress when story and herald breakdown arrays are empty", () => {
    const summary = {
      uniqueCardCount: 0,
      uniqueSkuCount: 0,
      totalQuantity: 0,
      completionRate: 0,
      finishCounts: {},
      categoryCounts: {},
      progressBreakdowns: {
        stories: [],
        heralds: [],
      },
    };

    render(<CollectionSummary summary={summary} />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("omits finish and category chips when both count maps are empty", () => {
    const summary = {
      uniqueCardCount: 1,
      uniqueSkuCount: 1,
      totalQuantity: 1,
      completionRate: 0.01,
      finishCounts: {},
      categoryCounts: {},
      progressBreakdowns: {
        stories: [
          {
            code: "Z",
            title: "Z Story",
            items: [
              {
                key: "storyCards",
                label: "Story cards",
                owned: 0,
                total: 1,
                percent: 0,
              },
            ],
          },
        ],
        heralds: [
          {
            key: "dunSkus",
            label: "Herald dun",
            owned: 0,
            total: 1,
            percent: 0,
          },
        ],
      },
    };

    render(<CollectionSummary summary={summary} />);
    expect(screen.queryByText("Finishes")).not.toBeInTheDocument();
    expect(screen.queryByText("Categories")).not.toBeInTheDocument();
  });

  it("renders summary stats, progress, subset breakdowns, and chip lists", () => {
    const summary = {
      uniqueCardCount: 2,
      uniqueSkuCount: 3,
      totalQuantity: 7,
      completionRate: 0.333,
      finishCounts: { DUN: 4, FOIL: 3 },
      categoryCounts: { story: 5, herald: 2 },
      progressBreakdowns: {
        stories: [
          {
            code: "TST",
            title: "Test Story Arc",
            items: [
              {
                key: "storyCards",
                label: "Story cards",
                owned: 1,
                total: 4,
                percent: 25,
              },
            ],
          },
        ],
        heralds: [
          {
            key: "dunSkus",
            label: "Herald dun",
            owned: 0,
            total: 3,
            percent: 0,
          },
          {
            key: "foilSkus",
            label: "Herald foil",
            owned: 1,
            total: 2,
            percent: 50,
          },
        ],
      },
    };

    render(<CollectionSummary summary={summary} />);

    const region = screen.getByRole("region", { name: "Collection summary" });
    expect(region).toBeInTheDocument();
    expect(within(region).getByText("Unique Cards")).toBeInTheDocument();
    expect(
      within(region).getByText(`${summary.uniqueCardCount} / ${datasetMeta.totalUniqueCards}`),
    ).toBeInTheDocument();
    expect(within(region).getByText(String(summary.totalQuantity))).toBeInTheDocument();
    expect(
      within(region).getByText("33% of the Stormlight Lost Tales set catalogued"),
    ).toBeInTheDocument();

    expect(within(region).getByRole("heading", { name: "Test Story Arc" })).toBeInTheDocument();
    expect(within(region).getByRole("heading", { name: "Heralds" })).toBeInTheDocument();

    const progressbars = within(region).getAllByRole("progressbar");
    expect(progressbars.length).toBeGreaterThan(0);

    expect(within(region).getByText("Finishes")).toBeInTheDocument();
    expect(within(region).getByText("DUN")).toBeInTheDocument();
    expect(within(region).getByText("Categories")).toBeInTheDocument();
  });

  it("omits the herald subset card when herald breakdown is empty", () => {
    const summary = {
      uniqueCardCount: 1,
      uniqueSkuCount: 1,
      totalQuantity: 1,
      completionRate: 0.01,
      finishCounts: { DUN: 1 },
      categoryCounts: {},
      progressBreakdowns: {
        stories: [
          {
            code: "Z",
            title: "Z Story",
            items: [
              {
                key: "storyCards",
                label: "Story cards",
                owned: 0,
                total: 1,
                percent: 0,
              },
            ],
          },
        ],
        heralds: [],
      },
    };

    render(<CollectionSummary summary={summary} />);
    expect(screen.queryByRole("heading", { name: "Heralds" })).not.toBeInTheDocument();
  });

  it("falls back to raw category keys when a label is unknown", () => {
    const summary = {
      uniqueCardCount: 1,
      uniqueSkuCount: 1,
      totalQuantity: 1,
      completionRate: 0.01,
      finishCounts: {},
      categoryCounts: { custom_unknown_category: 3 },
      progressBreakdowns: {
        stories: [],
        heralds: [],
      },
    };

    render(<CollectionSummary summary={summary} />);
    const region = screen.getByRole("region", { name: "Collection summary" });
    const categoriesList = within(region)
      .getByText("Categories")
      .closest(".collection-summary__list");
    expect(categoriesList).toBeTruthy();
    expect(within(categoriesList).getByText("custom_unknown_category")).toBeInTheDocument();
    expect(within(categoriesList).getByText("3")).toBeInTheDocument();
  });
});

describe("CollectionTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseEntry = {
    displayName: "Row Card",
    categoryLabel: "—",
    quantity: 1,
    updatedAtLabel: "—",
    notes: null,
    cardId: null,
    skuId: null,
    finish: null,
    storyTitle: null,
    binderLabel: null,
    detail: null,
  };

  it("navigates to the card route when only cardId is set", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <TestMemoryRouter initialEntries={["/collection"]}>
        <CollectionTable
          entries={[
            {
              ...baseEntry,
              id: "r1",
              cardId: "LT24-ELS-01",
            },
          ]}
        />
      </TestMemoryRouter>,
    );

    const row = screen.getByText("Row Card").closest("tr");
    expect(row).toBeTruthy();
    await user.click(row);
    expect(mockNavigate).toHaveBeenCalledWith("/collectibles/LT24-ELS-01");
  });

  it("does not navigate when the row has neither cardId nor skuId", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <TestMemoryRouter initialEntries={["/collection"]}>
        <CollectionTable entries={[{ ...baseEntry, id: "r2" }]} />
      </TestMemoryRouter>,
    );

    const row = screen.getByText("Row Card").closest("tr");
    expect(row).not.toHaveClass("collection-table__row--clickable");
    await user.click(row);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("omits the SKU line when skuId is missing", () => {
    render(
      <TestMemoryRouter initialEntries={["/collection"]}>
        <CollectionTable
          entries={[
            {
              ...baseEntry,
              id: "r3",
              cardId: "LT24-ELS-01",
              finish: "DUN",
            },
          ]}
        />
      </TestMemoryRouter>,
    );

    const row = screen.getByText("Row Card").closest("tr");
    expect(within(row).getByText("DUN")).toBeInTheDocument();
    expect(within(row).queryByText("LT24-ELS-01-DUN")).not.toBeInTheDocument();
  });
});

describe("CollectionPage (integration)", () => {
  it("shows AuthGuard fallback while auth is loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    renderCollectionPage();
    expect(screen.getByText("Loading collection…")).toBeInTheDocument();
  });

  it("shows loading state while the collection hook reports loading", () => {
    mockUseUserCollection.mockReturnValue({ entries: [], loading: true, error: null });
    renderCollectionPage();
    expect(screen.getByText("Fetching your collectibles…")).toBeInTheDocument();
  });

  it("shows empty state when there are no entries", () => {
    renderCollectionPage();
    expect(screen.getByText("No collectibles catalogued yet")).toBeInTheDocument();
    expect(screen.getByText(/Add items from the Collectibles page/)).toBeInTheDocument();
  });

  it("shows error message when the collection hook reports an error", () => {
    mockUseUserCollection.mockReturnValue({
      entries: [],
      loading: false,
      error: new Error("Network down"),
    });
    renderCollectionPage();
    expect(screen.getByText(/Failed to load your collection/)).toBeInTheDocument();
    expect(screen.getByText(/Network down/)).toBeInTheDocument();
  });

  it("uses a generic error hint when the error has no message", () => {
    mockUseUserCollection.mockReturnValue({
      entries: [],
      loading: false,
      error: {},
    });
    renderCollectionPage();
    expect(screen.getByText(/Please try again in a moment/)).toBeInTheDocument();
  });

  it("passes a null owner uid when the signed-in user has no uid", () => {
    mockUseAuth.mockReturnValue({ user: {}, loading: false });
    renderCollectionPage();
    expect(mockUseUserCollection).toHaveBeenCalledWith(null);
  });

  it("renders summary and table rows for catalogued SKUs and navigates on row click", async () => {
    const user = userEvent.setup({ delay: null });
    const firestoreDate = new Date("2023-02-10T00:00:00.000Z");
    mockUseUserCollection.mockReturnValue({
      entries: [
        {
          id: "e1",
          skuId: "LT24-ELS-01-DUN",
          quantity: 2,
          updatedAt: { toDate: () => firestoreDate },
        },
        {
          id: "e1f",
          skuId: "LT24-ELS-01-FOIL",
          quantity: 1,
        },
        {
          id: "e2",
          skuId: "LT24-NS-ELS-02-FOIL",
          count: 1,
          notes: "  keeper  ",
        },
        {
          id: "e2d",
          skuId: "LT24-NS-ELS-02-DUN",
          quantity: 1,
        },
        {
          id: "e3",
          skuId: "LT24-HLD-01-DUN",
          copies: 1,
        },
        {
          id: "e3b",
          skuId: "LT24-HLD-01-FOIL",
          quantity: 1,
        },
        {
          id: "e4",
          skuId: "UNKNOWN-SKU-XYZ",
          total: 1,
        },
        {
          id: "e5",
          skuId: "LT24-ELS-02-DUN",
          quantity: 0,
        },
      ],
      loading: false,
      error: null,
    });

    renderCollectionPage();

    expect(screen.getByRole("region", { name: "Collection summary" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Card" })).toBeInTheDocument();

    const elsRow = screen.getByText("LT24-ELS-01-DUN").closest("tr");
    expect(elsRow).toBeTruthy();
    expect(within(elsRow).getByText("2")).toBeInTheDocument();

    const nonsenseRow = screen.getByText("LT24-NS-ELS-02-FOIL").closest("tr");
    expect(nonsenseRow).toBeTruthy();
    expect(within(nonsenseRow).getByText("keeper")).toBeInTheDocument();

    await user.click(elsRow);
    expect(mockNavigate).toHaveBeenCalledWith("/collectibles/LT24-ELS-01/LT24-ELS-01-DUN");

    const unknownRow = screen.getAllByText("UNKNOWN-SKU-XYZ")[0].closest("tr");
    expect(unknownRow).toBeTruthy();
    mockNavigate.mockClear();
    await user.click(unknownRow);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("does not navigate when the click originates inside an interactive element", async () => {
    const user = userEvent.setup({ delay: null });
    mockUseUserCollection.mockReturnValue({
      entries: [
        {
          id: "e1",
          skuId: "LT24-ELS-01-DUN",
          quantity: 1,
        },
      ],
      loading: false,
      error: null,
    });

    renderCollectionPage();
    const row = screen.getByText("LT24-ELS-01-DUN").closest("tr");
    expect(row).toBeTruthy();

    const link = document.createElement("a");
    link.href = "#test";
    link.textContent = "inside";
    row.querySelector("td")?.appendChild(link);

    await user.click(link);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows 0% catalogue progress when the dataset reports no unique card total", () => {
    const { totalUniqueCards } = datasetMeta;
    datasetMeta.totalUniqueCards = 0;
    mockUseUserCollection.mockReturnValue({
      entries: [{ id: "e1", skuId: "LT24-ELS-01-DUN", quantity: 1 }],
      loading: false,
      error: null,
    });

    renderCollectionPage();
    expect(screen.getByText(/0% of the Stormlight Lost Tales set catalogued/)).toBeInTheDocument();

    datasetMeta.totalUniqueCards = totalUniqueCards;
  });
});
