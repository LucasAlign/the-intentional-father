import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import billingWebhookRouter from "./routes/billingWebhook";
import { authMiddleware } from "./middlewares/authMiddleware";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
// Stripe's webhook (#18) needs the exact raw bytes it signed to verify a
// delivery's signature — billingWebhookRouter applies express.raw() as
// route-level middleware on just its one route (not here, which would make
// every other JSON route's body arrive as an unparsed Buffer too), but the
// whole router still has to be mounted ahead of the global express.json()
// below, since that would otherwise already have consumed the body by the
// time a later-mounted route-level parser got a turn. Also ahead of
// authMiddleware, since Stripe calls this directly with no session at all.
app.use("/api", billingWebhookRouter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);

app.use("/api", router);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err, url: req.url, method: req.method }, "Unhandled error");
  if (res.headersSent) return;
  res.status(500).json({ error: "Internal server error" });
});

export default app;
