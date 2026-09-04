import { type Request, type Response, type NextFunction } from "express";

// Guards the reminder-scan endpoint (#75): it has no logged-in user (an
// external scheduler calls it once a day, since the app's Replit autoscale
// deployment has no persistent process of its own to run this), so it can't
// use requireAuth. REMINDERS_CRON_SECRET must be set for this endpoint to
// ever succeed — unset means "not configured yet", not "open to anyone".
export function requireRemindersCronSecret(req: Request, res: Response, next: NextFunction): void {
  const configured = process.env.REMINDERS_CRON_SECRET;
  if (!configured) {
    res.status(503).json({ error: "Reminders are not configured (REMINDERS_CRON_SECRET unset)" });
    return;
  }
  const header = req.headers.authorization;
  if (header !== `Bearer ${configured}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
