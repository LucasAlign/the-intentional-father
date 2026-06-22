import { randomBytes } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { googleCalendarConnections } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

const STATE_COOKIE = "google_calendar_state";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
};

type GoogleCalendarEvent = {
  id?: string;
  summary?: string;
  location?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
};

export type CalendarEvent = {
  id: number;
  date: string;
  time: string;
  title: string;
  sub: string;
  tag: string;
  kind: string;
};

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return proto + "://" + host;
}

function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured");
  }
  return { clientId, clientSecret };
}

function callbackUrl(req: Request): string {
  return getOrigin(req) + "/api/google-calendar/callback";
}

function tokenExpiry(expiresIn = 3600): Date {
  return new Date(Date.now() + Math.max(expiresIn - 60, 60) * 1000);
}

function eventId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  return -Math.abs(hash || 1);
}

function eventDate(start?: GoogleCalendarEvent["start"]): string | null {
  if (!start?.dateTime && !start?.date) return null;
  if (start.date) return start.date;
  return new Date(start.dateTime!).toISOString().slice(0, 10);
}

function eventTime(start?: GoogleCalendarEvent["start"]): string {
  if (!start?.dateTime) return "All day";
  return new Date(start.dateTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function mapEvent(event: GoogleCalendarEvent): CalendarEvent | null {
  const date = eventDate(event.start);
  if (!event.id || !date) return null;
  return {
    id: eventId(event.id),
    date,
    time: eventTime(event.start),
    title: event.summary || "Untitled event",
    sub: event.location || "",
    tag: "Google Calendar",
    kind: "work",
  };
}

async function refreshAccessToken(userId: string, refreshToken: string) {
  const { clientId, clientSecret } = getGoogleConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const response = await fetch(GOOGLE_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const tokens = await response.json() as GoogleTokenResponse;
  if (!response.ok || !tokens.access_token) throw new Error(tokens.error || "Google token refresh failed");
  await db.update(googleCalendarConnections).set({
    accessToken: tokens.access_token,
    expiresAt: tokenExpiry(tokens.expires_in),
    updatedAt: new Date(),
  }).where(eq(googleCalendarConnections.userId, userId));
  return tokens.access_token;
}

async function getAccessToken(userId: string): Promise<string | null> {
  const [connection] = await db.select().from(googleCalendarConnections).where(eq(googleCalendarConnections.userId, userId)).limit(1);
  if (!connection) return null;
  if (connection.expiresAt.getTime() > Date.now() + 30000) return connection.accessToken;
  return refreshAccessToken(userId, connection.refreshToken);
}

export async function fetchGoogleCalendarEventsForUser(userId: string, start: string, end: string): Promise<CalendarEvent[]> {
  const accessToken = await getAccessToken(userId);
  if (!accessToken) return [];

  const params = new URLSearchParams({
    timeMin: new Date(start + "T00:00:00.000Z").toISOString(),
    timeMax: new Date(end + "T23:59:59.999Z").toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
  });
  const response = await fetch(CALENDAR_EVENTS_URL + "?" + params.toString(), {
    headers: { Authorization: "Bearer " + accessToken },
  });
  if (!response.ok) throw new Error("Google Calendar events request failed");
  const data = await response.json() as { items?: GoogleCalendarEvent[] };
  return (data.items || []).map(mapEvent).filter((event): event is CalendarEvent => Boolean(event));
}

router.get("/google-calendar/status", async (req: Request, res: Response) => {
  try {
    const [connection] = await db.select({ userId: googleCalendarConnections.userId }).from(googleCalendarConnections).where(eq(googleCalendarConnections.userId, req.user!.id)).limit(1);
    res.json({ connected: Boolean(connection) });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch Google Calendar status");
    res.status(500).json({ error: "Failed to fetch calendar status" });
  }
});

router.get("/google-calendar/connect", (req: Request, res: Response) => {
  const { clientId } = getGoogleConfig();
  const state = randomBytes(24).toString("hex");
  res.cookie(STATE_COOKIE, state, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 10 * 60 * 1000 });
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl(req),
    response_type: "code",
    scope: CALENDAR_SCOPE,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });
  res.redirect(GOOGLE_AUTH_URL + "?" + params.toString());
});

router.get("/google-calendar/callback", async (req: Request, res: Response) => {
  try {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    if (!code || !state || state !== req.cookies?.[STATE_COOKIE]) {
      res.status(400).send("Invalid Google Calendar authorization response.");
      return;
    }

    const { clientId, clientSecret } = getGoogleConfig();
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: callbackUrl(req),
      grant_type: "authorization_code",
    });
    const response = await fetch(GOOGLE_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    const tokens = await response.json() as GoogleTokenResponse;
    if (!response.ok || !tokens.access_token) {
      req.log.error({ tokens }, "Google Calendar token exchange failed");
      res.status(502).send("Google Calendar connection failed.");
      return;
    }

    const existing = await db.select().from(googleCalendarConnections).where(eq(googleCalendarConnections.userId, req.user!.id)).limit(1);
    const refreshToken = tokens.refresh_token || existing[0]?.refreshToken;
    if (!refreshToken) {
      res.status(400).send("Google did not return a refresh token. Disconnect and try again with consent.");
      return;
    }

    await db.insert(googleCalendarConnections).values({
      userId: req.user!.id,
      googleEmail: req.user!.email ?? req.user!.id,
      accessToken: tokens.access_token,
      refreshToken,
      scope: tokens.scope || CALENDAR_SCOPE,
      expiresAt: tokenExpiry(tokens.expires_in),
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: [googleCalendarConnections.userId, googleCalendarConnections.googleEmail],
      set: {
        accessToken: tokens.access_token,
        refreshToken,
        scope: tokens.scope || CALENDAR_SCOPE,
        expiresAt: tokenExpiry(tokens.expires_in),
        updatedAt: new Date(),
      },
    });

    res.clearCookie(STATE_COOKIE, { path: "/" });
    res.redirect("/?calendar=connected");
  } catch (err) {
    req.log.error({ err }, "Google Calendar callback error");
    res.status(500).send("Google Calendar connection failed. Please try again.");
  }
});

router.get("/google-calendar/events", async (req: Request, res: Response) => {
  const start = typeof req.query.start === "string" ? req.query.start : new Date().toISOString().slice(0, 10);
  const end = typeof req.query.end === "string" ? req.query.end : start;
  try {
    res.json(await fetchGoogleCalendarEventsForUser(req.user!.id, start, end));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch Google Calendar events");
    res.status(502).json({ error: "Failed to fetch Google Calendar events" });
  }
});

router.post("/google-calendar/disconnect", async (req: Request, res: Response) => {
  try {
    const [connection] = await db.select().from(googleCalendarConnections).where(eq(googleCalendarConnections.userId, req.user!.id)).limit(1);
    if (connection) {
      await fetch(GOOGLE_REVOKE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: connection.refreshToken }),
      }).catch(() => undefined);
      await db.delete(googleCalendarConnections).where(eq(googleCalendarConnections.userId, req.user!.id));
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to disconnect Google Calendar");
    res.status(500).json({ error: "Failed to disconnect calendar" });
  }
});

export default router;
