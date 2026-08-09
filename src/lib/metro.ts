import type { MatchResult, Pathway, PathwayResult } from "./types";

/**
 * Turns pathway data into transit-diagram geometry (UI spec §8).
 *
 * The lane layout is fixed by the wireframe — all three routes originate at
 * (70,196) and only 45-degree and 90-degree segments are allowed. What varies
 * with the data is how many stations each line carries, where its terminus
 * lands, and whether it grows a dashed onward extension.
 *
 * The lead/spacing/tail numbers reproduce the reference wireframe exactly for
 * the common two-station case and generalise from there.
 */

export const ORIGIN = { x: 70, y: 196 };
export const VIEWBOX = { w: 760, h: 340 };

/** Intermediate stations shown on the map. Anything beyond this lives in the list below. */
const MAX_STATIONS = 3;

interface Lane {
  y: number;
  colour: string;
  /** x at which the horizontal run begins (after any bend). */
  runStart: number;
  /** Distance from runStart to the first station. */
  lead: number;
  spacing: number;
  /** Distance from the last station to the terminus. */
  tail: number;
  bend: string;
}

const LANES: Record<Pathway["type"], Lane> = {
  sprint: { y: 88, colour: "#FF3D71", runStart: 130, lead: 66, spacing: 122, tail: 177, bend: "L130,88" },
  deep: { y: 196, colour: "#6034FF", runStart: 70, lead: 140, spacing: 140, tail: 195, bend: "" },
  lateral: { y: 292, colour: "#00C2A8", runStart: 140, lead: 74, spacing: 116, tail: 130, bend: "L140,292" },
};

/** Route order is fixed so the tabs never reshuffle between runs. */
export const LANE_ORDER: Pathway["type"][] = ["sprint", "deep", "lateral"];

export interface MetroStation {
  x: number;
  y: number;
  label: string;
}

export interface MetroOnward {
  x: number;
  y: number;
  label: string;
  sub: string;
}

export interface MetroStationRow {
  weeks: string;
  title: string;
  detail: string;
  hours: number;
}

export interface MetroLine {
  id: Pathway["type"];
  name: string;
  colour: string;
  duration: string;
  path: string;
  y: number;
  stations: MetroStation[];
  terminus: { x: number; y: number; label: string };
  onward: MetroOnward | null;
  /** The single next action for this route. */
  next: string;
  rows: MetroStationRow[];
}

/** "Phase 2: SQL and Machine Learning" -> "SQL and Machine Learning" */
function phaseLabel(title: string): string {
  return title.replace(/^phase\s*\d+\s*[:.\-–]\s*/i, "").trim() || title;
}

/**
 * Station labels sit on a diagram, not in a list. A long phase title overruns
 * its neighbours and the terminus, so map labels get clipped to something that
 * fits the lane spacing. The full title still appears in the station list below.
 */
function shortLabel(label: string, max = 22): string {
  const cleaned = label.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;

  // Prefer cutting at a natural joiner so the label stays a readable phrase.
  const joiner = cleaned.search(/\s+(and|&|\+|,)\s+/i);
  if (joiner > 0 && joiner <= max) return cleaned.slice(0, joiner).trim();

  const space = cleaned.lastIndexOf(" ", max);
  return `${cleaned.slice(0, space > 8 ? space : max).trim()}…`;
}

function titleCaseMonths(months: number): string {
  if (months < 1) return "under a month";
  const rounded = Math.round(months);
  return `${rounded} ${rounded === 1 ? "month" : "months"}`;
}

export function buildMetro(
  pathways: PathwayResult | null,
  match: MatchResult,
): MetroLine[] {
  if (!pathways || pathways.pathways.length === 0) return [];

  const ordered = [...pathways.pathways].sort(
    (a, b) => LANE_ORDER.indexOf(a.type) - LANE_ORDER.indexOf(b.type),
  );

  // The onward station is the role the user named that sits out of reach. It
  // hangs off the longest line, so the bridge recommendation becomes geometry:
  // you can see the route exists and that it runs through somewhere you're close to.
  const statedTarget = match.stated_target;
  const showOnward =
    statedTarget !== null &&
    statedTarget.role.role_id !== match.nearest_reachable?.role.role_id;
  const onwardLine =
    ordered.find((p) => p.type === "deep")?.type ??
    ordered[ordered.length - 1]?.type ??
    null;

  return ordered.map((p) => {
    const lane = LANES[p.type];

    // Every phase but the last is an intermediate station; the last one arrives
    // at the terminus, which is the role itself.
    const intermediate = p.phases.slice(0, -1).slice(0, MAX_STATIONS);

    const stations: MetroStation[] = intermediate.map((phase, i) => ({
      x: lane.runStart + lane.lead + i * lane.spacing,
      y: lane.y,
      label: shortLabel(phaseLabel(phase.title)),
    }));

    const lastX =
      stations.length > 0
        ? stations[stations.length - 1].x
        : lane.runStart + lane.lead;
    const termX = Math.min(VIEWBOX.w - 190, lastX + lane.tail);

    let cumulativeWeeks = 0;
    const rows: MetroStationRow[] = p.phases.map((phase) => {
      const from = cumulativeWeeks + 1;
      cumulativeWeeks += phase.duration_weeks;
      return {
        weeks: `Weeks ${from}–${cumulativeWeeks}`,
        title: phaseLabel(phase.title),
        detail: phase.steps[0]?.why ?? phase.portfolio_artifact,
        hours: phase.steps.reduce((sum, s) => sum + s.hours, 0),
      };
    });

    const onward: MetroOnward | null =
      showOnward && p.type === onwardLine && statedTarget
        ? {
            x: Math.min(VIEWBOX.w - 60, termX + 145),
            y: lane.y,
            label: statedTarget.role.title,
            sub: "THE ROLE YOU NAMED",
          }
        : null;

    return {
      id: p.type,
      name: p.type.charAt(0).toUpperCase() + p.type.slice(1),
      colour: lane.colour,
      duration: titleCaseMonths(p.estimated_months),
      path: `M${ORIGIN.x},${ORIGIN.y} ${lane.bend} L${termX},${lane.y}`.replace(/\s+/g, " "),
      y: lane.y,
      stations,
      terminus: { x: termX, y: lane.y, label: shortLabel(p.target_role, 26) },
      onward,
      next: p.phases[0]?.steps[0]?.resource ?? "Start with the first phase below",
      rows,
    };
  });
}
