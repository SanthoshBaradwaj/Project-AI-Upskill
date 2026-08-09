"use client";

import { useEffect, useMemo, useState } from "react";
import { overClaimRisk } from "@/lib/evidence";
import type { ExtractedSkill, QuizBank, SkillCategory } from "@/lib/types";
import { Icon } from "./Sprite";

type TaxonomyEntry = { skill_id: string; display_name: string; category: SkillCategory };

/**
 * Screen 4 — the trust gate. Chips are outlined, never filled: nothing is proven
 * at this stage of the flow, and gold is reserved for what the user earns.
 *
 * This screen also exists to hide quiz generation behind user activity.
 */
export function SkillConfirm({
  skills,
  taxonomy,
  quiz,
  onContinue,
}: {
  skills: ExtractedSkill[];
  taxonomy: TaxonomyEntry[];
  quiz: QuizBank | null;
  onContinue: (skills: ExtractedSkill[]) => void;
}) {
  const [all, setAll] = useState<ExtractedSkill[]>(skills);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(skills[0]?.skill_id ?? null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [genLabel, setGenLabel] = useState("Writing your questions…");

  // Surface the validator rejection rate as ambient proof once generation lands.
  useEffect(() => {
    if (!quiz) return;
    const s = quiz.stats;
    setGenLabel(
      s.generated > 0
        ? `${s.generated} written · ${s.rejected_by_validator} discarded · ready`
        : `${quiz.pool.length} verified questions · ready`,
    );
  }, [quiz]);

  const kept = all.filter((s) => !removed.has(s.skill_id));
  const added = all.filter((s) => s.user_added).length;
  const technical = all.filter((s) => s.category === "technical");
  const transferable = all.filter((s) => s.category === "transferable");
  const active = all.find((s) => s.skill_id === open) ?? null;

  const options = useMemo(
    () => taxonomy.filter((t) => !all.some((s) => s.skill_id === t.skill_id)),
    [taxonomy, all],
  );

  function toggle(id: string) {
    setRemoved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function add() {
    const match = options.find(
      (o) => o.display_name.toLowerCase() === draft.trim().toLowerCase(),
    );
    if (!match || added >= 3) return;
    setAll((c) => [
      ...c,
      {
        skill_id: match.skill_id,
        display_name: match.display_name,
        category: match.category,
        claimed_level: 2,
        evidence_snippet: "Added by you on this screen.",
        evidence_tier: "asserted",
        years_since_last_use: 0,
        user_added: true,
      },
    ]);
    setDraft("");
    setAdding(false);
  }

  function Group({ title, items }: { title: string; items: ExtractedSkill[] }) {
    if (items.length === 0) return null;
    return (
      <div>
        <div className="mono muted" style={{ marginBottom: 11 }}>
          {title}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {items.map((s) => (
            <span
              key={s.skill_id}
              className={`chip ${removed.has(s.skill_id) ? "gone" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => setOpen(s.skill_id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpen(s.skill_id);
                }
              }}
            >
              {s.display_name}
              <span className="lvl">L{s.claimed_level}</span>
              <span
                className="x"
                role="button"
                tabIndex={0}
                aria-label={`Remove ${s.display_name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(s.skill_id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    toggle(s.skill_id);
                  }
                }}
              >
                ×
              </span>
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section style={{ marginTop: 30 }}>
      <div className="eyebrow">
        <Icon name="check" />
        Trust gate
      </div>
      <h2>Did we read you right?</h2>
      <p className="muted" style={{ marginTop: 14, maxWidth: 540 }}>
        Every skill is anchored to a line you actually wrote. Tap one to see the quote.
        Remove anything we got wrong.
      </p>

      <div className="card" style={{ marginTop: 24, display: "grid", gap: 26 }}>
        <Group title="Technical" items={technical} />
        <Group title="Transferable" items={transferable} />

        <div>
          {adding ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                className="field"
                style={{ flex: "1 1 220px" }}
                list="add-skill-list"
                value={draft}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    add();
                  }
                }}
                placeholder="Start typing a skill…"
              />
              <datalist id="add-skill-list">
                {options.map((o) => (
                  <option key={o.skill_id} value={o.display_name} />
                ))}
              </datalist>
              <button className="btn ghost" onClick={add} disabled={!draft.trim()}>
                Add
              </button>
            </div>
          ) : (
            <button className="btn ghost" onClick={() => setAdding(true)} disabled={added >= 3}>
              + Add a skill{added > 0 ? ` · ${added}/3` : ""}
            </button>
          )}
        </div>
      </div>

      {active ? (
        <div
          style={{
            borderLeft: "5px solid var(--gold)",
            background: "var(--paper)",
            padding: "16px 18px",
            marginTop: 20,
          }}
        >
          <div className="mono muted" style={{ marginBottom: 8 }}>
            {active.display_name} · {active.evidence_tier === "evidenced" ? "Evidenced" : "Asserted"} ·
            claimed L{active.claimed_level}
          </div>
          <p style={{ fontSize: 14.5, lineHeight: 1.6 }}>&ldquo;{active.evidence_snippet}&rdquo;</p>
          {overClaimRisk(active) >= 0.45 ? (
            <div
              className="mono"
              style={{ color: "var(--rose)", marginTop: 10, letterSpacing: "0.08em" }}
            >
              Flagged — tested first
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          marginTop: 26,
          flexWrap: "wrap",
        }}
      >
        <button
          className="btn go"
          disabled={kept.length === 0}
          onClick={() => onContinue(kept)}
        >
          Looks right — test me
          <Icon name="arrow" />
        </button>
        <div className="bggen">
          {!quiz ? <span className="pulse" /> : null}
          <span>{genLabel}</span>
        </div>
      </div>
    </section>
  );
}
