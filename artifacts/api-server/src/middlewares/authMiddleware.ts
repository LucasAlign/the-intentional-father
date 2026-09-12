import * as oidc from "openid-client";
import { type Request, type Response, type NextFunction } from "express";
import type { AuthUser } from "@workspace/api-zod";
import {
  clearSession,
  getOidcConfig,
  getSessionId,
  getSession,
  setSessionCookie,
  updateSession,
  type SessionData,
} from "../lib/auth";

declare global {
  namespace Express {
    interface User extends AuthUser {}

    interface Request {
      isAuthenticated(): this is AuthedRequest;

      user?: User | undefined;
    }

    export interface AuthedRequest {
      user: User;
    }
  }
}

// #108 — a failed refresh here must never end the app session. This stored
// access/refresh token isn't actually consumed by anything (Google Calendar
// keeps its own independent connection + tokens in googleCalendarConnections,
// refreshed separately in routes/googleCalendar.ts), so there's nothing lost
// by leaving it stale on a refresh failure — only something to lose (the
// user's entire login) by treating that failure as fatal. Before this fix,
// any transient refresh error (provider hiccup, revoked consent, network
// blip) logged a Google/Microsoft user out entirely, far short of the
// 90-day SESSION_TTL the session row and cookie both otherwise honor.
async function refreshIfExpired(
  sid: string,
  session: SessionData,
): Promise<SessionData> {
  const now = Math.floor(Date.now() / 1000);
  if (session.provider === "demo" || session.provider === "email" || !session.expires_at || now <= session.expires_at) return session;

  if (!session.refresh_token) return session;

  try {
    const config = await getOidcConfig(session.provider);
    const tokens = await oidc.refreshTokenGrant(
      config,
      session.refresh_token,
    );
    session.access_token = tokens.access_token;
    session.refresh_token = tokens.refresh_token ?? session.refresh_token;
    session.expires_at = tokens.expiresIn()
      ? now + tokens.expiresIn()!
      : session.expires_at;
    await updateSession(sid, session);
  } catch {
    // Leave the session's stale access/refresh_token/expires_at as-is.
  }
  return session;
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  const sid = getSessionId(req);
  if (!sid) {
    next();
    return;
  }

  try {
    const session = await getSession(sid);
    if (!session?.user?.id) {
      await clearSession(res, sid);
      next();
      return;
    }

    const refreshed = await refreshIfExpired(sid, session);

    req.user = refreshed.user;
    // Sliding expiration keeps active users signed in across normal app use.
    // Extend the DB row alongside the cookie — refreshIfExpired only touches
    // it on OIDC token refresh, which never happens for demo sessions, so
    // without this a demo user active every day still hard-expires at
    // creation+30d while their cookie looks freshly slid.
    setSessionCookie(res, sid);
    await updateSession(sid, refreshed);
  } catch {
    // DB error — treat as unauthenticated rather than crashing every request
  }

  next();
}
