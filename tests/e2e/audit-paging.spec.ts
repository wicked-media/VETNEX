import { expect, test } from "@playwright/test";
import { signIn } from "./support";

test.describe("audit trail", () => {
  test("pages through the append-only history and exposes event detail", async ({ page }) => {
    await signIn(page);
    await page.goto("/audit");
    await expect(page.getByRole("heading", { name: "Audit trail", level: 1 })).toBeVisible();

    // The first page is server-rendered at 25 events (prepare.ts seeds >75).
    await expect(page.getByText("Showing 25 events")).toBeVisible();
    await expect(page.getByRole("button", { name: "Load older events" })).toBeVisible();

    await page.getByRole("button", { name: "Load older events" }).click();
    await expect(page.getByText("Showing 50 events")).toBeVisible();

    await page.getByRole("button", { name: "Load older events" }).click();
    await expect(page.getByText("Showing 75 events")).toBeVisible();

    // Event detail is available without leaving the page.
    await page.getByRole("button", { name: "Show detail" }).first().click();
    await expect(page.getByRole("button", { name: "Hide detail" }).first()).toBeVisible();

    // The trail is read-only: no control exists to edit or delete an event.
    await expect(page.getByRole("button", { name: /delete|edit/i })).toHaveCount(0);
  });

  test("denies audit access to a role without the permission", async ({ page }) => {
    // A veterinarian can read staff but not the audit trail.
    await signIn(page, { email: "tom.becker@riverbend.vet", password: "Vetnex-Demo-2026" });
    await page.goto("/audit");

    await expect(page.getByText("No access")).toBeVisible();
    await expect(page.getByText("Your role does not include audit access")).toBeVisible();
  });
});
