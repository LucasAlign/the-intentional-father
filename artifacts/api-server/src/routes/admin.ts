import { Router, Request, Response } from "express";
import { db, betaInvites } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { isAdmin } from "../lib/auth";

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
    const [row] = await db
      .update(betaInvites)
      .set({ status, acceptedAt: status === 'active' ? new Date() : null })
      .where(eq(betaInvites.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: 'Invite not found' }); return; }
    res.json(row);
  } catch (err) {
    req.log?.error({ err }, 'Error updating beta invite');
    res.status(500).json({ error: 'Failed to update beta invite' });
  }
});

export default router;
