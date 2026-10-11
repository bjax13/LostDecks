import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SITE_FEEDBACK_MAILTO } from "../../siteFeedback.js";
import ServerError from "./index.jsx";

describe("ServerError", () => {
  it("renders the friendly crash copy and actions", () => {
    render(<ServerError />);

    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.getByText(/Your collection is safe/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Tell us what happened" })).toHaveAttribute(
      "href",
      SITE_FEEDBACK_MAILTO,
    );
  });
});
