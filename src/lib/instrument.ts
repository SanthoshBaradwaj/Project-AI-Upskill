/**
 * Build instrumentation (PRD §8.3). Logged in-session as structured JSON so we
 * can answer judge questions with numbers instead of adjectives.
 */

export interface AgentTiming {
  agent: string;
  ms: number;
  source: "live" | "fallback";
  detail?: Record<string, unknown>;
}

export function logAgent(t: AgentTiming): void {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ pivot_instrument: t }));
}

export async function timed<T>(
  agent: string,
  fn: () => Promise<T>,
): Promise<{ value: T; ms: number }> {
  const start = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - start };
}
