import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import arloRouter from "./arlo";
import googleCalendarRouter from "./googleCalendar";
import interviewRouter from "./interview";
import adminRouter from "./admin";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(requireAuth, googleCalendarRouter);
router.use(requireAuth, arloRouter);
router.use(requireAuth, interviewRouter);
router.use(requireAuth, adminRouter);

export default router;
