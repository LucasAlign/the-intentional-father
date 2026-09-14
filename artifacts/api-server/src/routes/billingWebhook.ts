import express, { Router, type IRouter, type Request, type Response } from "express";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, subscriptions } from "@workspace/db";
import { getStripe, getWebhookSecret } from "../lib/stripeClient";
import type { SubscriptionStatus } from "../lib/billing";

const router: IRouter = Router();

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    // canceled, unpaid, incomplete, incomplete_expired, paused
    default:
      return "canceled";
  }
}

// current_period_end/current_period_start live on the subscription's first
// item, not the subscription object itself, as of this SDK's API version.
function periodEnd(sub: Stripe.Subscription): Date | null {
  const end = sub.items.data[0]?.current_period_end;
  return end ? new Date(end * 1000) : null;
}

function priceInterval(sub: Stripe.Subscription): "month" | "year" {
  return sub.items.data[0]?.price.recurring?.interval === "year" ? "year" : "month";
}

function customerId(sub: Stripe.Subscription): string {
  return typeof sub.customer === "string" ? sub.customer : sub.customer.id;
}

async function upsertFromCheckout(userId: string, sub: Stripe.Subscription): Promise<void> {
  const values = {
    userId,
    status: mapStripeStatus(sub.status),
    provider: "stripe" as const,
    providerCustomerId: customerId(sub),
    providerSubscriptionId: sub.id,
    priceInterval: priceInterval(sub),
    currentPeriodEnd: periodEnd(sub),
    trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  };
  await db
    .insert(subscriptions)
    .values(values)
    .onConflictDoUpdate({ target: subscriptions.userId, set: values });
}

async function updateFromStripeEvent(sub: Stripe.Subscription): Promise<void> {
  await db
    .update(subscriptions)
    .set({
      status: mapStripeStatus(sub.status),
      priceInterval: priceInterval(sub),
      currentPeriodEnd: periodEnd(sub),
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    })
    .where(eq(subscriptions.providerSubscriptionId, sub.id));
}

// POST /api/billing/webhook — Stripe's own server-to-server event delivery,
// not reachable through a session (Stripe holds none) and mounted in app.ts
// ahead of the global express.json(). express.raw() here, on just this one
// route, is what signature verification (stripe.webhooks.constructEvent)
// needs — the exact raw bytes Stripe signed, which a JSON-parsed-then
// -reserialized body would not reproduce byte-for-byte.
router.post("/billing/webhook", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string") {
    res.status(400).json({ error: "Missing signature" });
    return;
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(req.body as Buffer, signature, getWebhookSecret());
  } catch (err) {
    req.log?.error({ err }, "Stripe webhook signature verification failed");
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.client_reference_id;
        if (!userId || typeof session.subscription !== "string") break;
        const sub = await getStripe().subscriptions.retrieve(session.subscription);
        await upsertFromCheckout(userId, sub);
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await updateFromStripeEvent(event.data.object);
        break;
      }
      default:
        break;
    }
    res.json({ received: true });
  } catch (err) {
    req.log?.error({ err, type: event.type }, "Error processing Stripe webhook");
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
