export const PURSUIT_CATEGORIES = ["job", "business", "volunteer", "other"] as const;
export type PursuitCategory = (typeof PURSUIT_CATEGORIES)[number];
export function isPursuitCategory(value: unknown): value is PursuitCategory {
  return typeof value === "string" && (PURSUIT_CATEGORIES as readonly string[]).includes(value);
}

export const PURSUIT_CATEGORY_LABEL: Record<PursuitCategory, string> = {
  job: "Job",
  business: "Business",
  volunteer: "Volunteer",
  other: "Other",
};
