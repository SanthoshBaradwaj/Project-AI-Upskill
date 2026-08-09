"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { skillName } from "@/lib/data";
import { buildMetro } from "@/lib/metro";
import type {
  LearnerProfile,
  MatchResult,
  PathwayResult,
  Preferences,
  QuizBank,
  VerifiedSkill,
} from "@/lib/types";
import { NetworkMap } from "./NetworkMap";
import { Icon } from "./Sprite";

type Pace = { multiplier: number; reason: string; honest_note: string | null };

function money(n: number) {
  return `$${Math.round(n / 1000)}k`;
}

/**
 * A skill's proven position against what the role requires.
 * Segments fill upward toward the requirement — never downward from a claim.
 * A dashed segment is the next thing to earn, never a loss.
 */
function Segments({ v, r }: { v: number; r: number }) {
  return (
    <div className="segs" aria-hidden="true">
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className={`seg ${i <= v ? "on" : i <= r ? "need" : ""}`} />
      ))}
    </div>
  );
}

export function Results({
  verified,
  learner,
  pace,
  match,
  quiz,
  answers,
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
  answers: { correct: boolean }[];
  preferences: Preferences;
  domain: string;
  onRestart: () => void;
  onWeeklyHoursChange: (h: number) => void;
}) {
  const hero = match.nearest_reachable;
  const [pathways, setPathways] = useState<PathwayResult | null>(null);
  const [busy, setBusy] = useState(true);
  const [tab, setTab] = useState(0);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!hero) return;
    setBusy(true);
    try {
      const res = await fetch("/api/pathways", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role_id: hero.role.role_id,
          verified,
          preferences,
          pace_multiplier: pace.multiplier,
          domain,
        }),
      });
      const data = await res.json();
      setPathways(data.pathways as PathwayResult);
    } catch {
      setPathways(null);
    } finally {
      setBusy(false);
    }
  }, [hero, verified, preferences, pace.multiplier, domain]);

  useEffect(() => {
    void load();
  }, [load]);

  const lines = useMemo(() => buildMetro(pathways, match), [pathways, match]);

  // Default to Deep so the onward station is visible on first paint.
  useEffect(() => {
    if (lines.length === 0) return;
    const deep = lines.findIndex((l) => l.id === "deep");
    setTab(deep >= 0 ? deep : 0);
  }, [lines.length]);

  /** Verified position against what this specific role asks for. Strongest first. */
  const proven = useMemo(() => {
    if (!hero) return [];
    const byId = new Map(verified.map((v) => [v.skill_id, v]));
    return hero.role.required_skills
      .map((req) => {
        const v = byId.get(req.skill);
        return {
          // A requirement the user never claimed still needs a human-readable
          // name — fall through to the canonical taxonomy, never the raw id.
          n: v?.display_name ?? skillName(req.skill),
          v: v?.verified_level ?? 0,
          r: req.level,
        };
      })
      .sort((a, b) => b.v - b.r - (a.v - a.r) || b.v - a.v);
  }, [hero, verified]);

  /**
   * One sentence carrying the claim-correction rate and the confidence_delta ->
   * pace_multiplier link, without putting a deficit chart on the projector.
   */
  const scoringNote = useMemo(() => {
    const tested = verified.filter((v) => v.tested).length;
    const moved = verified.filter((v) => v.verified_level !== v.claimed_level);
    const down = moved.filter((v) => v.verified_level < v.claimed_level).length;
    const up = moved.length - down;
    const stretch = Math.round((pace.multiplier - 1) * 100);

    const parts = [
      `${answers.length} adaptive questions verified ${tested} ${tested === 1 ? "skill" : "skills"}.`,
      `${moved.length} of your ${verified.length} résumé claims moved after testing` +
        (moved.length > 0
          ? ` — ${down} down${up > 0 ? `, ${up} up` : ""}.`
          : "."),
    ];

    if (stretch > 0) {
      parts.push(
        `You answered fastest on the ones you missed, so every estimate below is stretched ${stretch}%.`,
      );
    } else if (stretch < 0) {
      parts.push(
        `You were fast and accurate at the hardest tier, so every estimate below is tightened ${Math.abs(stretch)}%.`,
      );
    } else {
      parts.push("Your pace read as steady, so estimates below are unadjusted.");
    }
    return parts.join(" ");
  }, [verified, answers.length, pace.multiplier]);

  const active = lines[tab] ?? null;

  function copyPlan() {
    const out: string[] = ["# Your Pivot route", ""];
    if (hero) {
      out.push(`## Nearest station: ${hero.role.title} — ${hero.readiness}% there already`);
      out.push(
        `${money(hero.role.salary_band_usd[0])}–${money(hero.role.salary_band_usd[1])} · ${hero.constraint.open_to_you} jobs open to you`,
        "",
      );
    }
    out.push(`## What you've proven`, "");
    for (const p of proven) {
      out.push(`- ${p.n}: ${p.v >= p.r ? "Ready" : `${p.v} of ${p.r}`}`);
    }
    out.push("", scoringNote, "");
    if (active) {
      out.push(`## ${active.name} route — ${active.duration} to ${active.terminus.label}`, "");
      out.push(`Next stop: ${active.next}`, "");
      for (const row of active.rows) {
        out.push(`### ${row.weeks} — ${row.title} (${row.hours}h)`);
        out.push(row.detail, "");
      }
      if (active.onward) {
        out.push(`Onward: ${active.onward.label} — the role you named, two stops past here.`, "");
      }
    }
    if (hero) {
      out.push(
        "---",
        `${hero.constraint.total_postings} in range · ${hero.constraint.explicitly_no_sponsorship} no sponsorship · ${hero.constraint.open_to_you} open to you.`,
        "From posting language, not legal status.",
      );
    }
    void navigator.clipboard.writeText(out.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  }

  if (!hero) {
    return (
      <section className="card" style={{ marginTop: 30 }}>
        <h2>No route yet</h2>
        <p className="muted" style={{ marginTop: 12 }}>
          We couldn&apos;t score a role from this run. Start over and try a fuller résumé.
        </p>
      </section>
    );
  }

  return (
    <div style={{ marginTop: 30 }}>
      {/* ---------------- a) Header slab ---------------- */}
      <div className="slab">
        <div className="slab-l">
          <div className="eyebrow" style={{ color: "rgba(255,255,255,.72)" }}>
            <Icon name="node" />
            Your nearest station
          </div>
          <div className="slab-role">{hero.role.title}</div>
          <div className="mono" style={{ marginTop: 12, opacity: 0.8, letterSpacing: "0.06em" }}>
            {money(hero.role.salary_band_usd[0])}–{money(hero.role.salary_band_usd[1])} ·{" "}
            {hero.constraint.open_to_you} jobs open to you
          </div>
        </div>
        <div className="slab-r">
          <div className="slab-pct">{hero.readiness}%</div>
          <div className="mono" style={{ color: "var(--mute)" }}>
            There already
          </div>
        </div>
      </div>

      {/* ---------------- b) What you've proven ---------------- */}
      <section className="card" style={{ marginTop: 26 }}>
        <div className="eyebrow">
          <Icon name="check" />
          What you&apos;ve proven
        </div>

        <div className="proven">
          {proven.map((p) => (
            <div key={p.n}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 12,
                  marginBottom: 7,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 14 }}>{p.n}</span>
                {p.v >= p.r ? (
                  <span className="mono" style={{ color: "#B87400", fontWeight: 700 }}>
                    Ready
                  </span>
                ) : (
                  <span className="mono muted">
                    {p.v} of {p.r}
                  </span>
                )}
              </div>
              <Segments v={p.v} r={p.r} />
            </div>
          ))}
        </div>

        <details style={{ marginTop: 24, borderTop: "1px solid var(--hair)", paddingTop: 16 }}>
          <summary className="mono muted" style={{ cursor: "pointer" }}>
            How we scored this
          </summary>
          <p className="tiny muted" style={{ marginTop: 12, lineHeight: 1.65 }}>
            {scoringNote}
          </p>
          {pace.honest_note ? (
            <p className="tiny muted" style={{ marginTop: 10, lineHeight: 1.65 }}>
              {pace.honest_note}
            </p>
          ) : null}
          <p className="tiny muted" style={{ marginTop: 10, lineHeight: 1.65 }}>
            {quiz.stats.generated > 0
              ? `${quiz.stats.generated} questions written, ${quiz.stats.rejected_by_validator} discarded by the adversarial validator.`
              : "Questions served from our hand-verified bank."}{" "}
            Matched against {match.corpus_size} real postings. Nothing here is stored.
          </p>
        </details>
      </section>

      {/* ---------------- c) Three ways there ---------------- */}
      <section className="card" style={{ marginTop: 26 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div className="eyebrow" style={{ marginBottom: 0 }}>
            <Icon name="route" />
            Three ways there
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="mono muted">Hrs/week</span>
            {[4, 8, 15].map((h) => (
              <button
                key={h}
                className="linkish"
                onClick={() => onWeeklyHoursChange(h)}
                style={{
                  textDecoration: "none",
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  fontWeight: preferences.weekly_hours === h ? 800 : 400,
                  color: preferences.weekly_hours === h ? "var(--void)" : "var(--mute)",
                }}
              >
                {h}
              </button>
            ))}
          </div>
        </div>

        {busy ? (
          <div className="bggen" style={{ padding: "40px 0", justifyContent: "center" }}>
            <span className="pulse" />
            <span>Mapping your routes…</span>
          </div>
        ) : lines.length === 0 ? (
          <p className="muted" style={{ padding: "30px 0" }}>
            We couldn&apos;t map a route for this role right now.
          </p>
        ) : (
          <>
            <div role="tablist" style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "18px 0" }}>
              {lines.map((l, i) => (
                <button
                  key={l.id}
                  role="tab"
                  aria-selected={i === tab}
                  className="tab"
                  onClick={() => setTab(i)}
                >
                  <span className="dot" style={{ background: l.colour }} />
                  {l.name}
                  <span className="m">{l.duration}</span>
                </button>
              ))}
            </div>

            <NetworkMap lines={lines} selected={tab} readiness={hero.readiness} />

            {pathways?.note ? (
              <p
                className="tiny"
                style={{
                  borderLeft: "5px solid var(--rose)",
                  background: "var(--paper)",
                  padding: "12px 14px",
                  marginTop: 16,
                }}
              >
                {pathways.note}
              </p>
            ) : null}

            {active ? (
              <>
                {/* Exactly one next action per pathway. */}
                <div className="nextstop">
                  <div style={{ minWidth: 0 }}>
                    <div className="mono" style={{ opacity: 0.7 }}>
                      Next stop
                    </div>
                    <div
                      style={{
                        fontSize: 19,
                        fontWeight: 800,
                        letterSpacing: "-0.025em",
                        marginTop: 5,
                      }}
                    >
                      {active.next}
                    </div>
                  </div>
                  <button className="btn nextbtn">
                    Start
                    <Icon name="arrow" />
                  </button>
                </div>

                <ul style={{ marginTop: 22 }}>
                  {active.rows.map((row) => (
                    <li key={row.weeks} className="stn">
                      <span className="no">{row.weeks}</span>
                      <span style={{ minWidth: 0 }}>
                        <span className="ti">{row.title}</span>
                        <br />
                        <span className="de">{row.detail}</span>
                      </span>
                      <span className="hr">{row.hours}h</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        )}
      </section>

      {/* ---------------- d) Why only N jobs ---------------- */}
      <section className="card" style={{ marginTop: 26 }}>
        <div className="eyebrow">
          <Icon name="filter" />
          Why only {hero.constraint.open_to_you} jobs
        </div>

        <div className="funnel">
          <div>
            {/* Postings left after the location filter — the number the
                sponsorship cut is actually taken from, so the arithmetic on
                screen adds up. */}
            <div className="fnum">{hero.constraint.location_eligible}</div>
            <div className="fbar" style={{ height: 40, background: "var(--hair)" }} />
            <div className="mono muted" style={{ marginTop: 9 }}>
              In range
            </div>
          </div>
          <div>
            <div className="fnum muted">−{hero.constraint.explicitly_no_sponsorship}</div>
            <div
              className="fbar"
              style={{ height: 30, border: "2px dashed var(--rose)", background: "transparent" }}
            />
            <div className="mono muted" style={{ marginTop: 9 }}>
              No sponsorship
            </div>
          </div>
          <div>
            <div className="fnum">{hero.constraint.open_to_you}</div>
            <div className="fbar" style={{ height: 40, background: "var(--gold)" }} />
            <div className="mono muted" style={{ marginTop: 9 }}>
              Open to you
            </div>
          </div>
        </div>

        <p className="tiny muted" style={{ marginTop: 18 }}>
          {hero.constraint.location_eligible < hero.constraint.total_postings
            ? `${hero.constraint.location_eligible} of ${hero.constraint.total_postings} postings sit where you'd work. `
            : ""}
          From posting language, not legal status.
        </p>
      </section>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          marginTop: 30,
          flexWrap: "wrap",
        }}
      >
        <button className="btn go" onClick={copyPlan}>
          {copied ? "Copied" : "Copy my plan"}
          <Icon name={copied ? "check" : "arrow"} />
        </button>
        <button className="linkish" onClick={onRestart}>
          Start over
        </button>
      </div>

      <style jsx>{`
        .slab {
          display: grid;
          grid-template-columns: 1fr auto;
          border: 2px solid var(--void);
        }
        .slab-l {
          background: var(--volt);
          color: #fff;
          padding: 28px 26px;
          min-width: 0;
        }
        .slab-role {
          font-size: clamp(28px, 4.6vw, 44px);
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1;
        }
        .slab-r {
          background: var(--void);
          color: var(--paper);
          padding: 28px 30px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-end;
          text-align: right;
        }
        .slab-pct {
          font-family: var(--mono);
          font-size: 60px;
          font-weight: 800;
          color: var(--gold);
          line-height: 1;
          letter-spacing: -0.04em;
        }
        .proven {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px 30px;
          margin-top: 6px;
        }
        .nextstop {
          background: var(--gold);
          border: 2px solid var(--void);
          padding: 22px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          flex-wrap: wrap;
          margin-top: 22px;
        }
        .funnel {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          align-items: end;
          margin-top: 6px;
        }
        .fnum {
          font-family: var(--mono);
          font-size: 30px;
          font-weight: 800;
          letter-spacing: -0.03em;
          margin-bottom: 10px;
        }
        .fbar {
          border: 2px solid var(--void);
        }
        @media (max-width: 620px) {
          .slab {
            grid-template-columns: 1fr;
          }
          .slab-r {
            align-items: flex-start;
            text-align: left;
          }
        }
        @media (max-width: 640px) {
          .proven {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      <style jsx global>{`
        .nextbtn {
          background: var(--void);
          border-color: var(--void);
          box-shadow: none;
        }
        .nextbtn:hover {
          background: var(--void);
          border-color: var(--void);
          transform: none;
          box-shadow: none;
          opacity: 0.85;
        }
      `}</style>
    </div>
  );
}
