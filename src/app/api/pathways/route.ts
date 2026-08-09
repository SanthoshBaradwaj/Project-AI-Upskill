import { NextResponse } from "next/server";
import { fallbackPathways, runPlannerAgent } from "@/lib/agents/planner";
import { hasApiKey } from "@/lib/anthropic";
import { role as lookupRole } from "@/lib/data";
import { enforceDifferentiation, checkDifferentiation } from "@/lib/differentiation";
import { logAgent } from "@/lib/instrument";
import { scoreRole } from "@/lib/match";
import { DEFAULT_PREFERENCES } from "@/lib/types";
import type { PathwayResult, Preferences, VerifiedSkill } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/pathways
 *
 * Career Planner Agent -> Calibrator -> differentiation check. Latency budget 12s.
 *
 * The target role is re-scored server-side from `role_id` + the verified vector
 * rather than trusting client-supplied gaps, so the plan is always built against
 * the same arithmetic the results page displayed.
 */
export async function POST(req: Request) {
  const started = Date.now();

  const body = (await req.json()) as {
    role_id: string;
    verified: VerifiedSkill[];
    preferences: Preferences | null;
    pace_multiplier?: number;
    domain?: string;
  };

  const target = lookupRole(body.role_id);
  if (!target) {
    return NextResponse.json({ error: "Unknown role." }, { status: 400 });
  }

  const prefs = body.preferences ?? DEFAULT_PREFERENCES;
  const pace = body.pace_multiplier ?? 1;
  const scored = scoreRole(target, body.verified ?? [], prefs, pace);

  const input = {
    target: scored,
    currentReadiness: scored.readiness,
    domain: body.domain ?? "general",
    companies: prefs.preferred_companies,
    weeklyHours: prefs.weekly_hours,
    paceMultiplier: pace,
  };

  let pathways;
  let note: string | null = null;
  let source: PathwayResult["source"] = "live";

  if (hasApiKey()) {
    try {
      const live = await runPlannerAgent(input);
      // The prompt states the 40% rule; this is what enforces it. If the model
      // produced three variations of one plan we ship two real ones instead.
      const enforced = enforceDifferentiation(live.pathways);
      pathways = enforced.pathways;
      note = enforced.note ?? live.note;
    } catch (err) {
      source = "fallback";
      const fb = fallbackPathways(input);
      pathways = fb.pathways;
      note = fb.note;
      logAgent({
        agent: "planner",
        ms: Date.now() - started,
        source: "fallback",
        detail: { error: err instanceof Error ? err.message : "unknown" },
      });
    }
  } else {
    source = "fallback";
    const fb = fallbackPathways(input);
    pathways = fb.pathways;
    note = fb.note;
  }

  const differentiation = checkDifferentiation(pathways);
  const ms = Date.now() - started;

  logAgent({
    agent: "planner",
    ms,
    source,
    detail: {
      role: target.role_id,
      pathways: pathways.length,
      max_overlap: differentiation.max_overlap,
      differentiation_passed: differentiation.passed,
      pace_multiplier: pace,
      months: pathways.map((p) => p.estimated_months),
    },
  });

  const result: PathwayResult = {
    pathways,
    note,
    differentiation,
    pace_multiplier: pace,
    source,
  };

  return NextResponse.json({ pathways: result, scored_target: scored, ms });
}
