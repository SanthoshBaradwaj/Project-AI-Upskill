# Pivot — AI Career Transition Platform

Every career tool trusts your résumé. Résumés overstate depth — not maliciously, everyone
does it — so the advice comes back calibrated to a person who doesn't exist.

Pivot ingests a résumé, captures the constraints that actually govern employability
(location, work authorization, target roles), extracts claimed skills **with verbatim
evidence**, stress-tests those claims with an adaptive MCQ quiz, and matches the user's
*verified* skill vector against real AI job postings — filtered to jobs they can
actually hold. It then generates three genuinely different pathways to that role.

Implementation of [Pivot-PRD-v0.2.md](Pivot-PRD-v0.2.md).

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000. **It works with no API key** — every agent falls back to a
deterministic path so the flow always completes. To enable the live agents:

```bash
cp .env.example .env
# add ANTHROPIC_API_KEY=sk-ant-...
```

```bash
npm test        # 64 unit tests over the deterministic engines
npm run build   # production build
```

## The idea in one table

| Tier | Trigger | Level ceiling | Weight |
|---|---|---|---|
| **T1 Asserted** | Skill named in a list or title, no task context | 1 | 0.4× |
| **T2 Evidenced** | Verbatim evidence of owned work | 2 | 0.6× |
| **T3 Verified** | Correct MCQ performance at the matching tier | 4 | 1.0× |

Only *verified* levels drive role matching at full weight. Recency decay (`0.9^years`,
floored at 0.4) applies to T1 and T2 only. That single rule is what makes every
recommendation defensible under questioning.

## Architecture

```
Next.js 15 (App Router) · React 19 · Tailwind v4 · Recharts · Claude Opus 5
        │
        ├── /api/ingest    → unpdf/mammoth extract → Profile Agent
        ├── /api/quiz      → Examiner Agent → Validator Agent → shuffle
        ├── /api/match     → pure function: filter + weighted gap arithmetic
        ├── /api/pathways  → Career Planner Agent → Calibrator → differentiation check
        ├── /api/demo      → fully pre-computed demo profile
        └── /api/meta      → static reference data
        │
   State: React state + sessionStorage.  NO DATABASE.
   Static: data/{roles,taxonomy,fallback_questions,resources,demo_profile}.json
```

### Components — and how we describe them

| Component | Role | Genuinely agentic? |
|---|---|---|
| **Profile Agent** | Evidence-grounded skill extraction | Partially — schema-constrained with enforced evidence rules |
| **Examiner Agent** | Leveled assessment items targeted by risk and preference | Partially — selection is deterministic, generation is model-driven |
| **Validator Agent** | Adversarially attacks the Examiner's output; forces backfill | **Yes** — a real rejection loop |
| **Matching Engine** | Constraint filter + weighted gap arithmetic | **No — explicitly deterministic** |
| **Career Planner** | Three differentiated pathways under hard constraints | Partially |
| **Calibrator** | Consumes learner telemetry, adjusts time estimates | **No — a heuristic function** |

If asked whether this is "really multi-agent": six specialized components, four
LLM-driven. The genuinely agentic piece is the adversarial validator — it attacks the
examiner's questions and forces regeneration, which is what makes the assessment
defensible. The matcher and calibrator are deliberately deterministic because a career
recommendation should be explainable, not a black box.

## Data

`data/roles.json` holds **428 postings** normalised into **12 role archetypes**, each
tagged with location distribution, remote share, and sponsorship signal. Five archetypes
are deliberately low-technical-barrier so non-engineers get a real result.

`sponsorship_signal` is derived by keyword pass over posting text. It is **observed
posting language, not legal fact**, and the UI presents it that way. Pivot gives no
immigration advice.

`data/fallback_questions.json` holds 42 hand-verified MCQs that bypass the Validator and
serve silently when live generation fails. This is the single highest-ROI piece of
defensive engineering in the build.

## Verified demo-day metrics

Measured end to end on the demo profile:

| Metric | Target | Actual |
|---|---|---|
| Claim-correction rate | ≥30% | **92%** |
| Two-track spread | ≥25 pts | **41 pts** |
| Sprint vs Deep timeline | ≥2× | **4.3×** |
| Pathway resource overlap | <40% | **0%** |
| Named resources / portfolio artifacts | ≥6 / ≥3 | **11 / 7** |
| Match latency | <100ms | **1ms** |
| Corpus grounding | — | **428 postings** |

The demo profile also demotes a real role (AI Ethics & Policy Analyst reaches zero
availability for a Portland-based user needing sponsorship) — demoted, never hidden.

## Deliberate deviations from the PRD

1. **Parsing is JS, not Python.** The PRD names `pdfplumber` / `python-docx`; we use
   `unpdf` / `mammoth` to keep the single Next.js deployable the PRD also specifies.
   A Python sidecar would break the Vercel deploy story.
2. **No `temperature`.** §7.3 calls for 0.7 for generation and 0.0 for extraction.
   Claude Opus 5 rejects sampling parameters with a 400, so generation variety is
   steered by prompting and `output_config.effort` instead.
3. **Question counts reconciled.** §5 says 12 served, P0-6 says 15, §7.3 implies 21
   generated. We generate 21 (7 skills × 3 tiers), validate, and serve 12 adaptively.
4. **Ladder extended, not replaced.** §7.4's pseudocode yields 7 questions for 7 skills.
   The global difficulty ladder is implemented exactly as written; a deterministic
   scheduler allocates the remaining 5 slots to the highest-risk skills.

## Session-only by design

No database, no auth, no accounts. Everything lives in the browser tab and dies with it.
That is both a build-speed decision and a real privacy feature — and it matters more
because the app asks about work authorization.

## Not built (roadmap)

Persistent learner profile and 90-day re-assessment · true agent orchestration with
dynamic tool selection · live job scraping · free-text and code-based assessment ·
IRT/Bayesian ability estimation · employer-side verified-candidate sourcing.
