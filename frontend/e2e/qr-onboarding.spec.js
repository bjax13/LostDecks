import { expect, test } from "@playwright/test";

test.describe("QR have/need onboarding (e2e)", () => {
  test("collect=pins shows series-grouped quick picker and opens Create Account", async ({
    page,
  }) => {
    await page.goto("/getting-started?collect=pins&utm_source=qr&utm_campaign=nexus-2026");

    await expect(page.getByRole("heading", { name: /Which pins do you have/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /ChasmFriends/i }).first()).toBeVisible();
    await expect(page.getByPlaceholder(/Search pins or series/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Have all" }).first()).toBeVisible();

    await page.getByRole("button", { name: "Find my trades" }).click();
    await expect(page.getByRole("heading", { name: "Create Account" })).toBeVisible();
    await expect(page.getByText("Continue with Google")).toBeVisible();
  });
});
