import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BulkCollectionTools from "./BulkCollectionTools.jsx";

const bulkImportMocks = vi.hoisted(() => ({
  createCollectionTemplateCsv: vi.fn(() => "skuId,quantity,notes\n"),
  parseBulkCollectionCsv: vi.fn(),
  applyBulkCollectionUpdate: vi.fn(),
}));

vi.mock("../utils/bulkImport", () => ({
  createCollectionTemplateCsv: bulkImportMocks.createCollectionTemplateCsv,
  parseBulkCollectionCsv: bulkImportMocks.parseBulkCollectionCsv,
  applyBulkCollectionUpdate: bulkImportMocks.applyBulkCollectionUpdate,
}));

const collectiblesState = vi.hoisted(() => ({
  skus: [],
  stories: [{ title: "Zeta" }, { title: "Alpha" }],
  cardById: {},
}));

vi.mock("../../../data/collectibles", () => ({
  get datasetSkus() {
    return collectiblesState.skus;
  },
  get datasetStories() {
    return collectiblesState.stories;
  },
  getCollectibleRecord: (cardId) => collectiblesState.cardById[cardId] ?? null,
}));

describe("BulkCollectionTools", () => {
  const ownerUid = "user-abc";

  beforeEach(() => {
    bulkImportMocks.createCollectionTemplateCsv.mockReturnValue("skuId,quantity,notes\n");
    bulkImportMocks.parseBulkCollectionCsv.mockReturnValue([]);
    bulkImportMocks.applyBulkCollectionUpdate.mockResolvedValue({
      created: 0,
      updated: 0,
      deleted: 0,
      issues: [],
    });
    collectiblesState.skus = [];
    collectiblesState.stories = [{ title: "Zeta" }, { title: "Alpha" }];
    collectiblesState.cardById = {};
    vi.spyOn(console, "error").mockImplementation(() => {});

    URL.createObjectURL = vi.fn(() => "blob:mock-url");
    URL.revokeObjectURL = vi.fn();

    Object.defineProperty(document, "execCommand", {
      value: vi.fn(() => true),
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function getFileInput(container) {
    return (container ?? document).querySelector('input[type="file"]');
  }

  function uploadCsv(container, name = "test.csv", content = "x") {
    const input = getFileInput(container);
    const file = new File([content], name, { type: "text/csv" });
    if (typeof file.text !== "function") {
      file.text = () => Promise.resolve(String(content));
    }
    const fileList = {
      0: file,
      length: 1,
      item: (index) => (index === 0 ? file : null),
      [Symbol.iterator]: function* fileIterator() {
        yield file;
      },
    };
    Object.defineProperty(input, "files", {
      configurable: true,
      value: fileList,
    });
    fireEvent.change(input);
    return file;
  }

  it("renders bulk tools section and instructions", () => {
    render(<BulkCollectionTools ownerUid={ownerUid} entries={[]} />);
    expect(screen.getByRole("region", { name: /bulk update tools/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /bulk update your collection/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/download the csv template, fill in your card counts/i),
    ).toBeInTheDocument();
  });

  it("shows sign-in hint and disables actions when ownerUid is missing", () => {
    const { container } = render(<BulkCollectionTools ownerUid={null} entries={[]} />);
    expect(
      screen.getByText(/sign in to download the template or upload updates/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download template/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /copy iso\/uft post/i })).toBeDisabled();
    expect(getFileInput(container)).toBeDisabled();
  });

  it("enables actions when signed in and not disabled", () => {
    const { container } = render(<BulkCollectionTools ownerUid={ownerUid} entries={[]} />);
    expect(screen.queryByText(/sign in to download/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download template/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /copy iso\/uft post/i })).toBeEnabled();
    expect(getFileInput(container)).toBeEnabled();
  });

  it("disables actions when disabled prop is true", () => {
    const { container } = render(<BulkCollectionTools ownerUid={ownerUid} entries={[]} disabled />);
    expect(screen.getByRole("button", { name: /download template/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /copy iso\/uft post/i })).toBeDisabled();
    expect(getFileInput(container)).toBeDisabled();
  });

  it("downloads CSV template via blob URL when template button is used", async () => {
    const user = userEvent.setup();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<BulkCollectionTools ownerUid={ownerUid} entries={[]} />);
    await user.click(screen.getByRole("button", { name: /download template/i }));

    expect(bulkImportMocks.createCollectionTemplateCsv).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    clickSpy.mockRestore();
  });

  it("shows uploading label while import is in progress", async () => {
    let finishImport;
    bulkImportMocks.parseBulkCollectionCsv.mockReturnValue([
      { skuId: "S1", quantity: "1", __lineNumber: 2 },
    ]);
    bulkImportMocks.applyBulkCollectionUpdate.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishImport = resolve;
        }),
    );

    const { container } = render(<BulkCollectionTools ownerUid={ownerUid} entries={[]} />);
    uploadCsv(container, "bulk.csv", "x");

    expect(await screen.findByText(/uploading/i)).toBeInTheDocument();
    finishImport({ created: 1, updated: 0, deleted: 0, issues: [] });
    await waitFor(() => {
      expect(screen.queryByText(/uploading/i)).not.toBeInTheDocument();
    });
  });

  it("sets error when CSV parses to zero rows", async () => {
    bulkImportMocks.parseBulkCollectionCsv.mockReturnValue([]);

    const { container } = render(<BulkCollectionTools ownerUid={ownerUid} entries={[]} />);
    uploadCsv(container, "empty.csv", "h");

    expect(
      await screen.findByText(/the uploaded file did not contain any collection updates/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/last uploaded file: empty\.csv/i)).toBeInTheDocument();
  });

  it("applies bulk update and shows summary for a single change type", async () => {
    bulkImportMocks.parseBulkCollectionCsv.mockReturnValue([
      { skuId: "S1", quantity: "1", __lineNumber: 2 },
    ]);
    bulkImportMocks.applyBulkCollectionUpdate.mockResolvedValue({
      created: 2,
      updated: 0,
      deleted: 0,
      issues: [],
    });

    const { container } = render(<BulkCollectionTools ownerUid={ownerUid} entries={[]} />);
    uploadCsv(container, "rows.csv", "a");

    expect(await screen.findByText(/2 new entries/i)).toBeInTheDocument();
    expect(bulkImportMocks.applyBulkCollectionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerUid,
        rows: [{ skuId: "S1", quantity: "1", __lineNumber: 2 }],
      }),
    );
    expect(bulkImportMocks.applyBulkCollectionUpdate.mock.calls[0][0].existingEntries).toEqual([]);
  });

  it("combines summary segments for multiple change types", async () => {
    bulkImportMocks.parseBulkCollectionCsv.mockReturnValue([
      { skuId: "S1", quantity: "1", __lineNumber: 2 },
    ]);
    bulkImportMocks.applyBulkCollectionUpdate.mockResolvedValue({
      created: 1,
      updated: 1,
      deleted: 1,
      issues: [],
    });

    const { container } = render(<BulkCollectionTools ownerUid={ownerUid} entries={[]} />);
    uploadCsv(container, "mix.csv", "a");

    expect(await screen.findByText(/1 new entry, 1 update and 1 removal/i)).toBeInTheDocument();
  });

  it("shows 'no changes' summary when report counts are all zero", async () => {
    bulkImportMocks.parseBulkCollectionCsv.mockReturnValue([
      { skuId: "S1", quantity: "1", __lineNumber: 2 },
    ]);
    bulkImportMocks.applyBulkCollectionUpdate.mockResolvedValue({
      created: 0,
      updated: 0,
      deleted: 0,
      issues: [],
    });

    const { container } = render(<BulkCollectionTools ownerUid={ownerUid} entries={[]} />);
    uploadCsv(container, "noop.csv", "a");

    expect(await screen.findByText(/no changes were necessary/i)).toBeInTheDocument();
  });

  it("shows import issues including rows with unknown line numbers", async () => {
    bulkImportMocks.parseBulkCollectionCsv.mockReturnValue([
      { skuId: "S1", quantity: "1", __lineNumber: 2 },
    ]);
    bulkImportMocks.applyBulkCollectionUpdate.mockResolvedValue({
      created: 0,
      updated: 0,
      deleted: 0,
      issues: [
        { line: 3, message: "Bad row" },
        { line: "?", message: "Ambiguous" },
      ],
    });

    const { container } = render(<BulkCollectionTools ownerUid={ownerUid} entries={[]} />);
    uploadCsv(container, "issues.csv", "a");

    expect(await screen.findByText(/some rows were skipped/i)).toBeInTheDocument();
    expect(screen.getByText(/line 3: bad row/i)).toBeInTheDocument();
    expect(screen.getByText(/row: ambiguous/i)).toBeInTheDocument();
  });

  it("shows error message when bulk import throws", async () => {
    bulkImportMocks.parseBulkCollectionCsv.mockReturnValue([
      { skuId: "S1", quantity: "1", __lineNumber: 2 },
    ]);
    bulkImportMocks.applyBulkCollectionUpdate.mockRejectedValue(new Error("Firestore exploded"));

    const { container } = render(<BulkCollectionTools ownerUid={ownerUid} entries={[]} />);
    uploadCsv(container, "bad.csv", "a");

    expect(await screen.findByText(/firestore exploded/i)).toBeInTheDocument();
    expect(console.error).toHaveBeenCalled();
  });

  it("uses execCommand fallback when clipboard has no writeText", async () => {
    const user = userEvent.setup();
    Reflect.deleteProperty(globalThis.navigator, "clipboard");
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: {},
      configurable: true,
      writable: true,
    });
    const execCommand = vi.mocked(document.execCommand);
    execCommand.mockClear();
    collectiblesState.skus = [];

    render(<BulkCollectionTools ownerUid={ownerUid} entries={[]} />);
    await user.click(screen.getByRole("button", { name: /copy iso\/uft post/i }));

    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(await screen.findByText(/copied iso\/uft post to your clipboard/i)).toBeInTheDocument();
  });

  it("shows success status after copy ISO/UFT post", async () => {
    const user = userEvent.setup();
    collectiblesState.skus = [];

    render(<BulkCollectionTools ownerUid={ownerUid} entries={[]} />);
    await user.click(screen.getByRole("button", { name: /copy iso\/uft post/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(/copied iso\/uft post/i);
  });

  it("shows post copy error when clipboard writeText rejects", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Reflect.deleteProperty(globalThis.navigator, "clipboard");
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    collectiblesState.skus = [];

    render(<BulkCollectionTools ownerUid={ownerUid} entries={[]} />);
    await user.click(screen.getByRole("button", { name: /copy iso\/uft post/i }));

    expect(await screen.findByText(/unable to copy the post/i)).toBeInTheDocument();
    expect(console.error).toHaveBeenCalled();
  });

  it("passes existing entries from props into applyBulkCollectionUpdate", async () => {
    const existing = [{ id: "e1", skuId: "LT-X" }];
    bulkImportMocks.parseBulkCollectionCsv.mockReturnValue([
      { skuId: "S1", quantity: "1", __lineNumber: 2 },
    ]);
    bulkImportMocks.applyBulkCollectionUpdate.mockResolvedValue({ created: 1, issues: [] });

    const { container } = render(<BulkCollectionTools ownerUid={ownerUid} entries={existing} />);
    uploadCsv(container, "with-existing.csv", "a");

    await waitFor(() => {
      expect(bulkImportMocks.applyBulkCollectionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ existingEntries: existing }),
      );
    });
  });

  it("does not run file import when ownerUid is missing", () => {
    bulkImportMocks.parseBulkCollectionCsv.mockReturnValue([
      { skuId: "S1", quantity: "1", __lineNumber: 2 },
    ]);

    const { container } = render(<BulkCollectionTools ownerUid={null} entries={[]} />);
    const input = getFileInput(container);
    expect(input).toBeDisabled();
    uploadCsv(container, "nope.csv", "a");

    expect(bulkImportMocks.parseBulkCollectionCsv).not.toHaveBeenCalled();
  });

  it("shows two-part summary when only two change types are present", async () => {
    bulkImportMocks.parseBulkCollectionCsv.mockReturnValue([
      { skuId: "S1", quantity: "1", __lineNumber: 2 },
    ]);
    bulkImportMocks.applyBulkCollectionUpdate.mockResolvedValue({
      created: 2,
      updated: 1,
      deleted: 0,
      issues: [],
    });

    const { container } = render(<BulkCollectionTools ownerUid={ownerUid} entries={[]} />);
    uploadCsv(container, "two-part.csv", "a");

    expect(await screen.findByText(/2 new entries and 1 update/i)).toBeInTheDocument();
  });

  it("shows generic error when import rejects without a message", async () => {
    bulkImportMocks.parseBulkCollectionCsv.mockReturnValue([
      { skuId: "S1", quantity: "1", __lineNumber: 2 },
    ]);
    bulkImportMocks.applyBulkCollectionUpdate.mockRejectedValue("bad");

    const { container } = render(<BulkCollectionTools ownerUid={ownerUid} entries={[]} />);
    uploadCsv(container, "nomsg.csv", "a");

    expect(await screen.findByText(/failed to process the uploaded file/i)).toBeInTheDocument();
  });

  it("does not create template CSV while a CSV upload is still processing", async () => {
    let finishImport;
    bulkImportMocks.parseBulkCollectionCsv.mockReturnValue([
      { skuId: "S1", quantity: "1", __lineNumber: 2 },
    ]);
    bulkImportMocks.applyBulkCollectionUpdate.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishImport = resolve;
        }),
    );

    const { container } = render(<BulkCollectionTools ownerUid={ownerUid} entries={[]} />);
    uploadCsv(container, "busy.csv", "x");
    expect(await screen.findByText(/uploading/i)).toBeInTheDocument();

    bulkImportMocks.createCollectionTemplateCsv.mockClear();
    const downloadBtn = screen.getByRole("button", { name: /download template/i });
    expect(downloadBtn).toBeDisabled();
    fireEvent.click(downloadBtn);
    expect(bulkImportMocks.createCollectionTemplateCsv).not.toHaveBeenCalled();

    finishImport({ created: 0, updated: 0, deleted: 0, issues: [] });
    await waitFor(() => {
      expect(screen.queryByText(/uploading/i)).not.toBeInTheDocument();
    });
  });

  it("copies ISO/UFT text built from collection entries and SKU metadata", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Reflect.deleteProperty(globalThis.navigator, "clipboard");
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });

    collectiblesState.stories = [{ title: "Zeta" }, { title: "Alpha" }];
    collectiblesState.skus = [
      { skuId: "iso-story-foil", cardId: "c-iso-sf", finish: "FOIL" },
      { skuId: "uft-story-foil", cardId: "c-uft-sf", finish: "FOIL" },
      { skuId: "iso-herald-dun", cardId: "c-iso-hd", finish: "DUN" },
      { skuId: "uft-nonsense-variant", cardId: "c-uft-ns", finish: "FOIL" },
      { skuId: "uft-nonsense-plain", cardId: "c-uft-ns2", finish: "DUN" },
    ];
    collectiblesState.cardById = {
      "c-iso-sf": { category: "story", number: 9, storyTitle: "Alpha" },
      "c-uft-sf": { category: "story", number: 10, storyTitle: "Zeta" },
      "c-iso-hd": {
        category: "herald",
        number: Number.NaN,
        displayName: "Test Herald",
        storyTitle: "Alpha",
      },
      "c-uft-ns": {
        category: "nonsense",
        number: 7,
        detail: "variant:  Sparkle ",
        storyTitle: "Zeta",
      },
      "c-uft-ns2": {
        category: "nonsense",
        number: 8,
        detail: "  standard variant  ",
        storyTitle: "Alpha",
      },
    };

    const entries = [
      { skuId: "uft-story-foil", quantity: 3 },
      { skuId: "uft-nonsense-variant", count: 2 },
      { skuId: "uft-nonsense-plain", total: 4 },
      { skuId: "", quantity: 1 },
      { quantity: 2 },
      { skuId: "skip-zero", quantity: 0 },
    ];

    render(<BulkCollectionTools ownerUid={ownerUid} entries={entries} />);
    await user.click(screen.getByRole("button", { name: /copy iso\/uft post/i }));

    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0][0];
    expect(copied).toContain("ISO:");
    expect(copied).toContain("Story Foils:");
    expect(copied).toMatch(/9\b/);
    expect(copied).toContain("UFT:");
    expect(copied).toContain("10");
    expect(copied).toMatch(/7\s+Sparkle/);
    expect(copied).toMatch(/\b8\b/);
    expect(await screen.findByRole("status")).toHaveTextContent(
      /entries without a valid sku were skipped/i,
    );
  });

  it("does not copy ISO/UFT post while a CSV upload is still processing", async () => {
    let finishImport;
    bulkImportMocks.parseBulkCollectionCsv.mockReturnValue([
      { skuId: "S1", quantity: "1", __lineNumber: 2 },
    ]);
    bulkImportMocks.applyBulkCollectionUpdate.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishImport = resolve;
        }),
    );

    const writeText = vi.fn().mockResolvedValue(undefined);
    Reflect.deleteProperty(globalThis.navigator, "clipboard");
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });

    const { container } = render(<BulkCollectionTools ownerUid={ownerUid} entries={[]} />);
    uploadCsv(container, "busy-copy.csv", "x");
    expect(await screen.findByText(/uploading/i)).toBeInTheDocument();

    const copyBtn = screen.getByRole("button", { name: /copy iso\/uft post/i });
    expect(copyBtn).toBeDisabled();
    fireEvent.click(copyBtn);
    expect(writeText).not.toHaveBeenCalled();

    finishImport({ created: 0, updated: 0, deleted: 0, issues: [] });
    await waitFor(() => {
      expect(screen.queryByText(/uploading/i)).not.toBeInTheDocument();
    });
  });

  it("does not copy ISO/UFT post when disabled", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Reflect.deleteProperty(globalThis.navigator, "clipboard");
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });

    render(<BulkCollectionTools ownerUid={ownerUid} entries={[]} disabled />);
    const copyBtn = screen.getByRole("button", { name: /copy iso\/uft post/i });
    expect(copyBtn).toBeDisabled();
    fireEvent.click(copyBtn);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("does not download template or copy post when signed out", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Reflect.deleteProperty(globalThis.navigator, "clipboard");
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });

    render(<BulkCollectionTools ownerUid={null} entries={[]} />);
    const downloadBtn = screen.getByRole("button", { name: /download template/i });
    const copyBtn = screen.getByRole("button", { name: /copy iso\/uft post/i });
    expect(downloadBtn).toBeDisabled();
    expect(copyBtn).toBeDisabled();
    fireEvent.click(downloadBtn);
    fireEvent.click(copyBtn);
    expect(bulkImportMocks.createCollectionTemplateCsv).not.toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
  });
});
