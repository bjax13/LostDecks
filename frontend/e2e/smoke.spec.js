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
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /Track your Lost Tales Story Deck cards/,
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      "https://shardstash.web.app/og-image.png",
    );
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute(
      "content",
      "1200",
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image",
    );
    await expect(page.getByRole("link", { name: "ShardStash" })).toBeVisible();
    await expect(
      page.getByRole("navigation").getByRole("link", { name: "Collectibles" }),
    ).toBeVisible();
    await expect(page.getByRole("navigation").getByRole("link", { name: "Home" })).toBeVisible();
  });
});
