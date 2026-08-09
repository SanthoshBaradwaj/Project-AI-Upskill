import { AgentUnavailable, callJSON } from "../anthropic";
import { skillName } from "../data";
import type { Difficulty, Question } from "../types";

/**
 * Prompt 2 — Examiner Agent (batched MCQ generation), PRD §7.3.
 *
 * The whole bank is generated in ONE call before the quiz starts. Per-question
 * generation adds 3-6s between every question and destroys the demo's rhythm.
 * We over-generate (3 tiers x 7 skills = 21) and serve 12 adaptively, which is
 * cheap and eliminates all mid-quiz latency.
 */

export const TIERS: Difficulty[] = ["L1", "L2", "L3"];

const SYSTEM = `You write assessment items that measure real proficiency, not trivia recall.
For each (skill, difficulty) pair, generate one multiple-choice question.

DIFFICULTY DEFINITIONS:
L1 FOUNDATIONAL - recall of core definitions. Answerable after one intro course.
L2 APPLIED - given a realistic scenario, select the correct method or next step.
             Requires having actually used the skill.
L3 ADVANCED  - diagnose a subtle failure mode, trade-off, or edge case.
             Requires production experience.

DISTRACTOR RULES (critical):
- Exactly 4 options, all similar in length, specificity, and grammatical form.
- Every distractor must be a plausible belief held by someone who ALMOST
  understands the concept. No absurd or joke options.
- Exactly one option unambiguously correct to a domain expert.
- Never "All of the above" or "None of the above".
- Do not signal the answer via hedged qualifiers ("usually", "typically")
  appearing in only one option.

STYLE:
- Scenario-framed and concrete. Prefer "A model's validation loss..." over
  "Which of the following describes...".
- Stem under 45 words. Options under 20 words each.
- explanation: one sentence that teaches the concept to someone who got it wrong.
- Vary the position of the correct answer across items.

Return one question for every requested pair, and nothing else.`;

const SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question_id: { type: "string" },
          skill_id: { type: "string" },
          difficulty: { type: "string", enum: ["L1", "L2", "L3"] },
          stem: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          correct_index: { type: "integer", enum: [0, 1, 2, 3] },
          explanation: { type: "string" },
        },
        required: [
          "question_id",
          "skill_id",
          "difficulty",
          "stem",
          "options",
          "correct_index",
          "explanation",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
} as const;

/** Structural validation. An item that fails here never reaches the Validator. */
export function isWellFormed(q: Question, allowedSkills: Set<string>): boolean {
  if (!q || typeof q.stem !== "string" || q.stem.trim().length < 10) return false;
  if (!Array.isArray(q.options) || q.options.length !== 4) return false;
  if (q.options.some((o) => typeof o !== "string" || o.trim().length === 0)) return false;
  if (new Set(q.options.map((o) => o.trim().toLowerCase())).size !== 4) return false;
  if (typeof q.correct_index !== "number" || q.correct_index < 0 || q.correct_index > 3) {
    return false;
  }
  if (!TIERS.includes(q.difficulty)) return false;
  if (!allowedSkills.has(q.skill_id)) return false;
  // Hard rule from the distractor spec — these leak the answer format.
  if (q.options.some((o) => /\b(all|none) of the above\b/i.test(o))) return false;
  return true;
}

export async function runExaminerAgent(
  skillIds: string[],
  domain: string,
): Promise<Question[]> {
  const pairs = skillIds.flatMap((skill) =>
    TIERS.map((difficulty) => ({ skill, skill_name: skillName(skill), difficulty })),
  );

  const result = await callJSON<{ questions: Question[] }>({
    system: SYSTEM,
    user: `Generate questions for: ${JSON.stringify(pairs)}
Use the skill id exactly as given in each pair for skill_id.
Candidate domain (scenario flavor ONLY - do not adjust difficulty): ${domain}`,
    schema: SCHEMA as unknown as Record<string, unknown>,
    effort: "medium",
    maxTokens: 16000,
    timeoutMs: 30_000,
  });

  const allowed = new Set(skillIds);
  const questions = (result.questions ?? [])
    .filter((q) => isWellFormed(q, allowed))
    .map((q, i) => ({ ...q, question_id: q.question_id || `gen_${i}` }));

  if (questions.length === 0) throw new AgentUnavailable("examiner produced no usable items");
  return questions;
}
