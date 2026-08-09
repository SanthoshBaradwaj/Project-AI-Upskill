"use client";

import type { ReactNode } from "react";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-12">{children}</main>
  );
}

export function StepBar({ step }: { step: number }) {
  const labels = ["Résumé", "Preferences", "Skills", "Reality check", "Results"];
  return (
    <div className="mb-8 flex items-center gap-2" aria-label={`Step ${step} of 5`}>
      {labels.map((label, i) => {
        const n = i + 1;
        const state = n < step ? "done" : n === step ? "now" : "next";
        return (
          <div key={label} className="flex flex-1 flex-col gap-1.5">
            <div
              className={`h-1 rounded-full transition-colors ${
                state === "done"
                  ? "bg-verified"
                  : state === "now"
                    ? "bg-brand"
                    : "bg-line"
              }`}
            />
            <span
              className={`hidden text-[11px] tracking-wide sm:block ${
                state === "next" ? "text-fog/50" : "text-fog"
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  type = "button",
  full,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "quiet";
  type?: "button" | "submit";
  full?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40";
  const styles = {
    primary: "bg-brand text-ink hover:brightness-110 active:scale-[0.99]",
    ghost: "border border-line bg-ink-2 text-chalk hover:border-fog/50",
    quiet: "text-fog hover:text-chalk",
  }[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles} ${full ? "w-full" : ""}`}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  tone?: "default" | "hero" | "muted";
}) {
  const tones = {
    default: "border-line bg-ink-2",
    hero: "border-brand/40 bg-gradient-to-br from-ink-3 to-ink-2",
    muted: "border-line/60 bg-ink-2/50",
  }[tone];
  return (
    <section className={`rounded-xl border ${tones} p-5 sm:p-6 ${className}`}>{children}</section>
  );
}

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-2">
      <div className="text-sm font-semibold text-chalk">{children}</div>
      {hint ? <div className="mt-0.5 text-xs text-fog">{hint}</div> : null}
    </div>
  );
}

export function Pill({
  children,
  active,
  onClick,
  tone = "neutral",
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  tone?: "neutral" | "verified" | "warn";
}) {
  const activeTone = {
    neutral: "border-brand bg-brand/15 text-chalk",
    verified: "border-verified bg-verified/15 text-chalk",
    warn: "border-warn bg-warn/15 text-chalk",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? activeTone : "border-line bg-ink-3 text-fog hover:border-fog/50"
      } ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      {children}
    </button>
  );
}

export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "warn" | "error";
}) {
  const tones = {
    info: "border-brand/30 bg-brand/10 text-chalk",
    warn: "border-warn/40 bg-warn/10 text-chalk",
    error: "border-hot/40 bg-hot/10 text-chalk",
  }[tone];
  return <div className={`rounded-lg border px-4 py-3 text-sm ${tones}`}>{children}</div>;
}

/**
 * Narrated loading, not a spinner. The PRD is specific about this: the wait has
 * to feel like the product is working, not like the page is stuck.
 */
export function Narration({ lines, active }: { lines: string[]; active: number }) {
  return (
    <ul className="space-y-2.5">
      {lines.map((line, i) => (
        <li
          key={line}
          className={`flex items-center gap-3 text-sm transition-all duration-500 ${
            i > active ? "opacity-25" : "opacity-100"
          }`}
        >
          <span
            className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] ${
              i < active
                ? "bg-verified text-ink"
                : i === active
                  ? "bg-brand text-ink pulse-soft"
                  : "border border-line text-fog"
            }`}
          >
            {i < active ? "✓" : i + 1}
          </span>
          <span className={i <= active ? "text-chalk" : "text-fog"}>{line}</span>
        </li>
      ))}
    </ul>
  );
}
