import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { MATCH_COUNTRIES, subdivisionsForCountry } from "../lib/matchLocations.js";
import LocationCombobox from "./LocationCombobox.jsx";

function Harness({ options, pinCode = "", initial = "" }) {
  const [value, setValue] = useState(initial);
  return (
    <LocationCombobox
      id="location"
      label="Country"
      options={options}
      value={value}
      pinCode={pinCode}
      onValueChange={setValue}
    />
  );
}

describe("LocationCombobox", () => {
  it("shows the United States first when the country filter is empty", async () => {
    const user = userEvent.setup();
    render(<Harness options={MATCH_COUNTRIES} pinCode="US" />);

    const input = screen.getByRole("combobox", { name: "Country" });
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("placeholder", "Not set");

    await user.click(input);
    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options[0]).toHaveTextContent("United States");
    expect(options[1]).toHaveTextContent("Not set");
    expect(options[2]).toHaveTextContent("Afghanistan");
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveAttribute("placeholder", "Type to filter");
  });

  it("filters by a partial name without regard to case", async () => {
    const user = userEvent.setup();
    render(<Harness options={MATCH_COUNTRIES} pinCode="US" />);

    const input = screen.getByRole("combobox", { name: "Country" });
    await user.click(input);
    await user.type(input, "cAn");

    const list = screen.getByRole("listbox");
    expect(
      within(list)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Canada", "Central African Republic", "Dominican Republic", "Vatican City"]);
  });

  it("saves only a listed value and restores the field after free text", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <LocationCombobox
        id="location"
        label="Country"
        options={MATCH_COUNTRIES}
        value="US"
        pinCode="US"
        onValueChange={onValueChange}
      />,
    );

    const input = screen.getByRole("combobox", { name: "Country" });
    expect(input).toHaveValue("United States");
    await user.click(input);
    await user.type(input, "Narnia");
    await user.keyboard("{Enter}");
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByText("No matches")).toBeInTheDocument();

    await user.tab();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("United States");
  });

  it("saves an exact name or code and ignores a partial name on blur", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(
      <LocationCombobox
        id="location"
        label="Country"
        options={MATCH_COUNTRIES}
        value=""
        pinCode="US"
        onValueChange={onValueChange}
      />,
    );

    const input = screen.getByRole("combobox", { name: "Country" });
    await user.type(input, "cana");
    await user.tab();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("");

    await user.type(input, "canada");
    await user.tab();
    expect(onValueChange).toHaveBeenCalledWith("CA");

    rerender(
      <LocationCombobox
        id="location"
        label="Country"
        options={MATCH_COUNTRIES}
        value=""
        pinCode="US"
        onValueChange={onValueChange}
      />,
    );
    await user.type(input, "fr");
    await user.tab();
    expect(onValueChange).toHaveBeenLastCalledWith("FR");
  });

  it("clears with Not set, with an empty field, and does not clear on open-and-leave", async () => {
    const user = userEvent.setup();
    render(<Harness options={MATCH_COUNTRIES} pinCode="US" initial="US" />);

    const input = screen.getByRole("combobox", { name: "Country" });
    expect(input).toHaveValue("United States");

    await user.click(input);
    await user.tab();
    expect(input).toHaveValue("United States");

    await user.click(input);
    await user.click(screen.getByRole("option", { name: "Not set" }));
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("placeholder", "Not set");

    await user.click(input);
    await user.click(screen.getByRole("option", { name: "Canada" }));
    expect(input).toHaveValue("Canada");

    await user.click(input);
    await user.type(input, "x");
    await user.keyboard("{Backspace}");
    await user.tab();
    expect(input).toHaveValue("");
  });

  it("selects a filtered state from the keyboard and keeps the saved name", async () => {
    const user = userEvent.setup();
    render(<Harness options={subdivisionsForCountry("US")} initial="" />);

    const input = screen.getByLabelText("Country");
    await user.type(input, "ut");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Utah",
      "Connecticut",
      "South Carolina",
      "South Dakota",
    ]);
    await user.keyboard("{Enter}");
    expect(input).toHaveValue("Utah");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("moves the highlight with the arrow keys and cancels with Escape", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <LocationCombobox
        id="location"
        label="Country"
        options={MATCH_COUNTRIES}
        value="CA"
        pinCode="US"
        onValueChange={onValueChange}
      />,
    );

    const input = screen.getByRole("combobox", { name: "Country" });
    await user.click(input);
    await user.keyboard("{ArrowDown}{ArrowUp}{Home}{End}{Home}{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("US");

    onValueChange.mockClear();
    await user.click(input);
    await user.type(input, "mex");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("Canada");
  });

  it("does not open while disabled", async () => {
    const user = userEvent.setup();
    render(
      <LocationCombobox
        id="location"
        label="Country"
        options={MATCH_COUNTRIES}
        value=""
        pinCode="US"
        disabled
        onValueChange={vi.fn()}
      />,
    );

    const input = screen.getByRole("combobox", { name: "Country" });
    expect(input).toBeDisabled();
    await user.click(input);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
