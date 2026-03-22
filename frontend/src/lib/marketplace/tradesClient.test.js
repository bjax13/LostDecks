import { describe, expect, it, vi } from "vitest";
import { updateTradeStatus } from "./tradesClient.js";

const mockCallable = vi.fn();

vi.mock("firebase/functions", () => ({
  httpsCallable: () => mockCallable,
}));

vi.mock("../firebase", () => ({
  functions: {},
}));

describe("tradesClient (unit)", () => {
  it("throws when tradeId is missing", async () => {
    await expect(updateTradeStatus({ status: "ACCEPTED" })).rejects.toThrow("tradeId is required");
  });

  it("throws when status is missing", async () => {
    await expect(updateTradeStatus({ tradeId: "t1" })).rejects.toThrow("status is required");
  });

  it("returns data from callable when both tradeId and status provided", async () => {
    mockCallable.mockResolvedValue({ data: { success: true, tradeId: "t1" } });
    const result = await updateTradeStatus({ tradeId: "t1", status: "ACCEPTED" });
    expect(result).toEqual({ success: true, tradeId: "t1" });
    expect(mockCallable).toHaveBeenCalledWith({ tradeId: "t1", status: "ACCEPTED" });
  });
});
