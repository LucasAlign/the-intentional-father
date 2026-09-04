import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Signed-out AuthGate — #35's copy, #37's mobile legibility/zoom, and #36's
// accessibility pass all landed here. Runs once per viewport project
// (playwright.config.ts), so this alone covers all four #41-named widths.
test.describe("signed-out", () => {
  test("shows the sign-in screen with all three providers", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Sign in to Steward")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Microsoft" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Email" })).toBeVisible();
  });

  test("pinch-zoom is not disabled", async ({ page }) => {
    await page.goto("/");
    const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute("content");
    // #37 — maximum-scale=1 (or user-scalable=no) blocks pinch-zoom outright,
    // directly contradicting the app's own legibility goals. Regression-lock
    // that it stays gone.
    expect(viewportMeta).not.toMatch(/maximum-scale\s*=\s*1(\.0)?\b/);
    expect(viewportMeta).not.toMatch(/user-scalable\s*=\s*no/);
  });

  test("has no automatically detectable accessibility violations", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
