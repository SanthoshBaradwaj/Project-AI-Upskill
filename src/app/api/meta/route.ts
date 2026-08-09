import { NextResponse } from "next/server";
import { hasApiKey } from "@/lib/anthropic";
import { CORPUS_META, METROS, ROLES, TAXONOMY } from "@/lib/data";

export const runtime = "nodejs";

/** Static reference data for the preference and skill-confirmation screens. */
export async function GET() {
  return NextResponse.json({
    metros: METROS,
    roles: ROLES.map((r) => ({ role_id: r.role_id, title: r.title })),
    taxonomy: TAXONOMY.map((s) => ({
      skill_id: s.skill_id,
      display_name: s.display_name,
      category: s.category,
    })),
    corpus: CORPUS_META,
    live_agents: hasApiKey(),
  });
}
