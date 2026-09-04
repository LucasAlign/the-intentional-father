import type { Page } from "@playwright/test";

// Creates a fresh, isolated demo user (routes/auth.ts's GET /login/demo —
// no OAuth round-trip, no shared state between test runs, deliberately
// bypasses the beta-invite gate) and skips the AI-driven onboarding
// interview via its own skip endpoint, landing on Today. `appOrigin` must
// be passed explicitly and match the app's own real login buttons
// (use-auth.ts's `login()` always sends `window.location.origin` the same
// way) — without it the redirect falls back to reading the Host header,
// which the Vite dev proxy rewrites to the API server's own origin
// (changeOrigin: true), sending the browser to the wrong place entirely.
//
// Tests that care about the interview flow itself should drive it
// directly instead of using this helper.
export async function signInAsDemoUser(page: Page, baseURL: string): Promise<void> {
  const returnTo = encodeURIComponent("/");
  const appOrigin = encodeURIComponent(baseURL);
  await page.goto(`/api/login/demo?returnTo=${returnTo}&appOrigin=${appOrigin}`);
  await page.request.post("/api/interview/skip");
  await page.goto("/");
}
