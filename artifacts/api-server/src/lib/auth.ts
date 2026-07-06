import * as client from "openid-client";
import crypto from "crypto";
import { type Request, type Response } from "express";
import { db, sessionsTable, betaInvites } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { AuthUser } from "@workspace/api-zod";

export const GOOGLE_ISSUER_URL =
  process.env.GOOGLE_ISSUER_URL ?? "https://accounts.google.com";
export const MICROSOFT_ISSUER_URL =
  process.env.MICROSOFT_ISSUER_URL ?? "https://login.microsoftonline.com/common/v2.0";
export const SESSION_COOKIE = "sid";
export const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;

export type Provider = "google" | "microsoft";

const PROVIDER_CONFIG: Record<
  Provider,
  { issuer: string; clientIdEnv: string; clientSecretEnv: string }
> = {
  google: {
    issuer: GOOGLE_ISSUER_URL,
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
  },
  microsoft: {
    issuer: MICROSOFT_ISSUER_URL,
    clientIdEnv: "MICROSOFT_CLIENT_ID",
    clientSecretEnv: "MICROSOFT_CLIENT_SECRET",
  },
};

export interface SessionData {
  user: AuthUser;
  provider: Provider;
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

const oidcConfigs = new Map<Provider, client.Configuration>();

export async function getOidcConfig(provider: Provider): Promise<client.Configuration> {
  const cached = oidcConfigs.get(provider);
  if (cached) return cached;

  const { issuer, clientIdEnv, clientSecretEnv } = PROVIDER_CONFIG[provider];
  const clientId = process.env[clientIdEnv];
  const clientSecret = process.env[clientSecretEnv];
  if (!clientId || !clientSecret) {
    throw new Error(`${clientIdEnv} and ${clientSecretEnv} must be configured`);
  }

  const config = await client.discovery(new URL(issuer), clientId, clientSecret);
  oidcConfigs.set(provider, config);
  return config;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Looks up the invite status for an email, auto-creating a `pending` row for
 * first-time sign-in attempts so unapproved users can be reviewed later.
 */
export async function resolveInviteStatus(email: string): Promise<string> {
  const normalized = normalizeEmail(email);

  const [existing] = await db
    .select()
    .from(betaInvites)
    .where(eq(betaInvites.email, normalized));
  if (existing) return existing.status;

  const [created] = await db
    .insert(betaInvites)
    .values({ email: normalized, status: "pending" })
    .onConflictDoNothing()
    .returning();
  if (created) return created.status;

  // Lost an insert race with another concurrent sign-in attempt; re-read.
  const [row] = await db
    .select()
    .from(betaInvites)
    .where(eq(betaInvites.email, normalized));
  return row?.status ?? "pending";
}

export async function createSession(data: SessionData): Promise<string> {
  const sid = crypto.randomBytes(32).toString("hex");
  await db.insert(sessionsTable).values({
    sid,
    sess: data as unknown as Record<string, unknown>,
    expire: new Date(Date.now() + SESSION_TTL),
  });
  return sid;
}

export async function getSession(sid: string): Promise<SessionData | null> {
  const [row] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.sid, sid));

  if (!row || row.expire < new Date()) {
    if (row) await deleteSession(sid);
    return null;
  }

  return row.sess as unknown as SessionData;
}

export async function updateSession(
  sid: string,
  data: SessionData,
): Promise<void> {
  await db
    .update(sessionsTable)
    .set({
      sess: data as unknown as Record<string, unknown>,
      expire: new Date(Date.now() + SESSION_TTL),
    })
    .where(eq(sessionsTable.sid, sid));
}

export async function deleteSession(sid: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.sid, sid));
}

export async function clearSession(res: Response, sid?: string): Promise<void> {
  if (sid) await deleteSession(sid);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export function getSessionId(req: Request): string | undefined {
  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return req.cookies?.[SESSION_COOKIE];
}
