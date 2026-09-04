import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { signInAsDemoUser } from "./helpers/auth";

// #36's accessibility pass on the authenticated app — ModalSheet's focus
// handling (Escape closes, focus returns to the trigger) and a baseline
// axe scan on Today itself, which the signed-out scan in signed-out.spec.ts
// doesn't cover.
test.describe("Today — accessibility and keyboard", () => {
  test("has no automatically detectable accessibility violations", async ({ page, baseURL }) => {
    await signInAsDemoUser(page, baseURL!);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("a modal opens on click, traps Escape to close, and returns focus", async ({ page, baseURL }) => {
    await signInAsDemoUser(page, baseURL!);

    const openButton = page.getByRole("button", { name: "View completed ›" });
    await openButton.click();

    const dialog = page.getByRole("dialog", { name: "Completed Priorities" });
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    // #36 — focus returns to whatever opened the modal, so keyboard users
    // aren't dropped back at the top of the page.
    await expect(openButton).toBeFocused();
  });
});
