# Arlo / Steward

A daily personal-OS dashboard for men (Christian men's ministry context): scripture verse, marriage intention, top-3 task priorities, daily reflection journal, and an AI accountability chat partner. In the running app today the product is branded **Steward** end-to-end; **Arlo** is a legacy internal name being phased out (see below).

## Language

**Steward**:
The product's name, and the name of its AI accountability chat partner as shown to users (the nav tab once labeled "Arlo" now displays "Steward"). This is the final, user-facing name.
_Avoid_: Arlo (legacy internal name only — see below)

**Arlo**:
The product's original/legacy name. #6 renamed the internal identifiers that were safe to touch — component names (`ArloChat` → `StewardChat`), route/schema file names (`routes/arlo.ts` → `routes/steward.ts`, `schema/arlo.ts` → `schema/steward.ts`), variables, and docs. Two things were deliberately left as `arlo`: the repo folder (`artifacts/arlo`) and the package name (`@workspace/arlo`) — Replit's own "Project" workflow (invisible to and unverifiable from an agent session, since it lives in Replit's project settings, not this repo) almost certainly starts the dev server with `pnpm --filter @workspace/arlo run dev`; renaming either would silently break that workflow with no way to confirm or fix it from here. A human renaming both together, in Replit itself, is the safe way to finish this. No longer shown to users anywhere either way — fully replaced by "Steward" in the UI.
_Avoid_: using "Arlo" in anything user-facing; don't treat it as a separate persona from Steward.

**Shepherd** (future, not built yet):
The org/business-facing management dashboard — the account a business or non-profit uses to oversee a group of individual Steward users under them. Distinct from Steward, which is the individual's own personal-OS instance. Out of scope for the V2 launch; reserved as the term for when multi-org support is eventually built.
_Avoid_: Tenant, Workspace, Team, Organization (picked "Shepherd" to fit the ministry framing — a business/non-profit "shepherds" the people using Steward under them)

**User**:
An individual person with a Steward account. No special term for users managed under a future Shepherd — they're still just Users.
_Avoid_: Member, Flock (considered for the Shepherd relationship, not adopted)
