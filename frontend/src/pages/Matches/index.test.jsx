import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseAuth = vi.hoisted(() => vi.fn());
const mockUseTradeMatches = vi.hoisted(() => vi.fn());
const mockGetSkuRecord = vi.hoisted(() => vi.fn());

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: mockUseAuth,
}));

vi.mock("../../components/Auth/AuthGuard", () => ({
  default: ({ children, fallback }) => {
    const { loading } = mockUseAuth();
    return loading ? fallback : children;
  },
}));

vi.mock("../../data/collectibles", () => ({
  collectiblesIndex: [
    { id: "SKU-1", category: "story", rarity: "Rare", story: "ELS" },
    { id: "SKU-2", category: "story", rarity: "Common", story: "ELS" },
  ],
  datasetStories: [{ code: "ELS", title: "Elantris" }],
  getSkuRecord: mockGetSkuRecord,
}));

vi.mock("./hooks/useTradeMatches", () => ({
  useTradeMatches: mockUseTradeMatches,
}));

import MatchesPage from "./index.jsx";

function defaultMatchesHook(overrides = {}) {
  return {
    cacheAgeSeconds: null,
    callerOptedOut: false,
    canGoNext: false,
    canGoPrevious: false,
    error: null,
    goToNextPage: vi.fn(),
    goToPreviousPage: vi.fn(),
    hasMore: false,
    isUsingCachedResult: false,
    loading: false,
    matches: [
      {
        userId: "user-2",
        displayName: "Collector Two",
        contact: {
          method: "trueEmail",
          email: "two@example.com",
          usedFallback: false,
          fallbackReason: null,
        },
        pairs: [{ theirSkuId: "SKU-2", yourSkuId: "SKU-1" }],
      },
    ],
    nextCursor: null,
    pageIndex: 1,
    pageSize: 20,
    refreshAvailableInSeconds: 0,
    reload: vi.fn(),
    showRefreshCountdown: false,
    totalOnPage: 1,
    ...overrides,
  };
}

describe("MatchesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockUseAuth.mockReturnValue({
      user: { uid: "me", displayName: "Me", email: "me@example.com" },
      loading: false,
    });
    mockGetSkuRecord.mockImplementation((skuId) => ({
      skuId,
      finish: "DUN",
      cardId: skuId,
      card: {
        id: skuId,
        displayName: skuId,
        category: "story",
        story: "ELS",
        storyTitle: "Elantris",
        rarity: "Rare",
        number: 1,
        searchTokens: `${skuId} els elantris`.toLowerCase(),
      },
    }));
    mockUseTradeMatches.mockReturnValue(defaultMatchesHook());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders grouped matches by counterparty", () => {
    render(<MatchesPage />);

    expect(screen.getByRole("heading", { name: "Matches" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Collector Two" })).toBeInTheDocument();
    expect(
      screen.getByText("SKU-2 (DUN) is available for trade for your SKU-1 (DUN)."),
    ).toBeInTheDocument();
  });

  it("shows resolved contact details when a row is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MatchesPage />);

    await user.click(
      screen.getByRole("button", { name: /sku-2 \(dun\).*trade for your.*sku-1 \(dun\)/i }),
    );

    expect(screen.getByText("Contact Collector Two. Email: two@example.com")).toBeInTheDocument();
  });

  it("shows discord contact details and fallback reasons", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockUseTradeMatches.mockReturnValue(
      defaultMatchesHook({
        matches: [
          {
            userId: "user-2",
            displayName: "Collector Two",
            contact: {
              method: "discord",
              discordHandle: "kaladin",
              discordChannel: "Sanderson Collectors Guild",
              usedFallback: false,
              fallbackReason: null,
            },
            pairs: [{ theirSkuId: "SKU-2", yourSkuId: "SKU-1" }],
          },
        ],
      }),
    );

    render(<MatchesPage />);
    await user.click(
      screen.getByRole("button", { name: /sku-2 \(dun\).*trade for your.*sku-1 \(dun\)/i }),
    );

    expect(
      screen.getByText("Contact Collector Two. Discord: kaladin in Sanderson Collectors Guild"),
    ).toBeInTheDocument();
  });

  it("explains missing contact details without sharing the account email", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockUseTradeMatches.mockReturnValue(
      defaultMatchesHook({
        matches: [
          {
            userId: "user-2",
            displayName: "Collector Two",
            contact: {
              method: "tradingEmail",
              usedFallback: false,
              fallbackReason: "Trading email is not set, so no contact details were shared.",
            },
            pairs: [{ theirSkuId: "SKU-2", yourSkuId: "SKU-1" }],
          },
        ],
      }),
    );

    render(<MatchesPage />);
    await user.click(
      screen.getByRole("button", { name: /sku-2 \(dun\).*trade for your.*sku-1 \(dun\)/i }),
    );

    expect(
      screen.getByText("Contact Collector Two. Contact details are unavailable."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Trading email is not set, so no contact details were shared."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/two@example.com/)).not.toBeInTheDocument();
  });

  it("shows opted-out message from backend response", () => {
    mockUseTradeMatches.mockReturnValue(
      defaultMatchesHook({
        callerOptedOut: true,
        matches: [],
      }),
    );

    render(<MatchesPage />);
    expect(screen.getByText("Matching is disabled for your account")).toBeInTheDocument();
  });

  it("hides freshness controls on initial fetch while cooldown remains", () => {
    mockUseTradeMatches.mockReturnValue(
      defaultMatchesHook({
        cacheAgeSeconds: 2,
        refreshAvailableInSeconds: 28,
        showRefreshCountdown: false,
      }),
    );

    render(<MatchesPage />);

    expect(screen.queryByText(/Can refresh in/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refresh" })).not.toBeInTheDocument();
  });

  it("shows freshness countdown and disables refresh for cached arrivals", () => {
    const reload = vi.fn();
    mockUseTradeMatches.mockReturnValue(
      defaultMatchesHook({
        cacheAgeSeconds: 8,
        isUsingCachedResult: true,
        refreshAvailableInSeconds: 22,
        reload,
        showRefreshCountdown: true,
      }),
    );

    render(<MatchesPage />);

    expect(screen.getByText("As of 8 seconds ago. Can refresh in 22 seconds.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
  });

  it("shows you may now refresh briefly then keeps the button without text", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const reload = vi.fn();
    mockUseTradeMatches.mockReturnValue(
      defaultMatchesHook({
        cacheAgeSeconds: 30,
        isUsingCachedResult: true,
        refreshAvailableInSeconds: 0,
        reload,
        showRefreshCountdown: true,
      }),
    );

    render(<MatchesPage />);

    expect(screen.getByText("You may now refresh.")).toBeInTheDocument();
    const refreshButton = screen.getByRole("button", { name: "Refresh" });
    expect(refreshButton).toBeEnabled();

    await act(async () => {
      vi.advanceTimersByTime(3_000);
    });

    expect(screen.queryByText("You may now refresh.")).not.toBeInTheDocument();
    expect(screen.queryByText(/As of/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();

    await user.click(refreshButton);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("shows refresh after cooldown ends even when countdown was hidden", async () => {
    mockUseTradeMatches.mockReturnValue(
      defaultMatchesHook({
        cacheAgeSeconds: 30,
        refreshAvailableInSeconds: 0,
        showRefreshCountdown: false,
      }),
    );

    render(<MatchesPage />);

    expect(screen.getByText("You may now refresh.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();

    await act(async () => {
      vi.advanceTimersByTime(3_000);
    });

    expect(screen.queryByText("You may now refresh.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
  });

  it("passes the signed-in user id into the matches hook", () => {
    render(<MatchesPage />);
    expect(mockUseTradeMatches).toHaveBeenCalledWith("me");
  });

  it("renders search and show any valid trade filter controls", () => {
    render(<MatchesPage />);

    expect(screen.getByLabelText("Search")).toBeInTheDocument();
    expect(screen.getByLabelText("Category")).toHaveDisplayValue("Show any valid trade");
    expect(screen.getByText(/Showing/i)).toBeInTheDocument();
  });

  it("renders pagination controls and navigates pages", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const goToNextPage = vi.fn();
    const goToPreviousPage = vi.fn();
    mockUseTradeMatches.mockReturnValue(
      defaultMatchesHook({
        canGoNext: true,
        canGoPrevious: false,
        goToNextPage,
        goToPreviousPage,
        hasMore: true,
        nextCursor: "user-2",
        pageIndex: 1,
        totalOnPage: 1,
      }),
    );

    render(<MatchesPage />);

    expect(screen.getByRole("navigation", { name: "Matches pagination" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    const nextButton = screen.getByRole("button", { name: "Next" });
    expect(nextButton).toBeEnabled();

    await user.click(nextButton);
    expect(goToNextPage).toHaveBeenCalledTimes(1);
  });
});
