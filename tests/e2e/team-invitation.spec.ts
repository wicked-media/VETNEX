import { expect, test } from "@playwright/test";
import { signIn } from "./support";

test.describe("team invitations", () => {
  test("invites a team member and the invitation link is usable", async ({ page, browser }) => {
    const email = `e2e.invitee.${Date.now()}@riverbend.vet`;

    await signIn(page);
    await page.goto("/staff");
    await expect(page.getByRole("heading", { name: "Team", level: 1 })).toBeVisible();

    await page.getByRole("button", { name: "Invite team member" }).click();
    const dialog = page.getByRole("dialog", { name: "Invite a team member" });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Email").fill(email);
    await dialog.getByLabel("Full name").fill("Dr E2E Invitee");
    await dialog.getByLabel("Role").selectOption({ label: "Veterinarian" });
    await dialog.getByLabel("Job title").fill("Locum Veterinarian");
    await dialog.getByRole("button", { name: "Send invitation" }).click();

    // Delivery is honestly surfaced: no email provider is configured in this build.
    await expect(dialog.getByText("Email delivery is not configured in this build")).toBeVisible();

    const invitationLink = await dialog.getByLabel("Invitation link").inputValue();
    expect(invitationLink).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/invite\/[A-Za-z0-9_-]{20,}$/);

    await dialog.getByRole("button", { name: "Done" }).click();

    // The pending invitation is listed with the invited address.
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByText("Pending invitations")).toBeVisible();

    // The link works in a clean browser context, so the token — not a session — is
    // what grants access.
    const inviteeContext = await browser.newContext();
    const inviteePage = await inviteeContext.newPage();
    try {
      await inviteePage.goto(invitationLink);
      await expect(inviteePage.getByLabel("Your full name")).toHaveValue("Dr E2E Invitee");

      await inviteePage.getByLabel("Choose a password").fill("Invitee-Password-2026");
      await inviteePage.getByRole("button", { name: "Join the practice" }).click();

      await expect(inviteePage).toHaveURL(/\/dashboard$/);
      // The dashboard mentions the new account in several places; the sidebar shows
      // who is actually signed in.
      await expect(inviteePage.locator("aside").getByText(email, { exact: true })).toBeVisible();
    } finally {
      await inviteeContext.close();
    }

    // The invitation is consumed: reopening it now fails instead of granting access.
    const reused = await browser.newContext();
    const reusedPage = await reused.newPage();
    try {
      await reusedPage.goto(invitationLink);
      await expect(reusedPage.getByRole("button", { name: "Join the practice" })).toHaveCount(0);
    } finally {
      await reused.close();
    }
  });
});
