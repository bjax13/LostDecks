import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import FinishTradeList from "./FinishTradeList.jsx";

vi.mock("../../../components/InfoBubble.jsx", () => ({
  default: ({ children }) => <span>{children}</span>,
}));

vi.mock("../../Collectibles/components/AddToCollectionButton", () => ({
  formatFinishLabel: (finish) => {
    const lower = String(finish ?? "").toLowerCase();
    return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
  },
  default: () => <div data-testid="add-to-collection" />,
}));

const setCollectionTradeFlag = vi.fn(() => new Promise(() => {}));

vi.mock("../../Collectibles/hooks/useCollectionQuantityMutations", () => ({
  useCollectionQuantityMutations: () => ({ setCollectionTradeFlag }),
}));

const CARD = {
  id: "LT24-ELS-01",
  category: "story",
  finishes: ["DUN"],
};

describe("FinishTradeList – TradeStatusSwitch draft", () => {
  it("drops a pending UFT draft when quantity goes to 0", async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <FinishTradeList
        card={CARD}
        entries={[{ skuId: "LT24-ELS-01-DUN", quantity: 1, tradeFlag: null }]}
        loading={false}
        ownedBySkuId={{}}
      />,
    );

    const uft = screen.getByRole("radio", { name: "UFT" });
    await user.click(uft);
    expect(uft).toBeChecked();

    rerender(
      <FinishTradeList
        card={CARD}
        entries={[{ skuId: "LT24-ELS-01-DUN", quantity: 0, tradeFlag: null }]}
        loading={false}
        ownedBySkuId={{}}
      />,
    );

    expect(screen.getByRole("radio", { name: "None" })).toBeChecked();
    expect(uft).not.toBeChecked();
    expect(uft).toBeDisabled();
  });
});
