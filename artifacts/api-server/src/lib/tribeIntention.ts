import { db, tribeIntentions, type Relationship } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { ToneVoice } from "./profile";

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
// One sentence, not a chat reply — no reason to hold the Tribe tab open as
// long as chat's own 30s timeout (#68) allows.
const OPENAI_TIMEOUT_MS = 10_000;

type OpenAIResponsesApiResponse = {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
};

function getOpenAIMessage(data: OpenAIResponsesApiResponse): string | undefined {
  if (data.output_text) return data.output_text;
  return data.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .find((text): text is string => Boolean(text));
}

// Condensed version of steward.ts's TONE_DELIVERY vocabulary, for a single
// generated sentence rather than a full chat reply — duplicated rather than
// shared, matching this app's existing tradeoff for small per-file prompt
// content (see e.g. the relationship/pulse category vocabularies).
const TONE_NOTE: Record<ToneVoice, string> = {
  straight_talk: "Direct and plainspoken.",
  middle_of_the_road: "Warm but still direct — no hedging.",
  take_it_easy: "Gentle and inviting, phrased more as an encouragement than a directive.",
};

export interface RelationshipCommitmentSignal {
  open: string[];
  kept: string[];
}

function defaultTribeIntentionText(rel: Relationship): string {
  return rel.name
    ? `Ask ${rel.name} about their week before you talk about yours.`
    : "Log commitments to the people who matter most — spouse, kids, parents, close friends.";
}

function hasGenerationSignal(rel: Relationship, commitments: RelationshipCommitmentSignal): boolean {
  return Boolean(rel.notes || rel.commitments || rel.biggestChallenge || commitments.open.length || commitments.kept.length);
}

// #137 — Tribe's "Today's Intention" card. Generated at most once per
// calendar day per user+relationship pairing (cached in `tribe_intentions`),
// checked first so a second visit the same day never re-calls OpenAI. Falls
// back to the same static line the card always showed pre-#137 whenever
// there isn't enough signal to say something specific yet, or generation
// fails for any reason — the card should never look empty or broken.
export async function getTribeIntentionText(
  userId: string,
  rel: Relationship,
  commitments: RelationshipCommitmentSignal,
  tone: ToneVoice,
): Promise<string> {
  const today = new Date().toISOString().split("T")[0] as string;

  const [cached] = await db.select({ text: tribeIntentions.text }).from(tribeIntentions)
    .where(and(
      eq(tribeIntentions.userId, userId),
      eq(tribeIntentions.date, today),
      eq(tribeIntentions.relationshipId, rel.id),
    ))
    .limit(1);
  if (cached) return cached.text;

  if (!hasGenerationSignal(rel, commitments)) return defaultTribeIntentionText(rel);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return defaultTribeIntentionText(rel);

  const details = [
    rel.notes ? `Notes: ${rel.notes}` : null,
    rel.commitments ? `Standing commitment: ${rel.commitments}` : null,
    rel.biggestChallenge ? `Current challenge: ${rel.biggestChallenge}` : null,
    commitments.open.length ? `Open commitments to them: ${commitments.open.join("; ")}` : null,
    commitments.kept.length ? `Recently kept commitments to them: ${commitments.kept.join("; ")}` : null,
  ].filter(Boolean).join("\n");

  const instructions = `Write exactly one short sentence, second person, telling the user a concrete way to invest in their relationship with ${rel.name || "this person"} (their ${rel.category}) today. ${TONE_NOTE[tone]} Ground it in the specific details given — don't invent details that aren't there. No preamble, no quotation marks, just the sentence.`;

  const timeoutController = new AbortController();
  const timeoutTimer = setTimeout(() => timeoutController.abort(), OPENAI_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        instructions,
        input: [{ role: "user", content: details }],
        max_output_tokens: 80,
      }),
      signal: timeoutController.signal,
    });
    if (!response.ok) return defaultTribeIntentionText(rel);

    const data = await response.json() as OpenAIResponsesApiResponse;
    const text = getOpenAIMessage(data)?.trim();
    if (!text) return defaultTribeIntentionText(rel);

    await db.insert(tribeIntentions)
      .values({ userId, date: today, relationshipId: rel.id, text })
      .onConflictDoNothing({ target: [tribeIntentions.userId, tribeIntentions.date, tribeIntentions.relationshipId] });
    return text;
  } catch {
    return defaultTribeIntentionText(rel);
  } finally {
    clearTimeout(timeoutTimer);
  }
}
