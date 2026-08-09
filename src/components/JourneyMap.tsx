"use client";

import type { Pathway } from "@/lib/types";

/**
 * Journey map (P0-12, spec §6.4). Static SVG, rendered against a shared week
 * axis so switching tabs visibly changes the timeline while "you are here"
 * stays put. That is the whole point of the visual: same starting reality,
 * three different futures.
 */

const W = 760;
const H = 300;
const PAD = { top: 30, right: 30, bottom: 46, left: 52 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const TONE: Record<Pathway["type"], string> = {
  sprint: "#fbbf24",
  deep: "#60a5fa",
  lateral: "#34d399",
};

export function JourneyMap({
  pathway,
  currentReadiness,
  targetTitle,
  targetBar = 80,
  maxWeeks,
}: {
  pathway: Pathway;
  currentReadiness: number;
  targetTitle: string;
  targetBar?: number;
  /** Shared across all tabs so the timelines are visually comparable. */
  maxWeeks: number;
}) {
  const colour = TONE[pathway.type];

  const x = (week: number) => PAD.left + (week / Math.max(1, maxWeeks)) * PLOT_W;
  const y = (readiness: number) => PAD.top + PLOT_H - (readiness / 100) * PLOT_H;

  // Cumulative week position for each phase boundary.
  let week = 0;
  const nodes = [{ week: 0, readiness: currentReadiness, label: "", artifact: "" }];
  for (const phase of pathway.phases) {
    week += phase.duration_weeks;
    nodes.push({
      week,
      readiness: phase.readiness_after,
      label: phase.title,
      artifact: phase.portfolio_artifact,
    });
  }

  const line = nodes.map((n) => `${x(n.week)},${y(n.readiness)}`).join(" ");
  const area = `${x(0)},${y(0)} ${line} ${x(week)},${y(0)}`;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full min-w-[560px]"
        role="img"
        aria-label={`${pathway.type} pathway: readiness climbs from ${currentReadiness}% to ${
          nodes[nodes.length - 1].readiness
        }% over ${week} weeks`}
      >
        {/* readiness gridlines */}
        {[0, 25, 50, 75, 100].map((r) => (
          <g key={r}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(r)}
              y2={y(r)}
              stroke="#26313f"
              strokeWidth={1}
            />
            <text x={PAD.left - 10} y={y(r) + 4} fill="#8b9bb0" fontSize={11} textAnchor="end">
              {r}%
            </text>
          </g>
        ))}

        {/* the posted bar for the role */}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(targetBar)}
          y2={y(targetBar)}
          stroke="#e8eef5"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          opacity={0.75}
        />
        <text
          x={W - PAD.right}
          y={y(targetBar) - 8}
          fill="#e8eef5"
          fontSize={11}
          fontWeight={600}
          textAnchor="end"
        >
          {targetTitle} — typical bar
        </text>

        {/* readiness curve */}
        <polygon points={area} fill={colour} opacity={0.1} />
        <polyline
          points={line}
          fill="none"
          stroke={colour}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* milestone nodes — one per portfolio artifact */}
        {nodes.slice(1).map((n, i) => (
          <g key={`${n.week}-${i}`}>
            <circle cx={x(n.week)} cy={y(n.readiness)} r={6} fill={colour} />
            <circle cx={x(n.week)} cy={y(n.readiness)} r={11} fill={colour} opacity={0.2} />
            <text
              x={x(n.week)}
              y={y(n.readiness) - 18}
              fill="#e8eef5"
              fontSize={11}
              fontWeight={600}
              textAnchor="middle"
            >
              Week {n.week}
            </text>
          </g>
        ))}

        {/* "you are here" — identical position on every tab */}
        <circle cx={x(0)} cy={y(currentReadiness)} r={7} fill="#e8eef5" />
        <circle
          cx={x(0)}
          cy={y(currentReadiness)}
          r={13}
          fill="none"
          stroke="#e8eef5"
          strokeWidth={1.5}
          opacity={0.5}
        />
        <text
          x={x(0) + 18}
          y={y(currentReadiness) + 4}
          fill="#e8eef5"
          fontSize={12}
          fontWeight={700}
        >
          You are here · {currentReadiness}%
        </text>

        {/* time axis */}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={H - PAD.bottom}
          y2={H - PAD.bottom}
          stroke="#26313f"
          strokeWidth={1.5}
        />
        {Array.from({ length: 5 }, (_, i) => Math.round((maxWeeks / 4) * i)).map((wk, i) => (
          <text
            key={`${wk}-${i}`}
            x={x(wk)}
            y={H - PAD.bottom + 18}
            fill="#8b9bb0"
            fontSize={11}
            textAnchor="middle"
          >
            {wk === 0 ? "today" : `wk ${wk}`}
          </text>
        ))}
      </svg>

      <ul className="mt-3 space-y-1.5">
        {nodes.slice(1).map((n, i) => (
          <li key={i} className="flex gap-2.5 text-xs leading-relaxed">
            <span className="shrink-0 font-semibold" style={{ color: colour }}>
              Wk {n.week}
            </span>
            <span className="text-fog">{n.artifact}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
