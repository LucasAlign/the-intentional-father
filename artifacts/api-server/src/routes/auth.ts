import * as oidc from "openid-client";
import crypto from "crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  GetCurrentAuthUserResponse,
  ExchangeMobileAuthorizationCodeBody,
  ExchangeMobileAuthorizationCodeResponse,
  LogoutMobileSessionResponse,
} from "@workspace/api-zod";
import { eq } from "drizzle-orm";
import { db, googleCalendarConnections, usersTable } from "@workspace/db";
import {
  clearSession,
  getOidcConfig,
  getSessionId,
  createSession,
  deleteSession,
  resolveInviteStatus,
  SESSION_COOKIE,
  SESSION_TTL,
  GOOGLE_ISSUER_URL,
  type OidcProvider,
  type SessionData,
} from "../lib/auth";

const OIDC_COOKIE_TTL = 10 * 60 * 1000;

const router: IRouter = Router();

function getOrigin(req: Request): string {
  if (process.env.PUBLIC_URL) {
    return process.env.PUBLIC_URL.replace(/\/+$/, "");
  }
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host =
    req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function setOidcCookie(res: Response, name: string, value: string) {
  res.cookie(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OIDC_COOKIE_TTL,
  });
}

function getSafeReturnTo(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/";
  }
  return value;
}

function tokenExpiry(expiresIn = 3600): Date {
  return new Date(Date.now() + Math.max(expiresIn - 60, 60) * 1000);
}

async function storeGoogleCalendarConnection(
  userId: string,
  googleEmail: string,
  tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers,
) {
  if (!tokens.access_token || !tokens.refresh_token) return;
  const grantedScope = tokens.scope ?? "";
  if (
    !grantedScope
      .split(" ")
      .includes("https://www.googleapis.com/auth/calendar.readonly")
  )
    return;

  await db
    .insert(googleCalendarConnections)
    .values({
      userId,
      googleEmail,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      scope: grantedScope,
      expiresAt: tokenExpiry(tokens.expiresIn()),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [googleCalendarConnections.userId, googleCalendarConnections.googleEmail],
      set: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        scope: grantedScope,
        expiresAt: tokenExpiry(tokens.expiresIn()),
        updatedAt: new Date(),
      },
    });
}

async function upsertUser(claims: Record<string, unknown>) {
  const userData = {
    id: claims.sub as string,
    email: (claims.email as string) || null,
    firstName: ((claims.given_name || claims.first_name) as string) || null,
    lastName: ((claims.family_name || claims.last_name) as string) || null,
    profileImageUrl: (claims.picture || claims.profile_image_url) as
      | string
      | null,
  };

  try {
    const [user] = await db
      .insert(usersTable)
      .values(userData)
      .onConflictDoUpdate({
        target: usersTable.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  } catch {
    // Email unique-constraint conflict: a stale record exists with the same email
    // but a different id (e.g. leftover from a previous auth system).
    // Update that record in-place, adopting the new canonical id.
    const [updated] = await db
      .update(usersTable)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(usersTable.email, userData.email!))
      .returning();
    return updated;
  }
}

router.get("/auth/user", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

// Google keeps its original bare paths (/login, /callback) so the redirect_uri
// already registered with the Google OAuth client doesn't need to change.
// Additional providers get their own /login/:provider + /callback/:provider.
function callbackPathFor(provider: OidcProvider): string {
  return provider === "google" ? "/api/callback" : `/api/callback/${provider}`;
}

function appendAuthError(target: string, error: string): string {
  const separator = target.includes("?") ? "&" : "?";
  return `${target}${separator}authError=${encodeURIComponent(error)}`;
}

function makeLoginHandler(provider: OidcProvider) {
  return async (req: Request, res: Response) => {
    const config = await getOidcConfig(provider);

    // Priority: PUBLIC_URL (explicit config) → browser-reported origin → server headers.
    // The browser value is the most reliable on mobile because x-forwarded-host can
    // resolve to a Replit dev tunnel URL instead of the published app domain.
    const rawClientOrigin = typeof req.query.appOrigin === "string" ? req.query.appOrigin : "";
    const clientOrigin = /^https?:\/\/[a-zA-Z0-9][a-zA-Z0-9.-]*(:\d+)?$/.test(rawClientOrigin)
      ? rawClientOrigin
      : null;
    const origin = process.env.PUBLIC_URL?.replace(/\/+$/, "")
      ?? clientOrigin
      ?? getOrigin(req);
    const callbackUrl = `${origin}${callbackPathFor(provider)}`;

    const returnTo = getSafeReturnTo(req.query.returnTo);

    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

    const redirectTo = oidc.buildAuthorizationUrl(config, {
      redirect_uri: callbackUrl,
      scope: "openid email profile",
      access_type: "offline",
      include_granted_scopes: "true",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      prompt: "consent select_account",
      state,
      nonce,
    });

    setOidcCookie(res, "code_verifier", codeVerifier);
    setOidcCookie(res, "nonce", nonce);
    setOidcCookie(res, "state", state);
    setOidcCookie(res, "return_to", returnTo);
    // Store the origin so the callback uses the exact same redirect_uri
    // and redirects the user back to the correct domain after login.
    setOidcCookie(res, "app_origin", origin);

    res.redirect(redirectTo.href);
  };
}

// Query params are not validated because the OIDC provider may include
// parameters not expressed in the schema.
function makeCallbackHandler(provider: OidcProvider) {
  return async (req: Request, res: Response) => {
    const config = await getOidcConfig(provider);
    const loginPath = provider === "google" ? "/api/login" : `/api/login/${provider}`;

    // Use the origin stored during login so the redirect_uri matches exactly.
    const storedOrigin = req.cookies?.app_origin;
    const callbackUrl = storedOrigin
      ? `${storedOrigin}${callbackPathFor(provider)}`
      : `${getOrigin(req)}${callbackPathFor(provider)}`;

    const codeVerifier = req.cookies?.code_verifier;
    const nonce = req.cookies?.nonce;
    const expectedState = req.cookies?.state;

    if (!codeVerifier || !expectedState) {
      res.redirect(loginPath);
      return;
    }

    const currentUrl = new URL(
      `${callbackUrl}?${new URL(req.url, `http://${req.headers.host}`).searchParams}`,
    );

    let tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
    try {
      tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
        pkceCodeVerifier: codeVerifier,
        expectedNonce: nonce,
        expectedState,
        idTokenExpected: true,
      });
    } catch {
      res.redirect(loginPath);
      return;
    }

    const returnTo = getSafeReturnTo(req.cookies?.return_to);

    res.clearCookie("code_verifier", { path: "/" });
    res.clearCookie("nonce", { path: "/" });
    res.clearCookie("state", { path: "/" });
    res.clearCookie("return_to", { path: "/" });
    res.clearCookie("app_origin", { path: "/" });

    const claims = tokens.claims();
    if (!claims) {
      res.redirect(loginPath);
      return;
    }

    let dbUser: Awaited<ReturnType<typeof upsertUser>>;
    try {
      dbUser = await upsertUser(claims as unknown as Record<string, unknown>);
    } catch (err) {
      req.log?.error({ err }, "Failed to upsert user during login");
      res.status(500).json({ error: "Login failed — could not save user." });
      return;
    }

    const redirectTarget = storedOrigin ? `${storedOrigin}${returnTo}` : returnTo;

    if (!dbUser.email) {
      res.redirect(appendAuthError(redirectTarget, "pending_approval"));
      return;
    }

    const inviteStatus = await resolveInviteStatus(dbUser.email);
    if (inviteStatus !== "active") {
      res.redirect(appendAuthError(redirectTarget, "pending_approval"));
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const sessionData: SessionData = {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        profileImageUrl: dbUser.profileImageUrl,
      },
      provider,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
    };

    if (provider === "google") {
      try {
        await storeGoogleCalendarConnection(dbUser.id, dbUser.email, tokens);
      } catch (err) {
        req.log?.warn({ err }, "Failed to store Google Calendar connection during login");
      }
    }

    let sid: string;
    try {
      sid = await createSession(sessionData);
    } catch (err) {
      req.log?.error({ err }, "Failed to create session during login");
      res.status(500).json({ error: "Login failed — could not create session." });
      return;
    }

    setSessionCookie(res, sid);
    // Redirect to the full origin + path so mobile users land back on the
    // correct domain, not the Replit dev tunnel URL.
    res.redirect(redirectTarget);
  };
}

router.get("/login", makeLoginHandler("google"));
router.get("/callback", makeCallbackHandler("google"));
router.get("/login/microsoft", makeLoginHandler("microsoft"));
router.get("/callback/microsoft", makeCallbackHandler("microsoft"));

// No OAuth round-trip: creates a fresh throwaway user and session directly,
// so anyone can try the app without a Google/Microsoft account. Bypasses the
// beta-invite gate on purpose — that gate only protects the real providers.
router.get("/login/demo", async (req: Request, res: Response) => {
  const rawClientOrigin = typeof req.query.appOrigin === "string" ? req.query.appOrigin : "";
  const clientOrigin = /^https?:\/\/[a-zA-Z0-9][a-zA-Z0-9.-]*(:\d+)?$/.test(rawClientOrigin)
    ? rawClientOrigin
    : null;
  const origin = process.env.PUBLIC_URL?.replace(/\/+$/, "") ?? clientOrigin ?? getOrigin(req);
  const returnTo = getSafeReturnTo(req.query.returnTo);

  let dbUser: Awaited<ReturnType<typeof upsertUser>>;
  try {
    const [user] = await db
      .insert(usersTable)
      .values({
        email: `demo-${crypto.randomUUID()}@demo.local`,
        firstName: "Demo",
        lastName: "User",
      })
      .returning();
    dbUser = user;
  } catch (err) {
    req.log?.error({ err }, "Failed to create demo user");
    res.status(500).json({ error: "Demo login failed — could not create user." });
    return;
  }

  const sessionData: SessionData = {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      profileImageUrl: dbUser.profileImageUrl,
    },
    provider: "demo",
    access_token: "demo",
  };

  let sid: string;
  try {
    sid = await createSession(sessionData);
  } catch (err) {
    req.log?.error({ err }, "Failed to create session during demo login");
    res.status(500).json({ error: "Demo login failed — could not create session." });
    return;
  }

  setSessionCookie(res, sid);
  res.redirect(`${origin}${returnTo}`);
});

router.get("/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.redirect("/");
});

router.post(
  "/mobile-auth/token-exchange",
  async (req: Request, res: Response) => {
    const parsed = ExchangeMobileAuthorizationCodeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required parameters" });
      return;
    }

    const { code, code_verifier, redirect_uri, state, nonce } = parsed.data;

    try {
      const config = await getOidcConfig("google");

      const callbackUrl = new URL(redirect_uri);
      callbackUrl.searchParams.set("code", code);
      callbackUrl.searchParams.set("state", state);
      callbackUrl.searchParams.set("iss", GOOGLE_ISSUER_URL);

      const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
        pkceCodeVerifier: code_verifier,
        expectedNonce: nonce ?? undefined,
        expectedState: state,
        idTokenExpected: true,
      });

      const claims = tokens.claims();
      if (!claims) {
        res.status(401).json({ error: "No claims in ID token" });
        return;
      }

      const dbUser = await upsertUser(
        claims as unknown as Record<string, unknown>,
      );

      if (!dbUser.email || (await resolveInviteStatus(dbUser.email)) !== "active") {
        res.status(401).json({ error: "Your account is pending approval." });
        return;
      }

      const now = Math.floor(Date.now() / 1000);
      const sessionData: SessionData = {
        user: {
          id: dbUser.id,
          email: dbUser.email,
          firstName: dbUser.firstName,
          lastName: dbUser.lastName,
          profileImageUrl: dbUser.profileImageUrl,
        },
        provider: "google",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
      };

      try {
        await storeGoogleCalendarConnection(dbUser.id, dbUser.email ?? dbUser.id, tokens);
      } catch (err) {
        req.log.warn({ err }, "Failed to store Google Calendar connection during mobile login");
      }

      const sid = await createSession(sessionData);
      res.json(ExchangeMobileAuthorizationCodeResponse.parse({ token: sid }));
    } catch (err) {
      req.log.error({ err }, "Mobile token exchange error");
      res.status(500).json({ error: "Token exchange failed" });
    }
  },
);

router.post("/mobile-auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (sid) {
    await deleteSession(sid);
  }
  res.json(LogoutMobileSessionResponse.parse({ success: true }));
});

export default router;
