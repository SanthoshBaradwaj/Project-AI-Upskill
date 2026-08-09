import resourcesJson from "@data/resources.json";
import { AgentUnavailable, callJSON } from "../anthropic";
import { enforceDifferentiation } from "../differentiation";
import type { Pathway, PathwayPhase, ScoredRole, SkillGap } from "../types";

/**
 * Prompt 3 — Career Planner Agent (three differentiated pathways), PRD §7.3.
 *
 * Rule 6 is the hallucination guard. Rule 5 is the emotional payload. The
 * differentiation requirement exists because the default failure mode of this
 * prompt is three near-identical plans with different labels.
 */

type ResourceBucket = { resource: string; hours: number };
type PathwayType = Pathway["type"];

const RESOURCES = resourcesJson.resources as Record<string, Record<PathwayType, ResourceBucket>>;
const GENERIC = resourcesJson.generic as Record<PathwayType, ResourceBucket>;

const SYSTEM = `You are a technical mentor building learning plans for a career switcher.
Produce THREE distinct pathways to the target role. Return only JSON.

PATHWAY DEFINITIONS - these must differ MEANINGFULLY, not cosmetically:
  SPRINT  - shortest time to employable. May target a bridge role rather than
            the final role. Breadth over depth. Minimum viable portfolio.
  DEEP    - strongest long-term ceiling. Foundations first (math, systems
            fundamentals). 2-3x longer. Portfolio-heavy.
  LATERAL - lowest disruption. Maximally leverages the candidate's existing
            domain: targets AI roles INSIDE their current industry. Fewest
            new skills; domain expertise is the primary asset.

DIFFERENTIATION REQUIREMENT:
  No two pathways may share more than 40% of their named resources.
  If you cannot meaningfully differentiate, say so in the "note" field rather
  than producing three variations of the same plan.

RULES:
1. Order phases by dependency, then gap size. Never suggest deep learning
   before the Python gap closes.
2. Every step names a SPECIFIC, REAL, free-or-cheap resource
   ("fast.ai Practical Deep Learning, Lessons 1-4"), never a category.
3. Every phase ends with ONE portfolio artifact that would appear on a resume.
4. Honest hour estimates for a working professional at the stated weekly hours.
5. Explicitly leverage the candidate's verified strengths BY NAME in each
   rationale. This person is not starting from zero.
6. Do not recommend anything you are not confident exists.
7. If preferred_companies are given, bias resources toward their known stack
   where it does not compromise fundamentals.

Produce 2-3 phases per pathway.`;

const SCHEMA = {
  type: "object",
  properties: {
    pathways: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["sprint", "deep", "lateral"] },
          headline: { type: "string" },
          target_role: { type: "string" },
          trade_off: { type: "string" },
          phases: {
            type: "array",
            items: {
              type: "object",
              properties: {
                phase: { type: "integer", enum: [1, 2, 3] },
                title: { type: "string" },
                duration_weeks: { type: "integer" },
                target_gaps: { type: "array", items: { type: "string" } },
                steps: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      resource: { type: "string" },
                      why: { type: "string" },
                      hours: { type: "integer" },
                    },
                    required: ["resource", "why", "hours"],
                    additionalProperties: false,
                  },
                },
                portfolio_artifact: { type: "string" },
                readiness_after: { type: "integer" },
              },
              required: [
                "phase",
                "title",
                "duration_weeks",
                "target_gaps",
                "steps",
                "portfolio_artifact",
                "readiness_after",
              ],
              additionalProperties: false,
            },
          },
          total_hours: { type: "integer" },
          estimated_months: { type: "number" },
        },
        required: [
          "type",
          "headline",
          "target_role",
          "trade_off",
          "phases",
          "total_hours",
          "estimated_months",
        ],
        additionalProperties: false,
      },
    },
    note: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
  required: ["pathways", "note"],
  additionalProperties: false,
} as const;

export interface PlannerInput {
  target: ScoredRole;
  currentReadiness: number;
  domain: string;
  companies: string[];
  weeklyHours: number;
  paceMultiplier: number;
}

export async function runPlannerAgent(input: PlannerInput): Promise<{
  pathways: Pathway[];
  note: string | null;
}> {
  const { target } = input;

  const result = await callJSON<{ pathways: Pathway[]; note: string | null }>({
    system: SYSTEM,
    user: JSON.stringify({
      target_role: target.role.title,
      required_stack: target.role.typical_stack,
      verified_strengths: target.strengths.map((s) => [s.display_name, s.level]),
      gaps: target.gaps.map((g) => [g.display_name, g.current, g.required]),
      current_readiness_percent: input.currentReadiness,
      domain: input.domain,
      preferred_companies: input.companies,
      weekly_hours: input.weeklyHours,
    }),
    schema: SCHEMA as unknown as Record<string, unknown>,
    effort: "medium",
    maxTokens: 16000,
    timeoutMs: 30_000,
  });

  const pathways = (result.pathways ?? []).filter(
    (p) => Array.isArray(p.phases) && p.phases.length > 0 && p.phases.every((ph) => ph.steps?.length),
  );
  if (pathways.length === 0) throw new AgentUnavailable("planner produced no usable pathways");

  return { pathways: applyPace(pathways, input), note: result.note ?? null };
}

/**
 * The Calibrator's single downstream use: pace_multiplier applied to every hour
 * estimate and every journey-map timeline. The model does not see it — it is a
 * deterministic post-pass so the adjustment is auditable.
 */
function applyPace(pathways: Pathway[], input: PlannerInput): Pathway[] {
  const { paceMultiplier: pace, weeklyHours } = input;

  return pathways.map((p) => {
    const phases = p.phases.map((ph) => {
      const steps = ph.steps.map((s) => ({ ...s, hours: Math.round(s.hours * pace) }));
      const phaseHours = steps.reduce((sum, s) => sum + s.hours, 0);
      return {
        ...ph,
        steps,
        duration_weeks: Math.max(1, Math.round(phaseHours / Math.max(1, weeklyHours))),
      };
    });

    const totalHours = phases.reduce(
      (sum, ph) => sum + ph.steps.reduce((s, st) => s + st.hours, 0),
      0,
    );

    return {
      ...p,
      phases,
      total_hours: totalHours,
      estimated_months: Math.round((totalHours / Math.max(1, weeklyHours) / 4.33) * 10) / 10,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Deterministic fallback                                              */
/* ------------------------------------------------------------------ */

function resourceFor(skillId: string, type: PathwayType): ResourceBucket {
  return RESOURCES[skillId]?.[type] ?? GENERIC[type];
}

const ARTIFACTS: Record<PathwayType, string[]> = {
  sprint: [
    "A public GitHub repo with a working end-to-end notebook and a README a hiring manager can skim in two minutes",
    "A deployed demo with a live URL and a one-page write-up of the decisions you made",
    "A short case study post showing the problem, your approach, and the measured result",
  ],
  deep: [
    "A from-scratch implementation with tests, showing you understand the mechanism rather than the library call",
    "A reproducible project repo with documented experiments, an evaluation harness, and results you can defend",
    "A written technical deep-dive on a non-obvious failure mode you found and fixed",
  ],
  lateral: [
    "An internal proof-of-concept on your own team's real data, with before-and-after numbers",
    "A documented internal tool your colleagues actually use, with an adoption note",
    "A written proposal to your leadership costing out an AI intervention in your own function",
  ],
};

const HEADLINES: Record<PathwayType, (role: string) => string> = {
  sprint: (role) => `Shortest credible route to ${role}`,
  deep: (role) => `Highest long-term ceiling toward ${role}`,
  lateral: (role) => `${role} inside the industry you already know`,
};

const TRADE_OFFS: Record<PathwayType, string> = {
  sprint:
    "You will be employable sooner but shallower. Expect to backfill fundamentals on the job, and expect the first role to be a step rather than the destination.",
  deep:
    "Two to three times longer before you are interview-ready, in exchange for a ceiling the sprint route cannot reach. Best if you are not under time pressure.",
  lateral:
    "The fewest new skills and the least disruption, because your domain knowledge is doing most of the work. The trade-off is a narrower set of employers.",
};

/**
 * Rule 5 says to leverage verified strengths BY NAME. Naming the *same*
 * strength in every step reads as a mail-merge, so each step draws the next
 * strength off a rotating list and the phrasing varies with it. When the user
 * has no verified strength to lean on, we say something true instead of
 * inventing one.
 */
const RATIONALE: Record<PathwayType, ((skill: string, strength: string) => string)[]> = {
  sprint: [
    (skill, s) => `Closes the ${skill} gap fast. Your verified ${s} means you can skip the beginner framing and go straight to application.`,
    (skill, s) => `The shortest path to working ${skill}. Lean on your ${s} to move through the setup material quickly.`,
    (skill, s) => `Enough ${skill} to ship something. Your ${s} is what makes the result worth putting in front of a hiring manager.`,
  ],
  deep: [
    (skill, s) => `Builds ${skill} from the foundations up rather than pattern-matching. Pairs with your verified ${s}, which is the base this depends on.`,
    (skill, s) => `Goes past the recipe into why ${skill} works. Your ${s} gives you the vocabulary to follow the derivations.`,
    (skill, s) => `The version of ${skill} that holds up under interview questions. Your ${s} is the anchor it attaches to.`,
  ],
  lateral: [
    (skill, s) => `Gets you to working ${skill} using tools your industry already runs, so your verified ${s} keeps its value.`,
    (skill, s) => `Applies ${skill} to problems you already understand. Your ${s} is the part nobody else on the team has.`,
    (skill, s) => `Builds ${skill} where your ${s} is already an advantage, rather than starting over somewhere new.`,
  ],
};

const RATIONALE_NO_STRENGTH: Record<PathwayType, ((skill: string) => string)[]> = {
  sprint: [
    (skill) => `Closes the ${skill} gap fast, with the minimum theory needed to use it in a portfolio piece.`,
    (skill) => `Gets ${skill} to the level where you can build something with it, and stops there.`,
    (skill) => `Covers the ${skill} a first employer will actually ask you to do on day one.`,
  ],
  deep: [
    (skill) => `Builds ${skill} from the foundations up, so the next layer of the stack rests on something solid.`,
    (skill) => `Takes ${skill} past the recipe stage into why it works, which is what survives an interview.`,
    (skill) => `The thorough version of ${skill}. Slower, but you will not have to relearn it later.`,
  ],
  lateral: [
    (skill) => `Gets you to working ${skill} through the tooling your current industry already uses.`,
    (skill) => `Learns ${skill} against problems from your own domain rather than generic tutorials.`,
    (skill) => `Enough ${skill} to run an internal project where you already understand the data.`,
  ],
};

/**
 * Three genuinely different plans without a model in the loop.
 *
 * Differentiation is structural, not stylistic: each pathway draws from its own
 * disjoint slice of the resource library, and each targets a different subset of
 * the gaps (Sprint takes the highest-weight few, Deep takes everything in
 * dependency order, Lateral takes the smallest gaps plus domain leverage).
 */
export function fallbackPathways(input: PlannerInput): { pathways: Pathway[]; note: string | null } {
  const { target, weeklyHours, paceMultiplier, currentReadiness } = input;
  const roleTitle = target.role.title;

  // Rotate through everything the user actually proved, so no two steps cite
  // the same strength unless they genuinely have only one.
  const strengths = [
    ...target.strengths.map((s) => s.display_name),
    ...target.matched_signals.map((s) => s.replace(/_/g, " ")),
  ];

  const byImpact = [...target.gaps].sort((a, b) => b.weight * b.gap - a.weight * a.gap);
  const bySize = [...target.gaps].sort((a, b) => a.gap - b.gap || b.weight - a.weight);

  const slices: Record<PathwayType, SkillGap[]> = {
    sprint: byImpact.slice(0, 3),
    deep: byImpact.slice(0, 5),
    lateral: bySize.slice(0, 3),
  };

  const pathways = (["sprint", "deep", "lateral"] as PathwayType[]).map((type) => {
    const gaps = slices[type].length > 0 ? slices[type] : byImpact.slice(0, 2);
    const perPhase = 2;
    const phases: PathwayPhase[] = [];
    let stepOrdinal = 0;

    for (let i = 0; i < gaps.length; i += perPhase) {
      const chunk = gaps.slice(i, i + perPhase);
      const phaseIndex = phases.length + 1;
      if (phaseIndex > 3) break;

      const steps = chunk.map((g) => {
        const r = resourceFor(g.skill_id, type);
        const strength = strengths[stepOrdinal % Math.max(1, strengths.length)];
        const why = strength
          ? RATIONALE[type][stepOrdinal % RATIONALE[type].length](g.display_name, strength)
          : RATIONALE_NO_STRENGTH[type][stepOrdinal % RATIONALE_NO_STRENGTH[type].length](
              g.display_name,
            );
        stepOrdinal++;
        return {
          resource: r.resource,
          why,
          hours: Math.round(r.hours * paceMultiplier),
        };
      });

      const phaseHours = steps.reduce((s, st) => s + st.hours, 0);
      const progress = (phaseIndex / Math.min(3, Math.ceil(gaps.length / perPhase))) || 1;

      phases.push({
        phase: phaseIndex,
        title: `Phase ${phaseIndex}: ${chunk.map((c) => c.display_name).join(" and ")}`,
        duration_weeks: Math.max(1, Math.round(phaseHours / Math.max(1, weeklyHours))),
        target_gaps: chunk.map((c) => c.display_name),
        steps,
        portfolio_artifact: ARTIFACTS[type][Math.min(phaseIndex - 1, ARTIFACTS[type].length - 1)],
        readiness_after: Math.min(
          95,
          Math.round(currentReadiness + (target.readiness ? (100 - currentReadiness) * 0.55 * progress : 0)),
        ),
      });
    }

    const totalHours = phases.reduce(
      (sum, ph) => sum + ph.steps.reduce((s, st) => s + st.hours, 0),
      0,
    );

    return {
      type,
      headline: HEADLINES[type](type === "lateral" ? roleTitle : roleTitle),
      target_role: roleTitle,
      trade_off: TRADE_OFFS[type],
      phases,
      total_hours: totalHours,
      estimated_months: Math.round((totalHours / Math.max(1, weeklyHours) / 4.33) * 10) / 10,
    } satisfies Pathway;
  });

  const enforced = enforceDifferentiation(pathways.filter((p) => p.phases.length > 0));
  return enforced;
}
