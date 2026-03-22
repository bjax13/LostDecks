import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CollectiblesHeader from "./CollectiblesHeader.jsx";

describe("CollectiblesHeader (unit)", () => {
  it("renders set name and total collectibles", () => {
    render(
      <CollectiblesHeader
        setName="Lost Tales"
        totalCollectibles={100}
        viewMode="grid"
        onChangeView={() => {}}
      />,
    );
    expect(screen.getByText("Set: Lost Tales")).toBeInTheDocument();
    expect(screen.getByText(/Browse the 100 collectibles/)).toBeInTheDocument();
  });

  it("calls onChangeView with grid when Grid view clicked", async () => {
    const onChangeView = vi.fn();
    render(
      <CollectiblesHeader
        setName="LT"
        totalCollectibles={50}
        viewMode="table"
        onChangeView={onChangeView}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Grid view" }));
    expect(onChangeView).toHaveBeenCalledWith("grid");
  });

  it("calls onChangeView with table when Table view clicked", async () => {
    const onChangeView = vi.fn();
    render(
      <CollectiblesHeader
        setName="LT"
        totalCollectibles={50}
        viewMode="grid"
        onChangeView={onChangeView}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Table view" }));
    expect(onChangeView).toHaveBeenCalledWith("table");
  });

  it("applies active class to current view mode button", () => {
    const { rerender } = render(
      <CollectiblesHeader
        setName="LT"
        totalCollectibles={50}
        viewMode="grid"
        onChangeView={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Grid view" })).toHaveClass("active");
    rerender(
      <CollectiblesHeader
        setName="LT"
        totalCollectibles={50}
        viewMode="table"
        onChangeView={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Table view" })).toHaveClass("active");
  });
});
