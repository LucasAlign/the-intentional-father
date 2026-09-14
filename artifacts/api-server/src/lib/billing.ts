import { and, eq } from "drizzle-orm";
import { db, subscriptions, betaInvites, type Subscription } from "@workspace/db";
import { isAdmin } from "./auth";

// #18 — deliberately our own vocabulary, never the payment provider's raw
// status strings. The webhook handler (routes/billing.ts) is the one place
// that translates a provider event into one of these; everywhere else reads
// this instead, so a future provider swap only touches that translation.
export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "grandfathered",
  "admin",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

// Statuses that mean "let them use the app." past_due is included — a
// failed renewal gets Stripe's own multi-day Smart Retries plus an in-app
// "update your card" notice before we ever actually cut access, rather than
// an instant lockout on one transient decline (#18's grilling, Q7).
export function hasActiveAccess(status: SubscriptionStatus): boolean {
  return status === "trialing" || status === "active" || status === "past_due" ||
    status === "grandfathered" || status === "admin";
}

// Master switch for the whole paywall. Off (unset/anything but "true") is a
// complete no-op everywhere this is checked — merging this feature changes
// nothing about the running app until this is deliberately set, which is
// also the moment that defines "the cutover" for grandfathering (#18's
// grilling, Q5/Q12): whoever is already `active` in beta_invites at that
// moment is grandfathered, checked lazily rather than via a migration script
// (see resolveSubscriptionStatus below) so there's no separate backfill step
// to run before flipping this on.
export function billingEnabled(): boolean {
  return process.env.BILLING_ENABLED === "true";
}

/**
 * Resolves a user's current access status. Never throws — a DB error here
 * would otherwise take down every request, so it fails toward continued
 * access (`grandfathered`) rather than an accidental lockout; the actual
 * subscription lifecycle only starts mattering once BILLING_ENABLED is set,
 * at which point this is expected to be reliable.
 */
export async function resolveSubscriptionStatus(userId: string, email: string | null | undefined): Promise<SubscriptionStatus> {
  if (isAdmin(email)) return "admin";
  if (!billingEnabled()) return "grandfathered";

  try {
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
    if (sub) return sub.status as SubscriptionStatus;

    // No subscription row: either a pre-cutover user who never needed one
    // (grandfathered — their beta_invites was already active before billing
    // went live) or a brand-new self-serve signup that hasn't started a
    // trial yet (no access until they do).
    const normalized = email?.trim().toLowerCase();
    if (normalized) {
      const [invite] = await db.select().from(betaInvites).where(and(eq(betaInvites.email, normalized), eq(betaInvites.status, "active")));
      if (invite) return "grandfathered";
    }
    return "canceled";
  } catch {
    return "grandfathered";
  }
}

export async function getSubscription(userId: string): Promise<Subscription | null> {
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
  return sub ?? null;
}
