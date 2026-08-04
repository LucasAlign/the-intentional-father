import rateLimit from "express-rate-limit";

// Guards the unauthenticated email-code endpoints from abuse (spamming a
// stranger's inbox, brute-forcing a 6-digit code). Keyed by IP since there's
// no session yet; the per-code attempt counter in email_login_codes is the
// primary defense against brute force, this is defense-in-depth.
export const emailStartRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many code requests. Try again in a few minutes." },
});

export const emailVerifyRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again in a few minutes." },
});
