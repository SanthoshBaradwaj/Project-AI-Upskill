/**
 * Stage 1 — deterministic text extraction (PRD §7.2). No LLM.
 *
 * The hard guard at the bottom is the most important line in this file: if
 * extraction yields under 200 characters we surface an explicit failure state
 * and never call the model. Passing near-empty text to an LLM produces a
 * confidently hallucinated skill profile, which is the worst possible demo
 * failure.
 */

export const MIN_USABLE_CHARS = 200;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export class ExtractionFailed extends Error {
  constructor(
    message: string,
    readonly charsFound: number,
  ) {
    super(message);
    this.name = "ExtractionFailed";
  }
}

function normalise(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdf(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(bytes);
  const { text } = await extractText(doc, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = (await import("mammoth")).default;
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
}

export interface ExtractionResult {
  text: string;
  chars: number;
  source: "pdf" | "docx" | "text";
}

export async function extractFromFile(file: File): Promise<ExtractionResult> {
  if (file.size > MAX_FILE_BYTES) {
    throw new ExtractionFailed("That file is over 5MB. Paste your text instead.", 0);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  let raw = "";
  let source: ExtractionResult["source"];

  try {
    if (name.endsWith(".pdf") || file.type === "application/pdf") {
      raw = await extractPdf(new Uint8Array(buffer));
      source = "pdf";
    } else if (name.endsWith(".docx") || file.type.includes("wordprocessingml")) {
      raw = await extractDocx(buffer);
      source = "docx";
    } else if (name.endsWith(".txt") || name.endsWith(".md") || file.type.startsWith("text/")) {
      raw = buffer.toString("utf8");
      source = "text";
    } else {
      throw new ExtractionFailed(
        "We can read PDF, DOCX, and plain text. Paste your text instead.",
        0,
      );
    }
  } catch (err) {
    if (err instanceof ExtractionFailed) throw err;
    throw new ExtractionFailed(
      "We couldn't read this file — paste your text instead.",
      0,
    );
  }

  return guard(normalise(raw), source);
}

export function extractFromText(input: string): ExtractionResult {
  return guard(normalise(input), "text");
}

function guard(text: string, source: ExtractionResult["source"]): ExtractionResult {
  if (text.length < MIN_USABLE_CHARS) {
    throw new ExtractionFailed(
      "We couldn't read enough text from this — paste your résumé text instead.",
      text.length,
    );
  }
  return { text, chars: text.length, source };
}
