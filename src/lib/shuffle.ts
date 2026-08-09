import type { Question } from "./types";

/**
 * Position shuffle guardrail (PRD §7.3).
 *
 * LLMs over-place the correct answer at indices 1-2. We shuffle every item's
 * options server-side and remap `correct_index` so position carries no signal.
 * The RNG is injectable so tests can assert the remap rather than the ordering.
 */
export function shuffleOptions(q: Question, rng: () => number = Math.random): Question {
  const indices = q.options.map((_, i) => i);

  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  return {
    ...q,
    options: indices.map((i) => q.options[i]),
    correct_index: indices.indexOf(q.correct_index),
  };
}

export function shuffleAll(questions: Question[], rng: () => number = Math.random): Question[] {
  return questions.map((q) => shuffleOptions(q, rng));
}

/** Deterministic RNG for reproducible demo runs and tests. */
export function seededRng(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
}
