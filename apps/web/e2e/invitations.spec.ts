import { expect, test, type BrowserContext, type Page } from "@playwright/test";

async function register(context: BrowserContext, name: string) {
  const page = await context.newPage();
  const uniqueId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  const email = `invite-${uniqueId}@example.test`;

  await page.goto("/register");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("E2ePassword123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/workspaces/, { timeout: 10_000 });

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
