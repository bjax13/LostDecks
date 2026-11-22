import { render, screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { TestMemoryRouter } from "../../test/router.jsx";
import PublicTradeListPage from "./index.jsx";

vi.mock("../../lib/tradeShares.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchShareSnapshot: vi.fn(),
  };
});

const { fetchShareSnapshot } = await import("../../lib/tradeShares.js");

function renderPage(shareId) {
  render(
    <TestMemoryRouter initialEntries={[`/t/${shareId}`]}>
      <Routes>
        <Route path="/t/:shareId" element={<PublicTradeListPage />} />
      </Routes>
    </TestMemoryRouter>,
  );
}

describe("PublicTradeListPage", () => {
  it("shows unavailable state when share is missing", async () => {
    fetchShareSnapshot.mockResolvedValueOnce(null);
    renderPage("does-not-exist");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /isn't shared anymore/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /Start your own collection/i })).toHaveAttribute(
      "href",
      "/getting-started?utm_source=share&utm_medium=trade_list",
    );
  });

  it("renders ISO/UFT lists for a public snapshot", async () => {
    fetchShareSnapshot.mockResolvedValueOnce({
      id: "abc",
      displayName: "Pat",
      iso: "LT24-ELS-01-DUN",
      uft: "",
      updatedAt: { toDate: () => new Date("2025-01-01T12:00:00Z") },
    });

    renderPage("abc");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Pat's trade list/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "ISO (looking for)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "UFT (up for trade)" })).toBeInTheDocument();
  });
});
