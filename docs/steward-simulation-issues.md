# Steward Simulation Test — Issues and Recommendations

**Prepared for:** Jason  
**Test date:** September 14, 2026  
**Environment:** Production (`https://1arlo.replit.app/`)  
**Coverage:** Signed-in experience, onboarding tour, Today, Tribe, Work, Sphere, Chat, Week, standard desktop viewport, 390×844 mobile, and 320×568 compact mobile.

## Executive summary

Steward has a strong visual identity, a clear mobile navigation model, and an effective six-step tour. The Today screen is the most successful part of the product: it brings the daily actions together without losing the product's tone. The accountability chat also returned a useful, actionable response without browser console errors.

The main risks are incomplete validation, silent failure states, an unnecessarily rigid job-entry flow, and significant accessibility problems—especially in the calendar. These issues will disproportionately affect first-time, low-confidence, and assistive-technology users.

## Priority overview

| ID | Severity | Area | Issue |
|---|---|---|---|
| SIM-01 | High | Work | A job can advance through all five steps with no name and reach an enabled **Add Job** button. |
| SIM-02 | High | Accessibility | The Week calendar exposes more than 3,300 accessibility items across many months. |
| SIM-03 | High | Accessibility | Pages lack semantic headings; overlays are generic containers rather than dialogs. |
| SIM-04 | Medium | Validation | Blank priority and unanswered Sphere actions fail silently. |
| SIM-05 | Medium | Work | The five-step job wizard has no Back or review/edit path. |
| SIM-06 | Medium | Recovery | Priority entry has no Cancel action and Escape does not close it. |
| SIM-07 | Medium | Mobile | The Today header breaks down at 320px, forcing the greeting into several short lines. |
| SIM-08 | Medium | Discoverability | Help is hidden in Profile and disabled; several domain terms are unexplained outside the tour. |
| SIM-09 | Medium | Information architecture | Maintenance controls compete with primary actions on Tribe and Work. |
| SIM-10 | Medium | Accessibility | The marriage-intention field lacks an associated label; selected tone state is unclear. |
| SIM-11 | Low | Naming | The live tab says **Chat**, while tour/accessibility text exposes **S Chat** and the product identity is Steward. |
| SIM-12 | Low | Visual accessibility | The faint text color has approximately 3.39:1 contrast against the base background. |

## Detailed issues

### SIM-01 — Job wizard permits a blank job

**Severity:** High  
**Persona affected:** All users, especially rushed and first-time users

**Steps to reproduce**

1. Open **Work**.
2. Select **Add new job**.
3. Select a job type and pursuit.
4. Leave every question blank and press **Next** five times.

**Observed:** The flow advances from “What's the job?” without a name and ends with an enabled **Add Job ✓** button. The implementation has a fallback that can create an “Untitled job.”  
**Expected:** A job name is required before leaving the first step or submitting.

**Recommendation**

- Require and trim the job name on the client and server.
- Disable **Next** until required input is present.
- Show an inline message such as “Give this job a name to continue.”
- Treat the other questions as explicitly optional or provide **Skip**.

**Acceptance criteria**

- A blank or whitespace-only name cannot be submitted.
- The user receives visible and screen-reader-announced guidance.
- The server rejects unnamed jobs even if client validation is bypassed.

### SIM-02 — Calendar accessibility tree is excessively large

**Severity:** High  
**Persona affected:** Screen-reader and keyboard users; potentially low-powered devices

**Observed:** Opening **Week** exposed more than 3,300 accessibility items, including dates spanning many months, even though the visible view showed one week.  
**Expected:** Assistive technology should encounter the visible week and a small number of explicit navigation controls.

**Recommendation**

- Render only the visible week plus a small buffer.
- Remove offscreen months from the accessibility tree with true virtualization or `aria-hidden` where appropriate.
- Label the current range and announce changes after Previous, Next, or Today.
- Performance-test the view with a screen reader and on a lower-powered phone.

### SIM-03 — Missing page and dialog semantics

**Severity:** High  
**Persona affected:** Screen-reader and keyboard users

**Observed:** No semantic headings were found on the live dashboard. Editors and tours appeared as generic containers rather than dialogs.  
**Expected:** Each screen has a meaningful heading hierarchy, and modal experiences announce themselves and contain keyboard focus.

**Recommendation**

- Use one `h1` for the current screen and structured `h2` headings for cards.
- Give overlays `role="dialog"`, `aria-modal="true"`, and an accessible title.
- Move focus into a dialog when it opens, trap focus while open, support Escape, and restore focus when it closes.

### SIM-04 — Invalid actions fail silently

**Severity:** Medium  
**Persona affected:** First-time and low-confidence users

**Steps to reproduce**

- Open **Add a priority** and press **Add** with an empty field.
- Open a Sphere **Walk through this** flow and press **Next** without selecting an answer.

**Observed:** Nothing happens and no reason is provided.  
**Expected:** The button is visibly disabled or the page explains what is required.

**Recommendation:** Prefer disabled controls with clear required-state instructions, backed by inline validation announced through an `aria-live` region.

### SIM-05 — Job wizard has no Back or review step

**Severity:** Medium  
**Persona affected:** Power users and anyone correcting a mistake

**Observed:** The job wizard provides only **Next** and **Cancel**. Earlier answers cannot be corrected without abandoning the flow.  
**Recommendation:** Add Back, show a final editable summary, and add a one-screen **Quick add** mode for experienced users.

### SIM-06 — Priority entry has no cancellation path

**Severity:** Medium  
**Persona affected:** Error-prone and keyboard users

**Observed:** Once priority entry is opened, there is no visible Cancel action and Escape has no effect.  
**Recommendation:** Add **Cancel**, support Escape, and restore focus to **Add a priority**.

### SIM-07 — Compact-phone header layout is inefficient

**Severity:** Medium  
**Persona affected:** Users on small phones or large text settings

**Observed:** At 320×568, the greeting wraps into multiple short lines beside the date, consuming much of the first viewport. The priority placeholder is also truncated.  
**Recommendation:** Stack the date beneath the greeting below an appropriate breakpoint and test at 320px width plus 200% text zoom.

### SIM-08 — Guidance is hidden when it is most needed

**Severity:** Medium  
**Persona affected:** First-time and nontechnical users

**Observed:** The tour is good, but replay and Helpful Hints are inside the visually unlabeled Profile icon; Helpful Hints were off. Terms such as **Sphere**, **pursuit**, **provision**, and **leadership** depend heavily on the tour for explanation.  
**Recommendation:** Add contextual first-use hints and concise definitions next to unfamiliar terms. Offer a first-week checklist: set an intention, add one priority, complete a Pulse Check, and message Steward.

### SIM-09 — Maintenance controls compete with core work

**Severity:** Medium  
**Persona affected:** First-time and low-confidence users

**Observed:** **Deleted**, **Reset order**, **Deleted Jobs**, **Closed**, and **Kept & Deleted history** are prominent near primary actions.  
**Recommendation:** Move recovery and archive tools into a secondary overflow menu. Keep **Add person**, **Log a commitment**, and **Add new job** visually dominant.

### SIM-10 — Form and selection semantics need improvement

**Severity:** Medium  
**Persona affected:** Screen-reader users

**Observed:** The marriage-intention textarea relies on placeholder/context instead of an associated label. Chat tone choices did not clearly expose the selected option in the accessibility view.  
**Recommendation:** Add explicit labels and expose exclusive choices as a radio group or buttons with correct `aria-pressed` state.

### SIM-11 — Chat naming is inconsistent

**Severity:** Low  
**Persona affected:** First-time users

**Observed:** The navigation uses **Chat**, the tour exposed **S Chat**, and the product/assistant identity is Steward.  
**Recommendation:** Choose one consistent label—likely **Steward** with an accessible name such as “Steward chat”—and hide decorative initials from assistive technology.

### SIM-12 — Faint text contrast is below the normal-text target

**Severity:** Low  
**Persona affected:** Low-vision users and users in bright environments

**Observed:** The faint palette color `#6E664C` has approximately 3.39:1 contrast against `#0C0E07`, below the WCAG AA 4.5:1 target for normal text. Some small secondary labels visually appear faint.  
**Recommendation:** Reserve the faint color for decorative or large text, and increase contrast for metadata, helper text, placeholders, and navigation labels.

## What worked well

- Cohesive wood, brass, and parchment visual system.
- Clear bottom navigation suited to daily mobile use.
- Strong Today-screen information hierarchy.
- Six-step tour explains the product better than the live empty states.
- Priority entry automatically scrolls into view on a small phone.
- Chat produced a relevant, actionable response and recovered normally after waiting.
- No browser console warnings or errors appeared during the tested journeys.

## Recommended delivery order

### Now

1. Fix job-name validation on client and server.
2. Add visible validation to priority and Sphere flows.
3. Reduce the Week accessibility tree.
4. Add headings and correct dialog semantics.

### Next

1. Add Back, review, and quick-add options to the job flow.
2. Add Cancel/Escape/Undo recovery patterns.
3. Improve the 320px layout and text-zoom behavior.
4. Simplify Week to a true seven-day default view.

### Later

1. Add contextual first-week guidance.
2. Move archive/deleted tools into secondary menus.
3. Standardize Chat/Steward naming.
4. Raise the contrast of faint supporting text.

## Test-data note

One persistent Chat entry was created and clearly labeled **SIMULATION TEST**. No priorities, people, jobs, calendar items, or existing records were created, edited, completed, or deleted.
