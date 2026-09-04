import rateLimit from "express-rate-limit";

// Guards the unauthenticated demo-login endpoint (#79) — a single GET
// creates a real DB user and session, deliberately bypassing the
// beta-invite gate, so with no limit anyone who finds the URL could script
// unlimited free accounts and burn AI-chat cost on each one. Keyed by IP
// since there's no session yet, same pattern as emailAuthRateLimit.
//
// Limit is higher than emailStartRateLimit's: the #41 e2e suite calls this
// endpoint once per test case (6 cases x 4 viewports = 24 per full run,
// plus CI's single retry-on-failure), all from one IP, well within one
// 15-minute window — a real, legitimate caller this fix must not break.
// 40 still caps automated abuse at a small fraction of what makes scripted
// account creation worthwhile, while leaving headroom as the suite grows.
export const demoLoginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many demo sign-ins. Try again in a few minutes." },
});
