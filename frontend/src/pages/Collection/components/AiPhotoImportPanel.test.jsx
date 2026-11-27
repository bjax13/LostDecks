import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AiPhotoImportPanel from "./AiPhotoImportPanel.jsx";

const analyzeMock = vi.fn();
const applyBulkMock = vi.fn();
const captureEventMock = vi.fn();
const preparePhotoMock = vi.fn();
const isEnabledMock = vi.fn(() => true);

vi.mock("../../../analytics/posthog.js", () => ({
  captureEvent: (...args) => captureEventMock(...args),
  isAiPhotoImportEnabled: () => isEnabledMock(),
}));

vi.mock("../utils/analyzeCollectionPhotos.js", () => ({
  analyzeCollectionPhotos: (...args) => analyzeMock(...args),
}));

vi.mock("../utils/bulkImport.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    applyBulkCollectionUpdate: (...args) => applyBulkMock(...args),
  };
});

vi.mock("../utils/aiPhotoImportImage.js", () => ({
  preparePhotoForAiImport: (...args) => preparePhotoMock(...args),
}));

describe("AiPhotoImportPanel", () => {
  beforeEach(() => {
    analyzeMock.mockReset();
    applyBulkMock.mockReset();
    captureEventMock.mockReset();
    preparePhotoMock.mockReset();
    isEnabledMock.mockReturnValue(true);
    preparePhotoMock.mockResolvedValue({
      mimeType: "image/jpeg",
      dataBase64: "abc",
      byteLength: 3,
    });
    analyzeMock.mockResolvedValue({
      extractions: [
        {
          name: "Elsecaller",
          printedId: "LT24-ELS-01-DUN",
          kind: "card",
          confidence: 0.9,
        },
      ],
      meta: { estimatedCostUsd: 0.002, imageCount: 1, itemCount: 1 },
    });
    applyBulkMock.mockResolvedValue({ created: 1, updated: 0, deleted: 0, issues: [] });
  });

  it("does not render when feature flag is off", () => {
    isEnabledMock.mockReturnValue(false);
    const { container } = render(
      <AiPhotoImportPanel ownerUid="user-1" existingEntries={[]} disabled={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("runs analyze, shows review rows, and confirms via bulk import", async () => {
    const user = userEvent.setup();
    render(<AiPhotoImportPanel ownerUid="user-1" existingEntries={[]} disabled={false} />);

    const file = new File(["pixels"], "card.jpg", { type: "image/jpeg" });
    const input = document.querySelector('input[type="file"]');
    expect(input).toBeTruthy();
    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /review matches/i })).toBeInTheDocument();
    });

    expect(analyzeMock).toHaveBeenCalledWith([{ mimeType: "image/jpeg", dataBase64: "abc" }]);
    expect(captureEventMock).toHaveBeenCalledWith(
      "ai_photo_import_photos_sent",
      expect.any(Object),
    );

    await user.click(screen.getByRole("button", { name: /confirm import/i }));

    await waitFor(() => {
      expect(applyBulkMock).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerUid: "user-1",
          allowPins: true,
          rows: [expect.objectContaining({ skuId: "LT24-ELS-01-DUN", quantity: "1" })],
        }),
      );
    });
    expect(captureEventMock).toHaveBeenCalledWith(
      "ai_photo_import_items_confirmed",
      expect.any(Object),
    );
  });

  it("merges duplicate SKUs before calling bulk import", async () => {
    analyzeMock.mockResolvedValue({
      extractions: [
        { name: "Card A", printedId: "LT24-ELS-01-DUN", kind: "card", confidence: 0.9 },
        { name: "Card A again", printedId: "LT24-ELS-01-DUN", kind: "card", confidence: 0.8 },
      ],
      meta: { estimatedCostUsd: 0.004, imageCount: 1, itemCount: 2 },
    });
    const user = userEvent.setup();
    render(<AiPhotoImportPanel ownerUid="user-1" existingEntries={[]} disabled={false} />);

    const file = new File(["pixels"], "card.jpg", { type: "image/jpeg" });
    await user.upload(document.querySelector('input[type="file"]'), file);
    await waitFor(() => expect(screen.getByRole("heading", { name: /review matches/i })));

    await user.click(screen.getByRole("button", { name: /confirm import/i }));
    await waitFor(() => expect(applyBulkMock).toHaveBeenCalled());
    expect(applyBulkMock.mock.calls[0][0].rows).toEqual([
      expect.objectContaining({ skuId: "LT24-ELS-01-DUN", quantity: "2" }),
    ]);
  });

  it("keeps review rows visible when bulk import returns issues", async () => {
    applyBulkMock.mockResolvedValue({
      created: 0,
      updated: 0,
      deleted: 0,
      issues: [{ line: 1, message: 'SKU "BAD-SKU" not found in catalog.' }],
    });
    analyzeMock.mockResolvedValue({
      extractions: [{ name: "Unknown", printedId: "BAD-SKU", kind: "card", confidence: 0.5 }],
      meta: { estimatedCostUsd: 0.002, imageCount: 1, itemCount: 1 },
    });

    const user = userEvent.setup();
    render(<AiPhotoImportPanel ownerUid="user-1" existingEntries={[]} disabled={false} />);
    const uploadInput = document.querySelector('input[type="file"]');
    expect(uploadInput).toBeTruthy();
    await user.upload(uploadInput, new File(["pixels"], "card.jpg", { type: "image/jpeg" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: /review matches/i })));
    await user.click(screen.getByRole("button", { name: /confirm import/i }));

    await waitFor(() => {
      expect(screen.getByText(/some rows could not be imported/i)).toBeInTheDocument();
      expect(screen.getByText(/not found in catalog/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /confirm import/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: /review matches/i })).toBeInTheDocument();
    expect(captureEventMock).not.toHaveBeenCalledWith(
      "ai_photo_import_items_confirmed",
      expect.any(Object),
    );
  });
});
