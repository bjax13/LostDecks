import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TestMemoryRouter } from "../../test/router.jsx";
import {
  DEFAULT_MANUAL_QUANTITY,
  formatCollectionQuantitySummary,
  gettingStartedTree,
} from "./gettingStartedCatalog";
import GettingStartedPage from "./index.jsx";

const mockOpenAuthModal = vi.hoisted(() => vi.fn());
const mockUseAuth = vi.hoisted(() => vi.fn());
const mockUseUserCollection = vi.hoisted(() => vi.fn());
const mockApplyBulkCollectionUpdate = vi.hoisted(() => vi.fn());

vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("../../contexts/AuthModalContext.jsx", () => ({
  useAuthModal: () => ({ openAuthModal: mockOpenAuthModal }),
}));
vi.mock("../Collection/hooks/useUserCollection", () => ({
  useUserCollection: (ownerUid) => mockUseUserCollection(ownerUid),
}));
vi.mock("../Collection/utils/bulkImport", () => ({
  applyBulkCollectionUpdate: (...args) => mockApplyBulkCollectionUpdate(...args),
}));

function renderPage() {
  return render(
    <TestMemoryRouter initialEntries={["/getting-started"]}>
      <GettingStartedPage />
    </TestMemoryRouter>,
  );
}

async function goToCardReview(user, profilePattern = /not in a spreadsheet/i) {
  await user.click(screen.getByRole("radio", { name: profilePattern }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByRole("heading", { name: /review your collection/i })).toBeInTheDocument();
}

async function setElsecallerStoryFoilsToSome(user) {
  const elsecallerCoverage = screen.getByRole("group", {
    name: /elsecaller story foils coverage/i,
  });
  await user.click(within(elsecallerCoverage).getByRole("button", { name: "All" }));
  await user.click(within(elsecallerCoverage).getByRole("button", { name: "Some" }));
}

function getSkuQuantityGroup(namePattern) {
  return screen.getByRole("group", { name: namePattern });
}

function getDecreaseSkuButton(quantityLabelPattern) {
  return screen.getByRole("button", {
    name: new RegExp(`decrease ${quantityLabelPattern}`, "i"),
  });
}

function getIncreaseSkuButton(quantityLabelPattern) {
  return screen.getByRole("button", {
    name: new RegExp(`increase ${quantityLabelPattern}`, "i"),
  });
}

function getSkuQtyElement(group) {
  return group.querySelector(".getting-started__sku-condensed-qty");
}

async function confirmNoneCoverage(user) {
  await user.click(screen.getByRole("button", { name: "Set to none" }));
}

async function cancelNoneCoverage(user) {
  await user.click(screen.getByRole("button", { name: "Cancel" }));
}

async function applyBulkQuantity(user, bulkActions, quantity) {
  const input = within(bulkActions).getByLabelText(/custom quantity for/i);
  await user.clear(input);
  if (quantity !== "") {
    await user.type(input, String(quantity));
  }
  await user.click(within(bulkActions).getByRole("button", { name: "Apply all" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: null });
  mockUseUserCollection.mockReturnValue({ entries: [], loading: false, error: null });
  mockApplyBulkCollectionUpdate.mockResolvedValue({
    created: 0,
    updated: 0,
    deleted: 0,
    issues: [],
  });
});

describe("GettingStartedPage", () => {
  it("asks the collector profile question first", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: /what best describes you/i })).toBeInTheDocument();
    expect(
      screen.getByText(/choose whether to import from a spreadsheet or review cards in the app/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /collection is in a spreadsheet/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /collection is not in a spreadsheet/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /many or all/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /do not have many/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("expands Some groups in review and supports bulk quantity edits", async () => {
    const user = userEvent.setup();
    renderPage();

    await goToCardReview(user);
    await setElsecallerStoryFoilsToSome(user);

    expect(
      screen.getByText(
        /all and none are set to 1 and 0, but can be expanded for more granular edits\. selecting some will proactively open the granular view/i,
      ),
    ).toBeInTheDocument();

    const saveButton = screen.getByRole("button", { name: "Sign in and save" });
    const actionsRow = saveButton.closest(".getting-started__actions");
    const collectionSummary = within(actionsRow).getByLabelText("Collection summary");
    const elsecallerGroup = gettingStartedTree[0].children.find(
      (group) => group.label === "Elsecaller",
    );
    const elsecallerQuantities = Object.fromEntries(
      elsecallerGroup.skus.map((sku) => [sku.skuId, "1"]),
    );
    const coverage = Object.fromEntries(
      gettingStartedTree.flatMap((section) =>
        section.children.map((group) => [
          group.id,
          group.id === elsecallerGroup.id ? "some" : "none",
        ]),
      ),
    );
    expect(collectionSummary).toHaveTextContent(
      formatCollectionQuantitySummary(
        gettingStartedTree,
        coverage,
        elsecallerQuantities,
        DEFAULT_MANUAL_QUANTITY,
      ),
    );

    const expandStoryFoils = screen.getByRole("button", { name: /^collapse story foils$/i });
    expect(expandStoryFoils).toHaveAttribute("aria-expanded", "true");
    const expandElsecaller = screen.getByRole("button", {
      name: /^collapse elsecaller story foils$/i,
    });
    expect(expandElsecaller).toHaveAttribute("aria-expanded", "true");
    const bulkActions = screen.getByRole("toolbar", {
      name: /bulk action for elsecaller story foils/i,
    });
    expect(within(bulkActions).getByText(/\d+ total \d+\/\d+ unique/)).toHaveTextContent(
      `${elsecallerGroup.skus.length} total ${elsecallerGroup.skus.length}/${elsecallerGroup.skus.length} unique`,
    );
    const foilOneGroup = getSkuQuantityGroup(/elsecaller story foils foil #1 quantity, 1$/i);
    expect(foilOneGroup).toHaveTextContent("#1 :");
    expect(getSkuQtyElement(foilOneGroup)).toHaveTextContent("1");
    expect(screen.getByText("Elsecaller Story Foils")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Foil" })).not.toBeInTheDocument();
    expect(screen.queryByText(/^foil$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/LT24-ELS-01-FOIL/i)).not.toBeInTheDocument();

    const storyFoilsSection = screen.getByRole("button", { name: /^collapse story foils$/i });
    expect(
      within(storyFoilsSection.closest(".getting-started__tree-row")).queryByText(
        /\d+ total \d+\/\d+ unique/,
      ),
    ).not.toBeInTheDocument();

    const storyDunGroup = gettingStartedTree[1].children[0];
    const collapsedDunGroup = screen.getByRole("button", {
      name: new RegExp(`^expand ${storyDunGroup.label} story dun$`, "i"),
    });
    expect(collapsedDunGroup).toHaveAttribute("aria-expanded", "false");
    const collapsedDunRow = collapsedDunGroup.closest(".getting-started__tree-row");
    expect(
      within(collapsedDunRow).queryByText(/\d+ total \d+\/\d+ unique/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", {
        name: new RegExp(`${storyDunGroup.label.toLowerCase()} story dun dun #1 quantity`, "i"),
      }),
    ).not.toBeInTheDocument();

    await applyBulkQuantity(user, bulkActions, 0);
    expect(within(bulkActions).getByText(/\d+ total \d+\/\d+ unique/)).toHaveTextContent(
      `0 total 0/${elsecallerGroup.skus.length} unique`,
    );
    expect(collectionSummary).toHaveTextContent(
      formatCollectionQuantitySummary(
        gettingStartedTree,
        coverage,
        Object.fromEntries(elsecallerGroup.skus.map((sku) => [sku.skuId, "0"])),
        DEFAULT_MANUAL_QUANTITY,
      ),
    );
    expect(getSkuQuantityGroup(/elsecaller story foils foil #1 quantity, 0$/i)).toBeInTheDocument();
    expect(getSkuQuantityGroup(/elsecaller story foils foil #2 quantity, 0$/i)).toBeInTheDocument();

    await applyBulkQuantity(user, bulkActions, 1);
    expect(getSkuQuantityGroup(/elsecaller story foils foil #1 quantity, 1$/i)).toBeInTheDocument();

    await applyBulkQuantity(user, bulkActions, 3);
    expect(within(bulkActions).getByText(/\d+ total \d+\/\d+ unique/)).toHaveTextContent(
      `${elsecallerGroup.skus.length * 3} total ${elsecallerGroup.skus.length}/${elsecallerGroup.skus.length} unique`,
    );
    expect(getSkuQuantityGroup(/elsecaller story foils foil #1 quantity, 3$/i)).toBeInTheDocument();

    await user.click(getIncreaseSkuButton("elsecaller story foils foil #1 quantity"));
    expect(within(bulkActions).getByText(/\d+ total \d+\/\d+ unique/)).toHaveTextContent(
      `${elsecallerGroup.skus.length * 3 + 1} total ${elsecallerGroup.skus.length}/${elsecallerGroup.skus.length} unique`,
    );
    expect(getSkuQuantityGroup(/elsecaller story foils foil #1 quantity, 4$/i)).toBeInTheDocument();
    await user.click(getDecreaseSkuButton("elsecaller story foils foil #1 quantity"));
    expect(getSkuQuantityGroup(/elsecaller story foils foil #1 quantity, 3$/i)).toBeInTheDocument();
  });

  it("defaults a non-spreadsheet collector to None", async () => {
    const user = userEvent.setup();
    renderPage();

    await goToCardReview(user);

    const storyDunGroup = gettingStartedTree[1].children[0];
    const storyDunTitle = `${storyDunGroup.label} Story Dun`;
    const storyDunCoverage = screen.getByRole("group", { name: `${storyDunTitle} coverage` });
    expect(within(storyDunCoverage).getByRole("button", { name: "None" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("jumps to card review from the progress indicator with manual defaults", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /card review/i }));

    expect(screen.getByRole("heading", { name: /review your collection/i })).toBeInTheDocument();

    const storyDunGroup = gettingStartedTree[1].children[0];
    const storyDunTitle = `${storyDunGroup.label} Story Dun`;
    const storyDunCoverage = screen.getByRole("group", { name: `${storyDunTitle} coverage` });
    expect(within(storyDunCoverage).getByRole("button", { name: "None" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: /about you/i }));
    expect(
      screen.getByRole("radio", { name: /collection is not in a spreadsheet/i }),
    ).toBeChecked();
  });

  it("lets collectors jump back to earlier steps from the progress indicator", async () => {
    const user = userEvent.setup();
    renderPage();

    await goToCardReview(user);
    await setElsecallerStoryFoilsToSome(user);

    await user.click(screen.getByRole("button", { name: /about you/i }));
    expect(screen.getByRole("heading", { name: /what best describes you/i })).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /collection is not in a spreadsheet/i }),
    ).toBeChecked();

    await user.click(screen.getByRole("button", { name: /card review/i }));
    expect(screen.getByRole("heading", { name: /review your collection/i })).toBeInTheDocument();
  });

  it("sends spreadsheet collectors to the bulk import explanation", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("radio", { name: /collection is in a spreadsheet/i }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(
      screen.getByRole("heading", { name: /prepare your collection for bulk import/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/export as csv and upload/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /sign in to import/i }));
    expect(mockOpenAuthModal).toHaveBeenCalledWith({ reason: "getting-started-import" });
  });

  it("toggles card review group rows when clicking the row title", async () => {
    const user = userEvent.setup();
    renderPage();

    await goToCardReview(user);

    const storyDunGroup = gettingStartedTree[1].children[0];
    const storyDunTitle = `${storyDunGroup.label} Story Dun`;
    const expandStoryDun = screen.getByRole("button", {
      name: new RegExp(`^expand ${storyDunTitle}$`, "i"),
    });
    expect(expandStoryDun).toHaveAttribute("aria-expanded", "false");

    const storyDunRow = expandStoryDun.closest(".getting-started__tree-row");
    await user.click(within(storyDunRow).getByText(storyDunTitle));
    expect(
      screen.getByRole("button", { name: new RegExp(`^collapse ${storyDunTitle}$`, "i") }),
    ).toHaveAttribute("aria-expanded", "true");

    await user.click(within(storyDunRow).getByText(storyDunTitle));
    expect(
      screen.getByRole("button", { name: new RegExp(`^expand ${storyDunTitle}$`, "i") }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("does not toggle group expand state when clicking coverage controls", async () => {
    const user = userEvent.setup();
    renderPage();

    await goToCardReview(user);

    const storyDunGroup = gettingStartedTree[1].children[0];
    const storyDunTitle = `${storyDunGroup.label} Story Dun`;
    const storyDunCoverage = screen.getByRole("group", { name: `${storyDunTitle} coverage` });
    const expandStoryDun = screen.getByRole("button", {
      name: new RegExp(`^expand ${storyDunTitle}$`, "i"),
    });
    expect(expandStoryDun).toHaveAttribute("aria-expanded", "false");

    await user.click(within(storyDunCoverage).getByRole("button", { name: "All" }));
    expect(
      screen.getByRole("button", { name: new RegExp(`^expand ${storyDunTitle}$`, "i") }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(within(storyDunCoverage).getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(within(storyDunCoverage).getByRole("button", { name: "None" }));
    expect(
      screen.getByRole("button", { name: new RegExp(`^expand ${storyDunTitle}$`, "i") }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("dialog", { name: /set all cards to zero/i })).toBeInTheDocument();
    expect(within(storyDunCoverage).getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await cancelNoneCoverage(user);

    await user.click(within(storyDunCoverage).getByRole("button", { name: "All" }));
    expect(
      screen.getByRole("button", { name: new RegExp(`^expand ${storyDunTitle}$`, "i") }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(within(storyDunCoverage).getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("shows coverage controls on card review group rows", async () => {
    const user = userEvent.setup();
    renderPage();

    await goToCardReview(user);

    const storyDunGroup = gettingStartedTree[1].children[0];
    const storyDunTitle = `${storyDunGroup.label} Story Dun`;
    const storyDunCoverage = screen.getByRole("group", { name: `${storyDunTitle} coverage` });
    expect(within(storyDunCoverage).getByRole("button", { name: "None" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(within(storyDunCoverage).getByRole("button", { name: "All" }));
    await user.click(within(storyDunCoverage).getByRole("button", { name: "Some" }));
    expect(
      screen.getByRole("button", { name: new RegExp(`^collapse ${storyDunTitle}$`, "i") }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      getSkuQuantityGroup(new RegExp(`${storyDunTitle.toLowerCase()} dun #1 quantity, 1$`, "i")),
    ).toBeInTheDocument();
    expect(within(storyDunCoverage).getByRole("button", { name: "Some" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(within(storyDunCoverage).getByRole("button", { name: "None" }));
    expect(screen.getByRole("dialog", { name: /set all cards to zero/i })).toBeInTheDocument();
    await confirmNoneCoverage(user);
    expect(
      screen.getByRole("button", { name: new RegExp(`^collapse ${storyDunTitle}$`, "i") }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      getSkuQuantityGroup(new RegExp(`${storyDunTitle.toLowerCase()} dun #1 quantity, 0$`, "i")),
    ).toBeInTheDocument();
    expect(within(storyDunCoverage).getByRole("button", { name: "None" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(within(storyDunCoverage).getByRole("button", { name: "All" }));
    expect(
      screen.getByRole("button", { name: new RegExp(`^collapse ${storyDunTitle}$`, "i") }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      getSkuQuantityGroup(new RegExp(`${storyDunTitle.toLowerCase()} dun #1 quantity, 1$`, "i")),
    ).toBeInTheDocument();
    expect(within(storyDunCoverage).getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("keeps quantities above 1 when selecting All on a group", async () => {
    const user = userEvent.setup();
    renderPage();

    await goToCardReview(user);

    const storyDunGroup = gettingStartedTree[1].children[0];
    const storyDunTitle = `${storyDunGroup.label} Story Dun`;
    const storyDunCoverage = screen.getByRole("group", { name: `${storyDunTitle} coverage` });

    await user.click(within(storyDunCoverage).getByRole("button", { name: "Some" }));

    const dunOneGroup = getSkuQuantityGroup(
      new RegExp(`${storyDunTitle.toLowerCase()} dun #1 quantity, 0$`, "i"),
    );
    const dunTwoGroup = getSkuQuantityGroup(
      new RegExp(`${storyDunTitle.toLowerCase()} dun #2 quantity, 0$`, "i"),
    );

    expect(getSkuQtyElement(dunOneGroup)).toHaveTextContent("0");
    expect(getSkuQtyElement(dunTwoGroup)).toHaveTextContent("0");

    await user.click(getIncreaseSkuButton(`${storyDunTitle.toLowerCase()} dun #1 quantity`));
    await user.click(getIncreaseSkuButton(`${storyDunTitle.toLowerCase()} dun #1 quantity`));
    expect(
      getSkuQuantityGroup(new RegExp(`${storyDunTitle.toLowerCase()} dun #1 quantity, 2$`, "i")),
    ).toBeInTheDocument();

    await user.click(within(storyDunCoverage).getByRole("button", { name: "All" }));

    expect(
      getSkuQuantityGroup(new RegExp(`${storyDunTitle.toLowerCase()} dun #1 quantity, 2$`, "i")),
    ).toBeInTheDocument();
    expect(
      getSkuQuantityGroup(new RegExp(`${storyDunTitle.toLowerCase()} dun #2 quantity, 1$`, "i")),
    ).toBeInTheDocument();
    expect(within(storyDunCoverage).getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("adjusts quantities with + and - buttons", async () => {
    const user = userEvent.setup();
    renderPage();

    await goToCardReview(user);
    await setElsecallerStoryFoilsToSome(user);

    const foilOneGroup = getSkuQuantityGroup(/elsecaller story foils foil #1 quantity, 1$/i);
    expect(getSkuQtyElement(foilOneGroup)).toHaveTextContent("1");

    await user.click(getIncreaseSkuButton("elsecaller story foils foil #1 quantity"));
    expect(getSkuQuantityGroup(/elsecaller story foils foil #1 quantity, 2$/i)).toBeInTheDocument();

    await user.click(getDecreaseSkuButton("elsecaller story foils foil #1 quantity"));
    expect(getSkuQuantityGroup(/elsecaller story foils foil #1 quantity, 1$/i)).toBeInTheDocument();

    await user.click(getDecreaseSkuButton("elsecaller story foils foil #1 quantity"));
    expect(getSkuQuantityGroup(/elsecaller story foils foil #1 quantity, 0$/i)).toBeInTheDocument();
    await user.click(getDecreaseSkuButton("elsecaller story foils foil #1 quantity"));
    expect(getSkuQuantityGroup(/elsecaller story foils foil #1 quantity, 0$/i)).toBeInTheDocument();
  });

  it("shows nonsense variant under-lines without letter prefixes in condensed SKU labels", async () => {
    const user = userEvent.setup();
    renderPage();

    await goToCardReview(user);

    const elsecallerTitle = "Elsecaller Nonsense (Dun)";
    const elsecallerCoverage = screen.getByRole("group", {
      name: `${elsecallerTitle} coverage`,
    });
    await user.click(within(elsecallerCoverage).getByRole("button", { name: "All" }));
    await user.click(within(elsecallerCoverage).getByRole("button", { name: "Some" }));

    const mouseCell = getSkuQuantityGroup(/elsecaller nonsense \(dun\) mouse #54 quantity, 1$/i);
    const whaleCell = getSkuQuantityGroup(/elsecaller nonsense \(dun\) whale #54 quantity, 1$/i);
    const uniqueCell = getSkuQuantityGroup(/elsecaller nonsense \(dun\) #50 quantity, 1$/i);

    expect(within(mouseCell).getByText("#54 :")).toBeInTheDocument();
    expect(within(mouseCell).getByText("mouse")).toBeInTheDocument();
    expect(mouseCell).toHaveClass("has-variant");
    expect(within(whaleCell).getByText("#54 :")).toBeInTheDocument();
    expect(within(whaleCell).getByText("whale")).toBeInTheDocument();
    expect(whaleCell).toHaveClass("has-variant");
    expect(within(uniqueCell).getByText("#50 :")).toBeInTheDocument();
    expect(within(uniqueCell).queryByText("mouse")).not.toBeInTheDocument();
    expect(uniqueCell).not.toHaveClass("has-variant");
  });

  it("keeps All coverage when bulk-setting positive quantities on an All group", async () => {
    const user = userEvent.setup();
    renderPage();

    await goToCardReview(user);

    const elsecallerGroup = gettingStartedTree[0].children.find(
      (group) => group.label === "Elsecaller",
    );
    const elsecallerTitle = "Elsecaller Story Foils";
    const elsecallerCoverage = screen.getByRole("group", {
      name: `${elsecallerTitle} coverage`,
    });
    await user.click(within(elsecallerCoverage).getByRole("button", { name: "All" }));
    expect(within(elsecallerCoverage).getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const expandElsecaller = screen.getByRole("button", {
      name: /^expand elsecaller story foils$/i,
    });
    await user.click(expandElsecaller);

    const bulkActions = screen.getByRole("toolbar", {
      name: /bulk action for elsecaller story foils/i,
    });
    await applyBulkQuantity(user, bulkActions, 1);

    expect(within(elsecallerCoverage).getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(getSkuQuantityGroup(/elsecaller story foils foil #1 quantity, 1$/i)).toBeInTheDocument();

    await applyBulkQuantity(user, bulkActions, 2);

    expect(within(elsecallerCoverage).getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(getSkuQuantityGroup(/elsecaller story foils foil #1 quantity, 2$/i)).toBeInTheDocument();
    expect(elsecallerGroup.skus.length).toBeGreaterThan(0);
  });

  it("moves All coverage to Some when one SKU is set to zero", async () => {
    const user = userEvent.setup();
    renderPage();

    await goToCardReview(user);

    const elsecallerTitle = "Elsecaller Story Foils";
    const elsecallerCoverage = screen.getByRole("group", {
      name: `${elsecallerTitle} coverage`,
    });
    await user.click(within(elsecallerCoverage).getByRole("button", { name: "All" }));
    expect(within(elsecallerCoverage).getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const expandElsecaller = screen.getByRole("button", {
      name: /^expand elsecaller story foils$/i,
    });
    await user.click(expandElsecaller);

    await user.click(getDecreaseSkuButton("elsecaller story foils foil #1 quantity"));

    expect(within(elsecallerCoverage).getByRole("button", { name: "Some" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(getSkuQuantityGroup(/elsecaller story foils foil #1 quantity, 0$/i)).toBeInTheDocument();
    expect(getSkuQuantityGroup(/elsecaller story foils foil #2 quantity, 1$/i)).toBeInTheDocument();
  });

  it("moves None coverage to Some when a SKU quantity is increased above zero", async () => {
    const user = userEvent.setup();
    renderPage();

    await goToCardReview(user);

    const storyDunGroup = gettingStartedTree[1].children[0];
    const storyDunTitle = `${storyDunGroup.label} Story Dun`;
    const storyDunCoverage = screen.getByRole("group", { name: `${storyDunTitle} coverage` });
    expect(within(storyDunCoverage).getByRole("button", { name: "None" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const expandStoryDun = screen.getByRole("button", {
      name: new RegExp(`^expand ${storyDunTitle}$`, "i"),
    });
    await user.click(expandStoryDun);

    expect(
      getSkuQuantityGroup(new RegExp(`${storyDunTitle.toLowerCase()} dun #1 quantity, 0$`, "i")),
    ).toBeInTheDocument();

    await user.click(getIncreaseSkuButton(`${storyDunTitle.toLowerCase()} dun #1 quantity`));

    expect(within(storyDunCoverage).getByRole("button", { name: "Some" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      getSkuQuantityGroup(new RegExp(`${storyDunTitle.toLowerCase()} dun #1 quantity, 1$`, "i")),
    ).toBeInTheDocument();
  });

  it("prompts before setting a group to None and cancels without changes", async () => {
    const user = userEvent.setup();
    renderPage();

    await goToCardReview(user);

    const storyDunGroup = gettingStartedTree[1].children[0];
    const storyDunTitle = `${storyDunGroup.label} Story Dun`;
    const storyDunCoverage = screen.getByRole("group", { name: `${storyDunTitle} coverage` });
    await user.click(within(storyDunCoverage).getByRole("button", { name: "All" }));
    expect(within(storyDunCoverage).getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(within(storyDunCoverage).getByRole("button", { name: "None" }));
    expect(screen.getByRole("dialog", { name: /set all cards to zero/i })).toBeInTheDocument();
    expect(screen.getByText(storyDunTitle, { selector: "strong" })).toBeInTheDocument();

    await cancelNoneCoverage(user);
    expect(
      screen.queryByRole("dialog", { name: /set all cards to zero/i }),
    ).not.toBeInTheDocument();
    expect(within(storyDunCoverage).getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("applies None after confirmation and clears quantities", async () => {
    const user = userEvent.setup();
    renderPage();

    await goToCardReview(user);

    const storyDunGroup = gettingStartedTree[1].children[0];
    const storyDunTitle = `${storyDunGroup.label} Story Dun`;
    const storyDunCoverage = screen.getByRole("group", { name: `${storyDunTitle} coverage` });

    await user.click(within(storyDunCoverage).getByRole("button", { name: "All" }));
    await user.click(within(storyDunCoverage).getByRole("button", { name: "None" }));
    await confirmNoneCoverage(user);

    expect(within(storyDunCoverage).getByRole("button", { name: "None" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const expandStoryDun = screen.getByRole("button", {
      name: new RegExp(`^expand ${storyDunTitle}$`, "i"),
    });
    await user.click(expandStoryDun);
    expect(
      getSkuQuantityGroup(new RegExp(`${storyDunTitle.toLowerCase()} dun #1 quantity, 0$`, "i")),
    ).toBeInTheDocument();
  });

  it("does not prompt when None is already selected", async () => {
    const user = userEvent.setup();
    renderPage();

    await goToCardReview(user);

    const storyDunGroup = gettingStartedTree[1].children[0];
    const storyDunTitle = `${storyDunGroup.label} Story Dun`;
    const storyDunCoverage = screen.getByRole("group", { name: `${storyDunTitle} coverage` });
    expect(within(storyDunCoverage).getByRole("button", { name: "None" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(within(storyDunCoverage).getByRole("button", { name: "None" }));
    expect(
      screen.queryByRole("dialog", { name: /set all cards to zero/i }),
    ).not.toBeInTheDocument();
  });

  it("cancels None confirmation with Escape", async () => {
    const user = userEvent.setup();
    renderPage();

    await goToCardReview(user);

    const storyDunGroup = gettingStartedTree[1].children[0];
    const storyDunTitle = `${storyDunGroup.label} Story Dun`;
    const storyDunCoverage = screen.getByRole("group", { name: `${storyDunTitle} coverage` });

    await user.click(within(storyDunCoverage).getByRole("button", { name: "All" }));
    await user.click(within(storyDunCoverage).getByRole("button", { name: "None" }));
    expect(screen.getByRole("dialog", { name: /set all cards to zero/i })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: /set all cards to zero/i }),
    ).not.toBeInTheDocument();
    expect(within(storyDunCoverage).getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("saves a zeroed default collection for a signed-in non-spreadsheet collector", async () => {
    mockUseAuth.mockReturnValue({ user: { uid: "user-1" } });
    mockUseUserCollection.mockReturnValue({
      entries: [{ id: "existing", skuId: "LT24-ELS-01-DUN", quantity: 1 }],
      loading: false,
      error: null,
    });
    const user = userEvent.setup();
    renderPage();

    await goToCardReview(user);
    await user.click(screen.getByRole("button", { name: "Save collection" }));

    expect(mockApplyBulkCollectionUpdate).toHaveBeenCalledWith({
      ownerUid: "user-1",
      rows: expect.arrayContaining([expect.objectContaining({ quantity: "0" })]),
      existingEntries: [{ id: "existing", skuId: "LT24-ELS-01-DUN", quantity: 1 }],
    });
  });
});
