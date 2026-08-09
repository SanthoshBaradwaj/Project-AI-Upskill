import { AgentUnavailable, callJSON } from "../anthropic";
import { TAXONOMY, skill as lookupSkill } from "../data";
import type { ExtractedSkill, Profile, SkillCategory } from "../types";

/**
 * Prompt 1 — Profile Agent (skill extraction), PRD §7.3.
 *
 * Rules 4-5 do the heavy lifting. Without them the model reliably fabricates a
 * full stack from a job title. Rule 6 replaces the transcript corroboration
 * signal that v0.1 relied on.
 */

const SYSTEM = `You are a technical recruiter specializing in career transitions into AI.
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
4. Every skill MUST include a verbatim evidence_snippet copied exactly from the
   document. If you cannot quote evidence, do not emit the skill.
5. Do NOT infer skills from job titles alone. A "Data Analyst" title is not
   evidence of Python.
6. evidence_tier: "asserted" if the snippet is a list item or title;
   "evidenced" if it describes work performed.
7. years_since_last_use: infer from role dates, relative to the current year.
   null if undeterminable.
8. Maximum 15 skills, prioritized by prominence and recency.`;

const SCHEMA = {
  type: "object",
  properties: {
    skills: {
      type: "array",
      items: {
        type: "object",
        properties: {
          skill_id: { type: "string" },
          display_name: { type: "string" },
          category: { type: "string", enum: ["technical", "transferable"] },
          claimed_level: { type: "integer", enum: [1, 2, 3, 4] },
          evidence_snippet: { type: "string" },
          evidence_tier: { type: "string", enum: ["asserted", "evidenced"] },
          years_since_last_use: {
            anyOf: [{ type: "integer" }, { type: "null" }],
          },
        },
        required: [
          "skill_id",
          "display_name",
          "category",
          "claimed_level",
          "evidence_snippet",
          "evidence_tier",
          "years_since_last_use",
        ],
        additionalProperties: false,
      },
    },
    inferred_domain: { type: "string" },
  },
  required: ["skills", "inferred_domain"],
  additionalProperties: false,
} as const;

function taxonomyList(): string {
  return TAXONOMY.map((s) => `${s.skill_id} (${s.display_name}, ${s.category})`).join("\n");
}

/**
 * Drop anything outside the canonical taxonomy and anything without a snippet
 * that actually appears in the source. Rule 4 is only worth stating if we also
 * enforce it — a "verbatim" quote the model invented is the exact failure the
 * evidence ladder exists to prevent.
 */
export function sanitiseSkills(raw: ExtractedSkill[], sourceText: string): ExtractedSkill[] {
  const haystack = sourceText.toLowerCase().replace(/\s+/g, " ");
  const seen = new Set<string>();
  const out: ExtractedSkill[] = [];

  for (const s of raw) {
    const canonical = lookupSkill(s.skill_id);
    if (!canonical) continue;
    if (seen.has(s.skill_id)) continue;

    const snippet = (s.evidence_snippet ?? "").trim();
    if (snippet.length < 3) continue;

    const needle = snippet.toLowerCase().replace(/\s+/g, " ");
    // Allow a near-match: models sometimes normalise whitespace or trim a
    // trailing period. A snippet that shares no substantial run with the source
    // is treated as fabricated and dropped.
    const anchor = needle.slice(0, Math.min(40, needle.length));
    if (!haystack.includes(anchor)) continue;

    seen.add(s.skill_id);
    out.push({
      skill_id: canonical.skill_id,
      display_name: canonical.display_name,
      category: canonical.category as SkillCategory,
      claimed_level: Math.min(4, Math.max(1, Math.round(s.claimed_level))),
      evidence_snippet: snippet,
      evidence_tier: s.evidence_tier === "evidenced" ? "evidenced" : "asserted",
      years_since_last_use:
        typeof s.years_since_last_use === "number" && s.years_since_last_use >= 0
          ? Math.round(s.years_since_last_use)
          : null,
    });
  }

  return out.slice(0, 15);
}

export async function runProfileAgent(resumeText: string): Promise<Profile> {
  const result = await callJSON<Profile>({
    system: `${SYSTEM}\n\nCANONICAL_TAXONOMY:\n${taxonomyList()}\n\nThe current year is ${new Date().getFullYear()}.`,
    user: `<document>\n${resumeText}\n</document>`,
    schema: SCHEMA as unknown as Record<string, unknown>,
    effort: "medium",
    maxTokens: 8000,
    timeoutMs: 20_000,
  });

  const skills = sanitiseSkills(result.skills ?? [], resumeText);
  if (skills.length === 0) throw new AgentUnavailable("extraction produced no grounded skills");

  return { skills, inferred_domain: result.inferred_domain || "general" };
}

/**
 * Deterministic fallback extractor — no LLM.
 *
 * Used when the key is missing or the agent times out. It is deliberately
 * conservative: it only emits a skill when the skill's own name appears in the
 * text, and it quotes the sentence it found. Lower recall than the agent, but it
 * cannot hallucinate, and it keeps the flow completing at reduced confidence.
 */
const ALIASES: Record<string, string[]> = {
  python: ["python"],
  sql: ["sql", "postgres", "mysql", "bigquery", "snowflake"],
  r_programming: ["r programming", " r,", " r "],
  excel_modeling: ["excel", "spreadsheet"],
  statistics: ["statistic", "statistical", "regression", "hypothesis test"],
  probability: ["probability", "bayesian"],
  linear_algebra: ["linear algebra", "matrix algebra"],
  calculus: ["calculus"],
  machine_learning: ["machine learning", "ml model", "predictive model", "scikit"],
  deep_learning: ["deep learning", "neural network", "pytorch", "tensorflow"],
  nlp: ["nlp", "natural language processing"],
  computer_vision: ["computer vision", "image classification"],
  llm_application_dev: ["llm", "large language model", "gpt", "claude"],
  prompt_engineering: ["prompt engineering", "prompting"],
  rag_systems: ["retrieval augmented", "rag pipeline", "vector database"],
  model_evaluation: ["model evaluation", "model validation", "backtest"],
  feature_engineering: ["feature engineering"],
  data_wrangling: ["data cleaning", "data wrangling", "etl"],
  data_visualization: ["data visualization", "data visualisation", "dashboard", "charts"],
  bi_tooling: ["tableau", "power bi", "looker", "qlik"],
  data_modeling: ["data model", "star schema", "dimensional model"],
  dbt: ["dbt"],
  etl_pipelines: ["etl", "elt", "data pipeline"],
  data_orchestration: ["airflow", "dagster", "prefect"],
  distributed_data: ["spark", "hadoop", "databricks"],
  data_warehousing: ["data warehouse", "warehousing"],
  software_engineering: ["software engineering", "software development", "refactor"],
  version_control: ["git", "github", "version control"],
  testing_practice: ["unit test", "automated test", "pytest"],
  api_development: ["rest api", "api development", "endpoint"],
  cloud_deployment: ["aws", "azure", "gcp", "cloud"],
  containerization: ["docker", "container"],
  mlops: ["mlops", "model deployment"],
  model_monitoring: ["model monitoring", "drift detection"],
  ci_cd: ["ci/cd", "continuous integration"],
  system_design: ["system design", "architecture"],
  ai_safety_evaluation: ["red team", "ai safety"],
  ai_governance: ["ai governance", "responsible ai"],
  privacy_compliance: ["gdpr", "hipaa", "privacy compliance", "ccpa"],
  conversation_design: ["conversation design", "chatbot design"],
  information_architecture: ["information architecture"],
  technical_writing: ["technical writing", "documentation"],
  experimental_design: ["a/b test", "ab test", "experiment design", "experimental design"],
  causal_reasoning: ["causal", "causal inference"],
  critical_analysis: ["critical analysis", "root cause"],
  structured_decomposition: ["decompos", "structured problem"],
  algorithmic_intuition: ["algorithm"],
  systems_thinking: ["systems thinking", "end-to-end"],
  stakeholder_communication: ["stakeholder", "presented to", "executive"],
  requirements_elicitation: ["requirements gathering", "requirements elicitation"],
  project_management: ["project management", "project manager", "scrum", "agile"],
  roadmapping: ["roadmap", "prioritis", "prioritiz"],
  cross_functional_leadership: ["cross-functional", "cross functional", "led a team"],
  user_research: ["user research", "user interview"],
  domain_expertise: ["domain expert", "subject matter expert"],
  regulatory_literacy: ["regulatory", "compliance"],
  teaching_mentoring: ["mentor", "trained", "taught"],
  written_communication: ["wrote", "authored", "writing"],
  quantitative_reporting: ["reporting", "kpi", "metrics report"],
  vendor_evaluation: ["vendor", "tool evaluation"],
  process_improvement: ["process improvement", "streamlin"],
  risk_assessment: ["risk assessment", "risk analysis"],
};

/** Past-tense verbs that mark a line as describing work rather than listing a skill. */
const WORK_VERB =
  /\b(built|building|led|leading|owned|designed|developed|analy[sz]ed|implemented|managed|created|delivered|ran|running|automated|migrated|presented|produced|launched|shipped|maintained|reduced|improved|increased|reported|partnered|coordinated|architected|refactored|deployed|trained|taught|authored|wrote|published|defined|established|streamlined|scaled|integrated|configured|debugged|optimi[sz]ed)\b/i;

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function fallbackExtract(resumeText: string): Profile {
  const lower = resumeText.toLowerCase();
  const lines = sentences(resumeText);
  const skills: ExtractedSkill[] = [];

  for (const [skillId, needles] of Object.entries(ALIASES)) {
    const canonical = lookupSkill(skillId);
    if (!canonical) continue;

    if (!needles.some((n) => lower.includes(n))) continue;

    // A skill often appears twice: once in a bare SKILLS list and once in a
    // bullet describing what the person did with it. Collect every line matching
    // *any* alias, then prefer the bullet — it is the stronger evidence, and
    // quoting it is what makes the tier defensible.
    const matches = lines.filter((l) => {
      const lowered = l.toLowerCase();
      return needles.some((n) => lowered.includes(n));
    });
    const line = matches.find((l) => WORK_VERB.test(l)) ?? matches[0];
    if (!line) continue;

    // Tier is decided by whether the line describes *work performed*, not by
    // how it is punctuated. A leading "-" is bullet formatting; the bullets are
    // usually where the real evidence lives. A comma-run of skill names with no
    // verb in it is the assertion case.
    const describesWork = WORK_VERB.test(line);
    const tier: ExtractedSkill["evidence_tier"] = describesWork ? "evidenced" : "asserted";

    skills.push({
      skill_id: canonical.skill_id,
      display_name: canonical.display_name,
      category: canonical.category as SkillCategory,
      claimed_level: tier === "evidenced" ? 3 : 1,
      evidence_snippet: line.slice(0, 240),
      evidence_tier: tier,
      years_since_last_use: null,
    });
  }

  skills.sort((a, b) => b.claimed_level - a.claimed_level);

  return {
    skills: skills.slice(0, 15),
    inferred_domain: "general",
  };
}
