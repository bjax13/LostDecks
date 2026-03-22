import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/marketplace/listings", () => ({
  subscribeOpenListings: vi.fn(),
}));

import { subscribeOpenListings } from "../../../lib/marketplace/listings";
import useOpenListings from "./useOpenListings.js";

describe("useOpenListings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscribeOpenListings.mockImplementation((_params, _onNext, _onError) => vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts in loading state with empty listings and no error", () => {
    const { result } = renderHook(() => useOpenListings());

    expect(result.current.loading).toBe(true);
    expect(result.current.listings).toEqual([]);
    expect(result.current.error).toBe(null);
    expect(subscribeOpenListings).toHaveBeenCalledTimes(1);
  });

  it("subscribes with params without cardId (undefined)", () => {
    renderHook(() => useOpenListings());

    expect(subscribeOpenListings).toHaveBeenCalledWith(
      { cardId: undefined },
      expect.any(Function),
      expect.any(Function),
    );
  });

  it("subscribes with params including cardId when provided", () => {
    renderHook(() => useOpenListings({ cardId: "LT24-ELS-01" }));

    expect(subscribeOpenListings).toHaveBeenCalledWith(
      { cardId: "LT24-ELS-01" },
      expect.any(Function),
      expect.any(Function),
    );
  });

  it("maps snapshot docs to listings and clears loading on success", () => {
    const { result } = renderHook(() => useOpenListings());

    const onNext = subscribeOpenListings.mock.calls[0][1];
    const fakeSnap = {
      docs: [
        { id: "listing-1", data: () => ({ status: "OPEN", priceCents: 100 }) },
        { id: "listing-2", data: () => ({ status: "OPEN", cardId: "LT24-ELS-01" }) },
      ],
    };

    act(() => onNext(fakeSnap));

    expect(result.current.listings).toEqual([
      { id: "listing-1", status: "OPEN", priceCents: 100 },
      { id: "listing-2", status: "OPEN", cardId: "LT24-ELS-01" },
    ]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it("handles an empty snapshot", () => {
    const { result } = renderHook(() => useOpenListings());
    const onNext = subscribeOpenListings.mock.calls[0][1];

    act(() => onNext({ docs: [] }));

    expect(result.current.listings).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("invokes error callback: sets error, stops loading, and logs", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useOpenListings());
    const onError = subscribeOpenListings.mock.calls[0][2];
    const fakeError = new Error("permission-denied");

    act(() => onError(fakeError));

    expect(result.current.error).toBe(fakeError);
    expect(result.current.loading).toBe(false);
    expect(result.current.listings).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith("Failed to load open listings", fakeError);

    consoleSpy.mockRestore();
  });

  it("calls unsubscribe returned by subscribeOpenListings on unmount", () => {
    const unsubscribe = vi.fn();
    subscribeOpenListings.mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() => useOpenListings());
    expect(unsubscribe).not.toHaveBeenCalled();

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("resubscribes when cardId changes and unsubscribes from prior subscription", () => {
    const unsub1 = vi.fn();
    const unsub2 = vi.fn();
    subscribeOpenListings.mockReturnValueOnce(unsub1).mockReturnValueOnce(unsub2);

    const { rerender } = renderHook(({ cardId }) => useOpenListings({ cardId }), {
      initialProps: { cardId: undefined },
    });

    expect(subscribeOpenListings).toHaveBeenCalledTimes(1);
    expect(subscribeOpenListings).toHaveBeenLastCalledWith(
      { cardId: undefined },
      expect.any(Function),
      expect.any(Function),
    );

    rerender({ cardId: "LT24-ELS-01" });

    expect(unsub1).toHaveBeenCalledTimes(1);
    expect(subscribeOpenListings).toHaveBeenCalledTimes(2);
    expect(subscribeOpenListings).toHaveBeenLastCalledWith(
      { cardId: "LT24-ELS-01" },
      expect.any(Function),
      expect.any(Function),
    );
  });
});
