import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CategoryPill from "./CategoryPill.jsx";

describe("CategoryPill (unit)", () => {
  it("renders category label from constants when no label prop", () => {
    render(<CategoryPill category="story" />);
    expect(screen.getByText("Story")).toBeInTheDocument();
  });

  it("uses custom label when provided", () => {
    render(<CategoryPill category="story" label="Custom" />);
    expect(screen.getByText("Custom")).toBeInTheDocument();
  });

  it("falls back to category when unknown category", () => {
    render(<CategoryPill category="unknown" />);
    expect(screen.getByText("unknown")).toBeInTheDocument();
  });
});
