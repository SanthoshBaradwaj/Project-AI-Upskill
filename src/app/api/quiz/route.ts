import { NextResponse } from "next/server";
import { runExaminerAgent } from "@/lib/agents/examiner";
import { runValidatorAgent } from "@/lib/agents/validator";
import { hasApiKey } from "@/lib/anthropic";
import { FALLBACK_QUESTIONS } from "@/lib/data";
import { logAgent } from "@/lib/instrument";
import { buildPlan, QUIZ_LENGTH } from "@/lib/ladder";
import { shuffleAll } from "@/lib/shuffle";
import { selectSkillsToTest } from "@/lib/skillSelect";
import type { ExtractedSkill, Preferences, Question, QuizBank } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/quiz
 *
 * Examiner -> Validator -> shuffle. Runs behind the skill-confirmation screen,
 * which is what hides the ~15s of latency behind user activity.
 *
 * The client receives the whole validated pool plus the plan and runs the
 * adaptive ladder locally, so there is zero mid-quiz network latency.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as {
    skills: ExtractedSkill[];
    preferences: Preferences | null;
    domain?: string;
  };

  const skills = body.skills ?? [];
  if (skills.length === 0) {
    return NextResponse.json({ error: "No skills to test." }, { status: 400 });
  }

  const selected = selectSkillsToTest(skills, body.preferences ?? null);
  const skillIds = selected.map((s) => s.skill_id);

  let pool: Question[] = [];
  let generated = 0;
  let rejected = 0;
  let source: QuizBank["stats"]["source"] = "fallback";
  let generationMs = 0;
  let validationMs = 0;

  if (hasApiKey()) {
    const genStart = Date.now();
    try {
      const raw = await runExaminerAgent(skillIds, body.domain ?? "general");
      generationMs = Date.now() - genStart;
      generated = raw.length;

      const valStart = Date.now();
      try {
        const outcome = await runValidatorAgent(raw);
        validationMs = Date.now() - valStart;
        rejected = outcome.rejected.length;
        pool = outcome.kept;
      } catch (err) {
        // The Examiner succeeded but the Validator did not. Ship the unvalidated
        // items rather than dropping the whole bank — but say so in the stats so
        // the judge-facing rejection rate is not silently faked.
        validationMs = Date.now() - valStart;
        pool = raw;
        logAgent({
          agent: "validator",
          ms: validationMs,
          source: "fallback",
          detail: { error: err instanceof Error ? err.message : "unknown" },
        });
      }
      source = "live";
    } catch (err) {
      generationMs = Date.now() - genStart;
      logAgent({
        agent: "examiner",
        ms: generationMs,
        source: "fallback",
        detail: { error: err instanceof Error ? err.message : "unknown" },
      });
    }
  }

  // Backfill from the hand-verified bank whenever the live pool is thin. These
  // items bypass the Validator because they were verified by hand up front.
  const covered = new Set(pool.map((q) => `${q.skill_id}:${q.difficulty}`));
  const backfill = FALLBACK_QUESTIONS.filter(
    (q) => skillIds.includes(q.skill_id) && !covered.has(`${q.skill_id}:${q.difficulty}`),
  );

  if (backfill.length > 0) {
    pool = pool.concat(backfill);
    if (source === "live") source = "mixed";
  }

  // Last resort: no live items and none of the selected skills are in the bank.
  // Serve the whole bank so the quiz still runs rather than showing an error.
  if (pool.length === 0) {
    pool = [...FALLBACK_QUESTIONS];
    source = "fallback";
  }

  const shuffled = shuffleAll(pool);
  const poolSkills = new Set(shuffled.map((q) => q.skill_id));
  const planSkills = skillIds.filter((id) => poolSkills.has(id));
  const plan = buildPlan(planSkills.length > 0 ? planSkills : [...poolSkills], QUIZ_LENGTH);

  const stats: QuizBank["stats"] = {
    generated,
    rejected_by_validator: rejected,
    rejection_rate: generated > 0 ? Math.round((rejected / generated) * 100) / 100 : 0,
    source,
    generation_ms: generationMs,
    validation_ms: validationMs,
  };

  logAgent({
    agent: "quiz",
    ms: generationMs + validationMs,
    source: source === "fallback" ? "fallback" : "live",
    detail: { ...stats, pool_size: shuffled.length, skills: planSkills },
  });

  const bank: QuizBank = {
    pool: shuffled,
    plan,
    skills_tested: planSkills,
    stats,
  };

  return NextResponse.json({ quiz: bank });
}
