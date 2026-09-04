import rateLimit from "express-rate-limit";
import { type Request } from "express";

// Guards the authenticated "send me a test reminder" endpoint (#75) — it's
// cheap to abuse into a self-inflicted spam stream (and burns Resend sends)
// since it needs no more than an existing session, so it gets its own
// account-keyed limit rather than sharing aiRateLimit's OpenAI-cost budget.
export const testReminderRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.user!.id,
  message: { error: "Too many test reminders. Try again in a few minutes." },
});
