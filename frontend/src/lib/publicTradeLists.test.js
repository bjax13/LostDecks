import { beforeEach, describe, expect, it, vi } from "vitest";

const firestoreMocks = vi.hoisted(() => ({
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDoc: vi.fn(),
  doc: vi.fn((...args) => ({ path: args.slice(1).join("/") })),
  serverTimestamp: vi.fn(() => "SERVER_TS"),
}));

vi.mock("firebase/firestore", () => firestoreMocks);

vi.mock("./firebase", () => ({ db: {} }));

const prefsMocks = vi.hoisted(() => ({
  updateUserPreferences: vi.fn(),
}));

vi.mock("./userPreferences.js", () => prefsMocks);

describe("publicTradeLists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firestoreMocks.getDoc.mockResolvedValue({ exists: () => false });
    firestoreMocks.setDoc.mockResolvedValue(undefined);
    firestoreMocks.deleteDoc.mockResolvedValue(undefined);
    prefsMocks.updateUserPreferences.mockResolvedValue(undefined);
  });

  it("generateShareId returns a 12-char base62 string", async () => {
    const { generateShareId, PUBLIC_TRADE_LIST_SHARE_ID_LENGTH } = await import(
      "./publicTradeLists.js"
    );
    const id = generateShareId();
    expect(id).toHaveLength(PUBLIC_TRADE_LIST_SHARE_ID_LENGTH);
    expect(id).toMatch(/^[A-Za-z0-9]+$/);
  });

  it("buildPublicTradeListPayload omits email and empty optionals", async () => {
    const { buildPublicTradeListPayload } = await import("./publicTradeLists.js");
    const payload = buildPublicTradeListPayload({
      ownerUid: "u1",
      displayName: "  Ada  ",
      discordHandle: "",
      region: "",
      iso: ["lt24-els-01-dun"],
      uft: [{ skuId: "lt24-els-02-foil", quantity: 2 }],
      email: "secret@example.com",
    });
    expect(payload).toMatchObject({
      ownerUid: "u1",
      displayName: "Ada",
      version: 1,
      iso: ["LT24-ELS-01-DUN"],
      uft: [{ skuId: "LT24-ELS-02-FOIL", quantity: 2 }],
    });
    expect(payload).not.toHaveProperty("email");
    expect(payload).not.toHaveProperty("discordHandle");
    expect(payload).not.toHaveProperty("region");
  });

  it("enablePublicTradeList writes the doc and stores publicShareId", async () => {
    const { enablePublicTradeList } = await import("./publicTradeLists.js");
    const shareId = await enablePublicTradeList({
      ownerUid: "u1",
      displayName: "Ada",
      discordHandle: "ada#1",
      iso: [],
      uft: [],
    });
    expect(shareId).toHaveLength(12);
    expect(firestoreMocks.setDoc).toHaveBeenCalled();
    expect(prefsMocks.updateUserPreferences).toHaveBeenCalledWith("u1", {
      publicShareId: shareId,
    });
  });

  it("disablePublicTradeList deletes the doc and clears publicShareId", async () => {
    const { disablePublicTradeList } = await import("./publicTradeLists.js");
    await disablePublicTradeList({ ownerUid: "u1", shareId: "abc123XYZ999" });
    expect(firestoreMocks.deleteDoc).toHaveBeenCalled();
    expect(prefsMocks.updateUserPreferences).toHaveBeenCalledWith("u1", { publicShareId: "" });
  });

  it("isPublicTradeListStale flags lists older than 30 days", async () => {
    const { isPublicTradeListStale } = await import("./publicTradeLists.js");
    const now = Date.UTC(2026, 9, 9);
    expect(isPublicTradeListStale({ toMillis: () => now - 29 * 24 * 60 * 60 * 1000 }, now)).toBe(
      false,
    );
    expect(isPublicTradeListStale({ toMillis: () => now - 31 * 24 * 60 * 60 * 1000 }, now)).toBe(
      true,
    );
  });
});
