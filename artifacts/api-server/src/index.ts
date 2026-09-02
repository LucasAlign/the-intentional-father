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

// Every table with a user_id column gets an RLS policy scoped to
// app.current_user_id. Table-owner queries bypass RLS by default in
// Postgres unless FORCE is set — this app connects as the owning role for
// its normal per-user queries too (lib/db's beginUserSession), so FORCE is
// required for these policies to actually apply to them, not just to
// hypothetical other roles.
const RLS_TABLES = [
  "journal_entries", "tasks", "task_completions", "chat_messages",
  "commits", "jobs", "coming_up", "google_calendar_connections", "profile",
  "pulse_checks", "relationships", "pursuits",
];

// Guarded per-table: this bootstrap's own CREATE TABLE statements below
// predate the multi-user migration and don't all define user_id (Drizzle
// push added it separately on the tables that already exist in production) —
// a blind ALTER/CREATE POLICY would crash server boot outright on any
// environment where a table doesn't exist yet or lacks the column. Skip and
// warn instead of failing boot; a skipped table is unprotected by RLS but
// the app still starts, and the gap is loud (logged), not silent.
function rlsStatements(): string {
  return RLS_TABLES.map((table) => `
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = '${table}' AND column_name = 'user_id'
      ) THEN
        EXECUTE 'ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY';
        EXECUTE 'ALTER TABLE ${table} FORCE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS ${table}_isolation ON ${table}';
        EXECUTE 'CREATE POLICY ${table}_isolation ON ${table}
          USING (current_setting(''app.bypass_rls'', true) = ''true'' OR user_id = current_setting(''app.current_user_id'', true))
          WITH CHECK (current_setting(''app.bypass_rls'', true) = ''true'' OR user_id = current_setting(''app.current_user_id'', true))';
      ELSE
        RAISE WARNING 'Skipping RLS on % — no user_id column found', '${table}';
      END IF;
    END $$;
  `).join("\n");
}

async function ensureAuthTables(): Promise<void> {
  // A dedicated client, not the shared pool.query() — app.bypass_rls is set
  // session-scoped (not LOCAL) so it survives across every statement in this
  // batch, and it must be reset before this connection goes back to the
  // pool so a later, unrelated request can't inherit it.
  const client = await pool.connect();
  try {
    await client.query("SELECT set_config('app.bypass_rls', 'true', false)");
    await client.query([
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
    "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false",
    "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at timestamp",
    "CREATE TABLE IF NOT EXISTS chat_messages (id serial PRIMARY KEY, role text NOT NULL, content text NOT NULL, date text NOT NULL, created_at timestamp NOT NULL DEFAULT now())",
    "CREATE TABLE IF NOT EXISTS commits (id serial PRIMARY KEY, text text NOT NULL, made_date text NOT NULL, done boolean NOT NULL DEFAULT false, created_at timestamp NOT NULL DEFAULT now())",
    "CREATE TABLE IF NOT EXISTS jobs (id serial PRIMARY KEY, biz text NOT NULL, name text NOT NULL, stage text NOT NULL DEFAULT \x27\x27, due text NOT NULL DEFAULT \x27\x27, pct integer NOT NULL DEFAULT 0, created_at timestamp NOT NULL DEFAULT now())",
    "CREATE TABLE IF NOT EXISTS coming_up (id serial PRIMARY KEY, date text NOT NULL, time text NOT NULL, title text NOT NULL, sub text NOT NULL DEFAULT \x27\x27, tag text NOT NULL DEFAULT \x27\x27, kind text NOT NULL DEFAULT \x27work\x27, created_at timestamp NOT NULL DEFAULT now())",
    "CREATE TABLE IF NOT EXISTS profile (user_id text PRIMARY KEY, data jsonb, onboarded boolean NOT NULL DEFAULT false, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now())",
    "CREATE TABLE IF NOT EXISTS interview_messages (id serial PRIMARY KEY, user_id text NOT NULL, role text NOT NULL, content text NOT NULL, created_at timestamp NOT NULL DEFAULT now())",
    "CREATE TABLE IF NOT EXISTS relationships (id serial PRIMARY KEY, user_id text NOT NULL, name text, category text NOT NULL, type text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '', commitments text NOT NULL DEFAULT '', biggest_challenge text NOT NULL DEFAULT '', is_primary boolean NOT NULL DEFAULT false, created_at timestamp NOT NULL DEFAULT now())",
    "CREATE TABLE IF NOT EXISTS pursuits (id serial PRIMARY KEY, user_id text NOT NULL, name text NOT NULL, category text NOT NULL, notes text NOT NULL DEFAULT '', created_at timestamp NOT NULL DEFAULT now())",
    "CREATE TABLE IF NOT EXISTS pulse_checks (id serial PRIMARY KEY, user_id text NOT NULL, date text NOT NULL, category text NOT NULL, state text NOT NULL, note text NOT NULL DEFAULT '', created_at timestamp NOT NULL DEFAULT now())",
    "CREATE UNIQUE INDEX IF NOT EXISTS pulse_checks_user_date_category_unique ON pulse_checks (user_id, date, category)",
    "ALTER TABLE commits ADD COLUMN IF NOT EXISTS relationship_id integer REFERENCES relationships(id) ON DELETE SET NULL",
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS pursuit_id integer REFERENCES pursuits(id) ON DELETE SET NULL",
    "CREATE TABLE IF NOT EXISTS google_calendar_connections (id serial PRIMARY KEY, user_id text NOT NULL, google_email text NOT NULL, access_token text NOT NULL, refresh_token text NOT NULL, scope text NOT NULL DEFAULT \x27\x27, expires_at timestamp NOT NULL, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now())",
    "ALTER TABLE google_calendar_connections ADD COLUMN IF NOT EXISTS id serial",
    "ALTER TABLE google_calendar_connections ADD COLUMN IF NOT EXISTS google_email text",
    "UPDATE google_calendar_connections SET google_email = user_id WHERE google_email IS NULL",
    "ALTER TABLE google_calendar_connections ALTER COLUMN google_email SET NOT NULL",
    "CREATE UNIQUE INDEX IF NOT EXISTS gcal_user_email_unique ON google_calendar_connections (user_id, google_email)",
    ].join(";\n") + ";\n" + rlsStatements());
  } finally {
    await client.query("RESET app.bypass_rls").catch(() => undefined);
    client.release();
  }
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
