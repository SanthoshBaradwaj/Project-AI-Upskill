"use client";

import { useMemo, useState } from "react";
import type { ExtractedSkill, SkillCategory } from "@/lib/types";
import { Button, Card, Notice, Pill } from "./ui";

type TaxonomyEntry = { skill_id: string; display_name: string; category: SkillCategory };

const TIER_COPY: Record<ExtractedSkill["evidence_tier"], { label: string; tone: string }> = {
  evidenced: { label: "Evidenced", tone: "text-verified border-verified/40 bg-verified/10" },
  asserted: { label: "Listed only", tone: "text-warn border-warn/40 bg-warn/10" },
};

function SkillChip({
  skill,
  onRemove,
}: {
  skill: ExtractedSkill;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const tier = TIER_COPY[skill.evidence_tier];

  return (
    <div className="rounded-lg border border-line bg-ink-3 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-chalk">{skill.display_name}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${tier.tone}`}>
              {tier.label}
            </span>
            <span className="text-[10px] text-fog">
              claims level {skill.claimed_level}
            </span>
            {skill.years_since_last_use !== null && skill.years_since_last_use > 2 ? (
              <span className="text-[10px] text-warn">
                last used ~{skill.years_since_last_use}y ago
              </span>
            ) : null}
          </div>
        </div>
        <button
          onClick={onRemove}
          aria-label={`Remove ${skill.display_name}`}
          className="shrink-0 rounded px-1.5 py-0.5 text-fog transition-colors hover:bg-hot/15 hover:text-hot"
        >
          ✕
        </button>
      </div>

      {skill.evidence_snippet ? (
        <>
          <button
            onClick={() => setOpen((o) => !o)}
            className="mt-2 text-[11px] text-brand hover:underline"
          >
            {open ? "Hide evidence" : "Show evidence"}
          </button>
          {open ? (
            <p className="mt-2 border-l-2 border-line pl-3 text-[11px] italic leading-relaxed text-fog">
              &ldquo;{skill.evidence_snippet}&rdquo;
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function SkillConfirm({
  skills,
  taxonomy,
  quizReady,
  degraded,
  onContinue,
}: {
  skills: ExtractedSkill[];
  taxonomy: TaxonomyEntry[];
  quizReady: boolean;
  degraded: boolean;
  onContinue: (skills: ExtractedSkill[]) => void;
}) {
  const [current, setCurrent] = useState<ExtractedSkill[]>(skills);
  const [draft, setDraft] = useState("");

  const added = current.filter((s) => s.user_added).length;
  const technical = current.filter((s) => s.category === "technical");
  const transferable = current.filter((s) => s.category === "transferable");

  const options = useMemo(
    () => taxonomy.filter((t) => !current.some((c) => c.skill_id === t.skill_id)),
    [taxonomy, current],
  );

  function addSkill() {
    const match = options.find(
      (o) => o.display_name.toLowerCase() === draft.trim().toLowerCase(),
    );
    if (!match || added >= 3) return;
    setCurrent((c) => [
      ...c,
      {
        skill_id: match.skill_id,
        display_name: match.display_name,
        category: match.category,
        claimed_level: 2,
        evidence_snippet: "Added by you on the confirmation screen.",
        evidence_tier: "asserted",
        years_since_last_use: 0,
        user_added: true,
      },
    ]);
    setDraft("");
  }

  return (
    <div className="rise space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Did we read that right?</h2>
        <p className="mt-1.5 text-sm text-fog">
          Every skill below is anchored to something you actually wrote — hover the evidence to see
          the line it came from. Remove anything we got wrong.
        </p>
      </div>

      {degraded ? (
        <Notice tone="warn">
          We read your document with our offline extractor rather than the full model, so the skill
          list is more conservative than usual. Add anything obvious that&apos;s missing.
        </Notice>
      ) : null}

      {technical.length > 0 ? (
        <Card>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-fog">
            Technical · {technical.length}
          </h3>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {technical.map((s) => (
              <SkillChip
                key={s.skill_id}
                skill={s}
                onRemove={() => setCurrent((c) => c.filter((x) => x.skill_id !== s.skill_id))}
              />
            ))}
          </div>
        </Card>
      ) : null}

      {transferable.length > 0 ? (
        <Card>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-fog">
            Transferable · {transferable.length}
          </h3>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {transferable.map((s) => (
              <SkillChip
                key={s.skill_id}
                skill={s}
                onRemove={() => setCurrent((c) => c.filter((x) => x.skill_id !== s.skill_id))}
              />
            ))}
          </div>
        </Card>
      ) : null}

      <Card tone="muted">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fog">
          Anything missing? Add up to 3 · {added}/3 used
        </h3>
        <div className="flex gap-2">
          <input
            list="taxonomy-options"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSkill();
              }
            }}
            disabled={added >= 3}
            placeholder="Start typing a skill…"
            className="flex-1 rounded-lg border border-line bg-ink px-4 py-2.5 text-sm text-chalk outline-none placeholder:text-fog/50 focus:border-brand disabled:opacity-40"
          />
          <datalist id="taxonomy-options">
            {options.map((o) => (
              <option key={o.skill_id} value={o.display_name} />
            ))}
          </datalist>
          <Button variant="ghost" onClick={addSkill} disabled={added >= 3 || !draft.trim()}>
            Add
          </Button>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => onContinue(current)} disabled={current.length === 0}>
          {quizReady ? "Start the reality check →" : "Preparing your questions…"}
        </Button>
        <span className="text-xs text-fog">
          {quizReady ? (
            <>
              <span className="text-verified">●</span> 12 questions ready
            </>
          ) : (
            <span className="pulse-soft">Writing questions targeted at your claims…</span>
          )}
        </span>
      </div>
    </div>
  );
}
