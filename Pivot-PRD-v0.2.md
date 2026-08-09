# Product Requirements Document — "Pivot"

### AI Career Transition Platform — Hackathon MVP

**Version:** 0.2 (adds preference capture, multi-agent framing, multi-pathway planning; removes transcript ingestion)
**Build window:** 48–72 hours
**Owner:** Product / Hackathon Team
**Status:** Scope locked — changes require PM sign-off

---

## Changelog from v0.1

| Change | Rationale |
|---|---|
| **+ Preference capture screen** (location, citizenship, visa, target roles, target companies) | Preferences are hard constraints on viability, not soft flavor. Visa/sponsorship in particular changes *which roles exist* for a user |
| **+ Two-track results** (Nearest Reachable / Your Stated Target) | Preserves honesty of the verification thesis while respecting user ambition |
| **+ Three parallel pathways** (Sprint / Deep / Lateral) with journey visualization | Highest demo-value-per-hour addition in the backlog |
| **+ Learner Profile telemetry** (session-only) driving pathway hour calibration | Demonstrates the learning loop honestly without requiring persistence |
| **+ Explicit multi-agent architecture** with accuracy guardrails | Accurate framing of what is genuinely agentic vs. what isn't |
| **− Academic transcript parsing (removed entirely)** | Absorbs new scope; low coverage (most users lack a digital transcript); highest parse-failure rate of any input |
| **~ Evidence Ladder rebuilt** on evidence quality + recency instead of course grades | Transcript removal required it; result is simpler and single-source |
| **~ Job corpus schema extended** with location, remote, and sponsorship tags | Preference filtering has no teeth without them |

---

## 1. TL;DR

Professionals outside AI don't know which AI role is realistically within reach, and they systematically overestimate their own skill depth. Pivot ingests a résumé, captures the constraints that actually govern employability (location, work authorization, target roles and companies), extracts claimed skills, **stress-tests those claims with an adaptive MCQ quiz**, and matches the user's *verified* skill vector against real AI job postings — filtered to jobs they can actually hold.

It then generates **three distinct pathways** to that role and plots the user's earned starting position on each.

The differentiator remains verification. Every competitor trusts the résumé. We don't — and now we also don't pretend a role is reachable when the user can't legally hold it.

---

## 2. Problem Statement

**Primary problem:** Career-switchers targeting AI get advice that is generic, aspirational, or both — and never calibrated to what they actually know or what they're actually eligible for.

**Four compounding failures in the status quo:**

| Failure | Consequence |
|---|---|
| **Self-report bias** — résumés overstate depth ("Proficient in Statistics" = one course, years ago) | Users target roles they'll be rejected from, or under-target roles they'd get |
| **Skill invisibility** — transferable skills (experimental design, stakeholder translation, algorithmic intuition) are never mapped to AI job requirements | Users think they're starting from zero when they're 60% there |
| **Constraint blindness** — advice ignores work authorization, geography, and role density | A perfect pathway to a role that sponsors nobody in the user's city is worse than useless |
| **Pathway generality** — one-size-fits-all curricula, single route | 6–12 months of redundant study; no sense of progress; high dropout |

**Our thesis:** A 3-minute adaptive quiz plus 30 seconds of constraint capture produces a more actionable recommendation than a 30-minute résumé review — because it replaces *claims* with *evidence*, and *aspiration* with *eligibility*.

---

## 3. Target Audience

### Primary Persona — "The Adjacent Analyst"

- **Who:** 3–8 years in a quantitative-adjacent role — data analyst, actuary, financial analyst, biostatistician, QA engineer, ops research
- **Has:** SQL, Excel, some Python, real statistics exposure, domain depth
- **Lacks:** Clarity on whether they're closer to ML Engineer, Analytics Engineer, or AI Product Manager
- **JTBD:** *"Tell me the shortest credible path from where I actually am."*

### Secondary Persona — "The Domain Translator"

- **Who:** PM, consultant, teacher, clinician, lawyer, journalist
- **Has:** Critical analysis, stakeholder management, structured decomposition, domain authority
- **Lacks:** Technical baseline; assumes AI is closed to them
- **JTBD:** *"Is there a real AI role for someone like me?"*

### Tertiary Persona (newly served by preference capture) — "The Constrained Candidate"

- **Who:** International professional on a temporary visa, or someone geographically anchored (family, mortgage, caregiving)
- **Has:** Often strong technical credentials
- **Lacks:** Visibility into which roles and employers are *actually open* to them
- **JTBD:** *"Which of these roles can I actually get, given my situation?"*
- **Note:** This persona is the single strongest argument for the preferences feature. Generic career tools fail them completely.

### Out of Scope for MVP

- Current ML practitioners seeking senior roles
- Undergraduates with no work history
- Non-English documents
- Immigration advice of any kind (see §10 Risks)

---

## 4. Goals & Non-Goals

### Goals

1. A judge uploads their own résumé and gets a defensible, constraint-aware role recommendation in under 5 minutes.
2. The quiz visibly *corrects* an inflated skill claim on stage — the primary "aha."
3. Toggling between three pathways visibly changes the timeline — the secondary "aha."
4. The pathway is concrete enough that a judge says "I could actually follow this."

### Non-Goals

- ❌ User accounts, auth, cross-session persistence *(confirmed: session-only)*
- ❌ Academic transcript ingestion *(cut in v0.2)*
- ❌ Live job board integration or application submission
- ❌ Autonomous agent orchestration with dynamic tool selection
- ❌ Immigration, legal, or visa advice — we report observed posting data only
- ❌ Mobile-native app (responsive web only)
- ❌ Payment, tiering, monetization surface
- ❌ Résumé rewriting or cover letters
- ❌ Free-text or code-based assessment

---

## 5. Core User Journey

**Target: ≤ 5 minutes, 6 screens.**

```
[1] LANDING → [2] INGEST → [3] PREFERENCES → [4] SKILL CONFIRM → [5] QUIZ → [6] RESULTS
    10s          40s           30s               30s              2.5 min     review
```

### Screen 1 — Landing

- One-line value prop, single CTA: *"Find your nearest AI role"*
- Trust signals: "No account. Nothing stored. 5 minutes."
- Secondary CTA: **"Try a demo profile"** *(demo insurance — P0)*

### Screen 2 — Profile Ingestion

- **Required (choose one):** Résumé upload (PDF/DOCX) **or** paste LinkedIn "About + Experience" text
- Narrated loading state, not a spinner: "Reading your experience… Found 14 skills…"
- **No transcript upload** — removed in v0.2

### Screen 3 — Preferences & Constraints *(new)*

Five fields, all skippable, ~30 seconds. Placed **after** ingestion deliberately: asking for work authorization before delivering any value is a drop-off cliff.

| Field | Input type | Notes |
|---|---|---|
| **Preferred location(s)** | Typeahead, multi-select, max 3 + "Remote only" toggle | Metro-level granularity |
| **Citizenship / work authorization** | Single select: `Citizen or permanent resident` / `Need sponsorship` / `Student visa or OPT` / `Prefer not to say` | Coarse buckets only — never collect visa numbers, dates, or documents |
| **Visa detail** *(optional)* | Free text, 60 char | Purely to sharpen the sponsorship filter |
| **Preferred AI roles** | Multi-select from role taxonomy + free text, max 3 | Drives the second result track |
| **Preferred companies** | Free-text chips, max 5 | Drives stack-aligned pathway resources |

**Required UI copy, verbatim:** *"This stays in your browser. We don't store it, and we don't give immigration advice — we just show you what the job postings say."*

### Screen 4 — Skill Confirmation (trust gate)

- Extracted skills as chips, grouped **Technical** / **Transferable**
- Each chip shows evidence tier badge + hover-to-see verbatim evidence snippet
- User can **remove** wrong extractions and **add** up to 3 free-text skills
- Rationale: converts extraction errors into a user-fixable step rather than a credibility hit, and protects the demo from a bad parse
- **Quiz generation runs in the background during this screen** — hides ~15s of latency behind user activity

### Screen 5 — The Reality Check

- 12 questions (up from 10 — 2 reserved for preferred-role skill coverage), one per screen, 4 options
- Progress bar, streak counter, 45s soft timer (non-blocking, advisory only)
- Adaptive difficulty ladder (§7.4)
- Immediate per-question feedback with one-line explanation
- No cumulative score shown mid-quiz — preserves the reveal, prevents demoralization

### Screen 6 — Results Dashboard

Five modules, in order:

**A. Verified Skill Profile** — claimed vs. verified, side by side. The signature visual.

**B. Nearest Reachable Role** — hero card: title, readiness %, salary band, time-to-ready, 2-line "why you", plus a **constraint strip**:

> *"47 postings in Portland + Remote · 34 mention no sponsorship · 13 open to you"*

**C. Your Stated Target** *(shown only if user named preferred roles)* — the honest second track. Readiness %, gap list, realistic timeline, and a bridge recommendation:

> *"ML Research Scientist: 22% ready, ~2.5 years. Fastest credible route runs through ML Engineer (61% ready, ~7 months)."*

**D. Runners-Up** — 2 alternate roles, readiness % and one-line trade-off each.

**E. Your Pathways** — three tabs (Sprint / Deep / Lateral) over the **journey map** (§6.4). Selecting a tab re-renders the timeline against the same "you are here" position.

Persistent CTA: "Copy plan as Markdown."

---

## 6. Feature Scope

### 6.1 MUST-HAVE (P0) — no demo without these

| # | Feature | Acceptance Criteria |
|---|---|---|
| P0-1 | Résumé upload + text-paste ingestion | PDF/DOCX ≤5MB and raw text; ≥90% text fidelity on a standard 1-page résumé |
| P0-2 | Profile Agent skill extraction | Structured JSON: ≥8 skills with `name`, `category`, `claimed_level`, `evidence_snippet`, `years_since_last_use` |
| P0-3 | **Preference capture screen** | All 5 fields; every field skippable; state propagates to matching, quiz selection, and pathways |
| P0-4 | **Constraint-filtered matching** | Corpus filters by location + remote + sponsorship before scoring; constraint strip renders real counts |
| P0-5 | Skill confirmation UI | Remove chips, add ≤3 custom skills; edits propagate to quiz generation |
| P0-6 | Examiner Agent MCQ generation | 15 questions in <15s, skill-tagged, difficulty-tiered, with answer key + explanations |
| P0-7 | Validator Agent pass | Each item scored for single-defensible-answer; items below threshold discarded and backfilled |
| P0-8 | Adaptive difficulty ladder | Deterministic, unit-tested, per §7.4 |
| P0-9 | Verified skill scoring | `verified_level` (0–4) per tested skill; untested skills discounted per Evidence Ladder |
| P0-10 | Role matching + two-track results | Ranks ≥10 roles; returns Nearest Reachable + 2 alternates + Stated Target track |
| P0-11 | **Three-pathway generation** | Sprint / Deep / Lateral, each with ≥2 named resources per gap and ≥1 portfolio artifact per phase; enforced differentiation (§7.3) |
| P0-12 | **Journey map visualization** | Timeline per pathway with "you are here" marker, milestone nodes, target bar. *Static render acceptable; animation is P1* |
| P0-13 | Claimed-vs-verified chart | Legible from 15 feet (projector test) |
| P0-14 | **Learner Profile telemetry** | Session-only object capturing latency, ladder trajectory, confidence delta; produces `pace_multiplier` applied to all hour estimates |
| P0-15 | Demo profile button | Fully pre-computed path, zero live API dependency |
| P0-16 | Graceful degradation | Any LLM timeout, parse failure, or skipped preference still completes the flow at reduced confidence |

### 6.2 SHOULD-HAVE (P1) — only if P0 green by hour 44

- Weekly-hours slider (4 / 8 / 15) live-recomputing all three timelines
- Journey-map transition animation between pathway tabs
- "Why this role?" expandable panel citing verbatim résumé lines
- Markdown/PDF export of the selected pathway
- Company-specific gap view ("vs. Anthropic's posted bar for this role")
- Shareable read-only results link (in-memory ID)

### 6.3 NICE-TO-HAVE (P2) — roadmap slide only, do not build

- Persistent learner profile + 90-day re-assessment loop *(the honest v2 headline)*
- True agent orchestration: dynamic tool selection, self-directed re-testing on ambiguous signals
- Cross-session learning-velocity model trained on real completion data
- Live job scraping with freshness guarantees
- Free-text and code-based assessment items
- IRT / Bayesian ability estimation replacing the heuristic ladder
- Academic transcript ingestion *(deferred from v0.1)*
- Employer-side view: verified-candidate sourcing
- Course-provider affiliate integration

> **Scope-creep tripwire:** Any P1/P2 item raised after **hour 36** is automatically declined and logged to the roadmap slide. A crisp roadmap scores better with judges than a half-built feature.

### 6.4 Journey Map — Detailed Spec

The single highest-payoff visual in the product after the claimed-vs-verified chart.

**Structure:** horizontal timeline, left = today, right = target role readiness bar.

- **"You are here" marker** — plotted at the user's *verified* readiness %. Identical position across all three tabs. This is the point: same starting reality, three different futures.
- **Milestone nodes** — one per portfolio artifact, labeled and dated (week N).
- **Readiness curve** — climbs from current % to the role's threshold. Sprint climbs fast and plateaus lower; Deep climbs slower and overshoots; Lateral climbs moderately with a shorter total distance.
- **Target bar** — horizontal line at the role's required readiness, annotated with the role title.
- **Time axis** — weeks, computed as `base_hours × pace_multiplier ÷ weekly_hours`.

**Fallback if time-constrained:** three static SVG timelines rendered server-side, swapped on tab click. No animation, no slider. Still demos fine. Build this version first; upgrade only if hour 52 is green.

---

## 7. Technical Data Strategy

### 7.0 The Evidence Ladder (rebuilt for v0.2)

The intellectual spine of the product. With transcripts removed, tiers now derive from **evidence quality and recency within the résumé itself**.

| Tier | Trigger | Level ceiling | Weight in matching |
|---|---|---|---|
| **T1 — Asserted** | Skill named in a list or title, no task context | 1 | 0.4× |
| **T2 — Evidenced** | Verbatim evidence of owned work where the skill was central | 2 | 0.6× |
| **T3 — Verified** | Correct MCQ performance at the corresponding tier | 4 | 1.0× |

**Recency decay** applies to T1 and T2 only: `effective_level × 0.9^(years_since_last_use)`, floored at 0.4. A 2011 Python project is not a 2025 Python project — and saying so on stage demonstrates product judgment.

**The operative rule:** only *verified* levels drive role matching at full weight. This one line is what makes every recommendation defensible under questioning.

**Escalation heuristic (replaces the transcript grade signal):** skills where `claimed_level ≥ 3` but evidence is T1-only, or `years_since_last_use > 5`, are flagged **high over-claim risk** and jump the quiz queue. The likeliest over-claim gets tested first.

---

### 7.1 Job Role Data — Sourcing & Constraint Tagging

**Recommendation unchanged: pre-harvest a static corpus before the clock starts. Do not build a live scraper.**

Rationale, in priority order:

1. **Time risk.** LinkedIn is aggressively anti-scraping — auth walls, dynamic rendering, rate limits, IP bans. A live scraper is a 12-hour rabbit hole, and a mid-demo rate limit kills the project on stage.
2. **Terms of Service.** LinkedIn's ToS prohibit automated scraping. The legal position on public-data scraping is genuinely contested (*hiQ v. LinkedIn* went both directions over several years), but it's avoidable liability for a demoed product, and judges do ask.
3. **Freshness isn't the bottleneck.** Role *archetypes* shift over quarters, not hours.

**Phase A — Harvest (pre-hour-0, ~2.5 hours):** 150–300 postings, in source priority order:

- Official/open APIs and public boards: Adzuna API, USAJobs API, Greenhouse and Lever public boards of AI-heavy companies. **These are now strongly preferred over scraped HTML** because they expose structured location, remote, and sponsorship fields that v0.2's preference filtering requires.
- Existing Kaggle / HuggingFace job-posting datasets — fastest path, zero legal exposure
- Manual collection of exemplar postings — 30 well-chosen beats 300 noisy

**Phase B — Normalize into role archetypes (~2 hours):** 10–12 canonical roles.

```
Analytics Engineer · Data Analyst (AI-adjacent) · ML Engineer ·
Data Scientist · AI Product Manager · Prompt / LLM Application Engineer ·
MLOps Engineer · AI Solutions Architect · Conversation Designer ·
AI Ethics & Policy Analyst · Data Engineer · AI Technical Writer
```

Deliberately retain ≥4 **low-technical-barrier roles** (AI PM, Conversation Designer, Ethics Analyst, Technical Writer). Without them the Domain Translator always gets a demoralizing result and the demo only works for engineers.

**Extended schema (v0.2 additions marked):**

```json
{
  "role_id": "ml_engineer",
  "title": "Machine Learning Engineer",
  "salary_band_usd": [125000, 185000],
  "posting_count": 47,
  "required_skills": [
    { "skill": "python",               "level": 3, "weight": 1.0 },
    { "skill": "machine_learning",     "level": 3, "weight": 1.0 },
    { "skill": "statistics",           "level": 3, "weight": 0.8 },
    { "skill": "sql",                  "level": 2, "weight": 0.6 },
    { "skill": "cloud_deployment",     "level": 2, "weight": 0.7 },
    { "skill": "software_engineering", "level": 3, "weight": 0.9 }
  ],
  "transferable_signals": ["experimental_design", "systems_thinking"],
  "entry_difficulty": 4,

  // --- v0.2 additions ---
  "location_distribution": { "sf_bay": 14, "nyc": 9, "seattle": 7,
                             "portland": 3, "remote_us": 11, "other": 3 },
  "remote_share": 0.23,
  "sponsorship_signal": { "explicitly_no": 34, "explicitly_yes": 6,
                          "unstated": 7 },
  "typical_stack": ["pytorch", "aws_sagemaker", "docker", "airflow"]
}
```

`sponsorship_signal` is derived by keyword pass over posting text ("no sponsorship", "must be authorized to work", "visa sponsorship available"). It is **observed posting language, not legal fact** — the UI must present it as such.

**Phase C — Constraint-filtered matching:**

```
STEP 1 — FILTER (preferences applied to corpus)
  eligible_postings = corpus
    .filter(location ∈ user_locations OR remote_ok)
    .filter(sponsorship_needed ? NOT explicitly_no : true)

  role_availability = count(eligible_postings per role)
  Roles with availability = 0 are DEMOTED, not hidden.
  Render: "Strong match on skills, but 0 of 47 postings fit your
           location and authorization. Consider: [nearest alternative]"

STEP 2 — SCORE
  gap_i        = max(0, required_level_i − user_verified_level_i)
  Readiness    = 100 × (1 − Σ(wᵢ × gapᵢ) / Σ(wᵢ × required_levelᵢ))
  + transferable bonus: +3 per matched signal, capped +10
  TimeToReady  = Σ(gapᵢ × hours_per_level[skillᵢ]) × pace_multiplier

STEP 3 — SELECT
  Nearest Reachable = argmax(Readiness)
      subject to TimeToReady ≤ 500 hrs AND role_availability > 0
  Stated Target     = user's preferred role(s), scored honestly, unfiltered
```

Keep it arithmetic, not ML. It has to be explainable on stage in one sentence: *"We score the distance between what you can prove and what the postings require, then filter to the jobs you can actually hold."*

---

### 7.2 Document Parsing (simplified in v0.2)

Résumé / LinkedIn text only. Two stages.

**Stage 1 — Deterministic text extraction (no LLM):**

- PDF → `pdfplumber` (better multi-column layout handling than PyPDF2)
- DOCX → `python-docx`
- Pasted text → passthrough
- **Hard guard:** if extraction yields <200 characters, surface an explicit *"We couldn't read this file — paste your text instead"* state. Never pass empty or near-empty text to the LLM; it will confidently hallucinate a full skill profile, which is the worst possible demo failure.

**Stage 2 — Profile Agent extraction:** single JSON-schema-constrained call (Prompt 1, §7.3). Every skill must carry a verbatim `evidence_snippet` — this powers both the Evidence Ladder tiering and the "Why this role?" panel, and it forces grounding rather than title-based pattern matching.

*Transcript parsing removed. Retained in P2 roadmap.*

---

### 7.3 Agent Prompt Strategy

**Difficulty tiers — define once, use everywhere. Consistency here is what makes leveling meaningful.**

| Tier | Label | Definition |
|---|---|---|
| **L1** | Foundational | Recall of definitions and vocabulary. Answerable after one intro course. |
| **L2** | Applied | Choose the correct method or next step for a described scenario. Requires practical use. |
| **L3** | Advanced | Diagnose a subtle failure, trade-off, or edge case. Requires production experience. |

---

#### Prompt 1 — Profile Agent (skill extraction)

```
SYSTEM:
You are a technical recruiter specializing in career transitions into AI.
Extract skills from the candidate document. Return ONLY valid JSON.

RULES:
1. Extract BOTH technical skills (python, sql, statistics, deep_learning) and
   transferable skills (experimental_design, stakeholder_communication,
   algorithmic_intuition, critical_analysis, project_management).
2. Map every skill to the canonical taxonomy. Do not invent skill names.
3. claimed_level (1-4) is inferred STRICTLY from textual evidence:
     1 = mentioned only, no context
     2 = used in a described task
     3 = owned or led work where the skill was central
     4 = taught, published, or set standards for others
4. Every skill MUST include a verbatim evidence_snippet. If you cannot quote
   evidence, do not emit the skill.
5. Do NOT infer skills from job titles alone. A "Data Analyst" title is not
   evidence of Python.
6. evidence_tier: "asserted" if the snippet is a list item or title;
   "evidenced" if it describes work performed.
7. years_since_last_use: infer from role dates. null if undeterminable.
8. Maximum 15 skills, prioritized by prominence and recency.

CANONICAL_TAXONOMY: {{taxonomy_list}}

USER: <document>{{resume_text}}</document>

SCHEMA:
{ "skills": [ { "skill_id": str, "display_name": str,
                "category": "technical"|"transferable",
                "claimed_level": 1-4, "evidence_snippet": str,
                "evidence_tier": "asserted"|"evidenced",
                "years_since_last_use": int|null } ],
  "inferred_domain": str }
```

Rules 4–5 do the heavy lifting. Without them the model reliably fabricates a full stack from a job title. Rule 6 replaces the transcript-based corroboration signal.

---

#### Prompt 2 — Examiner Agent (batched MCQ generation)

Generate the full bank in **one call before the quiz starts**, not per-question. Per-question generation adds 3–6s between every question and destroys the demo's rhythm.

**Skill selection logic (v0.2 — preference-aware):**

1. **Slots 1–5:** top skills by `claimed_level × role_relevance × over_claim_risk`
2. **Slots 6–7 (new):** highest-weight required skills of the user's **preferred role**, even if weakly claimed — we need a real reading on the aspiration track, and a confident "you're not there yet on X" is only credible if X was actually tested
3. Generate **3 questions per selected skill (L1/L2/L3)**; serve 12 adaptively, discard the rest. Over-generation is cheap and eliminates all mid-quiz latency.

```
SYSTEM:
You write assessment items that measure real proficiency, not trivia recall.
For each (skill, difficulty) pair, generate one multiple-choice question.

DIFFICULTY DEFINITIONS:
L1 FOUNDATIONAL — recall of core definitions. Answerable after one intro course.
L2 APPLIED — given a realistic scenario, select the correct method or next step.
             Requires having actually used the skill.
L3 ADVANCED  — diagnose a subtle failure mode, trade-off, or edge case.
             Requires production experience.

DISTRACTOR RULES (critical):
- All 4 options similar in length, specificity, and grammatical form.
- Every distractor must be a plausible belief held by someone who ALMOST
  understands the concept. No absurd or joke options.
- Exactly one option unambiguously correct to a domain expert.
- Never "All of the above" or "None of the above."
- Do not signal the answer via hedged qualifiers ("usually", "typically")
  appearing in only one option.

STYLE:
- Scenario-framed and concrete. Prefer "A model's validation loss..." over
  "Which of the following describes...".
- Stem under 45 words. Options under 20 words each.
- explanation: one sentence that teaches the concept to someone who got it wrong.

USER:
Generate questions for: {{ [{"skill":"statistics","difficulty":"L2"}, ...] }}
Candidate domain (scenario flavor ONLY — do not adjust difficulty): {{ domain }}

SCHEMA:
{ "questions": [ { "question_id": str, "skill_id": str,
                   "difficulty": "L1"|"L2"|"L3", "stem": str,
                   "options": [str, str, str, str],
                   "correct_index": 0-3, "explanation": str } ] }
```

---

#### Prompt 2b — Validator Agent (adversarial pass)

The genuinely agentic component: a second model instance whose objective is to **defeat** the first.

```
SYSTEM:
You are an adversarial reviewer. Your goal is to find a defensible argument for
an option OTHER than the marked answer. You are rewarded for breaking questions.

For each question, return:
  single_answer_score: 1-5
    5 = exactly one defensible answer
    3 = one clearly best answer, one arguable alternative
    1 = two or more equally defensible answers
  difficulty_match: does the item genuinely require the stated tier? true|false
  breaking_argument: if score < 5, state the case for the alternative option.

Be harsh. A question that survives you is a question we can defend on stage.
```

Discard anything scoring <4 or failing `difficulty_match`; backfill from the over-generated bank. Costs ~5 seconds. Saves the demo.

**Additional guardrails:**

- **Position shuffle** — LLMs over-place correct answers at indices 1–2. Shuffle client-side and remap `correct_index`.
- **Cached fallback bank** — pre-generate and hand-verify ~40 items across the 10 most common skills. If live generation fails or times out, serve from cache silently. **The single highest-ROI 90 minutes of defensive engineering in the build.**
- **Temperature** — 0.7 for generation (variety), 0.0 for extraction and validation (consistency).

---

#### Prompt 3 — Career Planner Agent (three differentiated pathways)

```
SYSTEM:
You are a technical mentor building learning plans for a career switcher.
Produce THREE distinct pathways to the target role. Return only JSON.

PATHWAY DEFINITIONS — these must differ MEANINGFULLY, not cosmetically:
  SPRINT  — shortest time to employable. May target a bridge role rather than
            the final role. Breadth over depth. Minimum viable portfolio.
  DEEP    — strongest long-term ceiling. Foundations first (math, systems
            fundamentals). 2-3x longer. Portfolio-heavy.
  LATERAL — lowest disruption. Maximally leverages the candidate's existing
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
4. Honest hour estimates for a working professional at {{ weekly_hours }} hrs/week.
5. Explicitly leverage the candidate's verified strengths BY NAME in each
   rationale. This person is not starting from zero.
6. Do not recommend anything you are not confident exists.
7. If preferred_companies are given, bias resources toward their known stack
   ({{ typical_stack }}) where it does not compromise fundamentals.

USER:
Target role: {{ role_title }}   Required stack: {{ typical_stack }}
Verified strengths: {{ [skill, level] }}
Gaps: {{ [skill, current, required] }}
Domain: {{ domain }}   Preferred companies: {{ companies }}
Weekly availability: {{ weekly_hours }}

SCHEMA:
{ "pathways": [ { "type": "sprint"|"deep"|"lateral", "headline": str,
    "target_role": str, "trade_off": str,
    "phases": [ { "phase": 1-3, "title": str, "duration_weeks": int,
                  "target_gaps": [str],
                  "steps": [ {"resource": str, "why": str, "hours": int} ],
                  "portfolio_artifact": str,
                  "readiness_after": int } ],
    "total_hours": int, "estimated_months": float } ],
  "note": str|null }
```

Rule 6 is the hallucination guard. Rule 5 is the emotional payload. The differentiation requirement exists because the default failure mode of this prompt is three near-identical plans with different labels — which would visibly collapse the journey-map feature on stage.

---

### 7.4 Adaptive Ladder & Learner Profile

**Ladder (deterministic, client-side, no LLM):**

```
current_difficulty = L2                      # start Applied
for each skill in tested_skills:
    ask(skill, current_difficulty)
    if correct and current_difficulty < L3: current_difficulty += 1
    if wrong   and current_difficulty > L1: current_difficulty -= 1

verified_level(skill) =
    4  if L3 correct
    3  if L2 correct, L3 wrong or not reached
    2  if L1 correct, L2 wrong
    1  if L1 wrong

untested skills: verified_level = round(claimed_level × tier_weight × recency_decay)
```

**Learner Profile — session-only telemetry object (new in v0.2):**

```json
{
  "median_latency_by_tier": { "L1": 8.2, "L2": 19.4, "L3": 41.0 },
  "ladder_trajectory": "climbing",
  "confidence_delta": 0.34,
  "answer_changes": 2,
  "self_reported_weekly_hours": 8
}
```

`confidence_delta` = share of *fast* answers (below tier median latency) that were **wrong**. High delta indicates over-confidence — the same trait that produces résumé over-claiming, now measured directly. It's the most interesting number the product generates and it costs nothing to compute.

**Single downstream use — `pace_multiplier` (0.8 – 1.3):**

| Signal | Effect |
|---|---|
| Fast + accurate at L3 | ×0.85 — compress estimates |
| Climbing trajectory, moderate latency | ×1.0 — baseline |
| Oscillating, high latency at L2 | ×1.15 — expand estimates |
| High confidence_delta | ×1.25 — expand, and surface the honest note |

Applied to every hour estimate and every journey-map timeline.

**Discipline on the claim.** This is a *pace calibration heuristic derived from four minutes of in-session behavior*. It is not a learning-velocity model. The PRD, the UI copy, and the pitch all say the same thing: the profile is **instrumented and schema-ready for persistence**, and the cross-session learning loop is the v2 headline. Claiming a trained model here is the fastest way to lose a technically sharp judge.

---

### 7.5 Agent Architecture — and How We Describe It

**What we build:**

| Agent | Role | Genuinely agentic? |
|---|---|---|
| **Profile Agent** | Evidence-grounded skill extraction from unstructured text | Partially — schema-constrained extraction with self-imposed evidence rules |
| **Examiner Agent** | Generates leveled assessment items targeted by risk and preference | Partially — selection logic is deterministic, generation is model-driven |
| **Validator Agent** | Adversarially attacks the Examiner's output; forces regeneration | **Yes** — genuine adversarial loop with rejection and backfill |
| **Matching Engine** | Constraint filter + weighted gap arithmetic | **No — explicitly deterministic.** Call it an engine, never an agent |
| **Career Planner Agent** | Three differentiated pathways under hard constraints | Partially — constraint-satisfying generation with a differentiation check |
| **Calibrator** | Consumes Learner Profile telemetry, adjusts all time estimates | **No — heuristic function.** Named honestly |

**Shared state:** a single `session_context` object passed between stages. No inter-agent messaging, no dynamic tool selection, no autonomous replanning.

**Accuracy guardrail — the whole team says this same thing.** If a judge asks "is this really multi-agent?":

> *"Six specialized components, four LLM-driven. The genuinely agentic piece is the adversarial validator — it attacks the examiner's questions and forces regeneration, which is what makes the assessment defensible. The matcher and calibrator are deliberately deterministic because we want the career recommendation to be explainable, not a black box. Autonomous orchestration is on the roadmap; we didn't build it in 72 hours."*

That answer is stronger than an overclaim, and it holds up under a follow-up question. Overclaiming here fails badly and publicly — rehearse this line.

---

### 7.6 Suggested Architecture

```
Next.js (React + Tailwind + Recharts)   ← single deployable, Vercel
        │
        ├── /api/ingest      → pdfplumber/docx extract → Profile Agent
        ├── /api/quiz        → Examiner Agent → Validator Agent → shuffle
        ├── /api/match       → pure function: filter + score over roles.json
        └── /api/pathways    → Career Planner Agent → Calibrator
        │
   State: React context + sessionStorage.  NO DATABASE.
   Static: /data/roles.json, /data/taxonomy.json, /data/fallback_questions.json
```

**Deliberate omissions:** no database, no auth, no queue, no vector DB. Session-only is both a build-speed decision and a real privacy feature — say it on stage, especially given we now collect work-authorization data.

**Latency budget:** ingest ≤8s · preferences 0s · quiz generation ≤15s *(runs behind the skill-confirmation screen)* · match <100ms · pathways ≤12s. Total dead-wait under 22 seconds.

---

## 8. Success Metrics

### 8.1 Demo-Day Metrics — visible on a projector without narration

| Metric | Target | Where it shows |
|---|---|---|
| **Claim-correction rate** | ≥30% of claimed skills adjusted after quiz | Claimed-vs-verified chart. **The money shot.** |
| **Time to insight** | <5 minutes end-to-end | On-screen timer during the demo |
| **Constraint impact** | Eligible postings visibly < total postings | Constraint strip on the hero role card |
| **Two-track spread** | Stated Target readiness ≥25 points below Nearest Reachable | Module C — proves we don't just flatter the user |
| **Pathway divergence** | Sprint vs. Deep timeline differs by ≥2× | Journey map tab switch |
| **Pathway concreteness** | ≥6 named resources, ≥3 portfolio artifacts | Pathway module |
| **Corpus grounding** | "Matched against 200+ real postings" | Results header badge |
| **Validator rejection rate** | 15–35% of generated items discarded | Judge-facing stat — proves the quality gate is real, not decorative |

### 8.2 Product Metrics — post-hackathon plan (signals maturity)

- **Quiz completion rate** — target >80% (does the game framing work?)
- **Item discrimination** — do high scorers outperform low scorers per item? Negative discrimination → retire the item
- **Pathway selection distribution** — if >80% pick one pathway, the other two aren't differentiated enough
- **Preference completion rate** — how many users skip work authorization? High skip = the copy isn't earning trust
- **Week-1 activation** — % who start pathway step 1 within 7 days
- **Re-assessment lift** — verified level change at 90-day retake. **The only metric that proves the product works**, and the strongest possible closing line

### 8.3 Build Instrumentation

Log in-session to console/JSON: extraction count, generation latency per agent, validator rejection rate, per-question response time, pathway differentiation score. Enough to answer judge questions with numbers instead of adjectives.

---

## 9. 72-Hour Build Plan

Team of 4: **BE/AI dev**, **FE dev**, **designer**, **PM/demo lead**.

> **Schedule honesty:** v0.2 adds ~14 hours of P0 work and removes ~6 hours of previously-planned P1 (transcripts). Net pressure is **+8 hours**. Absorbed by demoting the hours slider to P1 and specifying a static journey-map fallback. **If hour 44 arrives with the journey map incomplete, ship the static SVG version and stop.**

### Pre-work (before the clock)

- Harvest + hand-curate `roles.json` (10–12 archetypes) **with location, remote, and sponsorship tags** — this is now the critical-path artifact
- Draft `taxonomy.json` (~60 canonical skills)
- Collect 5 test résumés spanning all three personas — including one requiring sponsorship
- Provision API keys, verify rate limits

### Hours 0–12 — Skeleton

- **PM:** lock scope; **write the demo script now**, not at hour 60
- **Design:** wireframe all 6 screens; build the results page first (judges look at it longest); design the journey map on paper before anyone codes it
- **BE:** upload → text extraction → Profile Agent working end-to-end in a terminal
- **FE:** Next.js scaffold, routing, upload component, preferences form
- ✅ **Gate @ 12:** a résumé PDF produces skills JSON; preferences form captures state

### Hours 12–28 — Core Loop

- **BE:** Examiner + Validator agents, fallback bank, shuffle; adaptive ladder with unit tests
- **FE:** skill confirmation UI, quiz screens with feedback animations
- **Design:** results visual system, chart styling, journey map spec handoff
- ✅ **Gate @ 28:** upload → preferences → skills → 12 adaptive questions → raw scores

### Hours 28–44 — Intelligence Layer

- **BE:** constraint-filtered matching, two-track results, Career Planner Agent, Calibrator
- **FE:** results dashboard, claimed-vs-verified chart, **journey map (static version first)**
- **PM:** run all 5 test résumés end to end; tune `roles.json` weights until output is sane for *all three* personas, especially the sponsorship-constrained one
- ✅ **Gate @ 44 — FEATURE FREEZE.** Anything not working now is cut, no discussion.

### Hours 44–60 — Polish & Harden

- Loading narration, error states, empty states, skipped-preference states
- Journey map animation + hours slider **only if everything above is green**
- Responsive pass (judges may open it on a phone)
- Deploy to production URL; **test on venue wifi**
- **Record a backup screen recording of a perfect run**

### Hours 60–72 — Pitch

- Slides: problem → insight → live demo → architecture → roadmap
- Rehearse the 3-minute pitch **5+ times, out loud, timed**
- Drill answers to the four questions you will definitely get:
  1. *"How do you know the quiz questions are good?"* → adversarial validator, rejection rate stat, hand-verified fallback bank, item-discrimination roadmap
  2. *"Is this really multi-agent?"* → §7.5 script, verbatim
  3. *"Isn't scraping LinkedIn against ToS?"* → open job APIs and public boards; archetypes are stable over quarters, so freshness isn't the bottleneck; structured sources are also what make sponsorship filtering possible
  4. *"Are you giving immigration advice?"* → no; we report posting language, nothing is stored, and the UI says so

---

## 10. Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Generated MCQs are ambiguous | **Critical** | Adversarial Validator; hand-verified fallback bank; rehearsed demo résumé |
| LLM API slow/down during demo | **Critical** | Cached fallback for every agent call; backup recording; fully pre-computed demo profile |
| **Three pathways look identical** | **High (new)** | Hard differentiation rule in Prompt 3 (<40% resource overlap); automated overlap check; if it fails, ship two pathways rather than three cosmetic ones |
| **Sponsorship signal read as legal advice** | **High (new)** | Present only as observed posting counts; explicit disclaimer copy; never phrase as eligibility |
| **Preferences perceived as biasing results** | **High (new)** | Two-track results make the separation visible; Nearest Reachable is computed from evidence alone and shown first |
| Résumé parse fails on judge's file | High | Text-paste always available; explicit failure UI; never pass empty text to the LLM |
| Recommendation feels generic | High | Evidence-snippet grounding; "Why this role?" panel quoting the user's own résumé |
| Domain Translator gets a demoralizing result | High | ≥4 low-barrier roles in corpus; transferable-skill bonus; Lateral pathway exists precisely for them |
| **Learner Profile overclaimed as ML** | Medium (new) | §7.4 discipline; UI copy says "calibration"; roadmap framing in the pitch |
| Scope creep | High | Hour-36 tripwire; hour-44 hard freeze; P2 list is a slide, not a backlog |
| Quiz feels like a test, not a game | Medium | Immediate feedback, streaks, micro-animations, no mid-quiz score, 12 questions max |
| Journey map eats the schedule | Medium | Static SVG fallback specified up front; animation and slider are P1 |

---

## 11. Open Questions

1. **Quiz length:** is 12 questions enough to verify 7 skills credibly? *Proposed: 12 for MVP; measure item discrimination post-hackathon.*
2. **Stated Target floor:** should we show a target the user can't reach in <3 years at all? *Proposed: yes, with the bridge-role redirect — hiding it feels evasive and the redirect is the useful part.*
3. **Sponsorship default when unstated:** treat `unstated` postings as open or closed? *Proposed: open, but excluded from the "confirmed open to you" count. Under-promising here is the safer error.*
4. **Level 4 ceiling:** can an MCQ verify expert level at all? *Proposed: cap at L3 for MVP — L4 requires artifacts, not multiple choice, and claiming otherwise undermines the credibility story.*
5. **Preferred-company data:** we have no per-company hiring bar. *Proposed: use `typical_stack` from the corpus for resource alignment only; defer the "vs. their bar" view to P1.*
6. **Salary provenance:** *Proposed: show with explicit "based on 200 postings, US, 2025" caveat. Unattributed salary numbers invite exactly the wrong judge question.*

---

## 12. Appendix — 3-Minute Pitch Structure

| Time | Beat |
|---|---|
| 0:00–0:25 | **Problem.** "Every career tool trusts your résumé. Résumés lie — not maliciously; everyone overestimates depth. So the advice is calibrated to a person who doesn't exist." |
| 0:25–0:45 | **Insight.** The Evidence Ladder: asserted → evidenced → verified. Plus: eligibility is a constraint, not a footnote. |
| 0:45–2:20 | **Live demo.** Upload → preferences (make the sponsorship filter visible) → skills → quiz (**answer one wrong on purpose**) → land hard on the claimed-vs-verified chart → toggle the three pathways on the journey map. |
| 2:20–2:40 | **Architecture.** "Six components. The one that matters is the adversarial validator — it attacks our own questions and throws out roughly a quarter of them. The matcher is deliberately deterministic, because a career recommendation should be explainable." |
| 2:40–3:00 | **Roadmap + close.** "We instrument a learner profile but don't persist it. The v2 loop is re-assessment at 90 days — because the only metric that matters is whether people actually level up, and we want to prove it." |

**Demo résumé requirements:** produces a visible over-claim (e.g. "Advanced Statistics" verifying at L2), *and* names an aspirational preferred role well above reach, *and* triggers a real sponsorship filter. Three visible corrections in one run. The corrections **are** the pitch.
