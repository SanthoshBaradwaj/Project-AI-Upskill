"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { skillName } from "@/lib/data";
import { nextDifficulty, nextQuestion, QUIZ_LENGTH } from "@/lib/ladder";
import type { Answer, Difficulty, Question, QuizBank } from "@/lib/types";
import { Icon } from "./Sprite";

const KEYS = ["A", "B", "C", "D"];

/**
 * Screen 5. Positive language on failure: "Banked", never "Correct"; "Not quite",
 * never "Wrong". No cumulative score is shown at any point — the reveal is the
 * whole payoff, and a running score mid-quiz drives dropout.
 */
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
  const [picked, setPicked] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);

  const startedAt = useRef<number>(Date.now());
  const changed = useRef(false);

  const total = Math.min(QUIZ_LENGTH, quiz.plan.length || QUIZ_LENGTH);

  // Derived rather than accumulated, so selection is idempotent under a
  // double-invoked effect.
  const usedIds = useMemo(() => new Set(answers.map((a) => a.question_id)), [answers]);

  useEffect(() => {
    if (index >= total) return;
    const q = nextQuestion(quiz.pool, quiz.plan, { index, difficulty, usedIds });
    if (!q) {
      onComplete(answers);
      return;
    }
    setQuestion(q);
    setPicked(null);
    changed.current = false;
    startedAt.current = Date.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const choose = useCallback(
    (i: number) => {
      if (picked !== null || !question) return; // answers lock on first click
      const correct = i === question.correct_index;
      setPicked(i);
      setStreak((s) => (correct ? s + 1 : 0));
      setAnswers((prev) => [
        ...prev,
        {
          question_id: question.question_id,
          skill_id: question.skill_id,
          difficulty: question.difficulty,
          chosen_index: i,
          correct,
          latency_ms: Date.now() - startedAt.current,
          answer_changed: changed.current,
        },
      ]);
    },
    [picked, question],
  );

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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const n = ["1", "2", "3", "4"].indexOf(e.key);
      if (n >= 0) choose(n);
      if (e.key === "Enter" && picked !== null) {
        e.preventDefault();
        advance();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!question) {
    return (
      <section className="card" style={{ marginTop: 30 }}>
        <div className="bggen">
          <span className="pulse" />
          <span>Loading your questions…</span>
        </div>
      </section>
    );
  }

  const correct = picked !== null && picked === question.correct_index;
  const last = index + 1 >= total;

  return (
    <section style={{ marginTop: 30 }}>
      <div className="qbar" aria-label={`Question ${index + 1} of ${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <i key={i} className={i < index ? "done" : i === index ? "now" : ""} />
        ))}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 14,
          marginTop: 16,
        }}
      >
        <span className="mono muted">
          {skillName(question.skill_id)} · {index + 1} of {total}
        </span>
        {streak >= 2 ? (
          <span
            className="mono"
            style={{ color: "#B87400", fontWeight: 700, letterSpacing: "0.06em" }}
          >
            ◆ {streak} in a row
          </span>
        ) : null}
      </div>

      <h3
        style={{
          fontSize: 21,
          fontWeight: 700,
          letterSpacing: "-0.025em",
          lineHeight: 1.32,
          margin: "18px 0 22px",
        }}
      >
        {question.stem}
      </h3>

      <div style={{ display: "grid", gap: 10 }}>
        {question.options.map((option, i) => {
          const state =
            picked === null
              ? ""
              : i === question.correct_index
                ? "right"
                : i === picked
                  ? "wrong"
                  : "";
          return (
            <button
              key={option}
              className={`ans ${state}`}
              disabled={picked !== null}
              onClick={() => choose(i)}
            >
              <span className="key">{KEYS[i]}</span>
              <span>{option}</span>
            </button>
          );
        })}
      </div>

      {picked !== null ? (
        <div
          style={{
            borderLeft: `5px solid ${correct ? "var(--gold)" : "var(--rose)"}`,
            background: "var(--white)",
            padding: "16px 18px",
            marginTop: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: "-0.01em",
              color: correct ? "#B87400" : "var(--rose)",
              marginBottom: 8,
            }}
          >
            <Icon name={correct ? "check" : "x"} size={15} />
            {correct ? "Banked" : "Not quite"}
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.55 }} className="muted">
            {question.explanation}
          </p>
          <div style={{ marginTop: 16 }}>
            <button className="btn go" onClick={advance}>
              {last ? "See my route" : "Continue"}
              <Icon name="arrow" />
            </button>
          </div>
        </div>
      ) : (
        <p className="tiny muted" style={{ marginTop: 18 }}>
          Press 1–4 to answer.
        </p>
      )}
    </section>
  );
}
