import { expect, test } from "@playwright/test";

test("new user can register and sign out", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.test`;
  await page.goto("/register");
  await page.getByLabel("Name").fill("E2E User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("E2ePassword123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/workspaces/);
  await page.getByLabel("Sign out").click();
  await expect(page).toHaveURL(/login/);
});
