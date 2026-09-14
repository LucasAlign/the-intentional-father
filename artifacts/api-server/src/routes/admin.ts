import { Router, Request, Response } from "express";
import { db, betaInvites, subscriptions, usersTable } from "@workspace/db";
import { desc, eq, and } from "drizzle-orm";
import { isAdmin } from "../lib/auth";
import { sendApprovalEmail } from "../lib/email";
import type { SubscriptionStatus } from "../lib/billing";

const router = Router();

// GET /api/admin/is-admin
router.get('/admin/is-admin', (req: Request, res: Response) => {
  res.json({ isAdmin: isAdmin(req.user?.email) });
});

// GET /api/admin/beta-invites
router.get('/admin/beta-invites', async (req: Request, res: Response) => {
  if (!isAdmin(req.user?.email)) { res.status(403).json({ error: 'Forbidden' }); return; }
  try {
    const rows = await db.select().from(betaInvites).orderBy(desc(betaInvites.invitedAt));
    res.json(rows);
  } catch (err) {
    req.log?.error({ err }, 'Error fetching beta invites');
    res.status(500).json({ error: 'Failed to fetch beta invites' });
  }
});

// PATCH /api/admin/beta-invites/:id
router.patch('/admin/beta-invites/:id', async (req: Request, res: Response) => {
  if (!isAdmin(req.user?.email)) { res.status(403).json({ error: 'Forbidden' }); return; }
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid invite id' }); return; }
    const { status } = req.body;
    if (status !== 'active' && status !== 'pending') {
      res.status(400).json({ error: 'Status must be "active" or "pending"' });
      return;
    }
    const [before] = await db.select().from(betaInvites).where(eq(betaInvites.id, id));
    const [row] = await db
      .update(betaInvites)
      .set({ status, acceptedAt: status === 'active' ? new Date() : null })
      .where(eq(betaInvites.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: 'Invite not found' }); return; }
    if (status === 'active' && before?.status !== 'active') {
      sendApprovalEmail(row.email).catch((err) => req.log?.error({ err }, 'Error sending approval email'));
    }
    res.json(row);
  } catch (err) {
    req.log?.error({ err }, 'Error updating beta invite');
    res.status(500).json({ error: 'Failed to update beta invite' });
  }
});

// #133 — unified account/billing status view, superseding the plain
// Pending/Active beta-invite split above for anything billing-related.
// Deliberately computed in JS over three small in-memory reads rather than
// one complex SQL join — this app's user base is small enough that this is
// simpler to read and safe, matching the style of other routes here.
interface AdminAccount {
  userId: string;
  email: string | null;
  status: SubscriptionStatus | "pending";
  // Only set when status is "pending" — lets the frontend re-use the
  // existing PATCH /admin/beta-invites/:id Approve action from this list.
  inviteId: number | null;
  // What to show as "why" alongside the status: a comped/grandfathered row
  // has no billing dates at all, a real Stripe subscription has one of
  // these depending on where it is in its lifecycle.
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  // "manual" here means an admin comp (see POST .../comp below), not a real
  // Stripe subscription — distinct from the no-row-at-all grandfathered case.
  provider: string | null;
  providerCustomerId: string | null;
  createdAt: string;
}

router.get("/admin/accounts", async (req: Request, res: Response) => {
  if (!isAdmin(req.user?.email)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const [users, subs, invites] = await Promise.all([
      db.select().from(usersTable),
      db.select().from(subscriptions),
      db.select().from(betaInvites),
    ]);
    const subByUserId = new Map(subs.map((s) => [s.userId, s]));
    const inviteByEmail = new Map(invites.map((i) => [i.email.toLowerCase(), i]));

    const accounts: AdminAccount[] = users.map((u) => {
      const sub = subByUserId.get(u.id);
      const invite = u.email ? inviteByEmail.get(u.email.toLowerCase()) : undefined;
      let status: SubscriptionStatus | "pending";
      if (isAdmin(u.email)) status = "admin";
      else if (sub) status = sub.status as SubscriptionStatus;
      else if (invite?.status === "active") status = "grandfathered";
      else if (invite?.status === "pending") status = "pending";
      else status = "canceled";

      return {
        userId: u.id,
        email: u.email,
        status,
        inviteId: status === "pending" ? (invite?.id ?? null) : null,
        trialEndsAt: sub?.trialEndsAt?.toISOString() ?? null,
        currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
        cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
        provider: sub?.provider ?? null,
        providerCustomerId: sub?.providerCustomerId ?? null,
        createdAt: u.createdAt.toISOString(),
      };
    });

    const summary = {
      total: accounts.length,
      active: accounts.filter((a) => a.status === "active").length,
      trialing: accounts.filter((a) => a.status === "trialing").length,
      pastDue: accounts.filter((a) => a.status === "past_due").length,
      grandfathered: accounts.filter((a) => a.status === "grandfathered").length,
    };

    res.json({ accounts, summary });
  } catch (err) {
    req.log?.error({ err }, "Error fetching admin accounts");
    res.status(500).json({ error: "Failed to fetch accounts" });
  }
});

// POST /api/admin/accounts/:userId/comp — grants free access without a
// Stripe subscription at all (a gift, not a discount) — distinct from the
// blanket ADMIN_EMAILS bypass, for comping one specific person (a pastor,
// family member, reviewer). Writes a `subscriptions` row with
// provider: "manual" so the accounts list (and this row's own presence) can
// tell a deliberate comp apart from an inferred pre-cutover grandfathering
// (which has no subscriptions row at all).
router.post("/admin/accounts/:userId/comp", async (req: Request, res: Response) => {
  if (!isAdmin(req.user?.email)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const userId = req.params.userId as string;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const values = { userId, status: "grandfathered", provider: "manual" };
    await db
      .insert(subscriptions)
      .values(values)
      .onConflictDoUpdate({ target: subscriptions.userId, set: values });
    res.json({ success: true });
  } catch (err) {
    req.log?.error({ err }, "Error comping account");
    res.status(500).json({ error: "Failed to comp account" });
  }
});

// POST /api/admin/accounts/:userId/uncomp — reverses a manual comp only
// (never touches a real Stripe-backed row) — the account falls back to
// whatever beta_invites/admin status it would otherwise resolve to.
router.post("/admin/accounts/:userId/uncomp", async (req: Request, res: Response) => {
  if (!isAdmin(req.user?.email)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const userId = req.params.userId as string;
    await db.delete(subscriptions).where(and(eq(subscriptions.userId, userId), eq(subscriptions.provider, "manual")));
    res.json({ success: true });
  } catch (err) {
    req.log?.error({ err }, "Error removing comp");
    res.status(500).json({ error: "Failed to remove comp" });
  }
});

export default router;
