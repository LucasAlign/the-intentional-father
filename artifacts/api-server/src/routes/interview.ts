import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { profile as profileTable, interviewMessages, relationships as relationshipsTable, pursuits as pursuitsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { normalizeProfileData, isToneVoice, isRecord, TONE_VOICES } from "../lib/profile";
import { aiRateLimit } from "../middlewares/aiRateLimit";
import { SCRIPTURE_GROUNDING } from "../lib/verses";
import { guessRelationshipCategory, isRelationshipCategory } from "../lib/relationships";
import { isPursuitCategory } from "../lib/pursuits";

const router = Router();
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const TOTAL_INTERVIEW_QUESTIONS = 10;
const MAX_INTERVIEW_MESSAGE_LENGTH = 4000;
// Without this, a slow OpenAI response has no server-side bound — same gap
// steward.ts's /chat route closed for the same reason (#68/#76): the
// request just hangs, and POST /interview can chain two of these calls
// back to back (reply, then profile extraction) on the completion turn.
const OPENAI_TIMEOUT_MS = 30_000;

type OpenAIResponsesApiResponse = {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
};

function getOpenAIMessage(data: OpenAIResponsesApiResponse): string | undefined {
  if (data.output_text) return data.output_text;
  return data.output
    ?.flatMap((item) => item.content ?? [])
    .map((c) => c.text)
    .find((t): t is string => Boolean(t));
}

const INTERVIEW_SYSTEM_PROMPT = `You are Steward — a direct, gospel-centered planning partner meeting someone for the first time.
Your mission: get to know them well enough to be genuinely useful across all of life — work, marriage, family, faith.

Work through these 7 areas naturally, like a mentor conversation — not a form or checklist. You have up to 10 questions total, so use any extras to push deeper with a follow-up before moving on:
1. Name, role, and season of life — ask this open-ended (single, dating, married, parenting young kids, empty nester, widowed, retired, or anything else). Don't assume marriage or kids.
2. Their #1 priority — what comes first? What's non-negotiable?
3. Their pursuits — a job, a business, a volunteer role, whatever they're actively working, one or more if they mentioned it. For each: what they do, any patterns or common blockers. If it's their own business, also ask naturally about team size (solo or with employees), a revenue or growth goal, and roughly how long they've been running it. If it's a job working for someone else, also ask who they report to and what career goal or next step they're working toward. Weave these in as part of the conversation, not a checklist.
4. Key relationships — who matters most to them right now given their season of life (a spouse, kids, parents, close friends, a mentee — whatever actually fits), names if they share them, and the biggest friction point in those relationships right now
5. Where do plans stall? What drains decisions? Where does execution break down?
6. Guardrails — what should you never suggest?
7. How direct do they want you to be — ask plainly whether they want it straight (no cushioning), a middle ground (acknowledge first, then the direct point), or eased into (invite reflection, still get to the truth quickly). Frame it in your own words, not as a multiple-choice list.

Rules:
- Start with a warm, direct greeting and ask their name.
- Ask ONE area at a time. Wait for the answer before moving on.
- If an answer is surface-level, push once with a pointed follow-up before moving on.
- Acknowledge patterns you hear ("That sounds like your 80% problem, doesn't it?").
- Reference Scripture naturally where it fits — not forced, not preachy. Quote only from the approved verses below, verbatim.
- Tone: direct and warm, like a brother who tells the truth and sees potential.
- By question 10 at the latest, give a clear summary of how you understand them and ask: "Does that sound right?"
- When they confirm the summary is accurate, end your response with exactly this tag on its own line: [INTERVIEW_COMPLETE]

${SCRIPTURE_GROUNDING}`;

const EXTRACT_SYSTEM_PROMPT = `You are a data extraction assistant. Given an interview conversation, extract a structured user profile as JSON.
Output ONLY valid JSON — no markdown, no code blocks, no explanation, no commentary. Just the JSON object.

Use this exact schema (use null for unknown fields). Order the "relationships" array with the person's most important relationship first, as they emphasized it in conversation — don't assume a spouse belongs first if they didn't lead with one:
{
  "name": "string",
  "season_of_life": "string describing their current life stage",
  "core_identity": {
    "worldview": "string or null",
    "top_priority": "string",
    "values": ["array of strings"]
  },
  "pursuits": [
    {
      "name": "string",
      "category": "exactly one of: job, business, volunteer, hobby, other — pick the closest fit",
      "notes": "string or null — role, rhythm, common blockers, what they track; for a business also team size/revenue goal and how long running if discussed; for a job also who they report to and their career goal if discussed"
    }
  ],
  "relationships": [
    {
      "name": "string or null",
      "category": "exactly one of: spouse, child, family, friend — pick the closest fit (parents/siblings/extended family all go under family; mentees/colleagues go under friend)",
      "type": "string — free-text description, e.g. spouse, child, parent, sibling, close friend, mentee",
      "notes": "string or null — role/context, e.g. 'wife', 'oldest son'",
      "commitments": "string or null",
      "biggest_challenge": "string or null"
    }
  ],
  "planning_profile": {
    "decision_drain": "string or null",
    "common_failure_point": "string or null",
    "ideal_rhythm": "string or null",
    "where_ai_helps_most": "string or null"
  },
  "guardrails": {
    "do_not_suggest": ["array of strings"],
    "always_remind_of": "string or null"
  },
  "voice": "exactly one of: straight_talk, middle_of_the_road, take_it_easy — pick whichever best matches how directly they said they want Steward to talk to them; default to straight_talk if they didn't express a preference"
}`;

async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens = 700,
): Promise<string> {
  const timeoutController = new AbortController();
  const timeoutTimer = setTimeout(() => timeoutController.abort(), OPENAI_TIMEOUT_MS);
  let response: globalThis.Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        instructions: systemPrompt,
        input: messages,
        max_output_tokens: maxTokens,
      }),
      signal: timeoutController.signal,
    });
  } finally {
    clearTimeout(timeoutTimer);
  }

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI error: ${err}`);
  }

  const data = (await response.json()) as OpenAIResponsesApiResponse;
  const text = getOpenAIMessage(data);
  if (!text) throw new Error("Empty response from OpenAI");
  return text;
}

// Relationships live in their own table (#28), not in profile.data — this
// pulls the AI-extracted "relationships" array out of the raw profile JSON
// and inserts one row per entry, best-effort classifying `category` if the
// model didn't return one of the fixed values.
async function persistExtractedRelationships(userId: string, profileData: unknown): Promise<void> {
  if (!isRecord(profileData) || !Array.isArray(profileData.relationships)) return;
  for (const raw of profileData.relationships) {
    if (!isRecord(raw)) continue;
    const category = isRelationshipCategory(raw.category)
      ? raw.category
      : guessRelationshipCategory(typeof raw.type === "string" ? raw.type : null);
    await db.insert(relationshipsTable).values({
      userId,
      name: typeof raw.name === "string" ? raw.name : null,
      category,
      type: typeof raw.type === "string" ? raw.type : "",
      notes: typeof raw.notes === "string" ? raw.notes : "",
      commitments: typeof raw.commitments === "string" ? raw.commitments : "",
      biggestChallenge: typeof raw.biggest_challenge === "string" ? raw.biggest_challenge : "",
    });
  }
}

// Pursuits live in their own table (#29), not in profile.data — this pulls
// the AI-extracted "pursuits" array out of the raw profile JSON and inserts
// one row per entry. Unlike relationships, there's no reliable way to guess
// job/business/volunteer/other from free text, so anything the model didn't
// tag with one of the fixed values falls back to "other".
async function persistExtractedPursuits(userId: string, profileData: unknown): Promise<void> {
  if (!isRecord(profileData) || !Array.isArray(profileData.pursuits)) return;
  for (const raw of profileData.pursuits) {
    if (!isRecord(raw) || typeof raw.name !== "string" || !raw.name.trim()) continue;
    await db.insert(pursuitsTable).values({
      userId,
      name: raw.name.trim(),
      category: isPursuitCategory(raw.category) ? raw.category : "other",
      notes: typeof raw.notes === "string" ? raw.notes : "",
    });
  }
}

// #92 — the fields "Redo the Interview" (a fresh onboarding conversation
// run again later) and "Edit My Answers" (the direct form) both operate on.
// Deliberately excludes relationships/pursuits (their own tables now, never
// read back from profile.data) and voice (has its own Steward-tab toggle,
// though a redo's answer to the directness question still flows into it
// via the generic merge below — no special-casing needed).
const ONBOARDING_ANSWER_KEYS = ["name", "season_of_life", "core_identity", "planning_profile", "guardrails"] as const;

// A redo interview's extraction writes null (or an empty array) for
// anything the new conversation didn't happen to cover — merging instead
// of overwriting means a redo only updates what it actually touched, not
// wipe everything else back to blank. `voice` merges the same generic way
// as the top-level string fields, even though it isn't in
// ONBOARDING_ANSWER_KEYS (only used for display/editing there) — a redo's
// answer to the directness question should still update it.
function mergeOnboardingFields(oldData: unknown, newData: unknown): Record<string, unknown> {
  const old = isRecord(oldData) ? oldData : {};
  const fresh = isRecord(newData) ? newData : {};
  const merged: Record<string, unknown> = { ...old };
  for (const key of [...ONBOARDING_ANSWER_KEYS, "voice"]) {
    const freshVal = fresh[key];
    if (freshVal === null || freshVal === undefined) continue;
    if (isRecord(freshVal)) {
      // One level of nested-object merge (core_identity, planning_profile,
      // guardrails) — a null/absent/empty-array leaf keeps the old value,
      // anything else overwrites it.
      const oldNested = isRecord(old[key]) ? old[key] : {};
      const mergedNested: Record<string, unknown> = { ...oldNested };
      for (const [k, v] of Object.entries(freshVal)) {
        if (v === null || v === undefined) continue;
        if (Array.isArray(v) && v.length === 0) continue;
        mergedNested[k] = v;
      }
      merged[key] = mergedNested;
    } else {
      merged[key] = freshVal;
    }
  }
  return merged;
}

// GET /api/profile
router.get("/profile", async (req: Request, res: Response) => {
  try {
    const [row] = await db
      .select()
      .from(profileTable)
      .where(eq(profileTable.userId, req.user!.id))
      .limit(1);
    res.json({ onboarded: row?.onboarded ?? false, data: normalizeProfileData(row?.data ?? null) });
  } catch (err) {
    req.log?.error({ err }, "Error fetching profile");
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// PATCH /api/profile — updates one or more fields on the user's profile
// without re-running the interview. `voice` and `remindersEnabled` (#75),
// plus `hintsEnabled`/`dismissedHints` (#83 — the Helpful Hints master
// switch and its per-hint close-button state); the only writer of profile
// data before this was interview completion (and the dev-only test seed).
router.patch("/profile", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { voice, remindersEnabled, hintsEnabled, dismissedHints } = req.body as {
      voice?: unknown; remindersEnabled?: unknown; hintsEnabled?: unknown; dismissedHints?: unknown;
    };
    if (voice === undefined && remindersEnabled === undefined && hintsEnabled === undefined && dismissedHints === undefined) {
      res.status(400).json({ error: "Provide at least one of: voice, remindersEnabled, hintsEnabled, dismissedHints" });
      return;
    }
    if (voice !== undefined && !isToneVoice(voice)) {
      res.status(400).json({ error: `voice must be one of: ${TONE_VOICES.join(", ")}` });
      return;
    }
    if (remindersEnabled !== undefined && typeof remindersEnabled !== "boolean") {
      res.status(400).json({ error: "remindersEnabled must be a boolean" });
      return;
    }
    if (hintsEnabled !== undefined && typeof hintsEnabled !== "boolean") {
      res.status(400).json({ error: "hintsEnabled must be a boolean" });
      return;
    }
    if (dismissedHints !== undefined && (!Array.isArray(dismissedHints) || !dismissedHints.every((v) => typeof v === "string"))) {
      res.status(400).json({ error: "dismissedHints must be an array of strings" });
      return;
    }
    const [existing] = await db
      .select()
      .from(profileTable)
      .where(eq(profileTable.userId, userId))
      .limit(1);
    const existingData = isRecord(existing?.data) ? existing.data : {};
    const data = {
      ...existingData,
      ...(voice !== undefined ? { voice } : {}),
      ...(remindersEnabled !== undefined ? { remindersEnabled } : {}),
      ...(hintsEnabled !== undefined ? { hintsEnabled } : {}),
      ...(dismissedHints !== undefined ? { dismissedHints } : {}),
    };
    await db
      .insert(profileTable)
      .values({ userId, data, onboarded: existing?.onboarded ?? false, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: profileTable.userId,
        set: { data, updatedAt: new Date() },
      });
    res.json({ voice: data.voice, remindersEnabled: data.remindersEnabled, hintsEnabled: data.hintsEnabled, dismissedHints: data.dismissedHints });
  } catch (err) {
    req.log?.error({ err }, "Error updating profile");
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// PATCH /api/profile/answers (#92) — "Edit My Answers": a direct form over
// the onboarding-derived fields, no AI conversation involved. Each key
// present in the body fully replaces that top-level field (the client
// always submits the complete current state of whatever section it's
// editing, so there's no need for the redo interview's null-preserving
// merge here) — a key simply absent from the body is left untouched.
router.patch("/profile/answers", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const body = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    for (const key of ONBOARDING_ANSWER_KEYS) {
      if (body[key] === undefined) continue;
      if (key === "name" || key === "season_of_life") {
        if (typeof body[key] !== "string") {
          res.status(400).json({ error: `${key} must be a string` });
          return;
        }
      } else if (!isRecord(body[key])) {
        res.status(400).json({ error: `${key} must be an object` });
        return;
      }
      updates[key] = body[key];
    }
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: `Provide at least one of: ${ONBOARDING_ANSWER_KEYS.join(", ")}` });
      return;
    }

    const [existing] = await db.select().from(profileTable).where(eq(profileTable.userId, userId)).limit(1);
    const existingData = isRecord(existing?.data) ? existing.data : {};
    const data = { ...existingData, ...updates };

    await db
      .insert(profileTable)
      .values({ userId, data, onboarded: existing?.onboarded ?? false, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: profileTable.userId,
        set: { data, updatedAt: new Date() },
      });
    res.json({ data: normalizeProfileData(data) });
  } catch (err) {
    req.log?.error({ err }, "Error updating profile answers");
    res.status(500).json({ error: "Failed to update profile answers" });
  }
});

// GET /api/interview/status
router.get("/interview/status", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const [row] = await db
      .select()
      .from(profileTable)
      .where(eq(profileTable.userId, userId))
      .limit(1);
    res.json({ onboarded: row?.onboarded ?? false });
  } catch (err) {
    req.log?.error({ err }, "Error fetching interview status");
    res.status(500).json({ error: "Failed to fetch interview status" });
  }
});

// GET /api/interview/history
router.get("/interview/history", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const msgs = await db
      .select()
      .from(interviewMessages)
      .where(eq(interviewMessages.userId, userId))
      .orderBy(asc(interviewMessages.createdAt));

    const userCount = msgs.filter((m) => m.role === "user").length;
    const questionNumber = Math.min(userCount + 1, TOTAL_INTERVIEW_QUESTIONS);

    const [profileRow] = await db
      .select()
      .from(profileTable)
      .where(eq(profileTable.userId, userId))
      .limit(1);

    res.json({
      messages: msgs.map((m) => ({ role: m.role, content: m.content })),
      questionNumber,
      onboarded: profileRow?.onboarded ?? false,
    });
  } catch (err) {
    req.log?.error({ err }, "Error fetching interview history");
    res.status(500).json({ error: "Failed to fetch interview history" });
  }
});

// POST /api/interview
router.post("/interview", aiRateLimit, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { message } = req.body as { message?: string };
    if (message !== undefined && typeof message !== "string") {
      res.status(400).json({ error: "Message must be a string" });
      return;
    }
    if (message && message.length > MAX_INTERVIEW_MESSAGE_LENGTH) {
      res.status(400).json({ error: `Message must be under ${MAX_INTERVIEW_MESSAGE_LENGTH} characters` });
      return;
    }
    const isStart = !message || message.trim() === "";

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "OPENAI_API_KEY not configured" });
      return;
    }

    const existing = await db
      .select()
      .from(interviewMessages)
      .where(eq(interviewMessages.userId, userId))
      .orderBy(asc(interviewMessages.createdAt));

    // Build message array for OpenAI
    const apiMessages: Array<{ role: string; content: string }> = existing.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Add current user message (or a start trigger)
    const userContent = isStart ? "start" : message!.trim();
    if (!isStart) {
      apiMessages.push({ role: "user", content: userContent });
    } else if (existing.length === 0) {
      apiMessages.push({ role: "user", content: "start" });
    } else {
      // Already started — just return current state
      const userCount = existing.filter((m) => m.role === "user").length;
      res.json({
        message: existing[existing.length - 1]?.content ?? "",
        questionNumber: Math.min(userCount + 1, TOTAL_INTERVIEW_QUESTIONS),
      });
      return;
    }

    const assistantText = await callOpenAI(apiKey, INTERVIEW_SYSTEM_PROMPT, apiMessages);

    // Save messages to DB (skip "start" trigger)
    if (!isStart) {
      await db.insert(interviewMessages).values({
        userId,
        role: "user",
        content: userContent,
      });
    }
    await db.insert(interviewMessages).values({
      userId,
      role: "assistant",
      content: assistantText,
    });

    const userCount = existing.filter((m) => m.role === "user").length + (isStart ? 0 : 1);
    const questionNumber = Math.min(userCount + 1, TOTAL_INTERVIEW_QUESTIONS);

    // Check if interview is complete, or force it once the question cap is hit
    if (assistantText.includes("[INTERVIEW_COMPLETE]") || userCount >= TOTAL_INTERVIEW_QUESTIONS) {
      // #92 — "Redo the Interview" reuses this exact completion path. The
      // `onboarded` flag only ever flips true once and a redo never resets
      // it (see /interview/restart below), so its value going into this
      // completion already tells us whether this is someone's first-ever
      // finish (persist relationships/pursuits, use the extraction as-is)
      // or a redo (merge into what's already saved, skip relationships/
      // pursuits entirely to avoid inserting duplicate People/Pursuits rows).
      const [existingProfileRow] = await db.select().from(profileTable).where(eq(profileTable.userId, userId)).limit(1);
      const isRedo = existingProfileRow?.onboarded === true;
      try {
        const allMessages = await db
          .select()
          .from(interviewMessages)
          .where(eq(interviewMessages.userId, userId))
          .orderBy(asc(interviewMessages.createdAt));

        const extractMessages = allMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
        extractMessages.push({
          role: "user",
          content: "Extract the profile JSON from the conversation above.",
        });

        const rawJson = await callOpenAI(apiKey, EXTRACT_SYSTEM_PROMPT, extractMessages, 1500);

        let profileData: unknown = null;
        try {
          profileData = JSON.parse(rawJson.trim());
        } catch {
          // best-effort extraction
        }

        if (!isRedo) {
          await persistExtractedRelationships(userId, profileData);
          await persistExtractedPursuits(userId, profileData);
        }
        // Relationships and pursuits live in their own tables now — don't
        // also keep a stale copy in the jsonb blob.
        if (isRecord(profileData)) {
          delete profileData.relationships;
          delete profileData.pursuits;
          if (!isRedo) {
            // Helpful Hints (#83) — show automatically for a brand new
            // user's first login, even though the general default
            // (normalizeProfileData) is off. A redo leaves whatever the
            // user already has for this alone.
            profileData.hintsEnabled = true;
          }
        } else {
          profileData = isRedo ? {} : { hintsEnabled: true };
        }

        const finalData = isRedo ? mergeOnboardingFields(existingProfileRow?.data, profileData) : profileData;

        await db
          .insert(profileTable)
          .values({ userId, data: finalData, onboarded: true, updatedAt: new Date() })
          .onConflictDoUpdate({
            target: profileTable.userId,
            set: { data: finalData, onboarded: true, updatedAt: new Date() },
          });

        const cleanMessage = assistantText.replace("[INTERVIEW_COMPLETE]", "").trimEnd();
        res.json({ message: cleanMessage, questionNumber: TOTAL_INTERVIEW_QUESTIONS, complete: true, profile: finalData });
        return;
      } catch (extractErr) {
        req.log?.error({ extractErr }, "Profile extraction failed");
        if (!isRedo) {
          // Still mark complete even if extraction failed — hintsEnabled:
          // true for the same first-login reason as the success branch above.
          await db
            .insert(profileTable)
            .values({ userId, data: { hintsEnabled: true }, onboarded: true, updatedAt: new Date() })
            .onConflictDoUpdate({
              target: profileTable.userId,
              set: { onboarded: true, updatedAt: new Date() },
            });
        }
        // A redo's failed extraction leaves the already-saved profile
        // untouched — nothing to merge, and onboarded was already true.
        const cleanMessage = assistantText.replace("[INTERVIEW_COMPLETE]", "").trimEnd();
        res.json({ message: cleanMessage, questionNumber: TOTAL_INTERVIEW_QUESTIONS, complete: true });
        return;
      }
    }

    res.json({ message: assistantText, questionNumber });
  } catch (err) {
    req.log?.error({ err }, "Interview error");
    res.status(500).json({ error: "Failed to get response from Steward" });
  }
});

// POST /api/interview/skip
router.post("/interview/skip", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    // hintsEnabled: true — skipping the interview still counts as this
    // user's first login, so Helpful Hints (#83) should show automatically.
    await db
      .insert(profileTable)
      .values({ userId, data: { hintsEnabled: true }, onboarded: true, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: profileTable.userId,
        set: { onboarded: true, updatedAt: new Date() },
      });
    res.json({ success: true });
  } catch (err) {
    req.log?.error({ err }, "Error skipping interview");
    res.status(500).json({ error: "Failed to skip interview" });
  }
});

// POST /api/interview/restart (#92) — "Redo the Interview" from Profile.
// Clears the old conversation so /interview starts fresh (POST /interview's
// "already started" branch would otherwise just return the tail of the
// old, possibly months-old, transcript). Deliberately does NOT touch
// profileTable — onboarded stays true throughout, which is exactly what
// lets the completion handler above tell a redo apart from a first-ever
// completion. The client passes ?restart=1 to /interview so that screen
// skips its normal "already onboarded, bounce to /" redirect for this one
// visit; if the user abandons here (closes the app, or hits Skip, which
// leaves onboarded true and profile.data untouched), their existing
// profile is unaffected.
router.post("/interview/restart", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    await db.delete(interviewMessages).where(eq(interviewMessages.userId, userId));
    res.json({ success: true });
  } catch (err) {
    req.log?.error({ err }, "Error restarting interview");
    res.status(500).json({ error: "Failed to restart interview" });
  }
});

// POST /api/test/complete-interview  — seeds a completed profile for testing.
// Dev-only: any authenticated user could otherwise overwrite their own real
// onboarding data with this fixture, so it 404s outside local development.
router.post("/test/complete-interview", async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === "production") {
    res.status(404).json({ error: "Not found" });
    return;
  }
  try {
    const userId = req.user!.id;

    const testProfile = {
      name: "Bryant",
      season_of_life: "married, father of 3, runs multiple businesses",
      core_identity: {
        worldview: "biblical, Ephesians 5:25",
        top_priority: "marriage and family first",
        values: ["faithfulness", "planning", "execution"],
      },
      pursuits: [
        {
          name: "Signs",
          category: "business",
          notes: "owner/operator, quote-driven 2-3 week cycles — common blockers: supplier lead time, client revision loops — tracks: quote conversion, delivery on time",
        },
      ],
      relationships: [
        {
          name: "Sarah",
          category: "spouse",
          type: "spouse",
          notes: "wife",
          commitments: "weekly date, family dinner",
          biggest_challenge: "staying present when businesses pull",
        },
        {
          name: null,
          category: "child",
          type: "child",
          notes: "3 kids",
          commitments: null,
          biggest_challenge: null,
        },
      ],
      planning_profile: {
        decision_drain: "too many options",
        common_failure_point: "stalls at 80%",
        ideal_rhythm: "weekly planning Sunday, daily 60-second check-in",
        where_ai_helps_most: "predict blockers, spot patterns",
      },
      guardrails: {
        do_not_suggest: ["working weekends", "sacrificing family"],
        always_remind_of: "wife's needs come first",
      },
      voice: "straight_talk",
      hintsEnabled: true,
    };

    await persistExtractedRelationships(userId, testProfile);
    await persistExtractedPursuits(userId, testProfile);
    const { relationships: _relationships, pursuits: _pursuits, ...profileWithoutExtractedTables } = testProfile;

    await db
      .insert(profileTable)
      .values({ userId, data: profileWithoutExtractedTables, onboarded: true, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: profileTable.userId,
        set: { data: profileWithoutExtractedTables, onboarded: true, updatedAt: new Date() },
      });

    res.json({ success: true, profile: testProfile });
  } catch (err) {
    req.log?.error({ err }, "Test complete-interview error");
    res.status(500).json({ error: "Failed to seed test profile" });
  }
});

export default router;
