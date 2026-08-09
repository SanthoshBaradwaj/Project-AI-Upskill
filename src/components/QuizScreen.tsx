"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nextDifficulty, nextQuestion, QUIZ_LENGTH } from "@/lib/ladder";
import { skillName } from "@/lib/data";
import type { Answer, Difficulty, QuizBank, Question } from "@/lib/types";
import { Button, Card } from "./ui";

const SOFT_TIMER_SECONDS = 45;

const TIER_LABEL: Record<Difficulty, string> = {
  L1: "Foundational",
  L2: "Applied",
  L3: "Advanced",
};

export function QuizScreen({
  quiz,
  onComplete,
}: {
  quiz: QuizBank;
  onComplete: (answers: Answer[]) => void;
}) {
  const [index, setIndex] = useState(0);
  const [difficulty, setDifficulty] = useState<Difficulty>("L2");
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [streak, setStreak] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const startedAt = useRef<number>(Date.now());
  const changedRef = useRef(false);

  const total = Math.min(QUIZ_LENGTH, quiz.plan.length || QUIZ_LENGTH);

  /**
   * Already-answered items, derived from state rather than accumulated in a
   * mutable set. Selection must be idempotent: React re-invokes effects in dev,
   * and a set mutated inside the effect would silently burn a question and open
   * the quiz one rung below where the ladder is supposed to start.
   */
  const usedIds = useMemo(() => new Set(answers.map((a) => a.question_id)), [answers]);

  // Pull the next item whenever the index moves.
  useEffect(() => {
    if (index >= total) return;
    const q = nextQuestion(quiz.pool, quiz.plan, { index, difficulty, usedIds });
    if (!q) {
      onComplete(answers);
      return;
    }
    setQuestion(q);
    setSelected(null);
    setRevealed(false);
    changedRef.current = false;
    startedAt.current = Date.now();
    setElapsed(0);
    // `difficulty` and `usedIds` are intentionally excluded: both are set in the
    // same commit as `index`, so re-running on them would re-select mid-question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Advisory timer only — it never blocks or auto-submits.
  useEffect(() => {
    if (revealed) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 500);
    return () => clearInterval(t);
  }, [revealed, index]);

  const choose = useCallback(
    (i: number) => {
      if (revealed) return;
      if (selected !== null && selected !== i) changedRef.current = true;
      setSelected(i);
    },
    [revealed, selected],
  );

  function submit() {
    if (question === null || selected === null) return;
    const correct = selected === question.correct_index;

    setAnswers((prev) => [
      ...prev,
      {
        question_id: question.question_id,
        skill_id: question.skill_id,
        difficulty: question.difficulty,
        chosen_index: selected,
        correct,
        latency_ms: Date.now() - startedAt.current,
        answer_changed: changedRef.current,
      },
    ]);
    setStreak((s) => (correct ? s + 1 : 0));
    setRevealed(true);
  }

  function advance() {
    if (!question) return;
    const last = answers[answers.length - 1];
    setDifficulty(nextDifficulty(question.difficulty, Boolean(last?.correct)));

    if (index + 1 >= total) {
      onComplete(answers);
      return;
    }
    setIndex((i) => i + 1);
  }

  // Keyboard: 1-4 to pick, Enter to submit/advance.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (["1", "2", "3", "4"].includes(e.key)) choose(Number(e.key) - 1);
      if (e.key === "Enter") {
        e.preventDefault();
        if (revealed) advance();
        else if (selected !== null) submit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const progress = useMemo(() => (index / total) * 100, [index, total]);

  if (!question) {
    return (
      <Card>
        <p className="text-sm text-fog">Loading your questions…</p>
      </Card>
    );
  }

  return (
    <div className="rise space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-fog">
            Question {index + 1} of {total}
          </span>
          <div className="flex items-center gap-4">
            {streak >= 2 ? (
              <span className="font-semibold text-warn">{streak} in a row 🔥</span>
            ) : null}
            <span className={elapsed > SOFT_TIMER_SECONDS ? "text-fog/60" : "text-fog"}>
              {elapsed}s
            </span>
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="rounded border border-line bg-ink-3 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-fog">
            {skillName(question.skill_id)}
          </span>
          <span className="rounded border border-brand/40 bg-brand/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-brand">
            {TIER_LABEL[question.difficulty]}
          </span>
        </div>

        <h2 className="text-lg font-medium leading-relaxed text-chalk sm:text-xl">
          {question.stem}
        </h2>

        <div className="mt-5 space-y-2.5">
          {question.options.map((option, i) => {
            const isChosen = selected === i;
            const isCorrect = i === question.correct_index;

            let style = "border-line bg-ink-3 hover:border-fog/50";
            if (revealed && isCorrect) style = "border-verified bg-verified/15";
            else if (revealed && isChosen) style = "border-hot bg-hot/15";
            else if (isChosen) style = "border-brand bg-brand/15";

            return (
              <button
                key={option}
                onClick={() => choose(i)}
                disabled={revealed}
                className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${style}`}
              >
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border border-line text-[10px] text-fog">
                  {i + 1}
                </span>
                <span className="text-chalk">{option}</span>
              </button>
            );
          })}
        </div>

        {revealed ? (
          <div
            className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
              selected === question.correct_index
                ? "border-verified/40 bg-verified/10"
                : "border-warn/40 bg-warn/10"
            }`}
          >
            <div className="mb-1 font-semibold">
              {selected === question.correct_index ? "Correct" : "Not quite"}
            </div>
            <p className="leading-relaxed text-fog">{question.explanation}</p>
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-between">
          <span className="text-xs text-fog">
            {revealed ? "Press Enter to continue" : "Press 1–4 to choose, Enter to lock it in"}
          </span>
          {revealed ? (
            <Button onClick={advance}>
              {index + 1 >= total ? "See your results →" : "Next question →"}
            </Button>
          ) : (
            <Button onClick={submit} disabled={selected === null}>
              Lock it in
            </Button>
          )}
        </div>
      </Card>

      <p className="text-center text-xs text-fog/60">
        We don&apos;t show a running score — the whole point is the reveal at the end.
      </p>
    </div>
  );
}
