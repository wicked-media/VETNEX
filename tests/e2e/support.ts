import { expect, type Page } from "@playwright/test";

/** Seeded synthetic accounts from `packages/database/prisma/seed.ts`. */
export const OWNER = {
  email: "alex.morgan@riverbend.vet",
  password: "Vetnex-Demo-2026",
} as const;

/**
 * Signs in through the real form so every test exercises session issuance rather
 * than injecting cookies.
 */
export async function signIn(
  page: Page,
  credentials: { email: string; password: string } = OWNER,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
}
