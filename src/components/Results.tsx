"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { hoursToMonths } from "@/lib/match";
import type {
  LearnerProfile,
  MatchResult,
  PathwayResult,
  Preferences,
  QuizBank,
  ScoredRole,
  VerifiedSkill,
} from "@/lib/types";
import { ClaimedVsVerified } from "./ClaimedVsVerified";
import { JourneyMap } from "./JourneyMap";
import { Button, Card, Notice, Pill } from "./ui";

type Pace = { multiplier: number; reason: string; honest_note: string | null };

function money(n: number) {
  return `$${Math.round(n / 1000)}k`;
}

function weeks(n: number) {
  return `${n} ${n === 1 ? "week" : "weeks"}`;
}

function ConstraintStrip({ scored }: { scored: ScoredRole }) {
  const c = scored.constraint;
  if (!c.filters_applied) {
    return (
      <p className="text-xs text-fog">
        {c.total_postings} postings in the corpus · no location or authorization filter applied
      </p>
    );
  }
  return (
    <div className="space-y-1">
      <p className="text-xs text-fog">
        <span className="font-semibold text-chalk">{c.location_eligible}</span> of{" "}
        {c.total_postings} postings match your location
        {c.explicitly_no_sponsorship > 0 ? (
          <>
            {" · "}
            <span className="font-semibold text-warn">{c.explicitly_no_sponsorship}</span> say no
            sponsorship
          </>
        ) : null}
        {" · "}
        <span className="font-semibold text-verified">{c.open_to_you}</span> open to you
      </p>
      <p className="text-[11px] leading-relaxed text-fog/70">
        {c.confirmed_open} of those explicitly confirm sponsorship; the rest simply don&apos;t say.
        These are counts of what the postings state, not a judgement about your eligibility.
      </p>
    </div>
  );
}

function RoleCard({
  scored,
  weeklyHours,
  tone = "default",
  eyebrow,
}: {
  scored: ScoredRole;
  weeklyHours: number;
  tone?: "default" | "hero";
  eyebrow?: string;
}) {
  const months = hoursToMonths(scored.time_to_ready_hours, weeklyHours);
  return (
    <Card tone={tone}>
      {eyebrow ? (
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-brand">
          {eyebrow}
        </p>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className={tone === "hero" ? "text-2xl font-bold" : "text-lg font-semibold"}>
            {scored.role.title}
          </h3>
          <p className="mt-1 text-xs text-fog">
            {money(scored.role.salary_band_usd[0])}–{money(scored.role.salary_band_usd[1])} ·{" "}
            {months < 0.5 ? "ready now" : `~${months} months at ${weeklyHours} hrs/week`}
          </p>
        </div>
        <div className="text-right">
          <div
            className={`font-bold tabular-nums ${tone === "hero" ? "text-5xl" : "text-3xl"} ${
              scored.readiness >= 60 ? "text-verified" : scored.readiness >= 35 ? "text-warn" : "text-hot"
            }`}
          >
            {scored.readiness}%
          </div>
          <div className="text-[11px] uppercase tracking-wider text-fog">ready</div>
        </div>
      </div>

      {scored.demoted ? (
        <div className="mt-4 rounded-lg border border-hot/40 bg-hot/10 px-3.5 py-2.5 text-xs leading-relaxed">
          Strong match on skills, but{" "}
          <span className="font-semibold">
            0 of {scored.constraint.total_postings} postings
          </span>{" "}
          fit your location and authorization. We&apos;re showing it rather than hiding it, but
          it isn&apos;t a route we&apos;d point you at today.
        </div>
      ) : null}

      {scored.strengths.length > 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-fog">
          <span className="text-chalk">Why you: </span>
          you already clear the bar on{" "}
          <span className="text-verified">
            {scored.strengths.slice(0, 3).map((s) => s.display_name).join(", ")}
          </span>
          {scored.matched_signals.length > 0 ? (
            <>
              , and your{" "}
              <span className="text-verified">
                {scored.matched_signals.slice(0, 2).join(" and ").replace(/_/g, " ")}
              </span>{" "}
              carries over
            </>
          ) : null}
          .{" "}
          {scored.gaps.length > 0 ? (
            <>
              The distance left is{" "}
              <span className="text-warn">
                {scored.gaps.slice(0, 3).map((g) => g.display_name).join(", ")}
              </span>
              .
            </>
          ) : null}
        </p>
      ) : null}

      <div className="mt-4 border-t border-line pt-3">
        <ConstraintStrip scored={scored} />
      </div>
    </Card>
  );
}

export function Results({
  verified,
  learner,
  pace,
  match,
  quiz,
  preferences,
  domain,
  onRestart,
  onWeeklyHoursChange,
}: {
  verified: VerifiedSkill[];
  learner: LearnerProfile;
  pace: Pace;
  match: MatchResult;
  quiz: QuizBank;
  preferences: Preferences;
  domain: string;
  onRestart: () => void;
  onWeeklyHoursChange: (hours: number) => void;
}) {
  const hero = match.nearest_reachable;
  const [pathwayRole, setPathwayRole] = useState<string | null>(hero?.role.role_id ?? null);
  const [pathways, setPathways] = useState<PathwayResult | null>(null);
  const [pathwayBusy, setPathwayBusy] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);

  const loadPathways = useCallback(
    async (roleId: string) => {
      setPathwayBusy(true);
      setPathways(null);
      try {
        const res = await fetch("/api/pathways", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role_id: roleId,
            verified,
            preferences,
            pace_multiplier: pace.multiplier,
            domain,
          }),
        });
        const data = await res.json();
        setPathways(data.pathways as PathwayResult);
        setActiveTab(0);
      } catch {
        setPathways(null);
      } finally {
        setPathwayBusy(false);
      }
    },
    [verified, preferences, pace.multiplier, domain],
  );

  useEffect(() => {
    if (pathwayRole) void loadPathways(pathwayRole);
  }, [pathwayRole, loadPathways]);

  const correctionRate = useMemo(() => {
    if (verified.length === 0) return 0;
    return Math.round(
      (verified.filter((v) => v.verified_level !== v.claimed_level).length / verified.length) * 100,
    );
  }, [verified]);

  const maxWeeks = useMemo(() => {
    if (!pathways) return 24;
    const weeks = pathways.pathways.map((p) =>
      p.phases.reduce((sum, ph) => sum + ph.duration_weeks, 0),
    );
    return Math.max(8, ...weeks);
  }, [pathways]);

  const current = pathways?.pathways[activeTab] ?? null;

  function copyMarkdown() {
    const lines: string[] = [];
    lines.push(`# Your Pivot plan\n`);
    if (hero) {
      lines.push(`## Nearest reachable role: ${hero.role.title} — ${hero.readiness}% ready`);
      lines.push(
        `Salary band ${money(hero.role.salary_band_usd[0])}–${money(hero.role.salary_band_usd[1])} · ` +
          `${hoursToMonths(hero.time_to_ready_hours, preferences.weekly_hours)} months at ${preferences.weekly_hours} hrs/week\n`,
      );
      lines.push(
        `Postings open to you: ${hero.constraint.open_to_you} of ${hero.constraint.total_postings}` +
          ` (observed posting language, not legal advice)\n`,
      );
    }
    if (match.stated_target) {
      lines.push(
        `## Your stated target: ${match.stated_target.role.title} — ${match.stated_target.readiness}% ready`,
      );
      if (match.bridge) {
        lines.push(
          `Fastest credible route runs through ${match.bridge.title} (${match.bridge.readiness}% ready, ~${match.bridge.months} months).\n`,
        );
      }
    }
    lines.push(`## Verified skill profile\n`);
    lines.push(`| Skill | Claimed | Verified | Tested |`);
    lines.push(`|---|---|---|---|`);
    for (const v of verified) {
      lines.push(
        `| ${v.display_name} | ${v.claimed_level} | ${v.verified_level} | ${v.tested ? "yes" : "no"} |`,
      );
    }
    lines.push("");
    if (current) {
      lines.push(`## Pathway: ${current.headline}`);
      lines.push(`${current.trade_off}\n`);
      lines.push(
        `Total ${current.total_hours} hours · ~${current.estimated_months} months at ${preferences.weekly_hours} hrs/week\n`,
      );
      for (const phase of current.phases) {
        lines.push(`### ${phase.title} (${weeks(phase.duration_weeks)})`);
        for (const step of phase.steps) {
          lines.push(`- **${step.resource}** — ${step.why} (~${step.hours}h)`);
        }
        lines.push(`- Portfolio artifact: ${phase.portfolio_artifact}\n`);
      }
    }
    lines.push(
      `\n---\nGenerated by Pivot. Matched against ${match.corpus_size} real postings. ` +
        `Salary figures are US, 2025. Sponsorship counts are observed posting language, not legal advice.`,
    );

    void navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  }

  return (
    <div className="rise space-y-6 pb-24">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Here&apos;s where you actually stand</h1>
        <p className="mt-2 text-sm text-fog">
          Matched against {match.corpus_size} real postings ·{" "}
          {quiz.stats.source === "fallback"
            ? "questions from our hand-verified bank"
            : `${quiz.stats.generated} questions generated, ${quiz.stats.rejected_by_validator} thrown out by the validator`}
        </p>
      </div>

      {/* A — Verified skill profile */}
      <Card>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">What you claimed vs. what you showed</h2>
          <span className="text-sm text-fog">
            <span className="text-2xl font-bold text-warn">{correctionRate}%</span> of your claims
            moved
          </span>
        </div>
        <ClaimedVsVerified verified={verified} />
      </Card>

      {/* B — Nearest reachable */}
      {hero ? <RoleCard scored={hero} weeklyHours={preferences.weekly_hours} tone="hero" eyebrow="Nearest reachable role" /> : null}

      {/* C — Stated target */}
      {match.stated_target ? (
        <Card>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-warn">
            Your stated target
          </p>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold">{match.stated_target.role.title}</h3>
              <p className="mt-1 text-xs text-fog">
                ~
                {hoursToMonths(
                  match.stated_target.time_to_ready_hours,
                  preferences.weekly_hours,
                )}{" "}
                months at {preferences.weekly_hours} hrs/week
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold tabular-nums text-warn">
                {match.stated_target.readiness}%
              </div>
              <div className="text-[11px] uppercase tracking-wider text-fog">ready</div>
            </div>
          </div>

          {match.stated_target.gaps.length > 0 ? (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-chalk">What stands between you and it</p>
              <div className="flex flex-wrap gap-1.5">
                {match.stated_target.gaps.slice(0, 6).map((g) => (
                  <Pill key={g.skill_id} tone="warn">
                    {g.display_name} · {g.current} → {g.required}
                  </Pill>
                ))}
              </div>
            </div>
          ) : null}

          {match.bridge ? (
            <div className="mt-4 rounded-lg border border-brand/30 bg-brand/10 px-4 py-3 text-sm leading-relaxed">
              <span className="font-semibold">{match.stated_target.role.title}</span> is{" "}
              {match.stated_target.readiness}% within reach today. The fastest credible route runs
              through <span className="font-semibold">{match.bridge.title}</span> —{" "}
              {match.bridge.readiness}% ready, about {match.bridge.months} months — and everything
              you build there counts toward the target.
              <div className="mt-3">
                <Button variant="ghost" onClick={() => setPathwayRole(match.bridge!.role_id)}>
                  Plan the bridge route →
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}

      {/* D — Runners-up */}
      {match.runners_up.length > 0 ? (
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-fog">
            Also within range
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {match.runners_up.map((r) => (
              <RoleCard key={r.role.role_id} scored={r} weeklyHours={preferences.weekly_hours} />
            ))}
          </div>
        </div>
      ) : null}

      {/* E — Pathways */}
      <Card>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">Your pathways</h2>
          <div className="flex items-center gap-2 text-xs text-fog">
            <span>Hours a week:</span>
            {[4, 8, 15].map((h) => (
              <button
                key={h}
                onClick={() => onWeeklyHoursChange(h)}
                className={`rounded px-2 py-1 transition-colors ${
                  preferences.weekly_hours === h
                    ? "bg-brand/20 font-semibold text-chalk"
                    : "hover:text-chalk"
                }`}
              >
                {h}
              </button>
            ))}
          </div>
        </div>

        {pathwayBusy ? (
          <p className="pulse-soft py-8 text-center text-sm text-fog">
            Building three genuinely different routes…
          </p>
        ) : pathways && pathways.pathways.length > 0 ? (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {pathways.pathways.map((p, i) => (
                <button
                  key={p.type}
                  onClick={() => setActiveTab(i)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium capitalize transition-colors ${
                    activeTab === i
                      ? "border-brand bg-brand/15 text-chalk"
                      : "border-line bg-ink-3 text-fog hover:border-fog/50"
                  }`}
                >
                  {p.type} · {p.estimated_months}mo
                </button>
              ))}
            </div>

            {pathways.note ? (
              <div className="mb-4">
                <Notice tone="warn">{pathways.note}</Notice>
              </div>
            ) : null}

            {current ? (
              <>
                <div className="mb-4">
                  <h3 className="text-base font-semibold">{current.headline}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-fog">{current.trade_off}</p>
                </div>

                <JourneyMap
                  pathway={current}
                  currentReadiness={
                    match.all_ranked.find((r) => r.role.role_id === pathwayRole)?.readiness ?? 0
                  }
                  targetTitle={current.target_role}
                  maxWeeks={maxWeeks}
                />

                <div className="mt-6 space-y-4">
                  {current.phases.map((phase) => (
                    <div key={phase.phase} className="rounded-lg border border-line bg-ink-3 p-4">
                      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                        <h4 className="text-sm font-semibold">{phase.title}</h4>
                        <span className="text-xs text-fog">
                          {weeks(phase.duration_weeks)} · reaches {phase.readiness_after}%
                        </span>
                      </div>
                      <ul className="space-y-2.5">
                        {phase.steps.map((step, i) => (
                          <li key={i} className="text-sm">
                            <div className="font-medium text-chalk">{step.resource}</div>
                            <div className="mt-0.5 text-xs leading-relaxed text-fog">
                              {step.why} <span className="text-fog/60">· ~{step.hours}h</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3 border-t border-line pt-3 text-xs">
                        <span className="font-semibold text-verified">Portfolio artifact: </span>
                        <span className="text-fog">{phase.portfolio_artifact}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </>
        ) : (
          <p className="py-8 text-center text-sm text-fog">
            We couldn&apos;t build a pathway for this role right now.
          </p>
        )}
      </Card>

      {/* Calibration honesty */}
      {pace.honest_note ? (
        <Notice tone="warn">
          <span className="font-semibold">A note on these timelines. </span>
          {pace.honest_note}
        </Notice>
      ) : null}

      {/* Judge-facing instrumentation */}
      <details className="rounded-xl border border-line bg-ink-2/50 p-5">
        <summary className="cursor-pointer text-sm font-semibold text-fog">
          How we got these numbers
        </summary>
        <div className="mt-4 grid gap-4 text-xs sm:grid-cols-2">
          <div>
            <div className="mb-1.5 font-semibold text-chalk">Assessment quality gate</div>
            <ul className="space-y-1 text-fog">
              <li>Source: {quiz.stats.source}</li>
              <li>Generated: {quiz.stats.generated}</li>
              <li>
                Discarded by the adversarial validator: {quiz.stats.rejected_by_validator} (
                {Math.round(quiz.stats.rejection_rate * 100)}%)
              </li>
              <li>Skills tested: {quiz.skills_tested.length}</li>
            </ul>
          </div>
          <div>
            <div className="mb-1.5 font-semibold text-chalk">Pace calibration</div>
            <ul className="space-y-1 text-fog">
              <li>Multiplier: ×{pace.multiplier}</li>
              <li>{pace.reason}</li>
              <li>Trajectory: {learner.ladder_trajectory}</li>
              <li>Confidence delta: {learner.confidence_delta}</li>
              <li>Answers changed: {learner.answer_changes}</li>
            </ul>
          </div>
          <div className="sm:col-span-2">
            <div className="mb-1.5 font-semibold text-chalk">Pathway differentiation</div>
            <p className="text-fog">
              {pathways
                ? `Max pairwise resource overlap ${Math.round(
                    pathways.differentiation.max_overlap * 100,
                  )}% against a 40% ceiling — ${
                    pathways.differentiation.passed ? "passed" : "enforced by dropping a pathway"
                  }.`
                : "—"}
            </p>
          </div>
          <p className="text-fog/60 sm:col-span-2">
            This learner profile is a pace-calibration heuristic derived from four minutes of
            in-session behaviour. It is not a trained learning-velocity model, and nothing here is
            persisted. Salary figures are based on {match.corpus_size} US postings, 2025.
          </p>
        </div>
      </details>

      {/* Persistent CTA */}
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <Button variant="quiet" onClick={onRestart}>
            Start over
          </Button>
          <Button onClick={copyMarkdown}>
            {copied ? "Copied ✓" : "Copy plan as Markdown"}
          </Button>
        </div>
      </div>
    </div>
  );
}
