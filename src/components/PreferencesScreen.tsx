"use client";

import { useState } from "react";
import type { Preferences, SponsorshipStatus } from "@/lib/types";
import { DEFAULT_PREFERENCES } from "@/lib/types";
import { Button, Card, Label, Notice, Pill } from "./ui";

const SPONSORSHIP_OPTIONS: { value: SponsorshipStatus; label: string }[] = [
  { value: "citizen_or_pr", label: "Citizen or permanent resident" },
  { value: "need_sponsorship", label: "Need sponsorship" },
  { value: "student_or_opt", label: "Student visa or OPT" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const HOURS_OPTIONS = [4, 8, 15];

export function PreferencesScreen({
  metros,
  roles,
  initial,
  onDone,
}: {
  metros: { id: string; label: string }[];
  roles: { role_id: string; title: string }[];
  initial?: Preferences | null;
  onDone: (prefs: Preferences) => void;
}) {
  const [prefs, setPrefs] = useState<Preferences>(initial ?? DEFAULT_PREFERENCES);
  const [companyDraft, setCompanyDraft] = useState("");
  const [roleDraft, setRoleDraft] = useState("");

  function set<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPrefs((p) => ({ ...p, [key]: value }));
  }

  function toggleLocation(id: string) {
    const has = prefs.locations.includes(id);
    if (has) {
      set("locations", prefs.locations.filter((l) => l !== id));
    } else if (prefs.locations.length < 3) {
      set("locations", [...prefs.locations, id]);
    }
  }

  function toggleRole(title: string) {
    const has = prefs.preferred_roles.includes(title);
    if (has) {
      set("preferred_roles", prefs.preferred_roles.filter((r) => r !== title));
    } else if (prefs.preferred_roles.length < 3) {
      set("preferred_roles", [...prefs.preferred_roles, title]);
    }
  }

  return (
    <div className="rise space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          What actually constrains your search?
        </h2>
        <p className="mt-1.5 text-sm text-fog">
          Every field is optional — skip anything you&apos;d rather not answer. About 30 seconds.
        </p>
      </div>

      {/* Verbatim required copy (PRD §5, Screen 3). */}
      <Notice>
        This stays in your browser. We don&apos;t store it, and we don&apos;t give immigration
        advice — we just show you what the job postings say.
      </Notice>

      <Card>
        <Label hint="Metro level, up to 3.">Preferred location(s)</Label>
        <div className="flex flex-wrap gap-2">
          {metros
            .filter((m) => m.id !== "other")
            .map((m) => (
              <Pill
                key={m.id}
                active={prefs.locations.includes(m.id)}
                onClick={() => toggleLocation(m.id)}
              >
                {m.label}
              </Pill>
            ))}
        </div>
        <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-sm text-chalk">
          <input
            type="checkbox"
            checked={prefs.remote_only}
            onChange={(e) => set("remote_only", e.target.checked)}
            className="h-4 w-4 accent-[var(--color-brand)]"
          />
          Remote only
        </label>
      </Card>

      <Card>
        <Label hint="Coarse buckets only. We never ask for visa numbers, dates, or documents.">
          Citizenship / work authorization
        </Label>
        <div className="flex flex-wrap gap-2">
          {SPONSORSHIP_OPTIONS.map((o) => (
            <Pill
              key={o.value}
              active={prefs.sponsorship === o.value}
              onClick={() => set("sponsorship", o.value)}
            >
              {o.label}
            </Pill>
          ))}
        </div>
        {prefs.sponsorship === "need_sponsorship" || prefs.sponsorship === "student_or_opt" ? (
          <div className="mt-4">
            <Label hint="Optional. Only used to sharpen the sponsorship filter.">
              Anything worth noting?
            </Label>
            <input
              value={prefs.visa_detail}
              maxLength={60}
              onChange={(e) => set("visa_detail", e.target.value)}
              placeholder="e.g. H-1B transfer"
              className="w-full rounded-lg border border-line bg-ink px-4 py-2.5 text-sm text-chalk outline-none placeholder:text-fog/50 focus:border-brand"
            />
          </div>
        ) : null}
      </Card>

      <Card>
        <Label hint="Up to 3. This drives the second results track — we score it honestly, however far off it is.">
          Roles you&apos;re aiming for
        </Label>
        <div className="flex flex-wrap gap-2">
          {roles.map((r) => (
            <Pill
              key={r.role_id}
              active={prefs.preferred_roles.includes(r.title)}
              onClick={() => toggleRole(r.title)}
            >
              {r.title}
            </Pill>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={roleDraft}
            onChange={(e) => setRoleDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && roleDraft.trim()) {
                e.preventDefault();
                toggleRole(roleDraft.trim());
                setRoleDraft("");
              }
            }}
            placeholder="Or type another role and press Enter"
            className="flex-1 rounded-lg border border-line bg-ink px-4 py-2.5 text-sm text-chalk outline-none placeholder:text-fog/50 focus:border-brand"
          />
        </div>
        {prefs.preferred_roles.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {prefs.preferred_roles.map((r) => (
              <Pill key={r} active tone="warn" onClick={() => toggleRole(r)}>
                {r} ✕
              </Pill>
            ))}
          </div>
        ) : null}
      </Card>

      <Card>
        <Label hint="Up to 5. Used to bias learning resources toward their stack.">
          Companies you&apos;d like to work for
        </Label>
        <input
          value={companyDraft}
          onChange={(e) => setCompanyDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && companyDraft.trim() && prefs.preferred_companies.length < 5) {
              e.preventDefault();
              set("preferred_companies", [...prefs.preferred_companies, companyDraft.trim()]);
              setCompanyDraft("");
            }
          }}
          placeholder="Type a company and press Enter"
          className="w-full rounded-lg border border-line bg-ink px-4 py-2.5 text-sm text-chalk outline-none placeholder:text-fog/50 focus:border-brand"
        />
        {prefs.preferred_companies.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {prefs.preferred_companies.map((c) => (
              <Pill
                key={c}
                active
                onClick={() =>
                  set(
                    "preferred_companies",
                    prefs.preferred_companies.filter((x) => x !== c),
                  )
                }
              >
                {c} ✕
              </Pill>
            ))}
          </div>
        ) : null}
      </Card>

      <Card>
        <Label hint="Drives every timeline we show you. Change it later on the results page.">
          Hours a week you can realistically study
        </Label>
        <div className="flex gap-2">
          {HOURS_OPTIONS.map((h) => (
            <Pill key={h} active={prefs.weekly_hours === h} onClick={() => set("weekly_hours", h)}>
              {h} hrs/week
            </Pill>
          ))}
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={() => onDone(prefs)}>Continue →</Button>
        <Button variant="quiet" onClick={() => onDone(DEFAULT_PREFERENCES)}>
          Skip all of this
        </Button>
      </div>
    </div>
  );
}
