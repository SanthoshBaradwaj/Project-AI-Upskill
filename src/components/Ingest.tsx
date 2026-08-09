"use client";

import { useEffect, useRef, useState } from "react";
import type { Profile } from "@/lib/types";
import { Icon } from "./Sprite";

/**
 * Screen 2. Dropzone -> narrated reading state -> auto-advance.
 *
 * Narration, not a spinner: the ingest budget is 8s, long enough to read as
 * broken. Naming what was found also pre-sells Screen 4.
 */

const ROW_MS = 470;

export function Ingest({
  onDone,
  onBack,
}: {
  onDone: (profile: Profile, degraded: boolean) => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<"drop" | "paste">("drop");
  const [text, setText] = useState("");
  const [reading, setReading] = useState(false);
  const [rows, setRows] = useState<string[]>([]);
  const [shown, setShown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pending = useRef<{ profile: Profile; degraded: boolean } | null>(null);

  // Reveal the narration rows on a stagger, then hand off.
  useEffect(() => {
    if (!reading || rows.length === 0) return;
    if (shown < rows.length) {
      const t = setTimeout(() => setShown((s) => s + 1), ROW_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      if (pending.current) onDone(pending.current.profile, pending.current.degraded);
    }, 600);
    return () => clearTimeout(t);
  }, [reading, rows.length, shown, onDone]);

  async function submit(body: BodyInit, headers?: HeadersInit) {
    setError(null);
    setReading(true);
    setShown(0);
    setRows(["Extracting text…"]);

    try {
      const res = await fetch("/api/ingest", { method: "POST", body, headers });
      const data = await res.json();

      if (!res.ok) {
        setReading(false);
        setRows([]);
        setError(data.error ?? "We couldn't read this file — paste your text instead.");
        setMode("paste");
        return;
      }

      const profile = data.profile as Profile;
      const technical = profile.skills.filter((s) => s.category === "technical").length;

      pending.current = { profile, degraded: Boolean(data.meta?.degraded) };
      setRows([
        `Extracting text… <b>${Number(data.meta.chars).toLocaleString()} characters</b>`,
        `<b>${technical}</b> technical, <b>${profile.skills.length - technical}</b> transferable`,
        `Found <b>${profile.skills.length} skills</b>`,
        "Grounding each in a quote…",
      ]);
      setShown(0);
    } catch {
      setReading(false);
      setRows([]);
      setError("We couldn't reach the server — paste your text instead.");
      setMode("paste");
    }
  }

  function onFile(file: File) {
    const form = new FormData();
    form.append("file", file);
    void submit(form);
  }

  if (reading) {
    return (
      <section className="card" style={{ marginTop: 30 }}>
        <div className="eyebrow">
          <Icon name="doc" />
          Reading your résumé
        </div>
        <ul>
          {rows.slice(0, Math.max(1, shown)).map((r, i) => (
            <li
              key={r}
              className="readrow"
              style={{ animationDelay: `${i * 0.04}s` }}
              dangerouslySetInnerHTML={{ __html: r }}
            />
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section style={{ marginTop: 30 }}>
      <div className="eyebrow">
        <Icon name="doc" />
        Your experience
      </div>
      <h2>
        Start with what
        <br />
        you&apos;ve already done.
      </h2>

      {error ? (
        <div
          style={{
            borderLeft: "5px solid var(--rose)",
            background: "var(--white)",
            padding: "14px 16px",
            fontSize: 13.5,
            margin: "22px 0 0",
          }}
        >
          {error}
        </div>
      ) : null}

      <div style={{ marginTop: 24 }}>
        {mode === "drop" ? (
          <>
            <button
              className="drop"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) onFile(f);
              }}
            >
              <div className="mono muted">PDF or DOCX · up to 5 MB</div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", margin: "10px 0 6px" }}>
                Drop your résumé here
              </div>
              <div className="tiny muted">or click to browse</div>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.txt,.md,application/pdf,text/plain"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
            <div style={{ textAlign: "center", marginTop: 18 }}>
              <button className="linkish" onClick={() => setMode("paste")}>
                Paste text instead
              </button>
            </div>
          </>
        ) : (
          <div className="card">
            <textarea
              className="field"
              rows={12}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your résumé, or your LinkedIn About + Experience sections…"
              style={{ resize: "vertical", lineHeight: 1.55 }}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                marginTop: 14,
                flexWrap: "wrap",
              }}
            >
              <span className="mono muted">
                {text.trim().length} chars
                {text.trim().length > 0 && text.trim().length < 200 ? " · need 200+" : ""}
              </span>
              <button
                className="btn go"
                disabled={text.trim().length < 200}
                onClick={() =>
                  void submit(JSON.stringify({ text }), { "Content-Type": "application/json" })
                }
              >
                Read it
                <Icon name="arrow" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 22 }}>
        <button className="linkish" onClick={onBack}>
          Back
        </button>
      </div>
    </section>
  );
}
