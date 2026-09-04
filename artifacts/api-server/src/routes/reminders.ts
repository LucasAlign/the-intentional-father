import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { runReminderScan } from "../lib/reminders";
import { requireRemindersCronSecret } from "../middlewares/requireRemindersCronSecret";

const router: IRouter = Router();

// POST /api/reminders/run — meant to be called once a day by an external
// scheduler (e.g. a Replit Scheduled Deployment), not by the app itself.
// Public route (no session), protected by REMINDERS_CRON_SECRET instead —
// mounted ahead of requireAuth in routes/index.ts.
router.post("/reminders/run", requireRemindersCronSecret, async (req: Request, res: Response) => {
  try {
    const result = await runReminderScan(pool);
    res.json(result);
  } catch (err) {
    req.log?.error({ err }, "Reminder scan failed");
    res.status(500).json({ error: "Reminder scan failed" });
  }
});

export default router;
