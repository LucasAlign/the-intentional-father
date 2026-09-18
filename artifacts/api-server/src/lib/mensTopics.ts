// #188 Phase 2 — the "Men's Topics" list, browsable/favoritable independent
// of whether the Themes plan type (#189 Phase 3) ships. Draft list from
// #189's grilling; ids are stable slugs (not array indices) so favorites
// keyed on them don't silently break if this list is ever reordered — same
// reasoning verse_favorites already uses reference strings over indices
// for. No book/chapter/verse references here yet — that curation is #189's
// job once a Themes plan type actually needs it; this is deliberately just
// the browsable topic list + a favorite toggle.

export interface MensTopic {
  id: string;
  title: string;
  description: string;
}

export const MENS_TOPICS: MensTopic[] = [
  { id: "leadership", title: "Leadership", description: "Leading at home, work, and community." },
  { id: "integrity", title: "Integrity & Character", description: "Who you are when no one's watching." },
  { id: "marriage", title: "Marriage", description: "Loving and leading a wife." },
  { id: "fatherhood", title: "Fatherhood", description: "Raising and discipling children." },
  { id: "work_provision", title: "Work & Provision", description: "Working as unto the Lord, providing for a family." },
  { id: "perseverance", title: "Perseverance Through Trials", description: "Suffering, endurance, hope." },
  { id: "anger_self_control", title: "Anger & Self-Control", description: "Taming temper, patience." },
  { id: "friendship_brotherhood", title: "Friendship & Brotherhood", description: "Iron sharpens iron, accountability." },
  { id: "faith_under_pressure", title: "Faith Under Pressure", description: "Courage, fear, trusting God in hard decisions." },
  { id: "purity_temptation", title: "Purity & Temptation", description: "Sexual integrity, guarding the heart/mind." },
];

const topicById = new Map(MENS_TOPICS.map((t) => [t.id, t]));

export function isValidTopicId(id: string): boolean {
  return topicById.has(id);
}

export function topicTitle(id: string): string | null {
  return topicById.get(id)?.title ?? null;
}
