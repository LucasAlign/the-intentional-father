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

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    pendingApproval,
    login,
    logout,
  };
}
