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
  collectiblesIndex: [],
  datasetStories: [],
  getSkuRecord: mockGetSkuRecord,
}));

vi.mock("./hooks/useTradeMatches", () => ({
  useTradeMatches: mockUseTradeMatches,
}));

import MatchesPage from "./index.jsx";

function testerLanes() {
  return [
    {
      id: "dun",
      theyCanSend: [{ skuId: "LT24-HLD-01-DUN", owned: 2, extras: 1 }],
      youCanSend: [
        { skuId: "LT24-ELS-01-DUN", owned: 3, extras: 2 },
        { skuId: "LT24-CHM-01-DUN", owned: 2, extras: 1 },
      ],
    },
    {
      id: "pins",
      theyCanSend: [{ skuId: "PIN-CF-02", owned: 2, extras: 1 }],
      youCanSend: [{ skuId: "PIN-CF-01", owned: 2, extras: 1 }],
    },
  ];
}

function skuCard(skuId, displayName) {
  const finish = skuId.includes("FOIL") ? "FOIL" : skuId.includes("DUN") ? "DUN" : null;
  return {
    skuId,
    finish,
    cardId: skuId,
    card: {
      id: skuId,
      displayName,
      searchTokens: `${displayName} ${skuId}`.toLowerCase(),
    },
  };
}

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
        displayName: "Lost Tester 2",
        contact: {
          method: "trueEmail",
          email: "two@example.com",
          usedFallback: false,
          fallbackReason: null,
        },
        lanes: testerLanes(),
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
    mockGetSkuRecord.mockImplementation((skuId) => {
      const names = {
        "LT24-HLD-01-DUN": "Jezrien",
        "LT24-ELS-01-DUN": "Elsecaller #01",
        "LT24-CHM-01-DUN": "The Chasmfriends get a Pet! #01",
        "PIN-CF-02": "Howlerina",
        "PIN-CF-01": "Shreadad",
        "SKU-2": "SKU-2",
        "SKU-1": "SKU-1",
      };
      return skuCard(skuId, names[skuId] ?? skuId);
    });
    mockUseTradeMatches.mockReturnValue(defaultMatchesHook());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a person card with dun and pin piles and no sentence rows", () => {
    render(<MatchesPage />);

    expect(screen.getByRole("heading", { name: "Matches" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Lost Tester 2" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dun cards" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pins" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Foil cards" })).not.toBeInTheDocument();
    expect(screen.getByText("Jezrien (DUN)")).toBeInTheDocument();
    expect(screen.getAllByText("they have 2+").length).toBe(2);
    expect(screen.getByText("Elsecaller #01 (DUN)")).toBeInTheDocument();
    expect(screen.getByText("you own 3")).toBeInTheDocument();
    expect(screen.getAllByText("you own 2").length).toBe(2);
    expect(screen.queryByText(/owned \d/)).not.toBeInTheDocument();
    expect(screen.getByText("The Chasmfriends get a Pet! #01 (DUN)")).toBeInTheDocument();
    expect(screen.getByText("Howlerina")).toBeInTheDocument();
    expect(screen.getByText("Shreadad")).toBeInTheDocument();
    expect(screen.queryByText(/is available for trade for your/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Lost Tester 2" }).closest("details"),
    ).toHaveAttribute("open");
    expect(screen.getByText("Contact Lost Tester 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy email" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Email" })).toHaveAttribute(
      "href",
      "mailto:two%40example.com",
    );
  });

  it("collapses one counterparty group without affecting another", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockUseTradeMatches.mockReturnValue(
      defaultMatchesHook({
        matches: [
          {
            userId: "user-2",
            displayName: "Lost Tester 2",
            contact: {
              method: "trueEmail",
              email: "two@example.com",
              usedFallback: false,
              fallbackReason: null,
            },
            lanes: testerLanes(),
          },
          {
            userId: "user-3",
            displayName: "Collector Three",
            contact: {
              method: "trueEmail",
              email: "three@example.com",
              usedFallback: false,
              fallbackReason: null,
            },
            lanes: [
              {
                id: "dun",
                theyCanSend: [{ skuId: "SKU-1-DUN", owned: 2, extras: 1 }],
                youCanSend: [{ skuId: "SKU-2-DUN", owned: 2, extras: 1 }],
              },
            ],
          },
        ],
        totalOnPage: 2,
      }),
    );

    render(<MatchesPage />);

    const testerTwoHeading = screen.getByRole("heading", { name: "Lost Tester 2" });
    const collectorThreeHeading = screen.getByRole("heading", { name: "Collector Three" });
    const testerTwoGroup = testerTwoHeading.closest("details");
    const collectorThreeGroup = collectorThreeHeading.closest("details");

    expect(testerTwoGroup).toHaveAttribute("open");
    expect(collectorThreeGroup).toHaveAttribute("open");
    expect(screen.getByText("Jezrien (DUN)")).toBeVisible();
    expect(screen.getByText("SKU-1-DUN (DUN)")).toBeVisible();

    await user.click(testerTwoHeading);

    expect(testerTwoGroup).not.toHaveAttribute("open");
    expect(collectorThreeGroup).toHaveAttribute("open");
    expect(screen.getByRole("heading", { name: "Lost Tester 2" })).toBeVisible();
    expect(screen.getByText("SKU-1-DUN (DUN)")).toBeVisible();

    await user.click(testerTwoHeading);

    expect(testerTwoGroup).toHaveAttribute("open");
    expect(collectorThreeGroup).toHaveAttribute("open");
    expect(screen.getByText("Jezrien (DUN)")).toBeVisible();
  });

  it("copies the resolved email from the person contact block", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<MatchesPage />);

    await user.click(screen.getByRole("button", { name: "Copy email" }));

    expect(writeText).toHaveBeenCalledWith("two@example.com");
  });

  it("omits the mailto link when the email is not a safe address", () => {
    mockUseTradeMatches.mockReturnValue(
      defaultMatchesHook({
        matches: [
          {
            userId: "user-2",
            displayName: "Lost Tester 2",
            contact: {
              method: "tradingEmail",
              email: "collector;cc=attacker@example.com",
              usedFallback: false,
              fallbackReason: null,
            },
            lanes: testerLanes(),
          },
        ],
      }),
    );

    render(<MatchesPage />);

    expect(screen.getByRole("button", { name: "Copy email" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Email" })).not.toBeInTheDocument();
  });

  it("omits the mailto link when the email percent-encodes a separator", () => {
    mockUseTradeMatches.mockReturnValue(
      defaultMatchesHook({
        matches: [
          {
            userId: "user-2",
            displayName: "Lost Tester 2",
            contact: {
              method: "tradingEmail",
              email: "a%3Battacker@example.com",
              usedFallback: false,
              fallbackReason: null,
            },
            lanes: testerLanes(),
          },
        ],
      }),
    );

    render(<MatchesPage />);

    expect(screen.getByRole("button", { name: "Copy email" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Email" })).not.toBeInTheDocument();
  });

  it("shows discord contact details instead of email buttons", () => {
    mockUseTradeMatches.mockReturnValue(
      defaultMatchesHook({
        matches: [
          {
            userId: "user-2",
            displayName: "Lost Tester 2",
            contact: {
              method: "discord",
              discordHandle: "kaladin",
              discordChannel: "Sanderson Collectors Guild",
              usedFallback: false,
              fallbackReason: null,
            },
            lanes: testerLanes(),
          },
        ],
      }),
    );

    render(<MatchesPage />);

    expect(screen.getByText("Discord: kaladin in Sanderson Collectors Guild")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy email" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Email" })).not.toBeInTheDocument();
  });

  it("explains missing contact details without sharing the account email", () => {
    mockUseTradeMatches.mockReturnValue(
      defaultMatchesHook({
        matches: [
          {
            userId: "user-2",
            displayName: "Lost Tester 2",
            contact: {
              method: "tradingEmail",
              usedFallback: false,
              fallbackReason: "Trading email is not set, so no contact details were shared.",
            },
            lanes: testerLanes(),
          },
        ],
      }),
    );

    render(<MatchesPage />);

    expect(screen.getByText("Contact Lost Tester 2")).toBeInTheDocument();
    expect(screen.getByText("Contact details are unavailable.")).toBeInTheDocument();
    expect(
      screen.getByText("Trading email is not set, so no contact details were shared."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/two@example.com/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy email" })).not.toBeInTheDocument();
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

  it("renders search and lane filter controls", () => {
    render(<MatchesPage />);

    expect(screen.getByLabelText("Search")).toBeInTheDocument();
    expect(screen.getByLabelText("Lane")).toHaveDisplayValue("All lanes");
    expect(screen.queryByLabelText("Category")).not.toBeInTheDocument();
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
