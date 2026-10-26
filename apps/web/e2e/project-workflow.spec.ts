import { expect, test, type Page } from "@playwright/test";

async function register(page: Page) {
  await page.goto("/register");
  await page.getByLabel("Name").fill("Workflow User");
  await page.getByLabel("Email").fill(`workflow-${Date.now()}-${Math.random()}@example.test`);
  await page.getByLabel("Password").fill("E2ePassword123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/workspaces/);
}

test("member can create a project and task", async ({ page }) => {
  await register(page);
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Project name").fill("E2E Project");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { name: "E2E Project" })).toBeVisible();
  await page.getByLabel(/Create task in/i).first().click();
  await page.getByLabel("Task title").fill("E2E task");
  await page.getByRole("button", { name: "Create task" }).click();
  await expect(page.getByText("E2E task")).toBeVisible();
});

test("member can create and complete a sprint", async ({ page }) => {
  await register(page);
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Project name").fill("Sprint Project");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("button", { name: "New sprint" }).click();
  await page.getByLabel("Sprint name").fill("E2E Sprint");
  await page.getByRole("button", { name: "Start sprint" }).click();
  await expect(page.getByRole("heading", { name: "E2E Sprint" })).toBeVisible();
  await page.getByRole("button", { name: "Complete sprint" }).click();
  await page.getByRole("button", { name: "Complete sprint" }).last().click();
  await expect(page.getByText("Sprint analytics")).toBeVisible();
});

test("member can update notification preferences", async ({ page }) => {
  await register(page);
  await page.goto("/notifications");
  const comments = page.getByLabel("Comments");
  await expect(comments).toBeChecked();
  await comments.uncheck();
  await expect(comments).not.toBeChecked();
});
