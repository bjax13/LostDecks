import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BinderInfo from "./BinderInfo.jsx";

describe("BinderInfo (unit)", () => {
  it("renders muted message when no binder and grid layout", () => {
    render(<BinderInfo layout="grid" />);
    expect(screen.getByText("Not in binder mosaic")).toBeInTheDocument();
  });

  it("renders dash when no binder and table layout", () => {
    render(<BinderInfo layout="table" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders binder details in grid layout", () => {
    render(<BinderInfo binder={{ page: 1, row: 2, col: 3, position: 4 }} layout="grid" />);
    expect(screen.getByText("Page 1")).toBeInTheDocument();
    expect(screen.getByText(/Row 2 · Col 3/)).toBeInTheDocument();
    expect(screen.getByText("Slot 4")).toBeInTheDocument();
  });

  it("renders binder details in table layout", () => {
    render(<BinderInfo binder={{ page: 1, row: 2, col: 3, position: 4 }} layout="table" />);
    expect(screen.getByText("Page 1")).toBeInTheDocument();
    expect(screen.getByText(/Row 2, Col 3/)).toBeInTheDocument();
  });
});
