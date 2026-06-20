import { Router, type IRouter } from "express";
import healthRouter from "./health";
import arloRouter from "./arlo";

const router: IRouter = Router();

router.use(healthRouter);
router.use(arloRouter);

export default router;
