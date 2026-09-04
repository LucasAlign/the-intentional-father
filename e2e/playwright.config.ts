import { defineConfig, devices } from "@playwright/test";

// #41 — real usability regression coverage needs a real Postgres and both
// app processes up (Vite's dev-server proxy is what makes /api reachable at
// all; `vite preview` doesn't apply the same proxy config, so this runs the
// same dev servers Replit's own workflow runs, not a built/served bundle).
// `reuseExistingServer` lets a developer keep both already running locally
// (per CLAUDE.md, Replit's workflow manages them) instead of double-booting.
const API_PORT = 8080;
const WEB_PORT = 22384;

// The four widths #41 names — paired with realistic device heights rather
// than a fixed height, so scroll behavior (#37's fade cue, safe-area
// padding) is exercised the way it would be on the real device each width
// approximates: iPhone SE (1st gen), iPhone SE (2nd/3rd gen), iPhone 12-14,
// iPhone 14/15 Pro Max/Plus.
const VIEWPORTS = [
  { name: "mobile-320", width: 320, height: 568 },
  { name: "mobile-375", width: 375, height: 667 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-430", width: 430, height: 932 },
];

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "on-first-retry",
  },
  projects: VIEWPORTS.map(({ name, width, height }) => ({
    name,
    use: { ...devices["Desktop Chrome"], viewport: { width, height }, isMobile: true, hasTouch: true },
  })),
  webServer: [
    {
      command: "pnpm --filter @workspace/api-server run dev",
      url: `http://localhost:${API_PORT}/api/healthz`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      cwd: "..",
    },
    {
      command: "pnpm --filter @workspace/arlo run dev",
      url: `http://localhost:${WEB_PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      cwd: "..",
    },
  ],
});
