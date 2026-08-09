import { NextResponse } from "next/server";
import { fallbackExtract, runProfileAgent } from "@/lib/agents/profile";
import { hasApiKey } from "@/lib/anthropic";
import { ExtractionFailed, extractFromFile, extractFromText } from "@/lib/extract";
import { logAgent } from "@/lib/instrument";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/ingest
 *
 * Stage 1 deterministic extraction, then the Profile Agent. Latency budget: 8s.
 * Any agent failure degrades to the deterministic extractor rather than failing
 * the request (P0-16) — the flow always completes, at reduced confidence.
 */
export async function POST(req: Request) {
  const started = Date.now();

  let text: string;
  let extractionSource: string;

  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file provided." }, { status: 400 });
      }
      const result = await extractFromFile(file);
      text = result.text;
      extractionSource = result.source;
    } else {
      const body = (await req.json()) as { text?: string };
      const result = extractFromText(body.text ?? "");
      text = result.text;
      extractionSource = result.source;
    }
  } catch (err) {
    if (err instanceof ExtractionFailed) {
      return NextResponse.json(
        { error: err.message, chars_found: err.charsFound, recoverable: true },
        { status: 422 },
      );
    }
    return NextResponse.json(
      { error: "We couldn't read that — paste your text instead.", recoverable: true },
      { status: 422 },
    );
  }

  let profile;
  let source: "live" | "fallback" = "live";
  let degradedReason: string | null = null;

  if (hasApiKey()) {
    try {
      profile = await runProfileAgent(text);
    } catch (err) {
      source = "fallback";
      degradedReason = err instanceof Error ? err.message : "profile agent unavailable";
      profile = fallbackExtract(text);
    }
  } else {
    source = "fallback";
    degradedReason = "no API key configured";
    profile = fallbackExtract(text);
  }

  const ms = Date.now() - started;
  logAgent({
    agent: "profile",
    ms,
    source,
    detail: {
      chars: text.length,
      extraction_source: extractionSource,
      skills_found: profile.skills.length,
      degraded_reason: degradedReason,
    },
  });

  if (profile.skills.length === 0) {
    return NextResponse.json(
      {
        error:
          "We read your document but couldn't ground any skills in it. Try pasting a fuller version with your experience bullets.",
        recoverable: true,
      },
      { status: 422 },
    );
  }

  return NextResponse.json({
    profile,
    meta: {
      chars: text.length,
      extraction_source: extractionSource,
      source,
      degraded: source === "fallback",
      degraded_reason: degradedReason,
      ms,
    },
  });
}
