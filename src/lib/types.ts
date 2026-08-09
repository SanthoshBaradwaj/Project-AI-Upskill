// Shared types for the whole session. The `SessionContext` object is the single
// piece of state passed between stages (PRD §7.5). There is no database — the
// client owns this object and posts the relevant slice to each route.

export type SkillCategory = "technical" | "transferable";
export type EvidenceTier = "asserted" | "evidenced";
export type Difficulty = "L1" | "L2" | "L3";

export interface TaxonomySkill {
  skill_id: string;
  display_name: string;
  category: SkillCategory;
  /** Study hours a working professional needs to gain one level. */
  hours_per_level: number;
}

export interface ExtractedSkill {
  skill_id: string;
  display_name: string;
  category: SkillCategory;
  /** 1-4, inferred strictly from textual evidence. */
  claimed_level: number;
  /** Verbatim quote from the source document. Never synthesised. */
  evidence_snippet: string;
  evidence_tier: EvidenceTier;
  years_since_last_use: number | null;
  /** Set when the user adds a skill by hand on the confirmation screen. */
  user_added?: boolean;
}

export interface Profile {
  skills: ExtractedSkill[];
  inferred_domain: string;
}

export type SponsorshipStatus =
  | "citizen_or_pr"
  | "need_sponsorship"
  | "student_or_opt"
  | "prefer_not_to_say";

export interface Preferences {
  /** Metro ids from roles.json, max 3. */
  locations: string[];
  remote_only: boolean;
  sponsorship: SponsorshipStatus;
  /** Free text, max 60 chars. Never a visa number, date, or document. */
  visa_detail: string;
  /** Role ids from the taxonomy plus free text, max 3. */
  preferred_roles: string[];
  /** Free-text chips, max 5. */
  preferred_companies: string[];
  weekly_hours: number;
}

export interface Question {
  question_id: string;
  skill_id: string;
  difficulty: Difficulty;
  stem: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

export interface ValidatorVerdict {
  question_id: string;
  single_answer_score: number;
  difficulty_match: boolean;
  breaking_argument: string | null;
}

export interface QuizBank {
  /**
   * Every validated item, already shuffled. The client runs the adaptive ladder
   * against this pool so no question costs a network round trip mid-quiz.
   */
  pool: Question[];
  /** Which skill each of the 12 slots belongs to, in priority order. */
  plan: string[];
  skills_tested: string[];
  stats: {
    generated: number;
    rejected_by_validator: number;
    rejection_rate: number;
    source: "live" | "fallback" | "mixed";
    generation_ms: number;
    validation_ms: number;
  };
}

export interface Answer {
  question_id: string;
  skill_id: string;
  difficulty: Difficulty;
  chosen_index: number;
  correct: boolean;
  /** Milliseconds from question render to submit. */
  latency_ms: number;
  answer_changed: boolean;
}

export interface VerifiedSkill {
  skill_id: string;
  display_name: string;
  category: SkillCategory;
  claimed_level: number;
  verified_level: number;
  tested: boolean;
  /** Present only for tested skills. */
  evidence_tier: EvidenceTier;
  years_since_last_use: number | null;
}

export interface LearnerProfile {
  median_latency_by_tier: Record<Difficulty, number | null>;
  ladder_trajectory: "climbing" | "oscillating" | "descending" | "flat";
  /** Share of *fast* answers that were wrong. Measured over-confidence. */
  confidence_delta: number;
  answer_changes: number;
  self_reported_weekly_hours: number;
}

export interface RoleRequirement {
  skill: string;
  level: number;
  weight: number;
}

export interface Role {
  role_id: string;
  title: string;
  salary_band_usd: [number, number];
  posting_count: number;
  entry_difficulty: number;
  required_skills: RoleRequirement[];
  transferable_signals: string[];
  location_distribution: Record<string, number>;
  remote_share: number;
  sponsorship_signal: {
    explicitly_no: number;
    explicitly_yes: number;
    unstated: number;
  };
  typical_stack: string[];
}

export interface SkillGap {
  skill_id: string;
  display_name: string;
  current: number;
  required: number;
  gap: number;
  weight: number;
  hours: number;
}

export interface ConstraintStrip {
  total_postings: number;
  /** Postings passing the location/remote filter. */
  location_eligible: number;
  /** Of those, how many explicitly say no sponsorship. */
  explicitly_no_sponsorship: number;
  /** Postings that survive both filters. */
  open_to_you: number;
  /** Of open_to_you, how many explicitly confirm sponsorship. */
  confirmed_open: number;
  filters_applied: boolean;
}

export interface ScoredRole {
  role: Role;
  readiness: number;
  base_readiness: number;
  transferable_bonus: number;
  matched_signals: string[];
  time_to_ready_hours: number;
  gaps: SkillGap[];
  strengths: { skill_id: string; display_name: string; level: number }[];
  availability: number;
  constraint: ConstraintStrip;
  demoted: boolean;
}

export interface MatchResult {
  nearest_reachable: ScoredRole | null;
  runners_up: ScoredRole[];
  stated_target: ScoredRole | null;
  /** Bridge role recommended when the stated target is far out of reach. */
  bridge: { role_id: string; title: string; readiness: number; months: number } | null;
  all_ranked: ScoredRole[];
  pace_multiplier: number;
  corpus_size: number;
}

export interface PathwayStep {
  resource: string;
  why: string;
  hours: number;
}

export interface PathwayPhase {
  phase: number;
  title: string;
  duration_weeks: number;
  target_gaps: string[];
  steps: PathwayStep[];
  portfolio_artifact: string;
  readiness_after: number;
}

export interface Pathway {
  type: "sprint" | "deep" | "lateral";
  headline: string;
  target_role: string;
  trade_off: string;
  phases: PathwayPhase[];
  total_hours: number;
  estimated_months: number;
}

export interface PathwayResult {
  pathways: Pathway[];
  note: string | null;
  differentiation: {
    /** Max pairwise resource overlap, 0-1. Must be < 0.4 to ship three. */
    max_overlap: number;
    pairs: { a: string; b: string; overlap: number }[];
    passed: boolean;
  };
  pace_multiplier: number;
  source: "live" | "fallback";
}

export interface SessionContext {
  profile: Profile | null;
  preferences: Preferences | null;
  quiz: QuizBank | null;
  answers: Answer[];
  verified: VerifiedSkill[] | null;
  learner: LearnerProfile | null;
  match: MatchResult | null;
  pathways: PathwayResult | null;
}

export const DEFAULT_PREFERENCES: Preferences = {
  locations: [],
  remote_only: false,
  sponsorship: "prefer_not_to_say",
  visa_detail: "",
  preferred_roles: [],
  preferred_companies: [],
  weekly_hours: 8,
};
