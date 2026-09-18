import { expect, test } from "@playwright/test";

test.describe("smoke (e2e)", () => {
  test("home loads with main navigation links", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation")).toBeVisible();
    await expect(page).toHaveTitle("ShardStash");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://shardstash.web.app/",
    );
    await expect(page.getByRole("link", { name: "ShardStash" })).toBeVisible();
    await expect(
      page.getByRole("navigation").getByRole("link", { name: "Collectibles" }),
    ).toBeVisible();
    await expect(page.getByRole("navigation").getByRole("link", { name: "Home" })).toBeVisible();
  });
});
