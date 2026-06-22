import { expect, test } from "@playwright/test";

test.describe("public routes (e2e)", () => {
  test("collectibles page shows catalog heading", async ({ page }) => {
    await page.goto("/collectibles");
    await expect(page.getByRole("heading", { name: "Collectibles" })).toBeVisible();
  });

  test("login page renders sign-in heading", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(
      page.getByRole("heading", { name: /Sign in to Lost Tales Marketplace/i }),
    ).toBeVisible();
  });
});
