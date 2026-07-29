import rateLimit from "express-rate-limit";
import { type Request } from "express";

// Guards the OpenAI-backed routes (chat, interview) from cost/abuse from a
// single account. Keyed by user id, not IP, since these routes sit behind
// requireAuth and share of a home Wi-Fi shouldn't tighten everyone's limit.
export const aiRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.user!.id,
  message: { error: "You're sending messages too quickly. Take a breath and try again in a few minutes." },
});
