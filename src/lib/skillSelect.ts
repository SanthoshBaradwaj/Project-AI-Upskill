import { ROLES } from "./data";
import { overClaimRisk } from "./evidence";
import { resolvePreferredRole } from "./match";
import type { ExtractedSkill, Preferences } from "./types";

/**
 * Examiner skill selection (PRD §7.3) — deterministic, preference-aware.
 *
 *   Slots 1-5: top skills by claimed_level x role_relevance x over_claim_risk.
 *              The likeliest over-claim gets tested first.
 *   Slots 6-7: highest-weight required skills of the user's *preferred* role,
 *              even if weakly claimed. A confident "you're not there yet on X"
 *              is only credible if X was actually tested.
 */

export const RISK_SLOTS = 5;
export const PREFERENCE_SLOTS = 2;
export const TOTAL_SLOTS = RISK_SLOTS + PREFERENCE_SLOTS;

/** How much any role in the corpus leans on this skill, normalised to 0-1. */
export function roleRelevance(skillId: string): number {
  let max = 0;
  for (const role of ROLES) {
    for (const req of role.required_skills) {
      if (req.skill === skillId) max = Math.max(max, req.weight);
    }
    if (role.transferable_signals.includes(skillId)) max = Math.max(max, 0.5);
  }
  return max;
}

export interface RankedSkill {
  skill_id: string;
  score: number;
  reason: "over_claim_risk" | "preferred_role_requirement";
  risk: number;
}

export function rankByOverClaimRisk(skills: ExtractedSkill[]): RankedSkill[] {
  return skills
    .map((s) => {
      const risk = overClaimRisk(s);
      // Risk modulates rather than annihilates: a well-evidenced, highly
      // relevant skill is still worth testing, just not first.
      const riskFactor = 0.3 + 0.7 * risk;
      return {
        skill_id: s.skill_id,
        score: s.claimed_level * roleRelevance(s.skill_id) * riskFactor,
        reason: "over_claim_risk" as const,
        risk,
      };
    })
    .sort((a, b) => b.score - a.score || a.skill_id.localeCompare(b.skill_id));
}

/**
 * The full 7-slot selection. Returns skill ids in the order the quiz plan
 * should consume them, so the highest-risk claim is question one.
 */
export function selectSkillsToTest(
  skills: ExtractedSkill[],
  prefs: Preferences | null,
): RankedSkill[] {
  const ranked = rankByOverClaimRisk(skills);
  const chosen: RankedSkill[] = ranked.slice(0, RISK_SLOTS);
  const taken = new Set(chosen.map((c) => c.skill_id));

  // Slots 6-7 — the aspiration track.
  const preferredRoles = (prefs?.preferred_roles ?? [])
    .map(resolvePreferredRole)
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const preferenceCandidates = preferredRoles
    .flatMap((r) => r.required_skills)
    .sort((a, b) => b.weight - a.weight || b.level - a.level);

  for (const req of preferenceCandidates) {
    if (chosen.length >= TOTAL_SLOTS) break;
    if (taken.has(req.skill)) continue;
    chosen.push({
      skill_id: req.skill,
      score: req.weight,
      reason: "preferred_role_requirement",
      risk: 0,
    });
    taken.add(req.skill);
  }

  // No stated preference (or it added nothing) — backfill from the risk ranking
  // so the quiz is always the full length.
  for (const r of ranked) {
    if (chosen.length >= TOTAL_SLOTS) break;
    if (taken.has(r.skill_id)) continue;
    chosen.push(r);
    taken.add(r.skill_id);
  }

  return chosen;
}
