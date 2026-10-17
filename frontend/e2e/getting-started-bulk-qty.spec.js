import { expect, test } from "@playwright/test";

test.describe("getting started bulk quantity (e2e)", () => {
  test("rejects negative Apply all and still applies a positive quantity", async ({ page }) => {
    await page.goto("/getting-started");
    // Collectible type is asked first; Story Deck matches this card-review / bulk qty flow.
    // Click label text (same pattern as profile options) — the radio input is covered by the label span.
    await page.getByTestId("getting-started-type-cards").click({ force: true });
    await page.getByTestId("getting-started-profile-manual").click({ force: true });
    await page.getByTestId("getting-started-continue").click();
    await expect(page.getByRole("heading", { name: /review your cards/i })).toBeVisible();

    await page.getByRole("button", { name: /^expand elsecaller story foils$/i }).click();

    const bulkActions = page.getByRole("toolbar", {
      name: /bulk action for elsecaller story foils/i,
    });
    const input = bulkActions.getByLabel(/custom quantity for/i);
    const applyAll = bulkActions.getByRole("button", { name: "Apply all" });

    await expect(input).toHaveAttribute("min", "0");
    await expect(input).toHaveAttribute("max", "999");
    await expect(input).toHaveAttribute("step", "1");

    await input.fill("-5");

    await expect(applyAll).toBeDisabled();
    await expect(bulkActions.getByRole("alert")).toHaveText(/quantity must be between 0 and 999/i);
    await expect(
      page.getByRole("group", { name: /elsecaller story foils foil #1 quantity, 0$/i }),
    ).toBeVisible();

    await input.fill("1000");
    await expect(input).toHaveValue("999");
    await expect(applyAll).toBeEnabled();
    await expect(bulkActions.getByRole("alert")).toHaveCount(0);

    await input.fill("2");
    await expect(applyAll).toBeEnabled();
    await applyAll.click();
    await expect(
      page.getByRole("group", { name: /elsecaller story foils foil #1 quantity, 2$/i }),
    ).toBeVisible();
    await expect(bulkActions.getByRole("alert")).toHaveCount(0);
  });
});
