"use client";

import { useState } from "react";
import type { Preferences, SponsorshipStatus } from "@/lib/types";
import { DEFAULT_PREFERENCES } from "@/lib/types";
import { Icon } from "./Sprite";

const AUTH_OPTIONS: { value: SponsorshipStatus; label: string }[] = [
  { value: "citizen_or_pr", label: "Citizen or permanent resident" },
  { value: "need_sponsorship", label: "Need sponsorship" },
  { value: "student_or_opt", label: "Student visa or OPT" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

/**
 * Screen 3. Placed after ingestion deliberately (PRD §5): asking about work
 * authorization before delivering any value is a drop-off cliff.
 */
export function PreferencesScreen({
  metros,
  roles,
  initial,
  onDone,
}: {
  metros: { id: string; label: string }[];
  roles: { role_id: string; title: string }[];
  initial?: Preferences | null;
  onDone: (p: Preferences) => void;
}) {
  const [prefs, setPrefs] = useState<Preferences>(initial ?? DEFAULT_PREFERENCES);
  const [placeText, setPlaceText] = useState(() =>
    (initial?.locations ?? [])
      .map((id) => metros.find((m) => m.id === id)?.label ?? id)
      .join(", "),
  );
  const [companyText, setCompanyText] = useState(
    (initial?.preferred_companies ?? []).join(", "),
  );

  function set<K extends keyof Preferences>(k: K, v: Preferences[K]) {
    setPrefs((p) => ({ ...p, [k]: v }));
  }

  /** Free text in, canonical metro ids out. Unmatched text is simply ignored. */
  function resolvePlaces(raw: string): string[] {
    return raw
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .map((t) => metros.find((m) => m.label.toLowerCase().includes(t) || m.id === t)?.id)
      .filter((id): id is string => Boolean(id))
      .slice(0, 3);
  }

  function toggleRole(title: string) {
    const has = prefs.preferred_roles.includes(title);
    if (has) set("preferred_roles", prefs.preferred_roles.filter((r) => r !== title));
    else if (prefs.preferred_roles.length < 3)
      set("preferred_roles", [...prefs.preferred_roles, title]);
  }

  function commit() {
    onDone({
      ...prefs,
      locations: resolvePlaces(placeText),
      preferred_companies: companyText
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
        .slice(0, 5),
    });
  }

  return (
    <section style={{ marginTop: 30 }}>
      <div className="eyebrow">
        <Icon name="filter" />
        Constraints
      </div>
      <h2>
        What has to be true
        <br />
        about the job?
      </h2>
      <p className="muted" style={{ marginTop: 14, maxWidth: 520 }}>
        These are filters, not preferences. They change which roles exist for you.
      </p>

      <div className="card" style={{ marginTop: 24, display: "grid", gap: 24 }}>
        <div>
          <label className="flabel" htmlFor="place">
            Where you&apos;d work
          </label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              id="place"
              className="field"
              list="metro-list"
              style={{ flex: "1 1 220px" }}
              value={placeText}
              onChange={(e) => setPlaceText(e.target.value)}
              placeholder="Portland, OR"
            />
            <datalist id="metro-list">
              {metros.map((m) => (
                <option key={m.id} value={m.label} />
              ))}
            </datalist>
            <button
              className={`chip ${prefs.remote_only ? "sel" : ""}`}
              onClick={() => set("remote_only", !prefs.remote_only)}
              aria-pressed={prefs.remote_only}
            >
              Remote too
            </button>
          </div>
        </div>

        <div>
          <label className="flabel" htmlFor="auth">
            Work authorization
          </label>
          <select
            id="auth"
            className="field"
            value={prefs.sponsorship}
            onChange={(e) => set("sponsorship", e.target.value as SponsorshipStatus)}
          >
            {AUTH_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className="flabel">Roles you&apos;re aiming for</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {roles.map((r) => (
              <button
                key={r.role_id}
                className={`chip ${prefs.preferred_roles.includes(r.title) ? "sel" : ""}`}
                onClick={() => toggleRole(r.title)}
                aria-pressed={prefs.preferred_roles.includes(r.title)}
              >
                {r.title}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="flabel" htmlFor="cos">
            Companies on your list <span style={{ textTransform: "none" }}>(optional)</span>
          </label>
          <input
            id="cos"
            className="field"
            value={companyText}
            onChange={(e) => setCompanyText(e.target.value)}
            placeholder="Anthropic, Stripe, OHSU"
          />
        </div>
      </div>

      {/* Verbatim, legally load-bearing. Do not shorten for layout. */}
      <div
        style={{
          borderLeft: "5px solid var(--volt)",
          background: "var(--white)",
          padding: "14px 16px",
          fontSize: 13.5,
          marginTop: 20,
        }}
      >
        This stays in your browser. We don&apos;t store it, and we don&apos;t give immigration
        advice — we just show you what the job postings say.
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 26 }}>
        <button className="btn go" onClick={commit}>
          Continue
          <Icon name="arrow" />
        </button>
        <button className="linkish" onClick={() => onDone(DEFAULT_PREFERENCES)}>
          Skip
        </button>
      </div>
    </section>
  );
}
