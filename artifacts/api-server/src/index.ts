import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(
    "Invalid PORT value: \"" + rawPort + "\"",
  );
}

async function ensureAuthTables(): Promise<void> {
  await pool.query([
    "CREATE EXTENSION IF NOT EXISTS pgcrypto",
    "CREATE TABLE IF NOT EXISTS sessions (sid varchar PRIMARY KEY, sess jsonb NOT NULL, expire timestamp NOT NULL)",
    "CREATE INDEX IF NOT EXISTS \"IDX_session_expire\" ON sessions (expire)",
    "CREATE TABLE IF NOT EXISTS users (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), email varchar UNIQUE, first_name varchar, last_name varchar, profile_image_url varchar, created_at timestamp with time zone NOT NULL DEFAULT now(), updated_at timestamp with time zone NOT NULL DEFAULT now())",
    "CREATE TABLE IF NOT EXISTS beta_invites (id serial PRIMARY KEY, email varchar NOT NULL UNIQUE, status varchar NOT NULL DEFAULT 'active', invited_at timestamp with time zone NOT NULL DEFAULT now(), accepted_at timestamp with time zone)",
    "CREATE INDEX IF NOT EXISTS \"IDX_beta_invites_email\" ON beta_invites (email)",
    "CREATE TABLE IF NOT EXISTS email_login_codes (id serial PRIMARY KEY, email varchar NOT NULL, code_hash text NOT NULL, expires_at timestamp with time zone NOT NULL, consumed_at timestamp with time zone, attempts integer NOT NULL DEFAULT 0, created_at timestamp with time zone NOT NULL DEFAULT now())",
    "CREATE INDEX IF NOT EXISTS \"IDX_email_login_codes_email\" ON email_login_codes (email)",
    "CREATE TABLE IF NOT EXISTS journal_entries (id serial PRIMARY KEY, date text NOT NULL UNIQUE, reflect text NOT NULL DEFAULT \x27\x27, commit_text text NOT NULL DEFAULT \x27\x27, created_at timestamp NOT NULL DEFAULT now())",
    "CREATE TABLE IF NOT EXISTS tasks (id serial PRIMARY KEY, text text NOT NULL, category text NOT NULL DEFAULT \x27\x27, notes text NOT NULL DEFAULT \x27\x27, partial boolean NOT NULL DEFAULT false, done boolean NOT NULL DEFAULT false, created_at timestamp NOT NULL DEFAULT now())",
    "CREATE TABLE IF NOT EXISTS chat_messages (id serial PRIMARY KEY, role text NOT NULL, content text NOT NULL, date text NOT NULL, created_at timestamp NOT NULL DEFAULT now())",
    "CREATE TABLE IF NOT EXISTS commits (id serial PRIMARY KEY, text text NOT NULL, made_date text NOT NULL, done boolean NOT NULL DEFAULT false, created_at timestamp NOT NULL DEFAULT now())",
    "CREATE TABLE IF NOT EXISTS jobs (id serial PRIMARY KEY, biz text NOT NULL, name text NOT NULL, stage text NOT NULL DEFAULT \x27\x27, due text NOT NULL DEFAULT \x27\x27, pct integer NOT NULL DEFAULT 0, created_at timestamp NOT NULL DEFAULT now())",
    "CREATE TABLE IF NOT EXISTS coming_up (id serial PRIMARY KEY, date text NOT NULL, time text NOT NULL, title text NOT NULL, sub text NOT NULL DEFAULT \x27\x27, tag text NOT NULL DEFAULT \x27\x27, kind text NOT NULL DEFAULT \x27work\x27, created_at timestamp NOT NULL DEFAULT now())",
    "CREATE TABLE IF NOT EXISTS profile (user_id text PRIMARY KEY, data jsonb, onboarded boolean NOT NULL DEFAULT false, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now())",
    "CREATE TABLE IF NOT EXISTS interview_messages (id serial PRIMARY KEY, user_id text NOT NULL, role text NOT NULL, content text NOT NULL, created_at timestamp NOT NULL DEFAULT now())",
    "CREATE TABLE IF NOT EXISTS google_calendar_connections (id serial PRIMARY KEY, user_id text NOT NULL, google_email text NOT NULL, access_token text NOT NULL, refresh_token text NOT NULL, scope text NOT NULL DEFAULT \x27\x27, expires_at timestamp NOT NULL, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now())",
    "ALTER TABLE google_calendar_connections ADD COLUMN IF NOT EXISTS id serial",
    "ALTER TABLE google_calendar_connections ADD COLUMN IF NOT EXISTS google_email text",
    "UPDATE google_calendar_connections SET google_email = user_id WHERE google_email IS NULL",
    "ALTER TABLE google_calendar_connections ALTER COLUMN google_email SET NOT NULL",
    "CREATE UNIQUE INDEX IF NOT EXISTS gcal_user_email_unique ON google_calendar_connections (user_id, google_email)",
  ].join(";\n") + ";");
}

try {
  await ensureAuthTables();
} catch (err) {
  logger.error({ err }, "Failed to ensure auth database tables");
  process.exit(1);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
