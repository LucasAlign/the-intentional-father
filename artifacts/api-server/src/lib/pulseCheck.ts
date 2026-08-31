export const PULSE_CATEGORIES = ["physical", "mental", "spiritual"] as const;
export type PulseCategory = (typeof PULSE_CATEGORIES)[number];
export function isPulseCategory(value: unknown): value is PulseCategory {
  return typeof value === "string" && (PULSE_CATEGORIES as readonly string[]).includes(value);
}

export const PULSE_STATES = ["up", "mid", "down"] as const;
export type PulseState = (typeof PULSE_STATES)[number];
export function isPulseState(value: unknown): value is PulseState {
  return typeof value === "string" && (PULSE_STATES as readonly string[]).includes(value);
}

export const PULSE_STATE_LABEL: Record<PulseState, string> = { up: "up", mid: "steady", down: "down" };
