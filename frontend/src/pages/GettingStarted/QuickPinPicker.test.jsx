import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import QuickPinPicker from "./QuickPinPicker.jsx";

describe("QuickPinPicker", () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup({ delay: null });
  });

  it("groups pins by series collapsed by default with ChasmFriends first", () => {
    render(<QuickPinPicker onSubmit={vi.fn()} />);

    expect(screen.getByRole("heading", { name: /Which pins do you have/i })).toBeInTheDocument();
    const toggles = screen.getAllByRole("button", { expanded: false });
    expect(toggles[0]).toHaveTextContent(/ChasmFriends/i);
    expect(screen.queryByText("Shredhead")).not.toBeInTheDocument();
  });

  it("supports search, expand, and per-pin Need/Have/Have spares", async () => {
    const onSubmit = vi.fn();
    render(<QuickPinPicker onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText(/Search pins or series/i), "Shredhead");
    expect(screen.getByText("Shredhead")).toBeInTheDocument();

    const pinRow = screen.getByText("Shredhead").closest("li");
    const modes = within(pinRow).getByRole("group", { name: /Shredhead ownership/i }); // fieldset
    await user.click(within(modes).getByRole("button", { name: "Have" }));
    expect(within(modes).getByRole("button", { name: "Have" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(within(modes).getByRole("button", { name: "Have spares" }));
    expect(within(pinRow).getByText("Spares")).toBeInTheDocument();
    await user.click(within(pinRow).getByRole("button", { name: /Increase spares/i }));

    await user.click(screen.getByRole("button", { name: "Find my trades" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const quantities = onSubmit.mock.calls[0][0];
    expect(quantities["PIN-CF-01"]).toBe(3);
    expect(quantities["PIN-CF-02"]).toBe(0);
  });

  it("applies Have all / Need all to a series", async () => {
    const onSubmit = vi.fn();
    render(<QuickPinPicker onSubmit={onSubmit} />);

    const chasmToggle = screen.getByRole("button", { name: /ChasmFriends/i });
    await user.click(chasmToggle);
    await user.click(screen.getAllByRole("button", { name: "Have all" })[0]);
    await user.click(screen.getByRole("button", { name: "Find my trades" }));

    const afterHaveAll = onSubmit.mock.calls[0][0];
    expect(afterHaveAll["PIN-CF-01"]).toBe(1);
    expect(afterHaveAll["PIN-CF-05"]).toBe(1);

    onSubmit.mockClear();
    await user.click(screen.getAllByRole("button", { name: "Need all" })[0]);
    await user.click(screen.getByRole("button", { name: "Find my trades" }));
    const afterNeedAll = onSubmit.mock.calls[0][0];
    expect(afterNeedAll["PIN-CF-01"]).toBe(0);
    expect(afterNeedAll["PIN-CF-05"]).toBe(0);
  });

  it("prefills from signed-in collection entries", () => {
    render(
      <QuickPinPicker
        isSignedIn
        entries={[
          { skuId: "PIN-CF-01", quantity: 1 },
          { skuId: "PIN-CF-02", quantity: 4 },
        ]}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText(/2 marked Have/i)).toBeInTheDocument();
  });
});
