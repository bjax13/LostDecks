import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FinishPills from "./FinishPills.jsx";

describe("FinishPills (unit)", () => {
  it("renders empty state when no finishes", () => {
    render(<FinishPills finishes={[]} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders empty state when finishes is null", () => {
    render(<FinishPills />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders custom empty slot", () => {
    render(<FinishPills finishes={[]} empty={<span>None</span>} />);
    expect(screen.getByText("None")).toBeInTheDocument();
  });

  it("renders finish pills when finishes provided", () => {
    render(<FinishPills finishes={["DUN", "FOIL"]} />);
    expect(screen.getByText("DUN")).toBeInTheDocument();
    expect(screen.getByText("FOIL")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<FinishPills finishes={["DUN"]} className="custom-class" />);
    expect(container.querySelector(".custom-class")).toBeInTheDocument();
  });
});
