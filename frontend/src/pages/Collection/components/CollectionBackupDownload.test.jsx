import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import CollectionBackupDownload from "./CollectionBackupDownload.jsx";

describe("CollectionBackupDownload", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a backup card that is distinct from the bulk upload format", () => {
    render(<CollectionBackupDownload ownerUid="user-1" entries={[]} />);

    const region = screen.getByRole("region", { name: "Download my collection" });
    expect(screen.getByRole("heading", { name: "Download my collection" })).toBeInTheDocument();
    expect(region).toHaveTextContent(
      "Everything you own on ShardStash, including cards, pins, and any sets we add later. This is a backup and spreadsheet copy, not the bulk upload format.",
    );
    expect(region.textContent).not.toContain("—");
    expect(screen.getByRole("button", { name: "Download CSV" })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: /story deck quantities/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/upload filled template/i)).not.toBeInTheDocument();
  });

  it("disables download when signed out", () => {
    URL.createObjectURL = vi.fn(() => "blob:mock-url");
    render(<CollectionBackupDownload ownerUid={null} entries={[]} />);

    const button = screen.getByRole("button", { name: "Download CSV" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("disables download while collection data is still loading", () => {
    URL.createObjectURL = vi.fn(() => "blob:mock-url");
    render(<CollectionBackupDownload ownerUid="user-1" entries={[]} disabled />);

    const button = screen.getByRole("button", { name: "Download CSV" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("downloads a dated backup CSV of owned cards and pins", async () => {
    const user = userEvent.setup();
    const blobs = [];
    URL.createObjectURL = vi.fn((blob) => {
      blobs.push(blob);
      return "blob:backup";
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const anchors = [];
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag, options) => {
      const element = originalCreate(tag, options);
      if (String(tag).toLowerCase() === "a") {
        anchors.push(element);
      }
      return element;
    });

    render(
      <CollectionBackupDownload
        ownerUid="user-1"
        entries={[
          {
            skuId: "LT24-ELS-01-DUN",
            quantity: 3,
            updatedAt: new Date("2026-09-03T23:34:00.000Z"),
          },
          {
            skuId: "PIN-CF-01",
            quantity: 2,
            updatedAt: new Date("2026-09-03T23:34:00.000Z"),
          },
          { skuId: "PIN-CF-02", quantity: 0 },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Download CSV" }));

    expect(blobs).toHaveLength(1);
    const csv = await blobs[0].text();
    expect(csv.split("\n")[0]).toBe("type,set,skuId,name,finish,quantity,notes,lastUpdated");
    expect(csv).toContain(
      "story_card,Stormlight Lost Tales — Story Deck,LT24-ELS-01-DUN,Elsecaller #01,DUN,3,,2026-09-03T23:34:00.000Z",
    );
    expect(csv).toContain("pin,ChasmFriends Pins,PIN-CF-01,Shreadad,,2,,2026-09-03T23:34:00.000Z");
    expect(csv).not.toContain("PIN-CF-02");
    expect(csv).not.toContain("skuId,quantity,notes");

    expect(anchors).toHaveLength(1);
    expect(anchors[0].download).toMatch(/^shardstash-collection-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:backup");
  });

  it("downloads a header-only CSV for an empty collection", async () => {
    const user = userEvent.setup();
    const blobs = [];
    URL.createObjectURL = vi.fn((blob) => {
      blobs.push(blob);
      return "blob:empty";
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<CollectionBackupDownload ownerUid="user-1" entries={[]} />);
    await user.click(screen.getByRole("button", { name: "Download CSV" }));

    expect(await blobs[0].text()).toBe("type,set,skuId,name,finish,quantity,notes,lastUpdated");
  });
});
