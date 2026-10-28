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

test("user can delete a personal account from data settings", async ({ page }) => {
  const email = `delete-e2e-${Date.now()}@example.test`;
  const password = "E2ePassword123";
  await page.goto("/register");
  await page.getByLabel("Name").fill("Delete E2E User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/workspaces/);

  await page.goto("/profile");
  await page.getByRole("button", { name: "Data" }).click();
  await page.getByLabel("Current password").fill(password);
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page.getByRole("button", { name: "Delete account" }).click();

  await expect(page).toHaveURL(/login\?reason=account-deleted/);
  await page.goto("/workspaces");
  await expect(page).toHaveURL(/login\?next=/);
});

test("user can create and revoke an API token", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Name").fill("Token E2E User");
  await page.getByLabel("Email").fill(`token-e2e-${Date.now()}@example.test`);
  await page.getByLabel("Password").fill("E2ePassword123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/workspaces/);
  await page.goto("/profile");
  await page.getByRole("button", { name: "Setup" }).click();
  await page.getByLabel("Token name").fill("Playwright token");
  await page.getByRole("button", { name: "Create API token" }).click();
  await expect(page.locator("code").filter({ hasText: "df_" })).toBeVisible();
  await page.getByRole("button", { name: "Revoke" }).click();
  await expect(page.getByText("Playwright token")).not.toBeVisible();
});
