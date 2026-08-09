import rolesJson from "@data/roles.json";
import taxonomyJson from "@data/taxonomy.json";
import fallbackJson from "@data/fallback_questions.json";
import type { Question, Role, TaxonomySkill } from "./types";

// JSON imports widen tuples to arrays and string literals to string, so these
// go through `unknown`. The shapes are asserted by the data-integrity tests.
export const TAXONOMY = taxonomyJson.skills as unknown as TaxonomySkill[];
export const ROLES = rolesJson.roles as unknown as Role[];
export const METROS = rolesJson.metros as { id: string; label: string }[];
export const CORPUS_META = rolesJson.corpus_meta;
export const FALLBACK_QUESTIONS = fallbackJson.questions as unknown as Question[];

const bySkillId = new Map(TAXONOMY.map((s) => [s.skill_id, s]));
const byRoleId = new Map(ROLES.map((r) => [r.role_id, r]));

export function skill(id: string): TaxonomySkill | undefined {
  return bySkillId.get(id);
}

export function skillName(id: string): string {
  return bySkillId.get(id)?.display_name ?? id;
}

/** Hours to gain one level in a skill. Falls back to a neutral 40 for unknowns. */
export function hoursPerLevel(id: string): number {
  return bySkillId.get(id)?.hours_per_level ?? 40;
}

export function role(id: string): Role | undefined {
  return byRoleId.get(id);
}

export const TOTAL_POSTINGS = CORPUS_META.total_postings;
