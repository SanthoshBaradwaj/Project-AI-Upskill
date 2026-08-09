import { callJSON } from "../anthropic";
import type { Question, ValidatorVerdict } from "../types";

/**
 * Prompt 2b — Validator Agent (adversarial pass), PRD §7.3.
 *
 * The genuinely agentic component: a second model instance whose objective is to
 * DEFEAT the first. Items scoring below 4, or failing difficulty_match, are
 * discarded and backfilled from the over-generated bank. Costs ~5 seconds and
 * saves the demo — and the rejection rate is a judge-facing statistic, so it has
 * to be real rather than decorative.
 */

export const MIN_SINGLE_ANSWER_SCORE = 4;

const SYSTEM = `You are an adversarial reviewer. Your goal is to find a defensible argument for
an option OTHER than the marked answer. You are rewarded for breaking questions.

For each question, return:
  single_answer_score: 1-5
    5 = exactly one defensible answer
    3 = one clearly best answer, one arguable alternative
    1 = two or more equally defensible answers
  difficulty_match: does the item genuinely require the stated tier? true|false
  breaking_argument: if score < 5, state the case for the alternative option.
                     null if the question is airtight.

Difficulty tiers, for difficulty_match:
  L1 FOUNDATIONAL - recall of core definitions, answerable after one intro course
  L2 APPLIED - choose the correct method or next step for a described scenario
  L3 ADVANCED - diagnose a subtle failure, trade-off, or edge case

Be harsh. A question that survives you is a question we can defend on stage.
Return a verdict for every question_id you are given.`;

const SCHEMA = {
  type: "object",
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question_id: { type: "string" },
          single_answer_score: { type: "integer", enum: [1, 2, 3, 4, 5] },
          difficulty_match: { type: "boolean" },
          breaking_argument: { anyOf: [{ type: "string" }, { type: "null" }] },
        },
        required: [
          "question_id",
          "single_answer_score",
          "difficulty_match",
          "breaking_argument",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["verdicts"],
  additionalProperties: false,
} as const;

export interface ValidationOutcome {
  kept: Question[];
  rejected: Question[];
  verdicts: ValidatorVerdict[];
}

export function applyVerdicts(
  questions: Question[],
  verdicts: ValidatorVerdict[],
): ValidationOutcome {
  const byId = new Map(verdicts.map((v) => [v.question_id, v]));
  const kept: Question[] = [];
  const rejected: Question[] = [];

  for (const q of questions) {
    const verdict = byId.get(q.question_id);
    // No verdict means the Validator did not review it. We keep it rather than
    // discarding — an unreviewed item is not an item known to be bad — but it is
    // excluded from the rejection-rate statistic by construction.
    if (!verdict) {
      kept.push(q);
      continue;
    }
    if (verdict.single_answer_score < MIN_SINGLE_ANSWER_SCORE || !verdict.difficulty_match) {
      rejected.push(q);
    } else {
      kept.push(q);
    }
  }

  return { kept, rejected, verdicts };
}

export async function runValidatorAgent(questions: Question[]): Promise<ValidationOutcome> {
  const payload = questions.map((q) => ({
    question_id: q.question_id,
    skill_id: q.skill_id,
    difficulty: q.difficulty,
    stem: q.stem,
    options: q.options,
    marked_answer: q.options[q.correct_index],
  }));

  const result = await callJSON<{ verdicts: ValidatorVerdict[] }>({
    system: SYSTEM,
    user: JSON.stringify({ questions: payload }),
    schema: SCHEMA as unknown as Record<string, unknown>,
    effort: "medium",
    maxTokens: 12000,
    timeoutMs: 25_000,
  });

  return applyVerdicts(questions, result.verdicts ?? []);
}
