import { Router, type IRouter, type Request, type Response } from "express";
import { getStripe, getMonthlyPriceId, getAnnualPriceId, TRIAL_DAYS } from "../lib/stripeClient";
import { resolveSubscriptionStatus, getSubscription, billingEnabled } from "../lib/billing";
import { isAdmin } from "../lib/auth";

const router: IRouter = Router();

// GET /api/billing/status — what the frontend keys the BillingGate paywall
// off of. Always reachable (no requireActiveAccess on this route itself,
// unlike the rest of the app) since a canceled/lapsed user still needs this
// to render "Subscribe" vs. "Manage Subscription".
router.get("/billing/status", async (req: Request, res: Response) => {
  try {
    const status = await resolveSubscriptionStatus(req.user!.id, req.user!.email);
    const sub = await getSubscription(req.user!.id);
    res.json({
      status,
      billingEnabled: billingEnabled(),
      trialEndsAt: sub?.trialEndsAt ?? null,
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    });
  } catch (err) {
    req.log?.error({ err }, "Error resolving billing status");
    res.status(500).json({ error: "Failed to resolve billing status" });
  }
});

// POST /api/billing/checkout — starts a Stripe Checkout Session in
// subscription mode with a 14-day trial (#18's grilling, Q3) and a card
// required upfront (Stripe's own "collect payment method during trial"
// setting, not something this app enforces separately). { interval:
// "month" | "year" } picks which Price; defaults to monthly.
router.post("/billing/checkout", async (req: Request, res: Response) => {
  try {
    if (isAdmin(req.user!.email)) {
      res.status(400).json({ error: "Admin accounts don't need a subscription" });
      return;
    }
    const interval = req.body?.interval === "year" ? "year" : "month";
    const priceId = interval === "year" ? getAnnualPriceId() : getMonthlyPriceId();
    const origin = process.env.PUBLIC_URL ?? `${req.protocol}://${req.get("host")}`;

    const existing = await getSubscription(req.user!.id);
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { trial_period_days: TRIAL_DAYS },
      payment_method_collection: "always",
      customer: existing?.providerCustomerId ?? undefined,
      customer_email: existing?.providerCustomerId ? undefined : (req.user!.email ?? undefined),
      client_reference_id: req.user!.id,
      success_url: `${origin}/?billing=success`,
      cancel_url: `${origin}/?billing=canceled`,
    });
    res.json({ url: session.url });
  } catch (err) {
    req.log?.error({ err }, "Error creating checkout session");
    res.status(500).json({ error: "Failed to start checkout" });
  }
});

// POST /api/billing/portal — Stripe's hosted Customer Portal (#18's
// grilling, Q10): cancel, update card, switch monthly/annual — no custom
// billing-management UI built in this app.
router.post("/billing/portal", async (req: Request, res: Response) => {
  try {
    const sub = await getSubscription(req.user!.id);
    if (!sub?.providerCustomerId) {
      res.status(400).json({ error: "No billing account yet" });
      return;
    }
    const origin = process.env.PUBLIC_URL ?? `${req.protocol}://${req.get("host")}`;
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.providerCustomerId,
      return_url: `${origin}/`,
    });
    res.json({ url: session.url });
  } catch (err) {
    req.log?.error({ err }, "Error creating billing portal session");
    res.status(500).json({ error: "Failed to open billing portal" });
  }
});

export default router;
