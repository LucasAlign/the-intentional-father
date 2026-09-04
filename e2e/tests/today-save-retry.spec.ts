import { test, expect } from "@playwright/test";
import { signInAsDemoUser } from "./helpers/auth";

// #34's save lifecycle (Saving… / Saved / Couldn't save — Retry) and #76's
// fix for a save hanging forever on a stalled connection — regression-locks
// the one save flow every session touches: Today's intention textarea.
test.describe("Today — save and retry", () => {
  test("saves the intention and recovers from a failed save via Retry", async ({ page, baseURL }) => {
    await signInAsDemoUser(page, baseURL!);

    const intentionField = page.getByPlaceholder("What's your intention for the people who matter most today?");
    await expect(intentionField).toBeVisible();

    // Happy path: type, blur, confirm it durably saved.
    await intentionField.fill("Ask about their day before mine.");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("status", { name: "Saved" })).toBeVisible();

    // Forced failure: the request never reaches the server, so the UI must
    // show the failure state and offer Retry rather than silently losing
    // the edit or hanging on "Saving…" indefinitely (#76).
    await page.route("**/api/journal", (route) => route.abort());
    await intentionField.fill("A second, unsaved edit.");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("alert")).toContainText("Couldn't save");
    const retryButton = page.getByRole("button", { name: "Retry" });
    await expect(retryButton).toBeVisible();

    // Recovery: once the network is healthy again, Retry must actually
    // resolve to Saved, not just re-attempt and stay stuck.
    await page.unroute("**/api/journal");
    await retryButton.click();
    await expect(page.getByRole("status", { name: "Saved" })).toBeVisible();
  });
});
