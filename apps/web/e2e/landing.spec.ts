import { expect, test } from "@playwright/test";

test("visitor can open the landing page and navigate to registration", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /get started|sign up|register/i }).first()).toBeVisible();
  await page.getByRole("link", { name: /get started|sign up|register/i }).first().click();
  await expect(page).toHaveURL(/register/);
});
