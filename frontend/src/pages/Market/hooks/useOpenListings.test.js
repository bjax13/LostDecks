import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockSubscribeOpenListings = vi.fn();

vi.mock("../../../lib/marketplace/listings", () => ({
  subscribeOpenListings: (...args) => mockSubscribeOpenListings(...args),
}));

const { default: useOpenListings } = await import("./useOpenListings.js");

function fakeDoc(id, data) {
  return {
    id,
    data: () => data,
  };
}

describe("useOpenListings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribeOpenListings.mockImplementation(() => vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with loading true, empty listings, and no error", () => {
    const { result } = renderHook(() => useOpenListings());

    expect(result.current.loading).toBe(true);
    expect(result.current.listings).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("subscribes with cardId undefined when cardId is omitted", () => {
    renderHook(() => useOpenListings());

    expect(mockSubscribeOpenListings).toHaveBeenCalledWith(
      { cardId: undefined },
      expect.any(Function),
      expect.any(Function),
    );
  });

  it("subscribes with cardId undefined when cardId is empty string", () => {
    renderHook(() => useOpenListings({ cardId: "" }));

    expect(mockSubscribeOpenListings).toHaveBeenCalledWith(
      { cardId: undefined },
      expect.any(Function),
      expect.any(Function),
    );
  });

  it("subscribes with the provided cardId", () => {
    renderHook(() => useOpenListings({ cardId: "LT24-ELS-01" }));

    expect(mockSubscribeOpenListings).toHaveBeenCalledWith(
      { cardId: "LT24-ELS-01" },
      expect.any(Function),
      expect.any(Function),
    );
  });

  it("maps snapshot docs to listings and stops loading", () => {
    let onNext;
    mockSubscribeOpenListings.mockImplementation((_params, next) => {
      onNext = next;
      return vi.fn();
    });

    const { result } = renderHook(() => useOpenListings({ cardId: "LT24-ELS-01" }));

    act(() =>
      onNext({
        docs: [
          fakeDoc("l1", { cardId: "LT24-ELS-01", priceCents: 500 }),
          fakeDoc("l2", { cardId: "LT24-ELS-01", priceCents: 600 }),
        ],
      }),
    );

    expect(result.current.listings).toEqual([
      { id: "l1", cardId: "LT24-ELS-01", priceCents: 500 },
      { id: "l2", cardId: "LT24-ELS-01", priceCents: 600 },
    ]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("handles an empty docs array", () => {
    let onNext;
    mockSubscribeOpenListings.mockImplementation((_params, next) => {
      onNext = next;
      return vi.fn();
    });

    const { result } = renderHook(() => useOpenListings());

    act(() => onNext({ docs: [] }));

    expect(result.current.listings).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("sets error and stops loading when the error callback runs", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let onError;
    mockSubscribeOpenListings.mockImplementation((_params, _next, err) => {
      onError = err;
      return vi.fn();
    });

    const { result } = renderHook(() => useOpenListings());
    const failure = new Error("permission-denied");

    act(() => onError(failure));

    expect(result.current.error).toBe(failure);
    expect(result.current.loading).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith("Failed to load open listings", failure);

    consoleSpy.mockRestore();
  });

  it("calls unsubscribe on unmount", () => {
    const unsubscribe = vi.fn();
    mockSubscribeOpenListings.mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() => useOpenListings());
    expect(unsubscribe).not.toHaveBeenCalled();

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes and resubscribes when cardId changes", () => {
    const unsub1 = vi.fn();
    const unsub2 = vi.fn();
    mockSubscribeOpenListings.mockReturnValueOnce(unsub1).mockReturnValueOnce(unsub2);

    const { rerender } = renderHook(({ cardId }) => useOpenListings({ cardId }), {
      initialProps: { cardId: "LT24-ELS-01" },
    });

    expect(mockSubscribeOpenListings).toHaveBeenCalledTimes(1);

    rerender({ cardId: "LT24-WOK-01" });

    expect(unsub1).toHaveBeenCalledTimes(1);
    expect(mockSubscribeOpenListings).toHaveBeenCalledTimes(2);
    expect(mockSubscribeOpenListings).toHaveBeenLastCalledWith(
      { cardId: "LT24-WOK-01" },
      expect.any(Function),
      expect.any(Function),
    );
  });

  it("resets error and sets loading when effect re-runs after cardId change", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let onErrorFirst;
    let onNextSecond;
    mockSubscribeOpenListings
      .mockImplementationOnce((_p, _n, err) => {
        onErrorFirst = err;
        return vi.fn();
      })
      .mockImplementationOnce((_p, next) => {
        onNextSecond = next;
        return vi.fn();
      });

    const { rerender, result } = renderHook(({ cardId }) => useOpenListings({ cardId }), {
      initialProps: { cardId: "a" },
    });

    act(() => onErrorFirst(new Error("first")));

    expect(result.current.error).not.toBeNull();
    expect(result.current.loading).toBe(false);

    rerender({ cardId: "b" });

    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();

    act(() => onNextSecond({ docs: [fakeDoc("x", { status: "OPEN" })] }));

    expect(result.current.listings).toEqual([{ id: "x", status: "OPEN" }]);
    expect(result.current.loading).toBe(false);

    consoleSpy.mockRestore();
  });
});
