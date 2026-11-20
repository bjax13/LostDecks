import { render, screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TestMemoryRouter } from "../../test/router.jsx";
import PublicTradeListPage from "./index.jsx";

const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("../../lib/publicTradeLists.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchPublicTradeList: fetchMock,
  };
});

function renderAt(path) {
  return render(
    <TestMemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/t/:shareId" element={<PublicTradeListPage />} />
      </Routes>
    </TestMemoryRouter>,
  );
}

describe("PublicTradeListPage", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("shows unavailable state when the share doc is missing", async () => {
    fetchMock.mockResolvedValue(null);
    renderAt("/t/does-not-exist");

    expect(
      await screen.findByRole("heading", { name: /isn't shared anymore/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /see if you can trade — add your cards or pins/i }),
    ).toHaveAttribute("href", expect.stringContaining("/getting-started"));
    expect(fetchMock).toHaveBeenCalledWith("does-not-exist");
  });

  it("renders display name and optional Discord without email", async () => {
    fetchMock.mockResolvedValue({
      id: "share1",
      displayName: "Ada",
      discordHandle: "ada#1",
      iso: [],
      uft: [],
      updatedAt: {
        toDate: () => new Date("2026-10-01T12:00:00Z"),
        toMillis: () => Date.parse("2026-10-01T12:00:00Z"),
      },
    });

    renderAt("/t/share1");

    expect(await screen.findByRole("heading", { name: /Ada's trade list/i })).toBeInTheDocument();
    expect(screen.getByText(/Discord: ada#1/i)).toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("share1");
  });
});
