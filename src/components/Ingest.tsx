"use client";

import { useEffect, useRef, useState } from "react";
import type { Profile } from "@/lib/types";
import { Button, Card, Narration, Notice } from "./ui";

const NARRATION = [
  "Reading your experience…",
  "Pulling out verbatim evidence…",
  "Mapping claims to the skill taxonomy…",
  "Checking how recent each claim is…",
];

export function Ingest({
  onDone,
  onBack,
}: {
  onDone: (profile: Profile, degraded: boolean) => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [narrationStep, setNarrationStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!busy) return;
    setNarrationStep(0);
    const timer = setInterval(
      () => setNarrationStep((s) => Math.min(NARRATION.length - 1, s + 1)),
      1400,
    );
    return () => clearInterval(timer);
  }, [busy]);

  async function submit(body: BodyInit, headers?: HeadersInit) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ingest", { method: "POST", body, headers });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try pasting your text instead.");
        setBusy(false);
        // A failed parse should drop the user straight into the recovery path.
        setMode("paste");
        return;
      }
      onDone(data.profile as Profile, Boolean(data.meta?.degraded));
    } catch {
      setError("We couldn't reach the server. Try pasting your text instead.");
      setMode("paste");
      setBusy(false);
    }
  }

  function onFile(file: File) {
    const form = new FormData();
    form.append("file", file);
    void submit(form);
  }

  if (busy) {
    return (
      <Card className="rise">
        <h2 className="mb-1 text-xl font-semibold">Reading your résumé</h2>
        <p className="mb-6 text-sm text-fog">
          We only keep this in your browser tab. Nothing is written to a server.
        </p>
        <Narration lines={NARRATION} active={narrationStep} />
      </Card>
    );
  }

  return (
    <div className="rise space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Start with your experience</h2>
        <p className="mt-1.5 text-sm text-fog">
          A résumé, or the About + Experience text from your LinkedIn profile. Either works.
        </p>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="flex gap-2">
        <button
          onClick={() => setMode("upload")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            mode === "upload" ? "bg-ink-3 text-chalk" : "text-fog hover:text-chalk"
          }`}
        >
          Upload a file
        </button>
        <button
          onClick={() => setMode("paste")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            mode === "paste" ? "bg-ink-3 text-chalk" : "text-fog hover:text-chalk"
          }`}
        >
          Paste text
        </button>
      </div>

      {mode === "upload" ? (
        <Card>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) onFile(file);
            }}
            className="grid place-items-center rounded-lg border border-dashed border-line px-6 py-12 text-center"
          >
            <p className="text-sm text-chalk">Drop a PDF or DOCX here</p>
            <p className="mt-1 text-xs text-fog">Up to 5MB. Plain text works too.</p>
            <div className="mt-5">
              <Button variant="ghost" onClick={() => fileRef.current?.click()}>
                Choose a file
              </Button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.txt,.md,application/pdf,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFile(file);
              }}
            />
          </div>
        </Card>
      ) : (
        <Card>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            placeholder="Paste your résumé, or your LinkedIn About + Experience sections…"
            className="w-full resize-y rounded-lg border border-line bg-ink px-4 py-3 text-sm leading-relaxed text-chalk outline-none placeholder:text-fog/50 focus:border-brand"
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-fog">
              {text.trim().length} characters
              {text.trim().length > 0 && text.trim().length < 200
                ? " — we need at least 200 to read anything useful"
                : ""}
            </span>
            <Button
              disabled={text.trim().length < 200}
              onClick={() =>
                void submit(JSON.stringify({ text }), { "Content-Type": "application/json" })
              }
            >
              Read my experience →
            </Button>
          </div>
        </Card>
      )}

      <Button variant="quiet" onClick={onBack}>
        ← Back
      </Button>
    </div>
  );
}
