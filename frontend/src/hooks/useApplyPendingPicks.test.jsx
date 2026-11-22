import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearPendingPicks, savePendingPicks } from "../lib/pendingPicks.js";
import { PENDING_PICKS_APPLY_MAX_ATTEMPTS, PendingPicksApplier } from "./useApplyPendingPicks.js";

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
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    clearPendingPicks();
    mockUseAuth.mockReturnValue({ user: { uid: "u1" } });
    mockUseUserCollection.mockReturnValue({
      entries: [{ skuId: "PIN-CF-01", quantity: 1 }],
      status: "ready",
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

  it.each([
    { label: "idle", status: "idle", entries: [] },
    { label: "loading", status: "loading", entries: [] },
    { label: "error", status: "error", entries: [{ skuId: "PIN-CF-01", quantity: 1 }] },
  ])("does not apply picks while collection status is $label", async ({ status, entries }) => {
    savePendingPicks({ "PIN-CF-01": 2 });
    mockUseUserCollection.mockReturnValue({ entries, status });

    const { rerender } = render(<PendingPicksApplier />);

    await waitFor(() => {
      expect(mockApplyBulk).not.toHaveBeenCalled();
    });
    expect(mockNavigate).not.toHaveBeenCalled();

    mockUseUserCollection.mockReturnValue({
      entries: [{ skuId: "PIN-CF-01", quantity: 1 }],
      status: "ready",
    });
    rerender(<PendingPicksApplier />);

    await waitFor(() => {
      expect(mockApplyBulk).toHaveBeenCalledTimes(1);
    });
    expect(mockNavigate).toHaveBeenCalledWith("/matches?welcome=1", { replace: true });
  });

  it("retries apply after a failure once the collection is ready", async () => {
    vi.useFakeTimers();
    savePendingPicks({ "PIN-CF-01": 2 });
    mockApplyBulk.mockRejectedValueOnce(new Error("network"));
    mockApplyBulk.mockResolvedValue({ created: 0, updated: 1, deleted: 0 });

    render(<PendingPicksApplier />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockApplyBulk).toHaveBeenCalledTimes(2);
    expect(mockNavigate).toHaveBeenCalledWith("/matches?welcome=1", { replace: true });
  });

  it("writes once and still clears or navigates when entries change mid-apply", async () => {
    savePendingPicks({ "PIN-CF-02": 1 });
    mockUseUserCollection.mockReturnValue({
      entries: [{ id: "PIN-CF-01", quantity: 1 }],
      status: "ready",
    });

    let resolveApply;
    const applyDeferred = new Promise((resolve) => {
      resolveApply = () => resolve({ created: 1, updated: 0, deleted: 0 });
    });
    mockApplyBulk.mockReturnValue(applyDeferred);

    const { rerender } = render(<PendingPicksApplier />);

    await waitFor(() => {
      expect(mockApplyBulk).toHaveBeenCalledTimes(1);
    });
    expect(mockApplyBulk).toHaveBeenCalledWith(
      expect.objectContaining({
        existingEntries: [{ id: "PIN-CF-01", quantity: 1 }],
        rows: [{ skuId: "PIN-CF-02", quantity: 1 }],
      }),
    );

    mockUseUserCollection.mockReturnValue({
      entries: [
        { id: "PIN-CF-01", quantity: 1 },
        { id: "auto-id-1", skuId: "PIN-CF-02", quantity: 1 },
      ],
      status: "ready",
    });
    rerender(<PendingPicksApplier />);

    await act(async () => {
      resolveApply();
    });

    await waitFor(() => {
      expect(mockApplyBulk).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith("/matches?welcome=1", { replace: true });
    });
    expect(window.localStorage.getItem("pendingPinPicks")).toBeNull();
  });

  it("does not bulk-write Shredhead when the server snapshot already shows it owned", async () => {
    savePendingPicks({ "PIN-CF-01": 1, "PIN-CF-02": 1 });
    mockUseUserCollection.mockReturnValue({
      status: "ready",
      entries: [{ id: "PIN-CF-01", ownerUid: "u1", quantity: 1 }],
    });

    render(<PendingPicksApplier />);

    await waitFor(() => {
      expect(mockApplyBulk).toHaveBeenCalledTimes(1);
    });
    expect(mockApplyBulk).toHaveBeenCalledWith({
      ownerUid: "u1",
      rows: [{ skuId: "PIN-CF-02", quantity: 1 }],
      existingEntries: [{ id: "PIN-CF-01", ownerUid: "u1", quantity: 1 }],
      allowPins: true,
    });
  });

  it("stops after max attempts, keeps pending picks, and surfaces an alert", async () => {
    vi.useFakeTimers();
    savePendingPicks({ "PIN-CF-01": 2 });
    mockApplyBulk.mockRejectedValue(new Error("permission-denied"));

    render(<PendingPicksApplier />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockApplyBulk).toHaveBeenCalledTimes(PENDING_PICKS_APPLY_MAX_ATTEMPTS);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("pendingPinPicks")).not.toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent(/couldn't save your QR pin picks/i);
  });
});
