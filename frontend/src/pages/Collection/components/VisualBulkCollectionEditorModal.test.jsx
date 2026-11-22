import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VisualBulkCollectionEditorModal from "./VisualBulkCollectionEditorModal.jsx";

const mockApplyBulkCollectionUpdate = vi.hoisted(() => vi.fn());
const editedSku = vi.hoisted(() => ({ skuId: "LT24-ELS-01-DUN" }));

vi.mock("../utils/bulkImport", () => ({
  applyBulkCollectionUpdate: (...args) => mockApplyBulkCollectionUpdate(...args),
}));

vi.mock("../../../components/CollectionReviewEditor/CollectionReviewEditor.jsx", async () => {
  const catalog = await import("../../GettingStarted/gettingStartedCatalog.js");
  const reviewTree = catalog.filterGettingStartedTree(
    catalog.gettingStartedTree,
    catalog.COLLECTIBLE_TYPE_BOTH,
  );
  let editedSkuGroupId = "";
  for (const section of reviewTree) {
    for (const group of section.children) {
      if (group.skus.some((sku) => sku.skuId === editedSku.skuId)) {
        editedSkuGroupId = group.id;
        break;
      }
    }
  }

  return {
    default: function StubCollectionReviewEditor({ editor }) {
      return (
        <button
          type="button"
          onClick={() => editor.adjustSkuQuantity(editedSku.skuId, editedSkuGroupId, 1)}
        >
          Increase test ELS quantity
        </button>
      );
    },
  };
});

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

    fireEvent.click(screen.getByRole("button", { name: "Increase test ELS quantity" }));
    fireEvent.click(screen.getByRole("button", { name: /save collection/i }));

    await waitFor(() => {
      expect(mockApplyBulkCollectionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerUid,
          existingEntries: liveEntriesAfterRemoteChange,
          rows: [expect.objectContaining({ skuId: editedSku.skuId, quantity: "2" })],
        }),
      );
    });

    const { rows } = mockApplyBulkCollectionUpdate.mock.calls[0][0];
    expect(rows.some((row) => row.skuId === "LT24-CHM-01-DUN")).toBe(false);
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
