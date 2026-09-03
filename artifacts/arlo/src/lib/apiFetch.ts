// Every request to our own API goes through this instead of bare fetch — an
// unresponsive connection (dead network, a stalled OIDC token refresh in
// authMiddleware on the server, a stuck upstream OpenAI call, ...) would
// otherwise hang indefinitely with no client-side recovery: no error, no
// timeout, the caller's save/load just sits there forever with its button
// stuck reading "Saving…" (#76). Aborting after a bound turns that into an
// ordinary rejection every call site's existing try/catch (or the
// save-status hooks that wrap every save callback the same way) is already
// set up to handle as a failure.
export const API_TIMEOUT_MS = 15_000;

export function apiFetch(input: RequestInfo | URL, init?: RequestInit, timeoutMs = API_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}
