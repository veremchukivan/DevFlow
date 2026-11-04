import { expect, test, type BrowserContext } from "@playwright/test";

async function register(context: BrowserContext, name: string) {
  const page = await context.newPage();
  const uniqueId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  const email = `invite-${uniqueId}@example.test`;

  await page.goto("/register");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("E2ePassword123");
  await page.getByRole("button", { name: "Create account" }).click();
  try {
    await expect(page).toHaveURL(/workspaces/, { timeout: 10_000 });
  } catch (error) {
    const message = await page.locator('[role="alert"]').textContent();
    if (message?.trim()) {
      throw new Error(`Registration failed: ${message.trim()}`);
    }
    throw error;
  }

  return { email, page };
}

test("workspace owner can invite an existing user from notifications", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const inviteeContext = await browser.newContext();

  try {
    const owner = await register(ownerContext, "Workspace Owner");
    const invitee = await register(inviteeContext, "Invited User");

    await owner.page.getByRole("link", { name: "Team" }).click();
    await owner.page.getByLabel("Email").fill(invitee.email);
    await owner.page.getByRole("button", { name: "Send invite" }).click();
    await expect(owner.page.getByText(invitee.email)).toBeVisible();

    await invitee.page.goto("/notifications");
    const invitation = invitee.page.getByRole("button", {
      name: /invited you to a workspace/i,
    });
    await expect(invitation).toBeVisible();
    await invitation.click();
    await expect(
      invitee.page.getByRole("button", { name: "Accept invitation" }),
    ).toBeVisible();
    await invitee.page
      .getByRole("button", { name: "Accept invitation" })
      .click();
    await expect(invitee.page).toHaveURL(/workspaces\//, { timeout: 10_000 });
  } finally {
    await ownerContext.close();
    await inviteeContext.close();
  }
});

test("member can open an assigned task from a notification", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const memberContext = await browser.newContext();

  try {
    const owner = await register(ownerContext, "Notification Owner");
    const member = await register(memberContext, "Notification Member");
    const clientErrors: string[] = [];
    member.page.on("pageerror", (error) => clientErrors.push(error.message));

    await owner.page.getByRole("link", { name: "Team" }).click();
    await owner.page.getByLabel("Email").fill(member.email);
    await owner.page.getByRole("button", { name: "Send invite" }).click();

    await member.page.goto("/notifications");
    await member.page
      .getByRole("button", { name: /invited you to a workspace/i })
      .click();
    await member.page
      .getByRole("button", { name: "Accept invitation" })
      .click();

    await owner.page.getByRole("link", { name: "Back to workspace" }).click();
    await owner.page.getByRole("button", { name: "New project" }).click();
    await owner.page.getByLabel("Project name").fill("Assigned task project");
    await owner.page.getByRole("button", { name: "Create project" }).click();
    await owner.page
      .getByRole("main")
      .getByRole("link", { name: "A Assigned task project", exact: true })
      .click();

    await owner.page.getByLabel(/Create task in/i).first().click();
    const taskForm = owner.page
      .getByRole("button", { name: "Create task", exact: true })
      .locator("xpath=ancestor::form[1]");
    await taskForm.getByLabel("Task title").fill("Open from notification");
    await taskForm.getByLabel("Assignee").selectOption({
      label: "Notification Member",
    });
    await taskForm.getByRole("button", { name: "Create task" }).click();

    await member.page.goto("/notifications");
    await member.page
      .getByRole("button", { name: /assigned you a task/i })
      .click();
    await member.page.waitForTimeout(500);
    expect(clientErrors).toEqual([]);
    await expect(member.page.getByRole("dialog")).toBeVisible();
    await expect(
      member.page.locator('input[value="Open from notification"]'),
    ).toBeVisible();
  } finally {
    await ownerContext.close();
    await memberContext.close();
  }
});
