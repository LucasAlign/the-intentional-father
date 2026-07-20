import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { profile as profileTable, interviewMessages } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { normalizeProfileData } from "../lib/profile";

const router = Router();
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const TOTAL_INTERVIEW_QUESTIONS = 10;

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

Work through these 6 areas naturally, like a mentor conversation — not a form or checklist. You have up to 10 questions total, so use any extras to push deeper with a follow-up before moving on:
1. Name, role, and season of life — ask this open-ended (single, dating, married, parenting young kids, empty nester, widowed, retired, or anything else). Don't assume marriage or kids.
2. Their #1 priority — what comes first? What's non-negotiable?
3. Businesses or main work — what do they do, any patterns or common blockers?
4. Key relationships — who matters most to them right now given their season of life (a spouse, kids, parents, close friends, a mentee — whatever actually fits), names if they share them, and the biggest friction point in those relationships right now
5. Where do plans stall? What drains decisions? Where does execution break down?
6. Guardrails — what should you never suggest? How direct do they want you to be?

Rules:
- Start with a warm, direct greeting and ask their name.
- Ask ONE area at a time. Wait for the answer before moving on.
- If an answer is surface-level, push once with a pointed follow-up before moving on.
- Acknowledge patterns you hear ("That sounds like your 80% problem, doesn't it?").
- Reference Scripture naturally where it fits — not forced, not preachy.
- Tone: direct and warm, like a brother who tells the truth and sees potential.
- By question 10 at the latest, give a clear summary of how you understand them and ask: "Does that sound right?"
- When they confirm the summary is accurate, end your response with exactly this tag on its own line: [INTERVIEW_COMPLETE]`;

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
  "businesses": [
    {
      "name": "string",
      "role": "string",
      "rhythm": "string or null",
      "common_blockers": ["array of strings"],
      "key_metrics": ["array of strings"]
    }
  ],
  "relationships": [
    {
      "name": "string or null",
      "type": "string — e.g. spouse, child, parent, sibling, close friend, mentee",
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
  "voice": "string describing preferred communication style or null"
}`;

async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens = 700,
): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/responses", {
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
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI error: ${err}`);
  }

  const data = (await response.json()) as OpenAIResponsesApiResponse;
  const text = getOpenAIMessage(data);
  if (!text) throw new Error("Empty response from OpenAI");
  return text;
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
router.post("/interview", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { message } = req.body as { message?: string };
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

        await db
          .insert(profileTable)
          .values({ userId, data: profileData, onboarded: true, updatedAt: new Date() })
          .onConflictDoUpdate({
            target: profileTable.userId,
            set: { data: profileData, onboarded: true, updatedAt: new Date() },
          });

        const cleanMessage = assistantText.replace("[INTERVIEW_COMPLETE]", "").trimEnd();
        res.json({ message: cleanMessage, questionNumber: TOTAL_INTERVIEW_QUESTIONS, complete: true, profile: profileData });
        return;
      } catch (extractErr) {
        req.log?.error({ extractErr }, "Profile extraction failed");
        // Still mark complete even if extraction failed
        await db
          .insert(profileTable)
          .values({ userId, data: null, onboarded: true, updatedAt: new Date() })
          .onConflictDoUpdate({
            target: profileTable.userId,
            set: { onboarded: true, updatedAt: new Date() },
          });
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
    await db
      .insert(profileTable)
      .values({ userId, data: null, onboarded: true, updatedAt: new Date() })
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

// POST /api/test/complete-interview  — seeds a completed profile for testing
router.post("/test/complete-interview", async (req: Request, res: Response) => {
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
      businesses: [
        {
          name: "Signs",
          role: "owner/operator",
          rhythm: "quote-driven, 2-3 week cycles",
          common_blockers: ["supplier lead time", "client revision loops"],
          key_metrics: ["quote conversion", "delivery on time"],
        },
      ],
      relationships: [
        {
          name: "Sarah",
          type: "spouse",
          notes: "wife",
          commitments: "weekly date, family dinner",
          biggest_challenge: "staying present when businesses pull",
        },
        {
          name: null,
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
      voice: "direct, no fluff",
    };

    await db
      .insert(profileTable)
      .values({ userId, data: testProfile, onboarded: true, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: profileTable.userId,
        set: { data: testProfile, onboarded: true, updatedAt: new Date() },
      });

    res.json({ success: true, profile: testProfile });
  } catch (err) {
    req.log?.error({ err }, "Test complete-interview error");
    res.status(500).json({ error: "Failed to seed test profile" });
  }
});

export default router;
