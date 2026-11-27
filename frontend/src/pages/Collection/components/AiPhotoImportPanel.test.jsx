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
});
