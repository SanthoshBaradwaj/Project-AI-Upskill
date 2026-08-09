"use client";

import { Button } from "./ui";

export function Landing({
  onStart,
  onDemo,
  corpusSize,
  liveAgents,
}: {
  onStart: () => void;
  onDemo: () => void;
  corpusSize: number;
  liveAgents: boolean;
}) {
  return (
    <div className="rise flex min-h-[70vh] flex-col justify-center">
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-brand">
        Pivot
      </p>

      <h1 className="max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl">
        Find your nearest AI role.
      </h1>

      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-fog">
        Every career tool trusts your résumé. Résumés overstate depth — not
        maliciously, everyone does it. So the advice comes back calibrated to a
        person who doesn&apos;t exist.
        <span className="text-chalk">
          {" "}
          We stress-test what you claim, then match what you can actually prove
          against real postings you&apos;re eligible to hold.
        </span>
      </p>

      <div className="mt-9 flex flex-wrap items-center gap-3">
        <Button onClick={onStart}>Find your nearest AI role →</Button>
        <Button variant="ghost" onClick={onDemo}>
          Try a demo profile
        </Button>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-fog">
        <span>No account.</span>
        <span>Nothing stored.</span>
        <span>5 minutes.</span>
        <span className="text-fog/60">
          Matched against {corpusSize} real postings
        </span>
        {!liveAgents && (
          <span className="rounded-full border border-warn/40 bg-warn/10 px-2.5 py-1 text-warn">
            Offline mode — using the pre-verified question bank
          </span>
        )}
      </div>
    </div>
  );
}
