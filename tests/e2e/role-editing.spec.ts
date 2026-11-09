import { expect, test } from "@playwright/test";
import { signIn } from "./support";

test.describe("roles and permissions", () => {
  test("creates a custom role, edits its permissions, and the change persists", async ({ page }) => {
    const roleName = `Ward Coordinator ${Date.now().toString().slice(-6)}`;
    const renamed = `${roleName} (senior)`;

    await signIn(page);
    await page.goto("/roles");
    await expect(page.getByRole("heading", { name: "Roles and permissions", level: 1 })).toBeVisible();

    // --- create -------------------------------------------------------------
    await page.getByRole("button", { name: "Create role" }).click();
    const createDialog = page.getByRole("dialog", { name: "Create a role" });
    await createDialog.getByLabel("Role name").fill(roleName);
    await createDialog.getByLabel("Description").fill("Created by the end-to-end suite.");
    await createDialog.getByRole("checkbox", { name: /View clinics/ }).check();
    await createDialog.getByRole("checkbox", { name: /View staff/ }).check();

    // Permissions for modules that have not shipped cannot be granted.
    await expect(createDialog.getByRole("checkbox", { name: /View patients/ })).toBeDisabled();

    await createDialog.getByRole("button", { name: "Create role" }).click();
    await expect(page.getByText(`${roleName} created.`)).toBeVisible();

    const card = page.locator('[data-testid="role-card"]').filter({ hasText: roleName });
    await expect(card).toBeVisible();
    await expect(card.getByText("View clinics")).toBeVisible();

    // --- edit ---------------------------------------------------------------
    await card.getByRole("button", { name: "Edit permissions" }).click();
    const editDialog = page.getByRole("dialog", { name: `Edit ${roleName}` });
    await expect(editDialog).toBeVisible();
    await expect(editDialog.getByLabel("Role name")).toHaveValue(roleName);

    await editDialog.getByLabel("Role name").fill(renamed);
    await editDialog.getByRole("checkbox", { name: /View audit trail/ }).check();
    await editDialog.getByRole("checkbox", { name: /View clinics/ }).uncheck();
    await editDialog.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText(`${renamed} updated.`)).toBeVisible();

    // --- persists across a full reload (it is stored, not local state) -------
    await page.reload();
    const updatedCard = page.locator('[data-testid="role-card"]').filter({ hasText: renamed });
    await expect(updatedCard).toBeVisible();
    await expect(updatedCard.getByText("View audit trail")).toBeVisible();
    await expect(updatedCard.getByText("View staff")).toBeVisible();
    await expect(updatedCard.getByText("View clinics")).toHaveCount(0);
  });

  test("keeps the Owner role protected from permission edits", async ({ page }) => {
    await signIn(page);
    await page.goto("/roles");

    const ownerCard = page.locator('[data-testid="role-card"]').filter({ hasText: "Owner" });
    await expect(ownerCard.getByText("The Owner role is protected")).toBeVisible();
    await expect(ownerCard.getByRole("button", { name: "Edit permissions" })).toHaveCount(0);
  });
});
