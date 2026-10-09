import { expect, test } from "@playwright/test";

test.describe("public routes (e2e)", () => {
  test("collectibles page shows catalog heading", async ({ page }) => {
    await page.goto("/collectibles");
    await expect(page.getByRole("heading", { name: "Collectibles" })).toBeVisible();
  });

  test("login page renders sign-in heading", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByRole("heading", { name: /Sign in to ShardStash/i })).toBeVisible();
  });

  test("about page is public and shows feedback contacts", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { name: "About" })).toBeVisible();
    await expect(page.getByText(/ShardStash has two jobs/)).toBeVisible();
    await expect(page.getByRole("link", { name: "shardstashinfo@gmail.com" })).toHaveAttribute(
      "href",
      "mailto:shardstashinfo@gmail.com?subject=ShardStash%20feedback",
    );
    await expect(page.getByRole("main")).toContainText("gimpy_12");
    await expect(page.getByRole("main")).toContainText("1bjax");
    await expect(page.getByRole("main")).toContainText("Sanderson Collectors Guild");
    await expect(page.getByRole("main")).toContainText("Story Deck Bazaar");
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "About" })).toBeVisible();
  });

  test("missing public trade list shows unavailable state signed out", async ({ page }) => {
    await page.goto("/t/does-not-exist");
    await expect(page.getByRole("heading", { name: /isn't shared anymore/i })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /see if you can trade — add your cards or pins/i }),
    ).toBeVisible();
  });

  test("footer feedback modal shows shared email and Discord contacts", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("contentinfo").getByRole("button", { name: "Feedback" }).click();

    const dialog = page.getByRole("dialog", { name: "Send site feedback" });
    await expect(dialog).toContainText("not trade match contact");
    await expect(dialog.getByRole("link", { name: "shardstashinfo@gmail.com" })).toHaveAttribute(
      "href",
      "mailto:shardstashinfo@gmail.com?subject=ShardStash%20feedback",
    );
    await expect(dialog).toContainText("gimpy_12");
    await expect(dialog).toContainText("1bjax");
  });

  test("privacy and terms pages are public with footer links", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
    await expect(
      page.getByRole("contentinfo").getByRole("link", { name: "Privacy" }),
    ).toBeVisible();
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Terms" })).toBeVisible();

    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: "Terms of Use" })).toBeVisible();
  });
});
