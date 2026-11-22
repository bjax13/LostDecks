import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearPendingPicks, savePendingPicks } from "../lib/pendingPicks.js";
import { PendingPicksApplier } from "./useApplyPendingPicks.js";

const mockNavigate = vi.hoisted(() => vi.fn());
const mockApplyBulk = vi.hoisted(() => vi.fn());
const mockUseAuth = vi.hoisted(() => vi.fn());
const mockUseUserCollection = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../pages/Collection/hooks/useUserCollection", () => ({
  useUserCollection: (...args) => mockUseUserCollection(...args),
}));

vi.mock("../pages/Collection/utils/bulkImport", () => ({
  applyBulkCollectionUpdate: (...args) => mockApplyBulk(...args),
}));

describe("PendingPicksApplier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPendingPicks();
    mockUseAuth.mockReturnValue({ user: { uid: "u1" } });
    mockUseUserCollection.mockReturnValue({
      entries: [{ skuId: "PIN-CF-01", quantity: 1 }],
      loading: false,
      ready: true,
    });
    mockApplyBulk.mockResolvedValue({ created: 0, updated: 1, deleted: 0 });
  });

  it("applies pending picks once and navigates to matches welcome", async () => {
    savePendingPicks({ "PIN-CF-01": 2, "PIN-CF-02": 1 });
    render(<PendingPicksApplier />);

    await waitFor(() => {
      expect(mockApplyBulk).toHaveBeenCalledTimes(1);
    });
    expect(mockApplyBulk).toHaveBeenCalledWith({
      ownerUid: "u1",
      rows: [
        { skuId: "PIN-CF-01", quantity: 2 },
        { skuId: "PIN-CF-02", quantity: 1 },
      ],
      existingEntries: [{ skuId: "PIN-CF-01", quantity: 1 }],
      allowPins: true,
    });
    expect(mockNavigate).toHaveBeenCalledWith("/matches?welcome=1", { replace: true });
    expect(window.localStorage.getItem("pendingPinPicks")).toBeNull();
  });

  it("does nothing when there are no pending picks", async () => {
    render(<PendingPicksApplier />);
    await waitFor(() => {
      expect(mockApplyBulk).not.toHaveBeenCalled();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("waits for a ready collection snapshot before applying (not stale loading:false)", async () => {
    savePendingPicks({ "PIN-CF-01": 2 });

    mockUseUserCollection.mockReturnValue({
      entries: [],
      loading: false,
      ready: false,
    });

    const { rerender } = render(<PendingPicksApplier />);

    await waitFor(() => {
      expect(mockApplyBulk).not.toHaveBeenCalled();
    });

    mockUseUserCollection.mockReturnValue({
      entries: [{ skuId: "PIN-CF-01", quantity: 1 }],
      loading: false,
      ready: true,
    });
    rerender(<PendingPicksApplier />);

    await waitFor(() => {
      expect(mockApplyBulk).toHaveBeenCalledTimes(1);
    });
    expect(mockApplyBulk).toHaveBeenCalledWith({
      ownerUid: "u1",
      rows: [{ skuId: "PIN-CF-01", quantity: 2 }],
      existingEntries: [{ skuId: "PIN-CF-01", quantity: 1 }],
      allowPins: true,
    });
    expect(mockNavigate).toHaveBeenCalledWith("/matches?welcome=1", { replace: true });
  });

  it("retries apply after a failure once the collection is ready", async () => {
    savePendingPicks({ "PIN-CF-01": 2 });
    mockApplyBulk.mockRejectedValueOnce(new Error("network"));

    render(<PendingPicksApplier />);

    await waitFor(() => {
      expect(mockApplyBulk).toHaveBeenCalledTimes(1);
    });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("pendingPinPicks")).not.toBeNull();

    mockApplyBulk.mockResolvedValue({ created: 0, updated: 1, deleted: 0 });

    await waitFor(() => {
      expect(mockApplyBulk).toHaveBeenCalledTimes(2);
    });
    expect(mockNavigate).toHaveBeenCalledWith("/matches?welcome=1", { replace: true });
  });
});
