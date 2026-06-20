---
name: replit-auth-web lib setup
description: Gotchas when adding the @workspace/replit-auth-web auth hook lib to the monorepo.
---

When adding `@workspace/replit-auth-web` (the browser `useAuth()` lib) as a referenced TS project:

- Its tsconfig MUST set `"composite": true`, or any artifact that references it fails with TS6306 ("Referenced project must have setting composite: true").
- `use-auth.ts` uses `import.meta.env.BASE_URL`. The lib has no Vite dependency, so add a self-contained `src/env.d.ts` declaring `ImportMetaEnv { readonly BASE_URL: string }` + `ImportMeta { readonly env: ImportMetaEnv }`. Adding `vite/client` types instead does NOT resolve from the lib because vite isn't a dep there.

**Why:** the skill template ships the lib without these, and `pnpm --filter @workspace/api-spec run codegen` runs `typecheck:libs` at the end, so a fresh auth install fails codegen until both are fixed.
**How to apply:** any time a new composite lib uses `import.meta.env`, do both fixes together.
