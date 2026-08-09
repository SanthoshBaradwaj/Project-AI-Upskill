import { ROLES, TOTAL_POSTINGS, hoursPerLevel, skillName } from "./data";
import type {
  ConstraintStrip,
  MatchResult,
  Preferences,
  Role,
  ScoredRole,
  SkillGap,
  VerifiedSkill,
} from "./types";

/**
 * The Matching Engine (PRD §7.1 Phase C).
 *
 * Deliberately deterministic — a filter and some weighted arithmetic, with no
 * model in the loop. Call it an engine, never an agent. It has to be explainable
 * on stage in one sentence: "We score the distance between what you can prove
 * and what the postings require, then filter to the jobs you can actually hold."
 */

export const TIME_TO_READY_CEILING_HOURS = 500;
const TRANSFERABLE_BONUS_PER_SIGNAL = 3;
const TRANSFERABLE_BONUS_CAP = 10;

function needsSponsorship(prefs: Preferences | null): boolean {
  return prefs?.sponsorship === "need_sponsorship" || prefs?.sponsorship === "student_or_opt";
}

/**
 * STEP 1 — FILTER. Applies the user's constraints to a role's posting
 * distribution and reports the counts that render in the constraint strip.
 *
 * `unstated` sponsorship is treated as open (the posting did not rule the user
 * out) but is excluded from `confirmed_open`. Under-promising is the safer error
 * here — and the UI must present all of this as observed posting language, never
 * as a statement about eligibility.
 */
export function applyConstraints(role: Role, prefs: Preferences | null): ConstraintStrip {
  const total = role.posting_count;
  const dist = role.location_distribution;
  const remoteCount = dist.remote_us ?? 0;

  let locationEligible: number;
  let filtersApplied = false;

  if (prefs?.remote_only) {
    locationEligible = remoteCount;
    filtersApplied = true;
  } else if (prefs && prefs.locations.length > 0) {
    const metroSum = prefs.locations.reduce((sum, id) => sum + (dist[id] ?? 0), 0);
    locationEligible = metroSum + remoteCount;
    filtersApplied = true;
  } else {
    locationEligible = total;
  }

  const share = total === 0 ? 0 : locationEligible / total;
  const explicitlyNoInScope = Math.round(role.sponsorship_signal.explicitly_no * share);
  const confirmedYesInScope = Math.round(role.sponsorship_signal.explicitly_yes * share);

  let openToYou: number;
  let confirmedOpen: number;

  if (needsSponsorship(prefs)) {
    filtersApplied = true;
    openToYou = Math.max(0, locationEligible - explicitlyNoInScope);
    confirmedOpen = confirmedYesInScope;
  } else {
    openToYou = locationEligible;
    confirmedOpen = locationEligible;
  }

  return {
    total_postings: total,
    location_eligible: locationEligible,
    explicitly_no_sponsorship: explicitlyNoInScope,
    open_to_you: openToYou,
    confirmed_open: confirmedOpen,
    filters_applied: filtersApplied,
  };
}

/** STEP 2 — SCORE. Weighted gap arithmetic over verified levels only. */
export function scoreRole(
  role: Role,
  verified: VerifiedSkill[],
  prefs: Preferences | null,
  paceMultiplier: number,
): ScoredRole {
  const levelOf = new Map(verified.map((v) => [v.skill_id, v.verified_level]));

  let weightedGap = 0;
  let weightedRequired = 0;
  const gaps: SkillGap[] = [];
  const strengths: ScoredRole["strengths"] = [];

  for (const req of role.required_skills) {
    const current = levelOf.get(req.skill) ?? 0;
    const gap = Math.max(0, req.level - current);

    weightedGap += req.weight * gap;
    weightedRequired += req.weight * req.level;

    if (gap > 0) {
      gaps.push({
        skill_id: req.skill,
        display_name: skillName(req.skill),
        current,
        required: req.level,
        gap,
        weight: req.weight,
        hours: Math.round(gap * hoursPerLevel(req.skill) * paceMultiplier),
      });
    } else {
      strengths.push({
        skill_id: req.skill,
        display_name: skillName(req.skill),
        level: current,
      });
    }
  }

  const baseReadiness =
    weightedRequired === 0 ? 0 : 100 * (1 - weightedGap / weightedRequired);

  const matchedSignals = role.transferable_signals.filter(
    (sig) => (levelOf.get(sig) ?? 0) >= 2,
  );
  const transferableBonus = Math.min(
    TRANSFERABLE_BONUS_CAP,
    matchedSignals.length * TRANSFERABLE_BONUS_PER_SIGNAL,
  );

  const readiness = Math.max(0, Math.min(100, Math.round(baseReadiness + transferableBonus)));
  const timeToReady = gaps.reduce((sum, g) => sum + g.hours, 0);

  gaps.sort((a, b) => b.weight * b.gap - a.weight * a.gap);
  strengths.sort((a, b) => b.level - a.level);

  const constraint = applyConstraints(role, prefs);

  return {
    role,
    readiness,
    base_readiness: Math.max(0, Math.round(baseReadiness)),
    transferable_bonus: transferableBonus,
    matched_signals: matchedSignals,
    time_to_ready_hours: timeToReady,
    gaps,
    strengths,
    availability: constraint.open_to_you,
    constraint,
    demoted: constraint.open_to_you === 0,
  };
}

/**
 * Resolve a user's free-text role preference to a corpus role.
 * Exact id match, then title match, then a loose token overlap so
 * "ML Research Scientist" still lands somewhere sensible.
 */
export function resolvePreferredRole(input: string): Role | null {
  const needle = input.trim().toLowerCase();
  if (!needle) return null;

  const byId = ROLES.find((r) => r.role_id === needle);
  if (byId) return byId;

  const byTitle = ROLES.find((r) => r.title.toLowerCase() === needle);
  if (byTitle) return byTitle;

  const tokens = needle.split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  if (tokens.length === 0) return null;

  let best: { role: Role; score: number } | null = null;
  for (const r of ROLES) {
    const haystack = `${r.title} ${r.role_id}`.toLowerCase();
    const score = tokens.filter((t) => haystack.includes(t)).length / tokens.length;
    if (score > 0 && (best === null || score > best.score)) best = { role: r, score };
  }
  return best && best.score >= 0.5 ? best.role : null;
}

/**
 * STEP 3 — SELECT. Produces the two honest tracks.
 *
 * Nearest Reachable is computed from evidence alone and is shown first, which
 * is what keeps preference capture from reading as flattery. The Stated Target
 * is scored honestly and deliberately left unfiltered — we do not hide a role
 * the user asked about, we show the real distance to it.
 */
export function match(
  verified: VerifiedSkill[],
  prefs: Preferences | null,
  paceMultiplier: number,
): MatchResult {
  const scored = ROLES.map((r) => scoreRole(r, verified, prefs, paceMultiplier));

  // Demoted roles sort last regardless of readiness — never hidden, just ranked
  // below anything the user can actually hold.
  const ranked = [...scored].sort((a, b) => {
    if (a.demoted !== b.demoted) return a.demoted ? 1 : -1;
    return b.readiness - a.readiness;
  });

  const statedRoleIds = new Set(
    (prefs?.preferred_roles ?? [])
      .map(resolvePreferredRole)
      .filter((r): r is Role => r !== null)
      .map((r) => r.role_id),
  );

  const reachable = ranked.filter(
    (s) => !s.demoted && s.time_to_ready_hours <= TIME_TO_READY_CEILING_HOURS,
  );

  // Fall back through the constraints rather than returning nothing: a heavily
  // constrained user still gets a hero card, just a more honest one.
  const nearest =
    reachable[0] ?? ranked.find((s) => !s.demoted) ?? ranked[0] ?? null;

  const runnersUp = ranked
    .filter((s) => s.role.role_id !== nearest?.role.role_id)
    .slice(0, 2);

  let statedTarget: ScoredRole | null = null;
  if (statedRoleIds.size > 0) {
    const candidates = scored.filter((s) => statedRoleIds.has(s.role.role_id));
    // If the user named several, show the one they are furthest from — that is
    // the aspiration the two-track view exists to be honest about.
    candidates.sort((a, b) => a.readiness - b.readiness);
    statedTarget = candidates[0] ?? null;
  }

  let bridge: MatchResult["bridge"] = null;
  if (
    statedTarget &&
    nearest &&
    statedTarget.role.role_id !== nearest.role.role_id &&
    nearest.readiness - statedTarget.readiness >= 15
  ) {
    const targetSkills = new Set(statedTarget.role.required_skills.map((r) => r.skill));
    const bridgeCandidates = ranked.filter(
      (s) =>
        !s.demoted &&
        s.role.role_id !== statedTarget!.role.role_id &&
        s.readiness > statedTarget!.readiness + 10 &&
        s.role.required_skills.filter((r) => targetSkills.has(r.skill)).length >= 3,
    );
    const chosen = bridgeCandidates[0] ?? nearest;
    bridge = {
      role_id: chosen.role.role_id,
      title: chosen.role.title,
      readiness: chosen.readiness,
      months: hoursToMonths(chosen.time_to_ready_hours, prefs?.weekly_hours ?? 8),
    };
  }

  return {
    nearest_reachable: nearest,
    runners_up: runnersUp,
    stated_target: statedTarget,
    bridge,
    all_ranked: ranked,
    pace_multiplier: paceMultiplier,
    corpus_size: TOTAL_POSTINGS,
  };
}

export function hoursToMonths(hours: number, weeklyHours: number): number {
  const perWeek = Math.max(1, weeklyHours);
  return Math.round((hours / perWeek / 4.33) * 10) / 10;
}

export function hoursToWeeks(hours: number, weeklyHours: number): number {
  return Math.max(1, Math.round(hours / Math.max(1, weeklyHours)));
}
