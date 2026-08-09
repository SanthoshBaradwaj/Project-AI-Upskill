import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ROLES, TAXONOMY, FALLBACK_QUESTIONS, TOTAL_POSTINGS } from "../src/lib/data";
import {
  overClaimRisk,
  recencyDecay,
  untestedVerifiedLevel,
  TIER_CEILING,
  TIER_WEIGHT,
} from "../src/lib/evidence";
import {
  buildPlan,
  computeVerifiedSkills,
  claimCorrectionRate,
  nextDifficulty,
  nextQuestion,
  selectQuestion,
  verifiedLevelFromAnswers,
} from "../src/lib/ladder";
import { buildLearnerProfile, confidenceDelta, ladderTrajectory, paceMultiplier } from "../src/lib/learner";
import { applyConstraints, match, resolvePreferredRole, scoreRole } from "../src/lib/match";
import { checkDifferentiation, enforceDifferentiation, pairOverlap } from "../src/lib/differentiation";
import { rankByOverClaimRisk, selectSkillsToTest } from "../src/lib/skillSelect";
import { isWellFormed } from "../src/lib/agents/examiner";
import { applyVerdicts } from "../src/lib/agents/validator";
import { sanitiseSkills, fallbackExtract } from "../src/lib/agents/profile";
import { seededRng, shuffleOptions } from "../src/lib/shuffle";
import { DEFAULT_PREFERENCES } from "../src/lib/types";
import type { Answer, ExtractedSkill, Pathway, Preferences, Question, VerifiedSkill } from "../src/lib/types";

/* ---------------- helpers ---------------- */

function mkSkill(over: Partial<ExtractedSkill> = {}): ExtractedSkill {
  return {
    skill_id: "python",
    display_name: "Python",
    category: "technical",
    claimed_level: 3,
    evidence_snippet: "Built a Python pipeline",
    evidence_tier: "evidenced",
    years_since_last_use: 0,
    ...over,
  };
}

function mkAnswer(over: Partial<Answer> = {}): Answer {
  return {
    question_id: "q1",
    skill_id: "python",
    difficulty: "L2",
    chosen_index: 0,
    correct: true,
    latency_ms: 20000,
    answer_changed: false,
    ...over,
  };
}

function mkVerified(over: Partial<VerifiedSkill> = {}): VerifiedSkill {
  return {
    skill_id: "python",
    display_name: "Python",
    category: "technical",
    claimed_level: 3,
    verified_level: 3,
    tested: true,
    evidence_tier: "evidenced",
    years_since_last_use: 0,
    ...over,
  };
}

function mkQuestion(over: Partial<Question> = {}): Question {
  return {
    question_id: "q",
    skill_id: "python",
    difficulty: "L2",
    stem: "A realistic scenario that is long enough to pass the structural check.",
    options: ["alpha", "bravo", "charlie", "delta"],
    correct_index: 1,
    explanation: "Because alpha.",
    ...over,
  };
}

function mkPathway(type: Pathway["type"], resources: string[]): Pathway {
  return {
    type,
    headline: type,
    target_role: "ML Engineer",
    trade_off: "",
    phases: [
      {
        phase: 1,
        title: "P1",
        duration_weeks: 4,
        target_gaps: [],
        steps: resources.map((r) => ({ resource: r, why: "", hours: 10 })),
        portfolio_artifact: "thing",
        readiness_after: 50,
      },
    ],
    total_hours: 10 * resources.length,
    estimated_months: 1,
  };
}

/* ---------------- data integrity ---------------- */

describe("static data artifacts", () => {
  it("has 12 role archetypes and at least 4 low-technical-barrier roles", () => {
    assert.equal(ROLES.length, 12);
    const lowBarrier = ROLES.filter((r) => r.entry_difficulty <= 2);
    assert.ok(lowBarrier.length >= 4, `only ${lowBarrier.length} low-barrier roles`);
  });

  it("location and sponsorship counts reconcile to posting_count", () => {
    for (const role of ROLES) {
      const loc = Object.values(role.location_distribution).reduce((a, b) => a + b, 0);
      const spon =
        role.sponsorship_signal.explicitly_no +
        role.sponsorship_signal.explicitly_yes +
        role.sponsorship_signal.unstated;
      assert.equal(loc, role.posting_count, `${role.role_id} location sum`);
      assert.equal(spon, role.posting_count, `${role.role_id} sponsorship sum`);
    }
  });

  it("every referenced skill exists in the canonical taxonomy", () => {
    const ids = new Set(TAXONOMY.map((s) => s.skill_id));
    for (const role of ROLES) {
      for (const req of role.required_skills) assert.ok(ids.has(req.skill), req.skill);
      for (const sig of role.transferable_signals) assert.ok(ids.has(sig), sig);
    }
    for (const q of FALLBACK_QUESTIONS) assert.ok(ids.has(q.skill_id), q.skill_id);
  });

  it("fallback bank meets the ~40 hand-verified item target and is well formed", () => {
    assert.ok(FALLBACK_QUESTIONS.length >= 40, `only ${FALLBACK_QUESTIONS.length} items`);
    const allowed = new Set(FALLBACK_QUESTIONS.map((q) => q.skill_id));
    for (const q of FALLBACK_QUESTIONS) {
      assert.ok(isWellFormed(q, allowed), `${q.question_id} is malformed`);
    }
    const ids = FALLBACK_QUESTIONS.map((q) => q.question_id);
    assert.equal(new Set(ids).size, ids.length, "duplicate question ids");
  });

  it("corpus is large enough for the 'matched against N postings' claim", () => {
    assert.ok(TOTAL_POSTINGS >= 200, `corpus only ${TOTAL_POSTINGS}`);
  });
});

/* ---------------- evidence ladder ---------------- */

describe("evidence ladder", () => {
  it("caps asserted claims at 1 and evidenced claims at 2", () => {
    assert.equal(TIER_CEILING.asserted, 1);
    assert.equal(TIER_CEILING.evidenced, 2);
    assert.equal(TIER_WEIGHT.asserted, 0.4);
    assert.equal(TIER_WEIGHT.evidenced, 0.6);
  });

  it("decays with age and floors the decay factor at 0.4", () => {
    assert.equal(recencyDecay(0), 1);
    assert.equal(recencyDecay(null), 1);
    assert.ok(recencyDecay(3) < 1 && recencyDecay(3) > 0.7);
    assert.equal(recencyDecay(50), 0.4, "decay factor must never fall below 0.4");
    assert.ok(recencyDecay(10) < recencyDecay(5));
  });

  it("discounts an untested level-4 asserted claim to almost nothing", () => {
    // Claimed 4, but only a list item: capped to 1, weighted 0.4 -> rounds to 0.
    assert.equal(
      untestedVerifiedLevel(mkSkill({ claimed_level: 4, evidence_tier: "asserted" })),
      0,
    );
  });

  it("gives an untested evidenced claim more credit than an asserted one", () => {
    const evidenced = untestedVerifiedLevel(mkSkill({ evidence_tier: "evidenced" }));
    const asserted = untestedVerifiedLevel(mkSkill({ evidence_tier: "asserted" }));
    assert.ok(evidenced > asserted, `${evidenced} should exceed ${asserted}`);
  });

  it("flags the headline over-claim pattern: level 3+ on a list item", () => {
    const flagged = overClaimRisk(mkSkill({ claimed_level: 3, evidence_tier: "asserted" }));
    const clean = overClaimRisk(mkSkill({ claimed_level: 2, evidence_tier: "evidenced" }));
    assert.ok(flagged >= 0.45, `risk ${flagged} should clear the flag threshold`);
    assert.ok(clean < 0.45);
    assert.ok(flagged > clean);
  });

  it("treats a stale claim as riskier than a current one", () => {
    const stale = overClaimRisk(mkSkill({ years_since_last_use: 8 }));
    const fresh = overClaimRisk(mkSkill({ years_since_last_use: 0 }));
    assert.ok(stale > fresh);
  });
});

/* ---------------- adaptive ladder (P0-8) ---------------- */

describe("adaptive difficulty ladder", () => {
  it("moves up on correct and down on wrong", () => {
    assert.equal(nextDifficulty("L2", true), "L3");
    assert.equal(nextDifficulty("L2", false), "L1");
  });

  it("clamps at both ends", () => {
    assert.equal(nextDifficulty("L3", true), "L3");
    assert.equal(nextDifficulty("L1", false), "L1");
  });

  it("allocates 12 slots across 7 skills, revisiting the top 5", () => {
    const skills = ["a", "b", "c", "d", "e", "f", "g"];
    const plan = buildPlan(skills, 12);
    assert.equal(plan.length, 12);
    // Round 1 covers everything in priority order.
    assert.deepEqual(plan.slice(0, 7), skills);
    // Round 2 revisits the top 5 — the highest over-claim risk gets a second read.
    assert.deepEqual(plan.slice(7), ["a", "b", "c", "d", "e"]);
    const counts = new Map<string, number>();
    for (const s of plan) counts.set(s, (counts.get(s) ?? 0) + 1);
    assert.equal(counts.get("a"), 2);
    assert.equal(counts.get("f"), 1);
  });

  it("still fills 12 slots when fewer skills survive", () => {
    assert.equal(buildPlan(["a", "b"], 12).length, 12);
    assert.equal(buildPlan([], 12).length, 0);
  });

  it("reproduces the PRD verified_level table exactly", () => {
    const l3Correct = [mkAnswer({ difficulty: "L3", correct: true })];
    const l2CorrectL3Wrong = [
      mkAnswer({ difficulty: "L2", correct: true }),
      mkAnswer({ question_id: "q2", difficulty: "L3", correct: false }),
    ];
    const l1CorrectL2Wrong = [
      mkAnswer({ difficulty: "L1", correct: true }),
      mkAnswer({ question_id: "q2", difficulty: "L2", correct: false }),
    ];
    const l1Wrong = [mkAnswer({ difficulty: "L1", correct: false })];

    assert.equal(verifiedLevelFromAnswers(l3Correct, "python"), 4);
    assert.equal(verifiedLevelFromAnswers(l2CorrectL3Wrong, "python"), 3);
    assert.equal(verifiedLevelFromAnswers(l1CorrectL2Wrong, "python"), 2);
    assert.equal(verifiedLevelFromAnswers(l1Wrong, "python"), 1);
  });

  it("returns null for an untested skill so the caller can discount instead", () => {
    assert.equal(verifiedLevelFromAnswers([mkAnswer()], "sql"), null);
  });

  it("lands at level 1 when nothing was answered correctly at any tier", () => {
    const allWrong = [
      mkAnswer({ difficulty: "L2", correct: false }),
      mkAnswer({ question_id: "q2", difficulty: "L1", correct: false }),
    ];
    assert.equal(verifiedLevelFromAnswers(allWrong, "python"), 1);
  });

  it("uses earned levels for tested skills and discounted levels for untested ones", () => {
    const skills = [
      mkSkill({ skill_id: "python", claimed_level: 4, evidence_tier: "asserted" }),
      mkSkill({ skill_id: "sql", claimed_level: 3, evidence_tier: "evidenced" }),
    ];
    const answers = [mkAnswer({ skill_id: "python", difficulty: "L3", correct: true })];
    const verified = computeVerifiedSkills(skills, answers);

    const python = verified.find((v) => v.skill_id === "python")!;
    const sql = verified.find((v) => v.skill_id === "sql")!;

    assert.equal(python.verified_level, 4);
    assert.equal(python.tested, true);
    assert.equal(sql.tested, false);
    assert.ok(sql.verified_level < sql.claimed_level, "untested claim must be discounted");
  });

  it("computes the claim-correction rate that drives the money-shot chart", () => {
    const verified = [
      mkVerified({ skill_id: "a", claimed_level: 3, verified_level: 2 }),
      mkVerified({ skill_id: "b", claimed_level: 3, verified_level: 3 }),
    ];
    assert.equal(claimCorrectionRate(verified), 0.5);
    assert.equal(claimCorrectionRate([]), 0);
  });
});

describe("question selection", () => {
  const pool: Question[] = [
    mkQuestion({ question_id: "p1", skill_id: "python", difficulty: "L1" }),
    mkQuestion({ question_id: "p2", skill_id: "python", difficulty: "L2" }),
    mkQuestion({ question_id: "p3", skill_id: "python", difficulty: "L3" }),
    mkQuestion({ question_id: "s1", skill_id: "sql", difficulty: "L2" }),
  ];

  it("prefers the exact difficulty", () => {
    const q = selectQuestion(pool, "python", "L3", new Set());
    assert.equal(q?.question_id, "p3");
  });

  it("falls back to the nearest difficulty when the exact tier is used up", () => {
    const q = selectQuestion(pool, "python", "L3", new Set(["p3"]));
    assert.equal(q?.question_id, "p2");
  });

  it("never repeats an item", () => {
    const used = new Set(["p1", "p2", "p3"]);
    assert.equal(selectQuestion(pool, "python", "L2", used), null);
  });

  it("substitutes another skill rather than ending the quiz short", () => {
    const q = nextQuestion(pool, ["python", "sql"], {
      index: 0,
      difficulty: "L2",
      usedIds: new Set(["p1", "p2", "p3"]),
    });
    assert.equal(q?.question_id, "s1");
  });
});

/* ---------------- shuffle guardrail ---------------- */

describe("position shuffle", () => {
  it("keeps correct_index pointing at the same option text", () => {
    const rng = seededRng(42);
    for (let i = 0; i < 200; i++) {
      const q = mkQuestion({ correct_index: i % 4 });
      const shuffled = shuffleOptions(q, rng);
      assert.equal(
        shuffled.options[shuffled.correct_index],
        q.options[q.correct_index],
        "shuffle must remap correct_index to the same option",
      );
      assert.deepEqual([...shuffled.options].sort(), [...q.options].sort());
    }
  });

  it("actually moves answers off their original position over many items", () => {
    const rng = seededRng(7);
    let moved = 0;
    for (let i = 0; i < 200; i++) {
      const q = mkQuestion({ correct_index: 1 });
      if (shuffleOptions(q, rng).correct_index !== 1) moved++;
    }
    assert.ok(moved > 100, `only ${moved}/200 moved — shuffle looks degenerate`);
  });
});

/* ---------------- learner profile & calibrator ---------------- */

describe("learner profile", () => {
  it("measures over-confidence as the share of fast answers that were wrong", () => {
    const answers = [
      mkAnswer({ question_id: "1", difficulty: "L2", latency_ms: 5000, correct: false }),
      mkAnswer({ question_id: "2", difficulty: "L2", latency_ms: 6000, correct: false }),
      mkAnswer({ question_id: "3", difficulty: "L2", latency_ms: 40000, correct: true }),
      mkAnswer({ question_id: "4", difficulty: "L2", latency_ms: 45000, correct: true }),
    ];
    // Median is 23s; both sub-median answers are wrong.
    assert.equal(confidenceDelta(answers), 1);
  });

  it("returns zero when nobody answered faster than their tier median", () => {
    const answers = [mkAnswer({ latency_ms: 10000 })];
    assert.equal(confidenceDelta(answers), 0);
  });

  it("reads a rising difficulty run as climbing", () => {
    const answers = [
      mkAnswer({ question_id: "1", difficulty: "L1" }),
      mkAnswer({ question_id: "2", difficulty: "L2" }),
      mkAnswer({ question_id: "3", difficulty: "L3" }),
    ];
    assert.equal(ladderTrajectory(answers), "climbing");
  });

  it("reads an alternating run as oscillating", () => {
    const answers = [
      mkAnswer({ question_id: "1", difficulty: "L2" }),
      mkAnswer({ question_id: "2", difficulty: "L3" }),
      mkAnswer({ question_id: "3", difficulty: "L2" }),
      mkAnswer({ question_id: "4", difficulty: "L3" }),
      mkAnswer({ question_id: "5", difficulty: "L2" }),
    ];
    assert.equal(ladderTrajectory(answers), "oscillating");
  });
});

describe("calibrator", () => {
  it("expands estimates and surfaces an honest note on high confidence delta", () => {
    const answers = [
      mkAnswer({ question_id: "1", latency_ms: 4000, correct: false }),
      mkAnswer({ question_id: "2", latency_ms: 5000, correct: false }),
      mkAnswer({ question_id: "3", latency_ms: 40000, correct: true }),
      mkAnswer({ question_id: "4", latency_ms: 42000, correct: true }),
    ];
    const profile = buildLearnerProfile(answers, 8);
    const pace = paceMultiplier(profile, answers);
    assert.equal(pace.multiplier, 1.25);
    assert.ok(pace.honest_note, "over-confidence must be surfaced, not hidden");
  });

  it("compresses estimates for someone fast and accurate at L3", () => {
    const answers = [
      mkAnswer({ question_id: "1", difficulty: "L3", latency_ms: 20000, correct: true }),
      mkAnswer({ question_id: "2", difficulty: "L3", latency_ms: 22000, correct: true }),
      mkAnswer({ question_id: "3", difficulty: "L3", latency_ms: 25000, correct: true }),
    ];
    const profile = buildLearnerProfile(answers, 8);
    assert.equal(paceMultiplier(profile, answers).multiplier, 0.85);
  });

  it("always stays inside the documented 0.8-1.3 band", () => {
    for (const answers of [[], [mkAnswer()], [mkAnswer({ correct: false })]]) {
      const profile = buildLearnerProfile(answers, 8);
      const m = paceMultiplier(profile, answers).multiplier;
      assert.ok(m >= 0.8 && m <= 1.3, `multiplier ${m} out of band`);
    }
  });
});

/* ---------------- matching engine ---------------- */

describe("constraint filter", () => {
  const mlops = ROLES.find((r) => r.role_id === "mlops_engineer")!;
  const policy = ROLES.find((r) => r.role_id === "ai_ethics_policy_analyst")!;

  it("passes everything through when no preferences are set", () => {
    const strip = applyConstraints(mlops, null);
    assert.equal(strip.open_to_you, mlops.posting_count);
    assert.equal(strip.filters_applied, false);
  });

  it("narrows to the chosen metro plus remote", () => {
    const prefs: Preferences = { ...DEFAULT_PREFERENCES, locations: ["sf_bay"] };
    const strip = applyConstraints(mlops, prefs);
    const expected =
      mlops.location_distribution.sf_bay + mlops.location_distribution.remote_us;
    assert.equal(strip.location_eligible, expected);
    assert.ok(strip.location_eligible < mlops.posting_count, "filter must visibly bite");
  });

  it("removes explicitly-no-sponsorship postings for a user who needs sponsorship", () => {
    const prefs: Preferences = { ...DEFAULT_PREFERENCES, sponsorship: "need_sponsorship" };
    const strip = applyConstraints(mlops, prefs);
    assert.ok(strip.open_to_you < strip.location_eligible);
    assert.equal(
      strip.open_to_you,
      strip.location_eligible - strip.explicitly_no_sponsorship,
    );
  });

  it("counts unstated postings as open but excludes them from 'confirmed open'", () => {
    const prefs: Preferences = { ...DEFAULT_PREFERENCES, sponsorship: "need_sponsorship" };
    const strip = applyConstraints(mlops, prefs);
    assert.equal(strip.confirmed_open, mlops.sponsorship_signal.explicitly_yes);
    assert.ok(
      strip.open_to_you > strip.confirmed_open,
      "unstated postings should widen 'open' beyond 'confirmed'",
    );
  });

  it("reaches zero availability for an on-site-only role outside the user's metro", () => {
    const prefs: Preferences = { ...DEFAULT_PREFERENCES, locations: ["portland"] };
    const strip = applyConstraints(policy, prefs);
    assert.equal(strip.open_to_you, 0);
  });
});

describe("role scoring", () => {
  const mlEngineer = ROLES.find((r) => r.role_id === "ml_engineer")!;

  it("scores 100 for someone who meets every requirement", () => {
    const verified = mlEngineer.required_skills.map((r) =>
      mkVerified({ skill_id: r.skill, verified_level: r.level }),
    );
    const scored = scoreRole(mlEngineer, verified, null, 1);
    assert.equal(scored.readiness, 100);
    assert.equal(scored.time_to_ready_hours, 0);
    assert.equal(scored.gaps.length, 0);
  });

  it("scores 0 for someone with nothing verified", () => {
    const scored = scoreRole(mlEngineer, [], null, 1);
    assert.equal(scored.base_readiness, 0);
    assert.ok(scored.time_to_ready_hours > 0);
    assert.equal(scored.gaps.length, mlEngineer.required_skills.length);
  });

  it("adds +3 per matched transferable signal, capped at +10", () => {
    const verified = mlEngineer.transferable_signals.map((s) =>
      mkVerified({ skill_id: s, verified_level: 2 }),
    );
    const scored = scoreRole(mlEngineer, verified, null, 1);
    assert.equal(scored.matched_signals.length, 3);
    assert.equal(scored.transferable_bonus, 9);

    const many = mkVerified({ skill_id: "x", verified_level: 4 });
    const capped = scoreRole(
      { ...mlEngineer, transferable_signals: ["a", "b", "c", "d", "e"] },
      ["a", "b", "c", "d", "e"].map((s) => ({ ...many, skill_id: s })),
      null,
      1,
    );
    assert.equal(capped.transferable_bonus, 10);
  });

  it("scales time-to-ready by the pace multiplier", () => {
    const base = scoreRole(mlEngineer, [], null, 1).time_to_ready_hours;
    const slow = scoreRole(mlEngineer, [], null, 1.25).time_to_ready_hours;
    assert.ok(slow > base, `${slow} should exceed ${base}`);
  });
});

describe("two-track selection", () => {
  const strongVerified: VerifiedSkill[] = [
    mkVerified({ skill_id: "sql", verified_level: 4 }),
    mkVerified({ skill_id: "data_visualization", verified_level: 3 }),
    mkVerified({ skill_id: "bi_tooling", verified_level: 3 }),
    mkVerified({ skill_id: "statistics", verified_level: 2 }),
    mkVerified({ skill_id: "stakeholder_communication", verified_level: 3 }),
    mkVerified({ skill_id: "critical_analysis", verified_level: 3 }),
  ];

  it("picks a reachable role as Nearest Reachable and returns two runners-up", () => {
    const result = match(strongVerified, DEFAULT_PREFERENCES, 1);
    assert.ok(result.nearest_reachable);
    assert.equal(result.runners_up.length, 2);
    assert.ok(!result.nearest_reachable!.demoted);
    assert.ok(
      result.nearest_reachable!.readiness >= result.runners_up[0].readiness,
      "hero card must outrank its runners-up",
    );
  });

  it("scores the stated target honestly and unfiltered", () => {
    const prefs: Preferences = {
      ...DEFAULT_PREFERENCES,
      preferred_roles: ["MLOps Engineer"],
      locations: ["portland"],
      sponsorship: "need_sponsorship",
    };
    const result = match(strongVerified, prefs, 1);
    assert.equal(result.stated_target?.role.role_id, "mlops_engineer");
    assert.ok(
      result.stated_target!.readiness < result.nearest_reachable!.readiness,
      "the aspiration should sit below the reachable role",
    );
  });

  it("offers a bridge role when the stated target is far out of reach", () => {
    const prefs: Preferences = { ...DEFAULT_PREFERENCES, preferred_roles: ["MLOps Engineer"] };
    const result = match(strongVerified, prefs, 1);
    assert.ok(result.bridge, "a far-off target should produce a bridge recommendation");
    assert.ok(result.bridge!.readiness > result.stated_target!.readiness);
  });

  it("demotes zero-availability roles instead of hiding them", () => {
    const prefs: Preferences = { ...DEFAULT_PREFERENCES, locations: ["portland"] };
    const result = match(strongVerified, prefs, 1);
    const demoted = result.all_ranked.filter((r) => r.demoted);
    assert.ok(demoted.length > 0, "expected at least one demoted role for a Portland user");
    assert.equal(result.all_ranked.length, ROLES.length, "demoted roles must still be returned");
    const firstDemotedIndex = result.all_ranked.findIndex((r) => r.demoted);
    const lastOpenIndex = result.all_ranked.map((r) => r.demoted).lastIndexOf(false);
    assert.ok(firstDemotedIndex > lastOpenIndex, "demoted roles must sort below open ones");
  });

  it("resolves free-text role preferences to corpus roles", () => {
    assert.equal(resolvePreferredRole("MLOps Engineer")?.role_id, "mlops_engineer");
    assert.equal(resolvePreferredRole("ml_engineer")?.role_id, "ml_engineer");
    assert.equal(resolvePreferredRole("machine learning engineer")?.role_id, "ml_engineer");
    assert.equal(resolvePreferredRole("underwater basket weaver"), null);
  });
});

/* ---------------- pathway differentiation ---------------- */

describe("pathway differentiation", () => {
  it("measures overlap against the smaller resource set", () => {
    const a = mkPathway("sprint", ["Course A", "Course B"]);
    const b = mkPathway("deep", ["Course A", "Course B", "Course C", "Course D"]);
    assert.equal(pairOverlap(a, b), 1);
  });

  it("passes when the three plans draw on different resources", () => {
    const result = checkDifferentiation([
      mkPathway("sprint", ["A", "B", "C"]),
      mkPathway("deep", ["D", "E", "F"]),
      mkPathway("lateral", ["G", "H", "I"]),
    ]);
    assert.equal(result.max_overlap, 0);
    assert.ok(result.passed);
  });

  it("ships two real pathways rather than three cosmetic ones", () => {
    const { pathways, note } = enforceDifferentiation([
      mkPathway("sprint", ["A", "B", "C"]),
      mkPathway("deep", ["A", "B", "C"]),
      mkPathway("lateral", ["X", "Y", "Z"]),
    ]);
    assert.equal(pathways.length, 2);
    assert.ok(note && note.includes("40%"), "the user should be told why");
    assert.ok(pathways.some((p) => p.type === "lateral"));
  });
});

/* ---------------- examiner skill selection ---------------- */

describe("examiner skill selection", () => {
  const skills: ExtractedSkill[] = [
    mkSkill({ skill_id: "python", claimed_level: 3, evidence_tier: "asserted", years_since_last_use: 6 }),
    mkSkill({ skill_id: "sql", claimed_level: 3, evidence_tier: "evidenced", years_since_last_use: 0 }),
    mkSkill({ skill_id: "statistics", claimed_level: 3, evidence_tier: "asserted", years_since_last_use: 0 }),
    mkSkill({ skill_id: "excel_modeling", claimed_level: 2, evidence_tier: "evidenced" }),
    mkSkill({ skill_id: "data_visualization", claimed_level: 2, evidence_tier: "evidenced" }),
    mkSkill({ skill_id: "bi_tooling", claimed_level: 1, evidence_tier: "asserted" }),
  ];

  it("tests the likeliest over-claim first", () => {
    const ranked = rankByOverClaimRisk(skills);
    assert.ok(
      ["python", "statistics"].includes(ranked[0].skill_id),
      `expected a stale or asserted level-3 claim first, got ${ranked[0].skill_id}`,
    );
  });

  it("reserves slots 6-7 for the preferred role's heaviest requirements", () => {
    const prefs: Preferences = { ...DEFAULT_PREFERENCES, preferred_roles: ["MLOps Engineer"] };
    const selected = selectSkillsToTest(skills, prefs);
    assert.equal(selected.length, 7);
    const prefSlots = selected.slice(5);
    assert.ok(
      prefSlots.every((s) => s.reason === "preferred_role_requirement"),
      "slots 6-7 must come from the stated target",
    );
    const mlopsSkills = new Set(
      ROLES.find((r) => r.role_id === "mlops_engineer")!.required_skills.map((r) => r.skill),
    );
    assert.ok(prefSlots.every((s) => mlopsSkills.has(s.skill_id)));
  });

  it("still fills all 7 slots when the user states no preference", () => {
    const selected = selectSkillsToTest(skills, DEFAULT_PREFERENCES);
    assert.equal(selected.length, 6, "cannot exceed the number of extracted skills");
    assert.equal(new Set(selected.map((s) => s.skill_id)).size, selected.length);
  });
});

/* ---------------- agent output handling ---------------- */

describe("examiner structural validation", () => {
  const allowed = new Set(["python"]);

  it("accepts a well-formed item", () => {
    assert.ok(isWellFormed(mkQuestion(), allowed));
  });

  it("rejects items that break the distractor rules", () => {
    assert.ok(!isWellFormed(mkQuestion({ options: ["a", "b", "c"] }), allowed), "needs 4 options");
    assert.ok(
      !isWellFormed(mkQuestion({ options: ["a", "a", "b", "c"] }), allowed),
      "duplicate options",
    );
    assert.ok(
      !isWellFormed(mkQuestion({ options: ["a", "b", "c", "All of the above"] }), allowed),
      "'All of the above' is banned",
    );
    assert.ok(!isWellFormed(mkQuestion({ correct_index: 9 }), allowed), "index out of range");
    assert.ok(!isWellFormed(mkQuestion({ skill_id: "sql" }), allowed), "unrequested skill");
    assert.ok(!isWellFormed(mkQuestion({ stem: "short" }), allowed), "stem too short");
  });
});

describe("validator verdict handling", () => {
  const questions = [
    mkQuestion({ question_id: "a" }),
    mkQuestion({ question_id: "b" }),
    mkQuestion({ question_id: "c" }),
    mkQuestion({ question_id: "d" }),
  ];

  it("discards items below the single-answer threshold or failing difficulty match", () => {
    const outcome = applyVerdicts(questions, [
      { question_id: "a", single_answer_score: 5, difficulty_match: true, breaking_argument: null },
      { question_id: "b", single_answer_score: 3, difficulty_match: true, breaking_argument: "option 2 also works" },
      { question_id: "c", single_answer_score: 5, difficulty_match: false, breaking_argument: null },
      { question_id: "d", single_answer_score: 4, difficulty_match: true, breaking_argument: null },
    ]);
    assert.deepEqual(outcome.kept.map((q) => q.question_id), ["a", "d"]);
    assert.deepEqual(outcome.rejected.map((q) => q.question_id), ["b", "c"]);
  });

  it("keeps unreviewed items rather than silently dropping them", () => {
    const outcome = applyVerdicts(questions, []);
    assert.equal(outcome.kept.length, 4);
    assert.equal(outcome.rejected.length, 0);
  });
});

/* ---------------- profile agent grounding ---------------- */

describe("profile extraction grounding", () => {
  const source = "Built and owned the claims-severity forecasting model in SQL and Excel.";

  it("drops skills whose 'verbatim' snippet is not in the source document", () => {
    const raw = [
      mkSkill({ skill_id: "sql", evidence_snippet: "Built and owned the claims-severity forecasting model" }),
      mkSkill({ skill_id: "python", evidence_snippet: "Led a team of five machine learning engineers" }),
    ];
    const clean = sanitiseSkills(raw, source);
    assert.deepEqual(clean.map((s) => s.skill_id), ["sql"]);
  });

  it("drops skills outside the canonical taxonomy", () => {
    const raw = [mkSkill({ skill_id: "wizardry", evidence_snippet: source })];
    assert.equal(sanitiseSkills(raw, source).length, 0);
  });

  it("deduplicates and clamps claimed_level into range", () => {
    const raw = [
      mkSkill({ skill_id: "sql", claimed_level: 9, evidence_snippet: source }),
      mkSkill({ skill_id: "sql", claimed_level: 2, evidence_snippet: source }),
    ];
    const clean = sanitiseSkills(raw, source);
    assert.equal(clean.length, 1);
    assert.equal(clean[0].claimed_level, 4);
  });

  it("fallback extractor finds grounded skills without a model", () => {
    const text = `SKILLS
Python, SQL, Tableau, statistics
EXPERIENCE
Built a forecasting model in SQL and presented results to the executive team.`;
    const profile = fallbackExtract(text);
    const ids = profile.skills.map((s) => s.skill_id);
    assert.ok(ids.includes("sql"));
    assert.ok(ids.includes("python"));
    for (const s of profile.skills) {
      assert.ok(text.includes(s.evidence_snippet.slice(0, 30)), "snippet must be real text");
    }
  });

  const resume = `SKILLS
SQL, Python, Tableau, statistics, stakeholder management

EXPERIENCE
- Built and owned the patient readmission reporting pipeline in SQL.
- Presented quarterly performance findings to the executive team.`;

  it("tiers a résumé bullet as evidenced, not asserted", () => {
    // A leading "-" is bullet formatting, not a list of nouns. The bullets are
    // where the real evidence lives.
    const sql = fallbackExtract(resume).skills.find((s) => s.skill_id === "sql")!;
    assert.equal(sql.evidence_tier, "evidenced");
    assert.ok(sql.evidence_snippet.includes("Built and owned"));
  });

  it("tiers a bare skills-list mention as asserted", () => {
    const python = fallbackExtract(resume).skills.find((s) => s.skill_id === "python")!;
    assert.equal(python.evidence_tier, "asserted");
    assert.equal(python.claimed_level, 1);
  });

  it("prefers the strongest evidence line when a skill appears more than once", () => {
    // "stakeholder management" appears in the skills list, but the Presented
    // bullet is better evidence and must win.
    const comms = fallbackExtract(resume).skills.find(
      (s) => s.skill_id === "stakeholder_communication",
    )!;
    assert.equal(comms.evidence_tier, "evidenced");
    assert.ok(comms.evidence_snippet.includes("Presented"));
  });
});
