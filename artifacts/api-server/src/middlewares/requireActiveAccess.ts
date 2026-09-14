import { type Request, type Response, type NextFunction } from "express";
import { hasActiveAccess, resolveSubscriptionStatus, type SubscriptionStatus } from "../lib/billing";

declare global {
  namespace Express {
    interface Request {
      subscriptionStatus?: SubscriptionStatus;
    }
  }
}

// Gates every app route behind an active subscription (#18's grilling, Q6/
// Q11) — checked per request, not just at login, so a canceled/lapsed
// subscription cuts off access immediately rather than only on next login
// (the gap #86's beta-invite precedent has). A complete no-op while
// billingEnabled() is false (see lib/billing.ts) — resolveSubscriptionStatus
// itself already returns "grandfathered" in that case, so this exists
// mainly to attach req.subscriptionStatus for GET /billing/status and to
// give the frontend a single 402 to key its paywall off once billing is on.
export async function requireActiveAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const status = await resolveSubscriptionStatus(req.user.id, req.user.email);
  req.subscriptionStatus = status;
  if (!hasActiveAccess(status)) {
    res.status(402).json({ error: "Subscription required", status });
    return;
  }
  next();
}
