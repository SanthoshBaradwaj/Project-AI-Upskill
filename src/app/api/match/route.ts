import { NextResponse } from "next/server";
import { logAgent } from "@/lib/instrument";
import { claimCorrectionRate, computeVerifiedSkills } from "@/lib/ladder";
import { buildLearnerProfile, paceMultiplier } from "@/lib/learner";
import { match } from "@/lib/match";
import { DEFAULT_PREFERENCES } from "@/lib/types";
import type { Answer, ExtractedSkill, Preferences } from "@/lib/types";

export const runtime = "nodejs";

/**
 * POST /api/match
 *
 * Pure function — no LLM, no I/O. Latency budget is <100ms and it is a filter
 * plus weighted arithmetic, deliberately explainable rather than a black box.
 *
 * Does three things in one round trip: resolves verified levels from the quiz,
 * runs the Calibrator, then scores and ranks the corpus under the user's
 * constraints.
 */
export async function POST(req: Request) {
  const started = Date.now();

  const body = (await req.json()) as {
    skills: ExtractedSkill[];
    answers: Answer[];
    preferences: Preferences | null;
  };

  const skills = body.skills ?? [];
  const answers = body.answers ?? [];
  const prefs = body.preferences ?? DEFAULT_PREFERENCES;

  const verified = computeVerifiedSkills(skills, answers);
  const learner = buildLearnerProfile(answers, prefs.weekly_hours);
  const pace = paceMultiplier(learner, answers);
  const result = match(verified, prefs, pace.multiplier);

  const ms = Date.now() - started;
  logAgent({
    agent: "matching_engine",
    ms,
    source: "live",
    detail: {
      deterministic: true,
      roles_ranked: result.all_ranked.length,
      nearest: result.nearest_reachable?.role.role_id,
      nearest_readiness: result.nearest_reachable?.readiness,
      stated_target: result.stated_target?.role.role_id ?? null,
      stated_readiness: result.stated_target?.readiness ?? null,
      demoted_roles: result.all_ranked.filter((r) => r.demoted).length,
      pace_multiplier: pace.multiplier,
      claim_correction_rate: claimCorrectionRate(verified),
    },
  });

  return NextResponse.json({
    verified,
    learner,
    pace,
    match: result,
    metrics: {
      claim_correction_rate: claimCorrectionRate(verified),
      two_track_spread:
        result.nearest_reachable && result.stated_target
          ? result.nearest_reachable.readiness - result.stated_target.readiness
          : null,
      ms,
    },
  });
}
