import { skillName } from "./data";
import { untestedVerifiedLevel } from "./evidence";
import type {
  Answer,
  Difficulty,
  ExtractedSkill,
  Question,
  VerifiedSkill,
} from "./types";

/**
 * Adaptive difficulty ladder (PRD §7.4). Deterministic, client-side, no LLM.
 * P0-8 requires this to be unit tested, so every function here is pure.
 */

export const DIFFICULTY_ORDER: Difficulty[] = ["L1", "L2", "L3"];
export const START_DIFFICULTY: Difficulty = "L2";
export const QUIZ_LENGTH = 12;

export function difficultyValue(d: Difficulty): number {
  return DIFFICULTY_ORDER.indexOf(d) + 1;
}

export function difficultyFromValue(v: number): Difficulty {
  const clamped = Math.min(DIFFICULTY_ORDER.length, Math.max(1, v));
  return DIFFICULTY_ORDER[clamped - 1];
}

/** One rung of the ladder: right moves up, wrong moves down, bounded L1-L3. */
export function nextDifficulty(current: Difficulty, correct: boolean): Difficulty {
  return difficultyFromValue(difficultyValue(current) + (correct ? 1 : -1));
}

/**
 * Allocate the 12 slots across the tested skills.
 *
 * The PRD's pseudocode asks one question per skill, which yields 7 for 7 skills.
 * The remaining 5 slots go to the highest-priority skills — the ones the
 * Examiner flagged as most likely over-claimed — so the questions that matter
 * most get a second reading. Round 1 covers every skill in priority order;
 * round 2 revisits the top 5. Fully deterministic given the skill ordering.
 */
export function buildPlan(skillsInPriority: string[], count = QUIZ_LENGTH): string[] {
  if (skillsInPriority.length === 0) return [];
  const plan: string[] = [];
  let i = 0;
  while (plan.length < count) {
    plan.push(skillsInPriority[i % skillsInPriority.length]);
    i++;
  }
  return plan.slice(0, count);
}

/**
 * Pick the best available question for a (skill, difficulty) request.
 * Prefers the exact tier, then the nearest tier, and never repeats an item.
 */
export function selectQuestion(
  pool: Question[],
  skillId: string,
  difficulty: Difficulty,
  usedIds: Set<string>,
): Question | null {
  const candidates = pool.filter((q) => q.skill_id === skillId && !usedIds.has(q.question_id));
  if (candidates.length === 0) return null;

  const want = difficultyValue(difficulty);
  candidates.sort(
    (a, b) =>
      Math.abs(difficultyValue(a.difficulty) - want) -
        Math.abs(difficultyValue(b.difficulty) - want) ||
      a.question_id.localeCompare(b.question_id),
  );
  return candidates[0];
}

export interface QuizProgress {
  index: number;
  difficulty: Difficulty;
  usedIds: Set<string>;
}

/**
 * Drive the quiz one question at a time. The ladder carries a single global
 * difficulty across skills, exactly as PRD §7.4 specifies; the plan decides
 * *which* skill is asked at that difficulty.
 *
 * If the planned skill has no unused questions left, we fall through to any
 * other skill still holding stock rather than ending the quiz short.
 */
export function nextQuestion(
  pool: Question[],
  plan: string[],
  progress: QuizProgress,
): Question | null {
  if (progress.index >= plan.length) return null;

  const planned = plan[progress.index];
  const direct = selectQuestion(pool, planned, progress.difficulty, progress.usedIds);
  if (direct) return direct;

  for (const alt of plan.slice(progress.index + 1).concat(plan)) {
    if (alt === planned) continue;
    const sub = selectQuestion(pool, alt, progress.difficulty, progress.usedIds);
    if (sub) return sub;
  }

  const anything = pool.find((q) => !progress.usedIds.has(q.question_id));
  return anything ?? null;
}

/**
 * verified_level for a tested skill (PRD §7.4):
 *   4  if L3 correct
 *   3  if L2 correct, L3 wrong or not reached
 *   2  if L1 correct, L2 wrong
 *   1  if L1 wrong
 *
 * Implemented as "highest difficulty answered correctly, plus one" — which
 * reproduces the table exactly and is defined for skills that never reached L1.
 * A skill with no correct answer at any tier lands at 1.
 */
export function verifiedLevelFromAnswers(answers: Answer[], skillId: string): number | null {
  const forSkill = answers.filter((a) => a.skill_id === skillId);
  if (forSkill.length === 0) return null;

  const highestCorrect = forSkill
    .filter((a) => a.correct)
    .reduce((max, a) => Math.max(max, difficultyValue(a.difficulty)), 0);

  return highestCorrect === 0 ? 1 : highestCorrect + 1;
}

/**
 * The claimed-vs-verified vector that drives everything downstream.
 * Tested skills get their earned level; untested skills are discounted by the
 * Evidence Ladder rather than trusted at face value.
 */
export function computeVerifiedSkills(
  skills: ExtractedSkill[],
  answers: Answer[],
): VerifiedSkill[] {
  return skills.map((s) => {
    const tested = verifiedLevelFromAnswers(answers, s.skill_id);
    return {
      skill_id: s.skill_id,
      display_name: s.display_name || skillName(s.skill_id),
      category: s.category,
      claimed_level: s.claimed_level,
      verified_level: tested ?? untestedVerifiedLevel(s),
      tested: tested !== null,
      evidence_tier: s.evidence_tier,
      years_since_last_use: s.years_since_last_use,
    };
  });
}

/**
 * Demo-day metric: share of claimed skills whose verified level differs from
 * the claim. Target is >= 30% (PRD §8.1) — the money shot on the chart.
 */
export function claimCorrectionRate(verified: VerifiedSkill[]): number {
  if (verified.length === 0) return 0;
  const corrected = verified.filter((v) => v.verified_level !== v.claimed_level).length;
  return corrected / verified.length;
}
