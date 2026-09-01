#!/usr/bin/env node
// Cross-platform preinstall check (#33) — the previous `sh -c '...'` version
// failed outright on Windows, where `sh` isn't on PATH by default. Plain
// Node has no shell dependency, so this runs the same on every platform.
//
// Runs before `pnpm install` has set anything up, so this must stay
// dependency-free — no imports from node_modules or the workspace.
import { rmSync } from "node:fs";

// Stray npm/yarn lockfiles left behind by an accidental non-pnpm install.
rmSync("package-lock.json", { force: true });
rmSync("yarn.lock", { force: true });

const userAgent = process.env.npm_config_user_agent ?? "";
if (!userAgent.startsWith("pnpm/")) {
  console.error("Use pnpm instead");
  process.exit(1);
}
