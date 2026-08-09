import type { EvidenceTier, ExtractedSkill } from "./types";

/**
 * The Evidence Ladder (PRD §7.0) — the intellectual spine of the product.
 *
 *   T1 Asserted  — named in a list or title, no task context. Ceiling 1, weight 0.4x
 *   T2 Evidenced — verbatim evidence of owned work. Ceiling 2, weight 0.6x
 *   T3 Verified  — correct MCQ performance at the matching tier. Ceiling 4, weight 1.0x
 *
 * Only verified levels drive role matching at full weight. That single rule is
 * what makes every recommendation defensible under questioning.
 */

export const TIER_CEILING: Record<EvidenceTier, number> = {
  asserted: 1,
  evidenced: 2,
};

export const TIER_WEIGHT: Record<EvidenceTier, number> = {
  asserted: 0.4,
  evidenced: 0.6,
};

/** Verified skills carry full weight regardless of how they were originally claimed. */
export const VERIFIED_WEIGHT = 1.0;
export const VERIFIED_CEILING = 4;

/**
 * Recency decay, applied to T1 and T2 only (never to verified levels).
 *
 * The decay *factor* is floored at 0.4, i.e. staleness can cost at most 60% of a
 * claim's weight — a 2011 Python project is not a 2025 Python project, but it is
 * not worth nothing either. Unknown recency is treated as current (no penalty),
 * because punishing an undated résumé line penalises formatting, not skill.
 */
export function recencyDecay(yearsSinceLastUse: number | null): number {
  if (yearsSinceLastUse === null || yearsSinceLastUse <= 0) return 1;
  return Math.max(0.4, Math.pow(0.9, yearsSinceLastUse));
}

/**
 * What an untested claim is actually worth: the claim capped at its tier
 * ceiling, then discounted by tier weight and staleness.
 */
export function untestedVerifiedLevel(s: ExtractedSkill): number {
  const capped = Math.min(s.claimed_level, TIER_CEILING[s.evidence_tier]);
  const decayed = capped * TIER_WEIGHT[s.evidence_tier] * recencyDecay(s.years_since_last_use);
  return Math.max(0, Math.round(decayed));
}

/**
 * Escalation heuristic (PRD §7.0), replacing v0.1's transcript grade signal.
 *
 * A skill is high over-claim risk when the claim outruns the evidence:
 * `claimed_level >= 3` on asserted-only evidence, or a claim last exercised
 * more than five years ago. The likeliest over-claim gets tested first.
 *
 * Returns 0-1 rather than a boolean so the Examiner can rank within the flagged
 * set instead of treating every flagged skill as equally suspect.
 */
export function overClaimRisk(s: ExtractedSkill): number {
  let risk = 0;

  // The claim exceeds what its evidence tier can support at all.
  const ceiling = TIER_CEILING[s.evidence_tier];
  if (s.claimed_level > ceiling) {
    risk += 0.35 * Math.min(1, (s.claimed_level - ceiling) / 3);
  }

  // Headline trigger: level 3+ backed only by a list item.
  if (s.claimed_level >= 3 && s.evidence_tier === "asserted") risk += 0.45;

  // Staleness.
  const years = s.years_since_last_use;
  if (years !== null && years > 5) risk += 0.3;
  else if (years !== null && years > 2) risk += 0.12;

  return Math.min(1, risk);
}

export function isHighOverClaimRisk(s: ExtractedSkill): boolean {
  return overClaimRisk(s) >= 0.45;
}
