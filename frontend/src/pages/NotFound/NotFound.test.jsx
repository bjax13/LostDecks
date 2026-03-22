import { render, screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { TestMemoryRouter } from "../../test/router.jsx";
import NotFound from "./index.jsx";

describe("NotFound (integration)", () => {
  it("exposes the missing page message as a heading", () => {
    render(
      <TestMemoryRouter initialEntries={["/this-route-does-not-exist"]}>
        <Routes>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TestMemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: /page not found/i })).toBeInTheDocument();
  });
});
