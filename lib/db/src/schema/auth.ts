import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

// (IMPORTANT) This table is used for OIDC login sessions, don't drop it.
export const sessionsTable = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// (IMPORTANT) This table is used for OIDC login sessions, don't drop it.
export const usersTable = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  // The OIDC refresh token from this user's most recent login, reused on
  // later logins when the provider doesn't hand back a fresh one (Google
  // only reliably returns one on first consent) so the session stays
  // refreshable without forcing the user to re-approve every time (#57).
  refreshToken: text("refresh_token"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type UpsertUser = typeof usersTable.$inferInsert;
export type User = typeof usersTable.$inferSelect;


export const betaInvites = pgTable(
  "beta_invites",
  {
    id: serial("id").primaryKey(),
    email: varchar("email").notNull().unique(),
    status: varchar("status").notNull().default("active"),
    invitedAt: timestamp("invited_at", { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  },
  (table) => [index("IDX_beta_invites_email").on(table.email)],
);

export const emailLoginCodes = pgTable(
  "email_login_codes",
  {
    id: serial("id").primaryKey(),
    email: varchar("email").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("IDX_email_login_codes_email").on(table.email)],
);

export type BetaInvite = typeof betaInvites.$inferSelect;
export type EmailLoginCode = typeof emailLoginCodes.$inferSelect;

// #18 — billing. One row per user (1:1, this app has no team/household
// billing construct — see #18's grilling). `status` is deliberately OUR OWN
// vocabulary (lib/billing.ts's SubscriptionStatus), not the payment
// provider's raw status strings — the webhook handler is the one place that
// translates a provider event into one of these values, so every other
// access-control check reads a provider-agnostic status. That's the seam a
// future provider swap (Stripe -> something else) would need to redo; it
// does not eliminate the real cost of a swap (existing subscribers' stored
// payment methods don't transfer between providers), but it keeps that cost
// contained to this table and the provider-specific route handlers instead
// of leaking into every place access gets checked.
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull().unique(),
    status: varchar("status").notNull(),
    provider: varchar("provider").notNull().default("stripe"),
    providerCustomerId: varchar("provider_customer_id"),
    providerSubscriptionId: varchar("provider_subscription_id"),
    // "month" | "year" once a paying plan is chosen; null while trialing,
    // grandfathered, or admin-comped, since there's no billed interval yet.
    priceInterval: varchar("price_interval"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("IDX_subscriptions_user_id").on(table.userId),
    index("IDX_subscriptions_provider_customer_id").on(table.providerCustomerId),
  ],
);

export type Subscription = typeof subscriptions.$inferSelect;
