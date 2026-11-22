import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TestMemoryRouter } from "../../test/router.jsx";
import {
  COLLECTIBLE_TYPE_BOTH,
  DEFAULT_MANUAL_QUANTITY,
  filterGettingStartedTree,
  formatCollectionQuantitySummary,
  getCondensedSkuListStyle,
  gettingStartedTree,
} from "./gettingStartedCatalog";
import GettingStartedPage from "./index.jsx";

const mockOpenAuthModal = vi.hoisted(() => vi.fn());
const mockUseAuth = vi.hoisted(() => vi.fn());
const mockUseUserCollection = vi.hoisted(() => vi.fn());
const mockApplyBulkCollectionUpdate = vi.hoisted(() => vi.fn());
const mockCaptureEvent = vi.hoisted(() => vi.fn());

vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("../../contexts/AuthModalContext.jsx", () => ({
  useAuthModal: () => ({ openAuthModal: mockOpenAuthModal }),
}));
vi.mock("../Collection/hooks/useUserCollection", () => ({
  useUserCollection: (ownerUid) => mockUseUserCollection(ownerUid),
}));
vi.mock("../Collection/utils/bulkImport", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    applyBulkCollectionUpdate: (...args) => mockApplyBulkCollectionUpdate(...args),
  };
});
vi.mock("../../analytics/posthog.js", () => ({
  captureEvent: (...args) => mockCaptureEvent(...args),
}));

function setupUser() {
  return userEvent.setup({ delay: null });
}

function renderPage(path = "/getting-started") {
  return render(
    <TestMemoryRouter initialEntries={[path]}>
      <GettingStartedPage />
    </TestMemoryRouter>,
  );
}

async function chooseCollectibleType(user, collectiblePattern = /^both$/i) {
  await user.click(screen.getByRole("radio", { name: collectiblePattern }));
}

async function goToCardReview(
  user,
  {
    collectiblePattern = /^both$/i,
    profilePattern = /not in a spreadsheet/i,
    reviewHeading = /review your collection/i,
  } = {},
) {
  await chooseCollectibleType(user, collectiblePattern);
  await user.click(screen.getByRole("radio", { name: profilePattern }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByRole("heading", { name: reviewHeading })).toBeInTheDocument();
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
  fireEvent.change(input, { target: { value: String(quantity) } });
  const applyAll = within(bulkActions).getByRole("button", { name: "Apply all" });
  expect(applyAll).toBeEnabled();
  await user.click(applyAll);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: null });
  mockUseUserCollection.mockReturnValue({ entries: [], status: "ready", error: null });
  mockApplyBulkCollectionUpdate.mockResolvedValue({
    created: 0,
    updated: 0,
    deleted: 0,
    issues: [],
  });
});

// Coverage + GitHub-hosted runners can push these large-tree interactions past Vitest's 5s default.
describe("GettingStartedPage", { timeout: 20_000 }, () => {
  it("opens the quick pin picker from collect=pins", () => {
    renderPage("/getting-started?collect=pins&utm_source=qr&utm_campaign=nexus-2026");
    expect(screen.getByRole("heading", { name: /Which pins do you have/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Find my trades" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /what best describes you/i }),
    ).not.toBeInTheDocument();
  });

  it("seeds the quick pin picker from have= SKU CSV", () => {
    renderPage("/getting-started?collect=pins&have=PIN-CF-01:2,PIN-KROG-05");
    expect(screen.getByText(/2 marked Have/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ChasmFriends/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("skips step 1 into card review for collect=cards", () => {
    renderPage("/getting-started?collect=cards");
    expect(screen.getByRole("heading", { name: /Review your cards/i })).toBeInTheDocument();
  });

  it("asks collectible type then the collector profile question first", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: /what best describes you/i })).toBeInTheDocument();
    expect(screen.getByText("ShardStash setup")).toBeInTheDocument();
    expect(
      screen.getByText(/tell us what you collect, then choose how you want to start/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^pins$/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^story deck cards$/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^both$/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("radio", { name: /collection is in a spreadsheet/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("reveals spreadsheet or manual options after choosing a collectible type", async () => {
    const user = setupUser();
    renderPage();

    await chooseCollectibleType(user, /^story deck cards$/i);
    const spreadsheetOption = screen.getByRole("radio", {
      name: /collection is in a spreadsheet/i,
    });
    expect(spreadsheetOption).toBeEnabled();
    expect(
      screen.getByRole("radio", { name: /collection is not in a spreadsheet/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();

    await chooseCollectibleType(user, /^pins$/i);
    expect(screen.getByRole("radio", { name: /collection is in a spreadsheet/i })).toBeDisabled();
    expect(
      screen.getByRole("radio", { name: /collection is not in a spreadsheet/i }),
    ).toBeChecked();
    expect(
      screen.getByText(/spreadsheet import is for story deck cards only/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("keeps spreadsheet option visible but disabled for pins-only collectors", async () => {
    const user = setupUser();
    renderPage();

    await chooseCollectibleType(user, /^both$/i);
    await user.click(screen.getByRole("radio", { name: /collection is in a spreadsheet/i }));
    expect(screen.getByRole("radio", { name: /collection is in a spreadsheet/i })).toBeChecked();

    await chooseCollectibleType(user, /^pins$/i);
    const spreadsheetOption = screen.getByRole("radio", {
      name: /collection is in a spreadsheet/i,
    });
    expect(spreadsheetOption).toBeDisabled();
    expect(spreadsheetOption).not.toBeChecked();
    expect(
      screen.getByRole("radio", { name: /collection is not in a spreadsheet/i }),
    ).toBeChecked();
  });

  it("expands Some groups in review and supports bulk quantity edits", async () => {
    const user = setupUser();
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
    const reviewTree = filterGettingStartedTree(gettingStartedTree, COLLECTIBLE_TYPE_BOTH);
    const coverage = Object.fromEntries(
      reviewTree.flatMap((section) =>
        section.children.map((group) => [
          group.id,
          group.id === elsecallerGroup.id ? "some" : "none",
        ]),
      ),
    );
    expect(collectionSummary).toHaveTextContent(
      formatCollectionQuantitySummary(
        reviewTree,
        coverage,
        elsecallerQuantities,
        DEFAULT_MANUAL_QUANTITY,
        COLLECTIBLE_TYPE_BOTH,
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
        COLLECTIBLE_TYPE_BOTH,
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
    const user = setupUser();
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
    const user = setupUser();
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

  it("re-seeds the review tree when collectible type changes before using the progress indicator", async () => {
    const user = setupUser();
    renderPage();

    await goToCardReview(user, {
      collectiblePattern: /^story deck cards$/i,
      reviewHeading: /review your cards/i,
    });
    expect(screen.queryByText("ChasmFriends Pins")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /about you/i }));
    await chooseCollectibleType(user, /^both$/i);

    await user.click(screen.getByRole("button", { name: /card review/i }));

    expect(screen.getByRole("heading", { name: /review your collection/i })).toBeInTheDocument();
    expect(screen.getByText("ChasmFriends Pins")).toBeInTheDocument();
  });

  it("lets collectors jump back to earlier steps from the progress indicator", async () => {
    const user = setupUser();
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
    expect(
      within(screen.getByRole("group", { name: /elsecaller story foils coverage/i })).getByRole(
        "button",
        { name: "Some" },
      ),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("resets manual review when the signed-in account changes", async () => {
    const entriesByUser = {
      "user-a": [{ id: "LT24-CHM-01-DUN", quantity: 1 }],
      "user-b": [],
    };

    function AccountSwitchHarness() {
      const [uid, setUid] = useState("user-a");
      mockUseAuth.mockImplementation(() => ({ user: uid ? { uid } : null }));
      mockUseUserCollection.mockImplementation(() => ({
        entries: uid ? (entriesByUser[uid] ?? []) : [],
        status: "ready",
        error: null,
      }));
      mockApplyBulkCollectionUpdate.mockResolvedValue({
        created: 0,
        updated: 0,
        deleted: 0,
        issues: [],
      });

      return (
        <TestMemoryRouter initialEntries={["/getting-started"]}>
          <button type="button" onClick={() => setUid("user-b")}>
            Switch account
          </button>
          <GettingStartedPage />
        </TestMemoryRouter>
      );
    }

    const user = setupUser();
    render(<AccountSwitchHarness />);

    await goToCardReview(user);

    const elsecallerCoverage = screen.getByRole("group", {
      name: /elsecaller story foils coverage/i,
    });
    await user.click(within(elsecallerCoverage).getByRole("button", { name: "All" }));
    expect(within(elsecallerCoverage).getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Switch account" }));

    await waitFor(() => {
      expect(
        within(screen.getByRole("group", { name: /elsecaller story foils coverage/i })).getByRole(
          "button",
          { name: "None" },
        ),
      ).toHaveAttribute("aria-pressed", "true");
    });

    await user.click(screen.getByRole("button", { name: "Save collection" }));
    const call = mockApplyBulkCollectionUpdate.mock.calls.at(-1)?.[0];
    expect(call?.ownerUid).toBe("user-b");
    expect(call?.rows ?? []).toEqual([]);
  });

  it("sends spreadsheet collectors to the bulk import explanation", async () => {
    const user = setupUser();
    renderPage();

    await chooseCollectibleType(user, /^both$/i);
    await user.click(screen.getByRole("radio", { name: /collection is in a spreadsheet/i }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(
      screen.getByRole("heading", { name: /prepare your collection for bulk import/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/match every row to a ShardStash SKU before saving/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Story Deck card rows are supported here; add pins later from your collection/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/export as csv and upload/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /sign in to import/i }));
    expect(mockOpenAuthModal).toHaveBeenCalledWith({ reason: "getting-started-import" });
  });

  it("toggles card review group rows when clicking the row title", async () => {
    const user = setupUser();
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
    const user = setupUser();
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
    const user = setupUser();
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
    const user = setupUser();
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
    const user = setupUser();
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
    const user = setupUser();
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

    const cardList = mouseCell.closest(".getting-started__sku-list");
    const cardCount = cardList.querySelectorAll(".getting-started__sku-condensed").length;
    expect(cardList).toHaveStyle(getCondensedSkuListStyle(cardCount));
    expect(within(mouseCell).getByText("#54 :")).not.toHaveAttribute("title");
  });

  it("keeps All coverage when bulk-setting positive quantities on an All group", async () => {
    const user = setupUser();
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

  it("rejects negative bulk Apply all quantities and keeps positive Apply all working", async () => {
    const user = setupUser();
    renderPage();

    await goToCardReview(user);
    await setElsecallerStoryFoilsToSome(user);

    const bulkActions = screen.getByRole("toolbar", {
      name: /bulk action for elsecaller story foils/i,
    });
    const input = within(bulkActions).getByLabelText(/custom quantity for/i);
    const applyAll = within(bulkActions).getByRole("button", { name: "Apply all" });

    expect(input).toHaveAttribute("min", "0");
    expect(input).toHaveAttribute("max", "999");
    expect(input).toHaveAttribute("step", "1");

    await user.clear(input);
    await user.type(input, "-5");

    expect(input).toHaveValue(-5);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(applyAll).toBeDisabled();
    expect(within(bulkActions).getByRole("alert")).toHaveTextContent(
      /quantity must be between 0 and 999/i,
    );
    expect(getSkuQuantityGroup(/elsecaller story foils foil #1 quantity, 1$/i)).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "-5" } });
    fireEvent.input(input, { target: { value: "-5" } });
    expect(applyAll).toBeDisabled();
    expect(within(bulkActions).getByRole("alert")).toBeInTheDocument();

    await applyBulkQuantity(user, bulkActions, 2);

    expect(getSkuQuantityGroup(/elsecaller story foils foil #1 quantity, 2$/i)).toBeInTheDocument();
    expect(within(bulkActions).queryByRole("alert")).not.toBeInTheDocument();
    expect(within(bulkActions).getByRole("button", { name: "Apply all" })).toBeEnabled();
  });

  it("clamps bulk custom quantity above 999 so Apply all cannot set more than the collection ceiling", async () => {
    const user = setupUser();
    renderPage();

    await goToCardReview(user);
    await setElsecallerStoryFoilsToSome(user);

    const bulkActions = screen.getByRole("toolbar", {
      name: /bulk action for elsecaller story foils/i,
    });
    const input = within(bulkActions).getByLabelText(/custom quantity for/i);
    const applyAll = within(bulkActions).getByRole("button", { name: "Apply all" });

    fireEvent.change(input, { target: { value: "1000" } });
    expect(input).toHaveValue(999);
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(applyAll).toBeEnabled();
    expect(within(bulkActions).queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.input(input, { target: { value: "9999" } });
    expect(input).toHaveValue(999);

    await user.click(applyAll);
    expect(
      getSkuQuantityGroup(/elsecaller story foils foil #1 quantity, 999$/i),
    ).toBeInTheDocument();
  });

  it("moves All coverage to Some when one SKU is set to zero", async () => {
    const user = setupUser();
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
    const user = setupUser();
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
    const user = setupUser();
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
    const user = setupUser();
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
    const user = setupUser();
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
    const user = setupUser();
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

  it("includes ChasmFriends Pins under Pin Collections in manual review", async () => {
    const user = setupUser();
    renderPage();

    await goToCardReview(user);

    const pinsSection = gettingStartedTree.find((section) => section.id === "pins");
    const pinsGroup = pinsSection.children[0];
    const pinsTitle = "ChasmFriends Pins";

    expect(screen.getByRole("button", { name: /^collapse pin collections$/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText("Pin Collections")).toBeInTheDocument();
    expect(screen.getByText(pinsTitle)).toBeInTheDocument();

    const pinsCoverage = screen.getByRole("group", { name: `${pinsTitle} coverage` });
    expect(within(pinsCoverage).getByRole("button", { name: "None" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(within(pinsCoverage).getByRole("button", { name: "Some" }));
    expect(within(pinsCoverage).getByRole("button", { name: "Some" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(within(pinsCoverage).getByRole("button", { name: "All" }));
    expect(
      getSkuQuantityGroup(new RegExp(`${pinsTitle} Shredhead quantity, 1$`, "i")),
    ).toBeInTheDocument();
    expect(pinsGroup.skus).toHaveLength(5);
  });

  it("shows only Pin Collections for pins-only collectors", async () => {
    const user = setupUser();
    renderPage();

    await goToCardReview(user, {
      collectiblePattern: /^pins$/i,
      reviewHeading: /review your pins/i,
    });

    expect(screen.getByRole("button", { name: /^collapse pin collections$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /story foils/i })).not.toBeInTheDocument();
    expect(screen.getByText("ChasmFriends Pins")).toBeInTheDocument();
  });

  it("shows full pin names with a title and a phone-friendly pin grid", async () => {
    const user = setupUser();
    renderPage();

    await goToCardReview(user, {
      collectiblePattern: /^pins$/i,
      reviewHeading: /review your pins/i,
    });

    async function openGroup(title) {
      const coverage = screen.getByRole("group", { name: `${title} coverage` });
      await user.click(within(coverage).getByRole("button", { name: "Some" }));
    }

    await openGroup("Character Pin Series 4");
    const captain = getSkuQuantityGroup(/character pin series 4 captain tress quantity, 0$/i);
    expect(within(captain).getByText("Captain Tress :")).toHaveAttribute("title", "Captain Tress");
    expect(captain).toHaveClass("has-name-label");
    expect(
      within(captain.closest(".getting-started__sku-list")).getByText("Sazed :"),
    ).toHaveAttribute("title", "Sazed");
    expect(captain.closest(".getting-started__sku-list")).toHaveStyle({
      "--sku-cols": "4",
      "--sku-rows": "1",
      "--sku-cols-narrow": "1",
      "--sku-rows-narrow": "4",
    });
    expect(screen.queryByText("Series 4 - Pin 3 - :")).not.toBeInTheDocument();
    expect(screen.queryByText("Series 4 - Pin 0 - :")).not.toBeInTheDocument();

    await openGroup("Scene Pin");
    const sceneName = "Worldhopper Ball 2024 Scene Pin: Adolin and Shallan";
    const scene = getSkuQuantityGroup(
      new RegExp(`scene pin ${sceneName.toLowerCase()} quantity, 0$`, "i"),
    );
    expect(within(scene).getByText(`${sceneName} :`)).toHaveAttribute("title", sceneName);
    expect(scene.closest(".getting-started__sku-list")).toHaveStyle({
      "--sku-cols": "2",
      "--sku-cols-narrow": "1",
    });

    await openGroup("Sandershelf Pins");
    const tress = getSkuQuantityGroup(/sandershelf pins tress quantity, 0$/i);
    expect(within(tress).getByText("Tress :")).toHaveAttribute("title", "Tress");
    expect(screen.queryByText("Sandershelf - Pin 1 - Tress :")).not.toBeInTheDocument();

    await openGroup("Roshar Pins");
    const australian = getSkuQuantityGroup(/roshar pins wind and truth - australian quantity, 0$/i);
    expect(within(australian).getByText("Wind and Truth - Australian :")).toHaveAttribute(
      "title",
      "Wind and Truth - Australian",
    );

    await openGroup("Cytoverse Pins");
    const ddfUs = getSkuQuantityGroup(/cytoverse pins ddf two-tone \(us\) quantity, 0$/i);
    const ddfUk = getSkuQuantityGroup(/cytoverse pins ddf two-tone \(uk\) quantity, 0$/i);
    expect(within(ddfUs).getByText("DDF Two-Tone (US) :")).toHaveAttribute(
      "title",
      "DDF Two-Tone (US)",
    );
    expect(within(ddfUk).getByText("DDF Two-Tone (UK) :")).toHaveAttribute(
      "title",
      "DDF Two-Tone (UK)",
    );
    expect(screen.queryByText("DDF UK :")).not.toBeInTheDocument();
  });

  it("hides Pin Collections for Story Deck-only collectors", async () => {
    const user = setupUser();
    renderPage();

    await goToCardReview(user, {
      collectiblePattern: /^story deck cards$/i,
      reviewHeading: /review your cards/i,
    });

    expect(screen.getByRole("button", { name: /^collapse story foils$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pin collections/i })).not.toBeInTheDocument();
    expect(screen.queryByText("ChasmFriends Pins")).not.toBeInTheDocument();
  });

  it("keeps unsaved All coverage after footer Back and Continue", async () => {
    const user = setupUser();
    renderPage();

    await goToCardReview(user);

    const elsecallerCoverage = screen.getByRole("group", {
      name: /elsecaller story foils coverage/i,
    });
    await user.click(within(elsecallerCoverage).getByRole("button", { name: "All" }));

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: /what best describes you/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByRole("heading", { name: /review your collection/i })).toBeInTheDocument();
    expect(
      within(screen.getByRole("group", { name: /elsecaller story foils coverage/i })).getByRole(
        "button",
        { name: "All" },
      ),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("preserves in-progress review edits when navigating back to About you and returning", async () => {
    mockUseAuth.mockReturnValue({ user: { uid: "user-1" } });
    mockUseUserCollection.mockReturnValue({
      entries: [{ id: "existing", skuId: "LT24-CHM-01-DUN", quantity: 1 }],
      status: "ready",
      error: null,
    });
    const user = setupUser();
    renderPage();

    await goToCardReview(user);
    await setElsecallerStoryFoilsToSome(user);

    const elsecallerCoverage = screen.getByRole("group", {
      name: /elsecaller story foils coverage/i,
    });
    expect(within(elsecallerCoverage).getByRole("button", { name: "Some" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: /what best describes you/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /card review/i }));

    expect(
      within(screen.getByRole("group", { name: /elsecaller story foils coverage/i })).getByRole(
        "button",
        { name: "Some" },
      ),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(
        screen.getByRole("group", { name: /the chasmfriends get a pet! story dun coverage/i }),
      ).getByRole("button", { name: "Some" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps in-progress review edits when the Firestore snapshot updates", async () => {
    function SnapshotHarness() {
      const [collectionEntries, setCollectionEntries] = useState([
        { id: "LT24-CHM-01-DUN", quantity: 1 },
      ]);
      mockUseAuth.mockReturnValue({ user: { uid: "user-1" } });
      mockUseUserCollection.mockReturnValue({
        entries: collectionEntries,
        status: "ready",
        error: null,
      });

      return (
        <TestMemoryRouter initialEntries={["/getting-started"]}>
          <button
            type="button"
            onClick={() =>
              setCollectionEntries([
                { id: "LT24-CHM-01-DUN", quantity: 1 },
                { id: "PIN-CF-01", quantity: 2 },
              ])
            }
          >
            Push snapshot
          </button>
          <GettingStartedPage />
        </TestMemoryRouter>
      );
    }

    const user = setupUser();
    render(<SnapshotHarness />);

    await goToCardReview(user);
    await setElsecallerStoryFoilsToSome(user);

    const elsecallerCoverage = () =>
      screen.getByRole("group", { name: /elsecaller story foils coverage/i });
    expect(within(elsecallerCoverage()).getByRole("button", { name: "Some" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Push snapshot" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Collection summary")).toHaveTextContent(/[1-9]/);
    });
    expect(within(elsecallerCoverage()).getByRole("button", { name: "Some" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("prefills step 2 from legacy cardId + finish collection docs", async () => {
    mockUseAuth.mockReturnValue({ user: { uid: "user-1" } });
    mockUseUserCollection.mockReturnValue({
      entries: [
        { id: "card", cardId: "LT24-CHM-01", finish: "DUN", count: 1 },
        { id: "pin", cardId: "PIN-CF-01", copies: 1 },
      ],
      status: "ready",
      error: null,
    });
    const user = setupUser();
    renderPage();

    await goToCardReview(user);

    const chasmDunCoverage = screen.getByRole("group", {
      name: /the chasmfriends get a pet! story dun coverage/i,
    });
    expect(within(chasmDunCoverage).getByRole("button", { name: "Some" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const chasmPinCoverage = screen.getByRole("group", { name: /chasmfriends pins coverage/i });
    expect(within(chasmPinCoverage).getByRole("button", { name: "Some" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("prefills step 2 from a signed-in collector's saved items", async () => {
    mockUseAuth.mockReturnValue({ user: { uid: "user-1" } });
    mockUseUserCollection.mockReturnValue({
      entries: [
        { id: "card", skuId: "LT24-CHM-01-DUN", quantity: 1 },
        { id: "pin", skuId: "PIN-CF-01", quantity: 1 },
      ],
      status: "ready",
      error: null,
    });
    const user = setupUser();
    renderPage();

    await goToCardReview(user);

    const chasmDunCoverage = screen.getByRole("group", {
      name: /the chasmfriends get a pet! story dun coverage/i,
    });
    expect(within(chasmDunCoverage).getByRole("button", { name: "Some" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const chasmPinCoverage = screen.getByRole("group", { name: /chasmfriends pins coverage/i });
    expect(within(chasmPinCoverage).getByRole("button", { name: "Some" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("sends no delete rows when review state never matched owned SKUs", async () => {
    mockUseAuth.mockReturnValue({ user: { uid: "user-1" } });
    mockUseUserCollection.mockReturnValue({
      entries: [{ id: "legacy", skuId: "NOT-IN-REVIEW-TREE", quantity: 3 }],
      status: "ready",
      error: null,
    });
    const user = setupUser();
    renderPage();

    await goToCardReview(user);
    expect(screen.getByRole("status", { name: "Collection summary" })).toHaveTextContent(/0 total/);
    await user.click(screen.getByRole("button", { name: "Save collection" }));

    expect(mockApplyBulkCollectionUpdate).toHaveBeenCalled();
    expect(mockApplyBulkCollectionUpdate.mock.calls[0][0].rows).toEqual([]);
  });

  it("does not zero an owned SKU when a signed-in collector saves without edits", async () => {
    mockUseAuth.mockReturnValue({ user: { uid: "user-1" } });
    const existingEntries = [{ id: "existing", skuId: "LT24-CHM-01-DUN", quantity: 1 }];
    mockUseUserCollection.mockReturnValue({
      entries: existingEntries,
      status: "ready",
      error: null,
    });
    mockApplyBulkCollectionUpdate.mockResolvedValue({
      created: 0,
      updated: 1,
      deleted: 0,
      issues: [],
    });
    const user = setupUser();
    renderPage();

    await goToCardReview(user);
    await user.click(screen.getByRole("button", { name: "Save collection" }));

    const call = mockApplyBulkCollectionUpdate.mock.calls[0][0];
    expect(call.existingEntries).toEqual(existingEntries);
    expect(call.rows).toEqual([]);
  });

  it("hydrates manual review when Firestore docs only store sku ids in document ids", async () => {
    mockUseAuth.mockReturnValue({ user: { uid: "user-1" } });
    mockUseUserCollection.mockReturnValue({
      entries: [
        { id: "LT24-CHM-01-DUN", quantity: 1 },
        { id: "PIN-CF-01", quantity: 1 },
      ],
      status: "ready",
      error: null,
    });
    const user = setupUser();
    renderPage();

    await goToCardReview(user);

    const chasmCoverage = screen.getByRole("group", {
      name: /the chasmfriends get a pet! story dun coverage/i,
    });
    await waitFor(() => {
      expect(within(chasmCoverage).getByRole("button", { name: "Some" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
    expect(screen.getByLabelText("Collection summary")).toHaveTextContent(/[1-9]/);
  });

  it("captures sign_in_prompted when a signed-out collector tries to save", async () => {
    const user = setupUser();
    renderPage();

    await goToCardReview(user);
    await user.click(screen.getByRole("button", { name: "Sign in and save" }));

    expect(mockCaptureEvent).toHaveBeenCalledWith("sign_in_prompted", {
      reason: "getting-started-save",
    });
    expect(mockOpenAuthModal).toHaveBeenCalledWith({
      reason: "getting-started-save",
      initialMode: "register",
      onSuccess: expect.any(Function),
    });
    expect(mockApplyBulkCollectionUpdate).not.toHaveBeenCalled();
  });

  it("keeps save disabled when the collection hook is not ready", async () => {
    mockUseAuth.mockReturnValue({ user: { uid: "user-1" } });
    mockUseUserCollection.mockReturnValue({
      entries: [{ id: "PIN-CF-01", quantity: 1 }],
      status: "error",
      error: new Error("offline"),
    });
    renderPage("/getting-started?pins=all");

    expect(screen.getByRole("button", { name: "Save collection" })).toBeDisabled();

    const chasmPinCoverage = screen.getByRole("group", { name: /chasmfriends pins coverage/i });
    expect(within(chasmPinCoverage).getByRole("button", { name: "Some" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("saves cards-only collectors without allowing pin updates", async () => {
    mockUseAuth.mockReturnValue({ user: { uid: "user-1" } });
    mockUseUserCollection.mockReturnValue({ entries: [], status: "ready", error: null });
    const user = setupUser();
    renderPage();

    await goToCardReview(user, {
      collectiblePattern: /^story deck cards$/i,
      reviewHeading: /review your cards/i,
    });
    await user.click(screen.getByRole("button", { name: "Save collection" }));

    const call = mockApplyBulkCollectionUpdate.mock.calls[0][0];
    expect(call.allowPins).toBe(false);
    expect(call.rows.some((row) => String(row.skuId).startsWith("PIN-"))).toBe(false);
  });

  describe("Chasm Friend pin shortcut", () => {
    const chasmPath = "/getting-started?pins=chasmfriends";
    const chasmPinNames = ["Shredhead", "Howlerina", "Burpslurper", "Darren", "Cleverclaws"];

    function expectNoCardWord() {
      const main = document.querySelector("main");
      expect(main).toBeTruthy();
      expect(main.innerHTML.toLowerCase()).not.toMatch(/\bcards?\b/);
    }

    function ChasmAuthHarness() {
      const [authUser, setAuthUser] = useState(null);
      mockUseAuth.mockReturnValue({ user: authUser });
      return (
        <TestMemoryRouter initialEntries={[chasmPath]}>
          <button type="button" onClick={() => setAuthUser({ uid: "user-1" })}>
            Finish sign in
          </button>
          <GettingStartedPage />
        </TestMemoryRouter>
      );
    }

    it("opens the five ChasmFriends pins expanded, with pin-only copy", async () => {
      const user = setupUser();
      renderPage(chasmPath);

      expect(
        screen.getByRole("heading", { name: "which chasm friends do you have?" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "i have all 5" })).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: /what best describes you/i }),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/card review/i)).not.toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: /which pins do you have/i }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /collapse pin collections/i })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      expect(screen.getByRole("button", { name: /collapse chasmfriends pins/i })).toHaveAttribute(
        "aria-expanded",
        "true",
      );

      for (const name of chasmPinNames) {
        expect(
          screen.getByRole("group", { name: new RegExp(`${name} quantity, 0$`, "i") }),
        ).toBeInTheDocument();
      }
      expect(screen.queryByText("Brandon")).not.toBeInTheDocument();
      const coverage = screen.getByRole("group", { name: /chasmfriends pins coverage/i });
      expect(within(coverage).getByRole("button", { name: "All" })).toBeInTheDocument();
      expect(within(coverage).getByRole("button", { name: "Some" })).toBeInTheDocument();
      expect(within(coverage).getByRole("button", { name: "None" })).toBeInTheDocument();
      expectNoCardWord();

      await user.click(within(coverage).getByRole("button", { name: "All" }));
      await user.click(within(coverage).getByRole("button", { name: "None" }));
      expect(screen.getByRole("dialog", { name: /set all pins to zero/i })).toBeInTheDocument();
      expectNoCardWord();
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      await user.click(screen.getByRole("button", { name: "i have all 5" }));
      for (const name of chasmPinNames) {
        expect(
          screen.getByRole("group", { name: new RegExp(`${name} quantity, 1$`, "i") }),
        ).toBeInTheDocument();
      }
      expectNoCardWord();
    });

    it("keeps signed-out picks through sign-in and save, then offers the next links", async () => {
      const user = setupUser();
      render(<ChasmAuthHarness />);

      await user.click(
        screen.getByRole("button", { name: /increase chasmfriends pins shredhead quantity/i }),
      );
      expect(
        screen.getByRole("group", { name: /chasmfriends pins shredhead quantity, 1$/i }),
      ).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Sign in and save" }));
      expect(mockOpenAuthModal).toHaveBeenCalledWith({
        reason: "getting-started-save",
        initialMode: "register",
        onSuccess: expect.any(Function),
      });
      expect(
        screen.getByRole("group", { name: /chasmfriends pins shredhead quantity, 1$/i }),
      ).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Finish sign in" }));

      expect(
        await screen.findByRole("link", { name: "done. see who needs yours" }),
      ).toHaveAttribute("href", "/matches");
      expect(screen.getByRole("link", { name: "add the rest of your pins" })).toHaveAttribute(
        "href",
        "/getting-started?pins=all",
      );
      expect(
        screen.getByRole("heading", { name: "which chasm friends do you have?" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("group", { name: /chasmfriends pins shredhead quantity, 1$/i }),
      ).toBeInTheDocument();

      const rows = mockApplyBulkCollectionUpdate.mock.calls[0][0].rows;
      expect(rows).toEqual([expect.objectContaining({ skuId: "PIN-CF-01", quantity: "1" })]);
      expect(rows.every((row) => Number(row.quantity) > 0)).toBe(true);
      expectNoCardWord();
    });

    it("opens the full pin review directly from pins=all", () => {
      renderPage("/getting-started?pins=all");

      expect(screen.getByRole("heading", { name: /review your pins/i })).toBeInTheDocument();
      expect(screen.getByText("ChasmFriends Pins")).toBeInTheDocument();
      expect(screen.getByText("Character Pin Series 1")).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: /what best describes you/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: /which pins do you have/i }),
      ).not.toBeInTheDocument();
    });

    function FullPinReviewLoadHarness() {
      const [collection, setCollection] = useState({ entries: [], status: "loading" });
      mockUseAuth.mockReturnValue({ user: { uid: "user-1" } });
      mockUseUserCollection.mockImplementation(() => ({
        entries: collection.entries,
        status: collection.status,
        error: null,
      }));

      return (
        <TestMemoryRouter initialEntries={[chasmPath]}>
          <button type="button" onClick={() => setCollection({ entries: [], status: "ready" })}>
            Allow save
          </button>
          <button type="button" onClick={() => setCollection({ entries: [], status: "loading" })}>
            Loading again
          </button>
          <button
            type="button"
            onClick={() =>
              setCollection({
                entries: [{ id: "PIN-CF-01", quantity: 1 }],
                status: "ready",
              })
            }
          >
            Load collection
          </button>
          <GettingStartedPage />
        </TestMemoryRouter>
      );
    }

    it("prefills full pin review after the collection snapshot loads", async () => {
      const user = setupUser();
      mockApplyBulkCollectionUpdate.mockResolvedValue({
        created: 0,
        updated: 0,
        deleted: 0,
        issues: [],
      });
      render(<FullPinReviewLoadHarness />);

      await user.click(screen.getByRole("button", { name: "Allow save" }));
      await user.click(screen.getByRole("button", { name: "Save collection" }));
      await user.click(screen.getByRole("button", { name: "Loading again" }));
      await user.click(await screen.findByRole("link", { name: "add the rest of your pins" }));

      expect(screen.getByText(/loading your saved collection/i)).toBeInTheDocument();
      expect(
        screen.queryByRole("group", { name: /chasmfriends pins coverage/i }),
      ).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Load collection" }));

      await waitFor(() => {
        const chasmCoverage = screen.getByRole("group", { name: /chasmfriends pins coverage/i });
        expect(within(chasmCoverage).getByRole("button", { name: "Some" })).toHaveAttribute(
          "aria-pressed",
          "true",
        );
      });

      await user.click(screen.getByRole("button", { name: "Save collection" }));
      const call = mockApplyBulkCollectionUpdate.mock.calls.at(-1)[0];
      expect(call.rows).toEqual([]);
    });

    it("opens the unfiltered pin review from the after-save link", async () => {
      mockUseAuth.mockReturnValue({ user: { uid: "user-1" } });
      const user = setupUser();
      renderPage(chasmPath);

      await user.click(screen.getByRole("button", { name: "Save collection" }));
      await user.click(await screen.findByRole("link", { name: "add the rest of your pins" }));

      expect(screen.getByRole("heading", { name: /review your pins/i })).toBeInTheDocument();
      expect(screen.getByText("Character Pin Series 1")).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "which chasm friends do you have?" }),
      ).not.toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: "All", exact: true }).length).toBeGreaterThan(1);
    });
  });
});
