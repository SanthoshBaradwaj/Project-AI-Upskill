"use client";

import { ORIGIN, VIEWBOX, type MetroLine } from "@/lib/metro";

/**
 * The network map (UI spec §8). Replaces PRD Modules C, D and E with one
 * diagram: routes are pathways, terminals are roles, and the aspirational role
 * is an onward station on a dashed extension of the same line.
 *
 * Render order is strict, because SVG has no z-index.
 */
export function NetworkMap({
  lines,
  selected,
  readiness,
}: {
  lines: MetroLine[];
  selected: number;
  readiness: number;
}) {
  const active = lines[selected];
  if (!active) return null;

  return (
    <div style={{ background: "var(--void)", padding: 6, border: "2px solid var(--void)" }}>
      <svg
        className="metro"
        viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label={`${active.name} route: ${active.stations.length + 1} stops to ${
          active.terminus.label
        }, about ${active.duration}. You are at ${readiness}% readiness.`}
      >
        {/* 1. Route paths — unselected lines ghost back. */}
        {lines.map((l, i) => (
          <path
            key={`ln-${l.id}`}
            d={l.path}
            className={`ln ${i === selected ? "" : "ghost"}`}
            stroke={l.colour}
          />
        ))}

        {/* 2. Dashed onward extension. */}
        {lines.map((l, i) =>
          l.onward ? (
            <path
              key={`on-${l.id}`}
              d={`M${l.terminus.x},${l.terminus.y} L${l.onward.x},${l.onward.y}`}
              className={`ln dash ${i === selected ? "" : "ghost"}`}
              stroke={l.colour}
            />
          ) : null,
        )}

        {/* 3. Stations, terminals and labels. */}
        {lines.map((l, i) => {
          const on = i === selected;
          const o = on ? 1 : 0.22;
          return (
            <g key={`g-${l.id}`} opacity={o}>
              {l.stations.map((s) => (
                <g key={`${l.id}-${s.x}`}>
                  <circle cx={s.x} cy={s.y} r={8} className="st" stroke={l.colour} />
                  <text className="lbl" x={s.x} y={s.y - 20} textAnchor="middle">
                    {s.label}
                  </text>
                </g>
              ))}

              <circle
                cx={l.terminus.x}
                cy={l.terminus.y}
                r={12}
                className="st"
                stroke={l.colour}
                strokeWidth={5}
              />
              <circle cx={l.terminus.x} cy={l.terminus.y} r={4.5} fill={l.colour} />

              {/* A terminus label normally sits to the right of its node. When
                  the line continues to an onward station, that space belongs to
                  the dashed extension — so the label moves above instead. */}
              {l.onward ? (
                <>
                  <text
                    className="lbl"
                    x={l.terminus.x}
                    y={l.terminus.y - 24}
                    textAnchor="middle"
                  >
                    {l.terminus.label}
                  </text>
                  <text
                    className="sub"
                    x={l.terminus.x}
                    y={l.terminus.y + 30}
                    textAnchor="middle"
                  >
                    {l.duration.toUpperCase()}
                  </text>
                </>
              ) : (
                <>
                  <text className="lbl" x={l.terminus.x + 22} y={l.terminus.y - 2}>
                    {l.terminus.label}
                  </text>
                  <text className="sub" x={l.terminus.x + 22} y={l.terminus.y + 13}>
                    {l.duration.toUpperCase()}
                  </text>
                </>
              )}

              {l.onward ? (
                <g opacity={0.75}>
                  <circle
                    cx={l.onward.x}
                    cy={l.onward.y}
                    r={9}
                    className="st"
                    stroke={l.colour}
                    strokeDasharray="3 4"
                  />
                  <text className="lbl" x={l.onward.x} y={l.onward.y - 22} textAnchor="middle">
                    {l.onward.label}
                  </text>
                  <text className="sub" x={l.onward.x} y={l.onward.y + 28} textAnchor="middle">
                    {l.onward.sub}
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}

        {/* 4. Origin last, so it sits above every line. */}
        <circle cx={ORIGIN.x} cy={ORIGIN.y} r={15} fill="var(--gold)" />
        <circle cx={ORIGIN.x} cy={ORIGIN.y} r={6} fill="var(--void)" />
        <text
          className="lbl"
          x={ORIGIN.x}
          y={ORIGIN.y + 38}
          textAnchor="middle"
          fill="var(--gold)"
        >
          {`YOU · ${readiness}%`}
        </text>
      </svg>
    </div>
  );
}
