import { NextResponse } from "next/server";
import demo from "@data/demo_profile.json";

export const runtime = "nodejs";

/**
 * GET /api/demo — demo insurance (P0-15).
 *
 * Returns a pre-computed profile and preference set. Everything downstream then
 * runs the *real* deterministic engines against the hand-verified question bank,
 * so a demo run exercises production code with zero live API dependency.
 */
export async function GET() {
  return NextResponse.json({
    label: demo.label,
    resume_text: demo.resume_text,
    profile: demo.profile,
    preferences: demo.preferences,
  });
}
