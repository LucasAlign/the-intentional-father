import rateLimit from "express-rate-limit";
import { type Request } from "express";

// Guards the authenticated reminder-email add/resend endpoints (#93) —
// each one sends a real email, so it's account-keyed like
// testReminderRateLimit rather than IP-keyed like the login flow's
// (there's already a session here).
export const reminderEmailAddRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.user!.id,
  message: { error: "Too many code requests. Try again in a few minutes." },
});

export const reminderEmailVerifyRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.user!.id,
  message: { error: "Too many attempts. Try again in a few minutes." },
});
