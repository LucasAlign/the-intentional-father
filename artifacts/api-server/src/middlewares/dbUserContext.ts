import type { NextFunction, Request, Response } from "express";
import { beginUserSession, type UserDbSession } from "@workspace/db";

// Must run after requireAuth (needs req.user). Scopes every `db` query for
// the rest of this request to a single transaction with Postgres's
// app.current_user_id session variable set — the value each per-user
// table's RLS policy checks. Commits on a non-5xx response, rolls back
// otherwise, and always releases the connection back to the pool.
export async function dbUserContext(req: Request, res: Response, next: NextFunction): Promise<void> {
  let session: UserDbSession;
  try {
    session = await beginUserSession(req.user!.id);
  } catch (err) {
    next(err);
    return;
  }
  let settled = false;
  function settle(commit: boolean) {
    if (settled) return;
    settled = true;
    void (commit ? session.commit() : session.rollback()).catch((err: unknown) => req.log?.error({ err }, "Failed to close request DB session"));
  }
  res.on("finish", () => settle(res.statusCode < 500));
  res.on("close", () => settle(false));
  session.runSync(next);
}
