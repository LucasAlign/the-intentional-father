import { eq } from "drizzle-orm";
import type { AnyPgColumn, PgTableWithColumns, TableConfig } from "drizzle-orm/pg-core";
import { db } from "@workspace/db";

type UserOwnedTable = PgTableWithColumns<TableConfig & { columns: { userId: AnyPgColumn } }>;

// Forward-only guardrail (app-level layer, alongside RLS): a table wrapper
// that requires a userId up front so a new route can't accidentally write a
// query against a per-user table without a filter. Existing call-sites
// aren't retrofitted to this — RLS is their backstop, not this helper.
// Loosely typed internally (Drizzle's generics don't specialize cleanly
// through a wrapper like this); RLS is what actually enforces isolation,
// this is a convenience against forgetting the filter in new code.
export function scopedTable(table: UserOwnedTable, userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = table as any;
  const userCol = table.userId;
  return {
    select: () => db.select().from(t).where(eq(userCol, userId)),
    insert: (values: Record<string, unknown>) => db.insert(t).values({ ...values, userId }),
    update: (values: Record<string, unknown>) => db.update(t).set(values).where(eq(userCol, userId)),
    delete: () => db.delete(t).where(eq(userCol, userId)),
  };
}
