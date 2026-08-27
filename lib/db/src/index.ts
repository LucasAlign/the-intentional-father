import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const poolDb = drizzle(pool, { schema });

type Scoped = { db: NodePgDatabase<typeof schema> };
const requestContext = new AsyncLocalStorage<Scoped>();

// Every per-user table has a Postgres RLS policy keyed on the
// app.current_user_id session variable. Queries issued through this `db`
// export transparently use the request's scoped, RLS-primed connection when
// called inside beginUserSession()'s `runSync`; outside that (bootstrap,
// scripts), they fall back to the plain pool — which RLS then denies for
// any per-user table, since no user context is set. That's intentional
// fail-closed behavior, not a bug; bootstrap code that legitimately needs
// to touch these tables uses its own elevated session (see api-server's
// ensureAuthTables).
export const db: NodePgDatabase<typeof schema> = new Proxy(poolDb, {
  get(target, prop, receiver) {
    const scoped = requestContext.getStore();
    return Reflect.get(scoped ? scoped.db : target, prop, receiver);
  },
});

export type UserDbSession = {
  /** Establishes the session as the AsyncLocalStorage context for the duration of `fn` (sync or async). */
  run: <T>(fn: () => T) => T;
  /** Commits the underlying transaction and returns the connection to the pool. Idempotent. */
  commit: () => Promise<void>;
  /** Rolls back the underlying transaction and returns the connection to the pool. Idempotent. */
  rollback: () => Promise<void>;
};

/**
 * Opens a dedicated connection scoped to one Postgres transaction with
 * app.current_user_id set to `userId` — the session variable every per-user
 * table's RLS policy checks. Used by requireAuth's chain so a whole request
 * (any query issued via `db`, old code and new alike) is covered, and by any
 * one-off write that happens outside that chain (e.g. storing a Google
 * Calendar connection during the OIDC callback, before a session exists).
 *
 * Caller is responsible for calling exactly one of commit()/rollback().
 */
export async function beginUserSession(userId: string): Promise<UserDbSession> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [userId]);
  } catch (err) {
    client.release(err instanceof Error ? err : new Error(String(err)));
    throw err;
  }
  const scopedDb = drizzle(client, { schema });
  let settled = false;
  async function end(commitTx: boolean): Promise<void> {
    if (settled) return;
    settled = true;
    try {
      await client.query(commitTx ? "COMMIT" : "ROLLBACK");
      client.release();
    } catch (err) {
      // COMMIT/ROLLBACK itself failed — the connection may be left in an
      // unknown transaction state, so discard it rather than returning it
      // to the pool for reuse.
      client.release(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }
  return {
    run: (fn) => requestContext.run({ db: scopedDb }, fn),
    commit: () => end(true),
    rollback: () => end(false),
  };
}

/**
 * Self-contained version of beginUserSession for one-off async DB work that
 * needs to happen *between* other slow, non-DB work within a single request
 * — e.g. a route that reads, calls a slow external API, then writes, and
 * shouldn't hold a pooled connection open for the external call. Opens its
 * own session, scopes `fn` to it, and always commits/rolls back before
 * returning — independent of any ambient session (such as the one
 * dbUserContext already holds open for the rest of the request).
 */
export async function withUserSession<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const session = await beginUserSession(userId);
  try {
    const result = await session.run(fn);
    await session.commit();
    return result;
  } catch (err) {
    await session.rollback();
    throw err;
  }
}

export * from "./schema";
