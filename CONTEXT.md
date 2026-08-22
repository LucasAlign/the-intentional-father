# Arlo / Steward

A daily personal-OS dashboard for men (Christian men's ministry context): scripture verse, marriage intention, top-3 task priorities, daily reflection journal, and an AI accountability chat partner. In the running app today the product is branded **Steward** end-to-end; **Arlo** is a legacy internal name being phased out (see below).

## Language

**Steward**:
The product's name, and the name of its AI accountability chat partner as shown to users (the nav tab once labeled "Arlo" now displays "Steward"). This is the final, user-facing name.
_Avoid_: Arlo (legacy internal name only — see below)

**Arlo**:
The product's original/legacy name. Still used throughout the codebase (repo folder `artifacts/arlo`, package names, component names like `ArloChat`, docs) but no longer shown to users anywhere — fully replaced by "Steward" in the UI. Treated as an internal-only holdover to be renamed away, not a distinct concept from Steward.
_Avoid_: using "Arlo" in anything user-facing; don't treat it as a separate persona from Steward.

**Shepherd** (future, not built yet):
The org/business-facing management dashboard — the account a business or non-profit uses to oversee a group of individual Steward users under them. Distinct from Steward, which is the individual's own personal-OS instance. Out of scope for the V2 launch; reserved as the term for when multi-org support is eventually built.
_Avoid_: Tenant, Workspace, Team, Organization (picked "Shepherd" to fit the ministry framing — a business/non-profit "shepherds" the people using Steward under them)

**User**:
An individual person with a Steward account. No special term for users managed under a future Shepherd — they're still just Users.
_Avoid_: Member, Flock (considered for the Shepherd relationship, not adopted)
