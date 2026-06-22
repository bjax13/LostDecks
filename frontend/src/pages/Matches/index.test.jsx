import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  getSkuRecord: mockGetSkuRecord,
}));

vi.mock("./hooks/useTradeMatches", () => ({
  useTradeMatches: mockUseTradeMatches,
}));

import MatchesPage from "./index.jsx";

describe("MatchesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { uid: "me", displayName: "Me", email: "me@example.com" },
      loading: false,
    });
    mockGetSkuRecord.mockImplementation((skuId) => ({
      skuId,
      finish: "DUN",
      cardId: skuId,
      card: { displayName: skuId },
    }));
    mockUseTradeMatches.mockReturnValue({
      callerOptedOut: false,
      error: null,
      loading: false,
      matches: [
        {
          userId: "user-2",
          displayName: "Collector Two",
          pairs: [{ theirSkuId: "SKU-2", yourSkuId: "SKU-1" }],
        },
      ],
      reload: vi.fn(),
    });
  });

  it("renders grouped matches by counterparty", () => {
    render(<MatchesPage />);

    expect(screen.getByRole("heading", { name: "Matches" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Collector Two" })).toBeInTheDocument();
    expect(screen.getByText("is available for trade for your")).toBeInTheDocument();
  });

  it("shows contact placeholder text when a row is clicked", async () => {
    const user = userEvent.setup();
    render(<MatchesPage />);

    await user.click(
      screen.getByRole("button", { name: /sku-2 \(dun\).*trade for your.*sku-1 \(dun\)/i }),
    );

    expect(
      screen.getByText("Contact Collector Two. Direct messaging is coming soon."),
    ).toBeInTheDocument();
  });

  it("shows opted-out message from backend response", () => {
    mockUseTradeMatches.mockReturnValue({
      callerOptedOut: true,
      error: null,
      loading: false,
      matches: [],
      reload: vi.fn(),
    });

    render(<MatchesPage />);
    expect(screen.getByText("Matching is disabled for your account")).toBeInTheDocument();
  });
});
