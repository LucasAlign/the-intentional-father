import { useState, useEffect, useCallback } from "react";
import type { AuthUser } from "@workspace/api-client-react";

export type { AuthUser };

export type AuthProvider = "google" | "microsoft" | "demo";

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  pendingApproval: boolean;
  login: (provider?: AuthProvider) => void;
  logout: () => void;
  startEmailLogin: (email: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  verifyEmailLogin: (
    email: string,
    code: string,
    name?: string,
  ) => Promise<{ ok: true; pendingApproval: boolean } | { ok: false; error: string }>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingApproval, setPendingApproval] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("authError") === "pending_approval") {
      setPendingApproval(true);
      url.searchParams.delete("authError");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/user", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ user: AuthUser | null }>;
      })
      .then((data) => {
        if (!cancelled) {
          setUser(data.user ?? null);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback((provider: AuthProvider = "google") => {
    const base = import.meta.env.BASE_URL.replace(/\/+$/, "") || "/";
    // Pass the browser's real origin so the server can build the correct
    // redirect_uri regardless of what proxy headers say.
    const appOrigin = window.location.origin;
    const loginPath = provider === "google" ? "/api/login" : `/api/login/${provider}`;
    window.location.href = `${loginPath}?returnTo=${encodeURIComponent(base)}&appOrigin=${encodeURIComponent(appOrigin)}`;
  }, []);

  const logout = useCallback(() => {
    window.location.href = "/api/logout";
  }, []);

  const startEmailLogin = useCallback(async (email: string) => {
    try {
      const res = await fetch("/api/login/email/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return { ok: false as const, error: data.error ?? "Could not send the code." };
      return { ok: true as const };
    } catch {
      return { ok: false as const, error: "Could not send the code. Check your connection." };
    }
  }, []);

  const verifyEmailLogin = useCallback(async (email: string, code: string, name?: string) => {
    try {
      const res = await fetch("/api/login/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(name ? { email, code, name } : { email, code }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        user?: AuthUser | null;
        pendingApproval?: boolean;
      };
      if (!res.ok) return { ok: false as const, error: data.error ?? "That code isn't right." };
      if (data.pendingApproval) {
        setPendingApproval(true);
        return { ok: true as const, pendingApproval: true };
      }
      setUser(data.user ?? null);
      return { ok: true as const, pendingApproval: false };
    } catch {
      return { ok: false as const, error: "Could not verify the code. Check your connection." };
    }
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    pendingApproval,
    login,
    logout,
    startEmailLogin,
    verifyEmailLogin,
  };
}
