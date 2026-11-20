import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TestMemoryRouter } from "../../test/router.jsx";
import PinImage from "./PinImage.jsx";

function slotImage(container) {
  return container.querySelector(".pin-image img, .pin-image__photo");
}

describe("PinImage", () => {
  it("renders the tint, set code, and aria-label without an image request when there is no photo", () => {
    const { container } = render(<PinImage pinId="PIN-CPS2-01" name="Kaladin" />);

    const slot = screen.getByRole("img", { name: "no photo yet" });
    expect(slot).toHaveAttribute("title", "no photo yet");
    expect(slot).toHaveTextContent("CPS2");
    expect(slot.querySelector("svg")).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(slot.className).toContain("pin-image--empty");
  });

  it("treats version 0 and a non-integer as no photo", () => {
    const { container, rerender } = render(
      <PinImage pinId="PIN-CONV-09" name="Nexus" image={0} variant="grid" />,
    );
    expect(screen.getByRole("img", { name: "no photo yet" })).toHaveTextContent("CONV");
    expect(container.querySelector("img")).toBeNull();

    rerender(<PinImage pinId="PIN-CF-01" name="Shredhead" image={"1"} variant="match" />);
    expect(screen.getByRole("img", { name: "no photo yet" })).toHaveTextContent("CF");
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders srcset, lazy loading, async decoding, and fixed dimensions for a small photo slot", () => {
    const { container } = render(
      <PinImage pinId="PIN-CONV-09" name="Nexus" image={2} variant="row" />,
    );
    const img = slotImage(container);
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", "/pin-images/PIN-CONV-09-96.webp?v=2");
    expect(img).toHaveAttribute(
      "srcset",
      "/pin-images/PIN-CONV-09-96.webp?v=2 1x, /pin-images/PIN-CONV-09-320.webp?v=2 2x",
    );
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("decoding", "async");
    expect(img).toHaveAttribute("width", "40");
    expect(img).toHaveAttribute("height", "40");
    expect(img).toHaveAttribute("alt", "");
    expect(container.querySelector("a")).toBeNull();
  });

  it("uses 320 and 800 on the detail slot, with high priority and no lazy loading", () => {
    const { container } = render(
      <PinImage pinId="PIN-CF-01" name="Shredhead" image={1} variant="detail" />,
    );
    const img = slotImage(container);
    expect(img).toHaveAttribute("src", "/pin-images/PIN-CF-01-320.webp?v=1");
    expect(img).toHaveAttribute(
      "srcset",
      "/pin-images/PIN-CF-01-320.webp?v=1 1x, /pin-images/PIN-CF-01-800.webp?v=1 2x",
    );
    expect(img).toHaveAttribute("fetchpriority", "high");
    expect(img).not.toHaveAttribute("loading");
    expect(img).toHaveAttribute("decoding", "async");
    expect(img).toHaveAttribute("width", "320");
    expect(img).toHaveAttribute("height", "320");
    expect(
      screen.getByRole("button", { name: "View full size photo of Shredhead" }),
    ).toContainElement(img);
  });

  it("falls back to the tint when the image errors", () => {
    const { container } = render(<PinImage pinId="PIN-CPS2-04" name="Kaladin" image={3} />);
    const img = slotImage(container);
    fireEvent.error(img);

    expect(screen.getByRole("img", { name: "no photo yet" })).toHaveTextContent("CPS2");
    expect(container.querySelector("img")).toBeNull();
  });

  it("links the detail empty state to the about page and does not request an image", () => {
    const { container } = render(
      <TestMemoryRouter>
        <PinImage pinId="PIN-WHBALL-01" name="Worldhopper Ball" variant="detail" />
      </TestMemoryRouter>,
    );

    expect(screen.getByText("WHBALL")).toBeInTheDocument();
    expect(screen.getByText(/No photo yet\. Have this pin\?/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Send us a photo." })).toHaveAttribute(
      "href",
      "/about",
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByRole("img", { name: "no photo yet" })).not.toBeInTheDocument();
  });

  it("opens the 800px file from the detail photo", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PinImage pinId="PIN-CF-01" name="Shredhead" image={4} variant="detail" />,
    );

    await user.click(screen.getByRole("button", { name: "View full size photo of Shredhead" }));

    const dialog = screen.getByRole("dialog", { name: "Shredhead photo" });
    const full = dialog.querySelector("img");
    expect(full).toHaveAttribute("src", "/pin-images/PIN-CF-01-800.webp?v=4");
    expect(full).toHaveAttribute("width", "800");
    expect(full).toHaveAttribute("height", "800");
    expect(full).toHaveAttribute("decoding", "async");
    expect(full).not.toHaveAttribute("loading");
    expect(container.querySelectorAll("img")).toHaveLength(2);
  });
});
