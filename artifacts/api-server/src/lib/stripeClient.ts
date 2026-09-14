import Stripe from "stripe";

// Lazily constructed, not at module load — mirrors this app's other optional
// secrets (RESEND_API_KEY, lib/email.ts): STRIPE_SECRET_KEY not being set yet
// (dev, or before #18 actually launches) must not crash the server on boot,
// only the specific request that needed it.
let stripe: Stripe | undefined;

export function getStripe(): Stripe {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
    stripe = new Stripe(key);
  }
  return stripe;
}

// The two Prices created in the Stripe Dashboard for the $8/mo or $80/yr
// plan (#18's grilling, Q4) — IDs, not amounts, since the amount/currency
// live on the Price object in Stripe itself, not duplicated here.
export function getMonthlyPriceId(): string {
  const id = process.env.STRIPE_PRICE_MONTHLY;
  if (!id) throw new Error("STRIPE_PRICE_MONTHLY is not configured");
  return id;
}

export function getAnnualPriceId(): string {
  const id = process.env.STRIPE_PRICE_ANNUAL;
  if (!id) throw new Error("STRIPE_PRICE_ANNUAL is not configured");
  return id;
}

export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  return secret;
}

// #18's grilling, Q3 — 14 days, card required upfront (set on the Checkout
// Session itself, see routes/billing.ts), auto-charges at trial end (Q8).
export const TRIAL_DAYS = 14;
