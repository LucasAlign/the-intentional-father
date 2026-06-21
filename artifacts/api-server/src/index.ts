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
    "CREATE TABLE IF NOT EXISTS google_calendar_connections (user_id text PRIMARY KEY, access_token text NOT NULL, refresh_token text NOT NULL, scope text NOT NULL DEFAULT \x27\x27, expires_at timestamp NOT NULL, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now())",
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
