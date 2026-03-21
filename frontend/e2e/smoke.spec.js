import { expect, test } from "@playwright/test";

test.describe("smoke (e2e)", () => {
  test("home loads with main navigation links", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation")).toBeVisible();
    await expect(page.getByRole("link", { name: "Collectibles" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
  });
});
