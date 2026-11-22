import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VisualBulkCollectionEditorModal from "./VisualBulkCollectionEditorModal.jsx";

const mockApplyBulkCollectionUpdate = vi.hoisted(() => vi.fn());

vi.mock("../utils/bulkImport", () => ({
  applyBulkCollectionUpdate: (...args) => mockApplyBulkCollectionUpdate(...args),
}));

describe("VisualBulkCollectionEditorModal", () => {
  const ownerUid = "user-abc";
  const onClose = vi.fn();
  const onSaved = vi.fn();

  const openEntries = [
    { id: "LT24-CHM-01-DUN", quantity: 1 },
    { id: "LT24-ELS-01-DUN", quantity: 1 },
  ];

  const liveEntriesAfterRemoteChange = [{ id: "LT24-CHM-01-DUN", quantity: 5 }];

  beforeEach(() => {
    vi.clearAllMocks();
    mockApplyBulkCollectionUpdate.mockResolvedValue({
      created: 0,
      updated: 1,
      deleted: 0,
      issues: [],
    });
  });

  function renderModal(entries = openEntries) {
    return render(
      <VisualBulkCollectionEditorModal
        isOpen
        onClose={onClose}
        ownerUid={ownerUid}
        entries={entries}
        onSaved={onSaved}
        sessionKey="test-session"
      />,
    );
  }

  it("saves only session-edited SKUs against live entries when collection changed while open", async () => {
    const user = userEvent.setup({ delay: null });
    const { rerender } = renderModal(openEntries);

    rerender(
      <VisualBulkCollectionEditorModal
        isOpen
        onClose={onClose}
        ownerUid={ownerUid}
        entries={liveEntriesAfterRemoteChange}
        onSaved={onSaved}
        sessionKey="test-session"
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Increase Elsecaller Story Dun Dun #1 quantity",
      }),
    );

    await user.click(screen.getByRole("button", { name: /save collection/i }));

    await waitFor(() => {
      expect(mockApplyBulkCollectionUpdate).toHaveBeenCalledTimes(1);
    });

    const call = mockApplyBulkCollectionUpdate.mock.calls[0][0];
    expect(call.ownerUid).toBe(ownerUid);
    expect(call.existingEntries).toEqual(liveEntriesAfterRemoteChange);
    expect(call.rows).toEqual([
      expect.objectContaining({ skuId: "LT24-ELS-01-DUN", quantity: "2" }),
    ]);
    expect(call.rows.some((row) => row.skuId === "LT24-CHM-01-DUN")).toBe(false);
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
