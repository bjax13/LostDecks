import { expect, test } from "@playwright/test";

test.describe("public routes (e2e)", () => {
  test("signed-out home document footer links About next to Feedback", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();

    const footer = page.getByRole("contentinfo");
    await footer.scrollIntoViewIfNeeded();
    const aboutLink = footer.getByTestId("site-footer-about-link");
    await expect(aboutLink).toBeVisible();
    await expect(aboutLink).toHaveAttribute("href", "/about");
    await expect(aboutLink).toHaveText("About");
    await expect(footer.getByRole("button", { name: "Feedback" })).toBeVisible();
  });

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
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "About" })).toBeVisible();
  });
});
