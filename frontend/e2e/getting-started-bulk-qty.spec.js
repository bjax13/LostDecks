import { expect, test } from "@playwright/test";

test.describe("getting started bulk quantity (e2e)", () => {
  test("rejects negative Apply all and still applies a positive quantity", async ({ page }) => {
    await page.goto("/getting-started");
    await page.getByText(/my collection is not in a spreadsheet/i).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: /review your collection/i })).toBeVisible();

    await page.getByRole("button", { name: /^expand elsecaller story foils$/i }).click();

    const bulkActions = page.getByRole("toolbar", {
      name: /bulk action for elsecaller story foils/i,
    });
    const input = bulkActions.getByLabel(/custom quantity for/i);
    const applyAll = bulkActions.getByRole("button", { name: "Apply all" });

    await expect(input).toHaveAttribute("min", "0");
    await expect(input).toHaveAttribute("step", "1");

    await input.fill("-5");

    await expect(applyAll).toBeDisabled();
    await expect(bulkActions.getByRole("alert")).toHaveText(/quantity must be 0 or more/i);
    await expect(
      page.getByRole("group", { name: /elsecaller story foils foil #1 quantity, 0$/i }),
    ).toBeVisible();

    await input.fill("2");
    await expect(applyAll).toBeEnabled();
    await applyAll.click();
    await expect(
      page.getByRole("group", { name: /elsecaller story foils foil #1 quantity, 2$/i }),
    ).toBeVisible();
    await expect(bulkActions.getByRole("alert")).toHaveCount(0);
  });
});
