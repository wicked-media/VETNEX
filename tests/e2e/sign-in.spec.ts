import { expect, test } from "@playwright/test";
import { OWNER, signIn } from "./support";

test.describe("sign in", () => {
  test("sends anonymous visitors to the sign-in page", async ({ page }) => {
    await page.goto("/staff");

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in", level: 1 })).toBeVisible();
  });

  test("rejects a wrong password without revealing which field failed", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(OWNER.email);
    await page.getByLabel("Password").fill("definitely-not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Could not sign in")).toBeVisible();
    await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in", level: 1 })).toBeVisible();
  });

  test("signs in, shows the practice, and ends the session on sign out", async ({ page }) => {
    await signIn(page);

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Alex");
    await expect(page.getByText("Riverbend Veterinary Group").first()).toBeVisible();
    await expect(page.getByText("Active staff")).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    // The session cookie is gone, so protected routes redirect again.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  });
});
