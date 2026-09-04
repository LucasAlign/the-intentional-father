import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import stewardRouter from "./steward";
import googleCalendarRouter from "./googleCalendar";
import interviewRouter from "./interview";
import adminRouter from "./admin";
import remindersRouter from "./reminders";
import { requireAuth } from "../middlewares/requireAuth";
import { dbUserContext } from "../middlewares/dbUserContext";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
// Public (secret-keyed, not session-based) — see reminders.ts and #75.
router.use(remindersRouter);
// Establish authentication and the RLS-scoped database transaction once for
// the protected router stack. Applying these middlewares separately to each
// child router opens another pooled connection every time an earlier router
// does not match the request, which can exhaust the pool under parallel page
// loads and block even public OAuth callbacks.
router.use(requireAuth, dbUserContext);
router.use(googleCalendarRouter);
router.use(stewardRouter);
router.use(interviewRouter);
router.use(adminRouter);

export default router;
