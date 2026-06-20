import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import arloRouter from "./arlo";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(requireAuth, arloRouter);

export default router;
