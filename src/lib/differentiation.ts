import type { Pathway, PathwayResult } from "./types";

/**
 * Pathway differentiation check (PRD §7.3 Prompt 3 + §10 risk register).
 *
 * The default failure mode of the planner prompt is three near-identical plans
 * with different labels, which would visibly collapse the journey map on stage.
 * The prompt states the rule; this function *enforces* it. If the check fails we
 * ship two genuinely different pathways rather than three cosmetic ones.
 */

export const MAX_ALLOWED_OVERLAP = 0.4;

function normaliseResource(resource: string): string {
  return resource
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(lessons?|parts?|chapters?|weeks?|modules?)\b\s*\d*(\s*-\s*\d+)?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function resourceSet(p: Pathway): Set<string> {
  const out = new Set<string>();
  for (const phase of p.phases) {
    for (const step of phase.steps) {
      const key = normaliseResource(step.resource);
      if (key) out.add(key);
    }
  }
  return out;
}

/**
 * Overlap as a share of the *smaller* resource set. Using the smaller set is the
 * strict reading: a short Sprint pathway whose every resource also appears in
 * Deep is 100% overlapping, even though Deep is much longer.
 */
export function pairOverlap(a: Pathway, b: Pathway): number {
  const setA = resourceSet(a);
  const setB = resourceSet(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let shared = 0;
  for (const item of setA) if (setB.has(item)) shared++;

  return Math.round((shared / Math.min(setA.size, setB.size)) * 100) / 100;
}

export function checkDifferentiation(pathways: Pathway[]): PathwayResult["differentiation"] {
  const pairs: { a: string; b: string; overlap: number }[] = [];

  for (let i = 0; i < pathways.length; i++) {
    for (let j = i + 1; j < pathways.length; j++) {
      pairs.push({
        a: pathways[i].type,
        b: pathways[j].type,
        overlap: pairOverlap(pathways[i], pathways[j]),
      });
    }
  }

  const maxOverlap = pairs.reduce((m, p) => Math.max(m, p.overlap), 0);
  return { max_overlap: maxOverlap, pairs, passed: maxOverlap <= MAX_ALLOWED_OVERLAP };
}

/**
 * If two pathways are near-duplicates, drop the weaker of the offending pair
 * rather than presenting three variations of the same plan. Sprint is preserved
 * over Deep on a tie because it is the more actionable of the two.
 */
export function enforceDifferentiation(pathways: Pathway[]): {
  pathways: Pathway[];
  note: string | null;
} {
  const check = checkDifferentiation(pathways);
  if (check.passed || pathways.length <= 2) return { pathways, note: null };

  const worst = check.pairs.reduce((a, b) => (b.overlap > a.overlap ? b : a));
  const priority: Pathway["type"][] = ["sprint", "lateral", "deep"];
  const drop =
    priority.indexOf(worst.a as Pathway["type"]) > priority.indexOf(worst.b as Pathway["type"])
      ? worst.a
      : worst.b;

  return {
    pathways: pathways.filter((p) => p.type !== drop),
    note: `The ${worst.a} and ${worst.b} pathways shared ${Math.round(
      worst.overlap * 100,
    )}% of their resources, above our 40% ceiling. We dropped the ${drop} pathway rather than show you the same plan twice under different labels.`,
  };
}
