import type { Request } from "express";

// Priority: PUBLIC_URL (explicit config) → browser-reported origin → server headers.
// PUBLIC_URL must win when set: Replit's proxy can forward a different host
// than the one registered as an OAuth redirect_uri (an internal/preview
// hostname instead of the public one), and x-forwarded-host is unreliable on
// mobile — falling back to raw headers risks a redirect_uri_mismatch.
export function getOrigin(req: Request): string {
  if (process.env.PUBLIC_URL) {
    return process.env.PUBLIC_URL.replace(/\/+$/, "");
  }
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}
