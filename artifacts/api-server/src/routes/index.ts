import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import stewardRouter from "./steward";
import googleCalendarRouter from "./googleCalendar";
import interviewRouter from "./interview";
import adminRouter from "./admin";
import { requireAuth } from "../middlewares/requireAuth";
import { dbUserContext } from "../middlewares/dbUserContext";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(requireAuth, dbUserContext, googleCalendarRouter);
router.use(requireAuth, dbUserContext, stewardRouter);
router.use(requireAuth, dbUserContext, interviewRouter);
router.use(requireAuth, dbUserContext, adminRouter);

export default router;
