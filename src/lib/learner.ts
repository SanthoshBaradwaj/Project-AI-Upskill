import { difficultyValue } from "./ladder";
import type { Answer, Difficulty, LearnerProfile } from "./types";

/**
 * Learner Profile + Calibrator (PRD §7.4).
 *
 * Discipline on the claim: this is a pace calibration heuristic derived from
 * four minutes of in-session behaviour. It is NOT a learning-velocity model.
 * The object is instrumented and schema-ready for persistence; the cross-session
 * learning loop is the v2 headline. Nothing here is stored.
 */

export const PACE_MIN = 0.8;
export const PACE_MAX = 1.3;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function medianLatencyByTier(answers: Answer[]): Record<Difficulty, number | null> {
  const tiers: Difficulty[] = ["L1", "L2", "L3"];
  const out = {} as Record<Difficulty, number | null>;
  for (const t of tiers) {
    const ms = answers.filter((a) => a.difficulty === t).map((a) => a.latency_ms);
    const m = median(ms);
    out[t] = m === null ? null : Math.round((m / 1000) * 10) / 10;
  }
  return out;
}

/**
 * Where the ladder went. Compares each step's direction; a run that mostly
 * climbs reads as "climbing", one that keeps reversing reads as "oscillating".
 */
export function ladderTrajectory(answers: Answer[]): LearnerProfile["ladder_trajectory"] {
  if (answers.length < 3) return "flat";

  const values = answers.map((a) => difficultyValue(a.difficulty));
  let up = 0;
  let down = 0;
  let reversals = 0;
  let lastDir = 0;

  for (let i = 1; i < values.length; i++) {
    const delta = values[i] - values[i - 1];
    if (delta > 0) up++;
    else if (delta < 0) down++;
    const dir = Math.sign(delta);
    if (dir !== 0 && lastDir !== 0 && dir !== lastDir) reversals++;
    if (dir !== 0) lastDir = dir;
  }

  const moves = up + down;
  if (moves === 0) return "flat";
  if (reversals / moves > 0.6) return "oscillating";
  if (up > down) return "climbing";
  if (down > up) return "descending";
  return "oscillating";
}

/**
 * confidence_delta — share of *fast* answers that were wrong, where "fast"
 * means below the median latency for that answer's own tier.
 *
 * High delta indicates over-confidence: the same trait that produces résumé
 * over-claiming, now measured directly. It is the most interesting number the
 * product generates and it costs nothing to compute.
 */
export function confidenceDelta(answers: Answer[]): number {
  const tierMedians = new Map<Difficulty, number>();
  for (const t of ["L1", "L2", "L3"] as Difficulty[]) {
    const ms = answers.filter((a) => a.difficulty === t).map((a) => a.latency_ms);
    const m = median(ms);
    if (m !== null) tierMedians.set(t, m);
  }

  const fast = answers.filter((a) => {
    const m = tierMedians.get(a.difficulty);
    return m !== undefined && a.latency_ms < m;
  });

  if (fast.length === 0) return 0;
  const wrongFast = fast.filter((a) => !a.correct).length;
  return Math.round((wrongFast / fast.length) * 100) / 100;
}

export function buildLearnerProfile(answers: Answer[], weeklyHours: number): LearnerProfile {
  return {
    median_latency_by_tier: medianLatencyByTier(answers),
    ladder_trajectory: ladderTrajectory(answers),
    confidence_delta: confidenceDelta(answers),
    answer_changes: answers.filter((a) => a.answer_changed).length,
    self_reported_weekly_hours: weeklyHours,
  };
}

export interface PaceResult {
  multiplier: number;
  reason: string;
  /** Surfaced in the UI only when over-confidence drove the adjustment. */
  honest_note: string | null;
}

/**
 * The Calibrator — a heuristic function, named honestly. Not an agent.
 * Single downstream use: pace_multiplier, applied to every hour estimate and
 * every journey-map timeline.
 */
export function paceMultiplier(profile: LearnerProfile, answers: Answer[]): PaceResult {
  const l3 = answers.filter((a) => a.difficulty === "L3");
  const l3Accurate = l3.length >= 2 && l3.filter((a) => a.correct).length / l3.length >= 0.7;
  const l3Median = profile.median_latency_by_tier.L3;
  const l3Fast = l3Median !== null && l3Median < 35;

  const l2Median = profile.median_latency_by_tier.L2;
  const l2Slow = l2Median !== null && l2Median > 30;

  let multiplier: number;
  let reason: string;
  let honest_note: string | null = null;

  if (profile.confidence_delta >= 0.4) {
    multiplier = 1.25;
    reason = "High confidence delta — fast answers were often wrong";
    honest_note =
      "You answered quickly and got a meaningful share of those wrong. That pattern usually means the material feels more familiar than it is, so we have widened these estimates rather than narrowed them.";
  } else if (l3Fast && l3Accurate) {
    multiplier = 0.85;
    reason = "Fast and accurate at L3 — estimates compressed";
  } else if (profile.ladder_trajectory === "oscillating" && l2Slow) {
    multiplier = 1.15;
    reason = "Oscillating trajectory with high L2 latency — estimates expanded";
  } else if (profile.ladder_trajectory === "climbing") {
    multiplier = 1.0;
    reason = "Climbing trajectory at moderate latency — baseline pace";
  } else {
    multiplier = 1.0;
    reason = "Baseline pace";
  }

  return {
    multiplier: Math.min(PACE_MAX, Math.max(PACE_MIN, multiplier)),
    reason,
    honest_note,
  };
}
