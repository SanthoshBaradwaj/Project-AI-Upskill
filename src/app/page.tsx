"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Ingest } from "@/components/Ingest";
import { Landing } from "@/components/Landing";
import { PreferencesScreen } from "@/components/PreferencesScreen";
import { QuizScreen } from "@/components/QuizScreen";
import { Results } from "@/components/Results";
import { SkillConfirm } from "@/components/SkillConfirm";
import { Card, Narration, Shell, StepBar } from "@/components/ui";
import { DEFAULT_PREFERENCES } from "@/lib/types";
import type {
  Answer,
  ExtractedSkill,
  LearnerProfile,
  MatchResult,
  Preferences,
  Profile,
  QuizBank,
  SkillCategory,
  VerifiedSkill,
} from "@/lib/types";

type Step = "landing" | "ingest" | "preferences" | "confirm" | "quiz" | "scoring" | "results";

interface Meta {
  metros: { id: string; label: string }[];
  roles: { role_id: string; title: string }[];
  taxonomy: { skill_id: string; display_name: string; category: SkillCategory }[];
  corpus: { total_postings: number };
  live_agents: boolean;
}

interface MatchPayload {
  verified: VerifiedSkill[];
  learner: LearnerProfile;
  pace: { multiplier: number; reason: string; honest_note: string | null };
  match: MatchResult;
}

const SCORING_NARRATION = [
  "Resolving what you actually demonstrated…",
  "Discounting the claims we never tested…",
  "Filtering the corpus to postings you can hold…",
  "Scoring the distance to every role…",
];

const STEP_NUMBER: Partial<Record<Step, number>> = {
  ingest: 1,
  preferences: 2,
  confirm: 3,
  quiz: 4,
  scoring: 5,
  results: 5,
};

export default function Page() {
  const [step, setStep] = useState<Step>("landing");
  const [meta, setMeta] = useState<Meta | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [quiz, setQuiz] = useState<QuizBank | null>(null);
  const [result, setResult] = useState<MatchPayload | null>(null);
  const [scoringStep, setScoringStep] = useState(0);

  // Which skill set the cached quiz was generated for, so edits on the
  // confirmation screen correctly invalidate it (P0-5).
  const quizFor = useRef<string>("");
  const quizInFlight = useRef(false);

  useEffect(() => {
    void fetch("/api/meta")
      .then((r) => r.json())
      .then(setMeta)
      .catch(() => setMeta(null));
  }, []);

  // Session-only persistence: survives a refresh, dies with the tab.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("pivot_session");
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.profile) setProfile(saved.profile);
      if (saved.preferences) setPreferences(saved.preferences);
    } catch {
      /* a corrupt session is not worth crashing over */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem("pivot_session", JSON.stringify({ profile, preferences }));
    } catch {
      /* storage may be unavailable in private mode */
    }
  }, [profile, preferences]);

  const generateQuiz = useCallback(
    async (skills: ExtractedSkill[], prefs: Preferences, domain: string) => {
      const key = skills.map((s) => s.skill_id).sort().join("|");
      if (quizFor.current === key && quiz) return quiz;
      if (quizInFlight.current) return null;

      quizInFlight.current = true;
      try {
        const res = await fetch("/api/quiz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skills, preferences: prefs, domain }),
        });
        const data = await res.json();
        if (!res.ok) return null;
        quizFor.current = key;
        setQuiz(data.quiz as QuizBank);
        return data.quiz as QuizBank;
      } catch {
        return null;
      } finally {
        quizInFlight.current = false;
      }
    },
    [quiz],
  );

  // Fire generation the moment the confirmation screen mounts. This is what
  // hides ~15s of latency behind user activity.
  useEffect(() => {
    if (step !== "confirm" || !profile) return;
    void generateQuiz(profile.skills, preferences, profile.inferred_domain);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, profile]);

  useEffect(() => {
    if (step !== "scoring") return;
    setScoringStep(0);
    const t = setInterval(
      () => setScoringStep((s) => Math.min(SCORING_NARRATION.length - 1, s + 1)),
      600,
    );
    return () => clearInterval(t);
  }, [step]);

  async function score(answers: Answer[], prefs = preferences) {
    setStep("scoring");
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skills: profile?.skills ?? [], answers, preferences: prefs }),
      });
      const data = (await res.json()) as MatchPayload;
      setResult(data);
      setStep("results");
    } catch {
      setStep("quiz");
    }
  }

  const [answers, setAnswers] = useState<Answer[]>([]);

  async function startDemo() {
    const res = await fetch("/api/demo");
    const data = await res.json();
    setProfile(data.profile as Profile);
    setPreferences(data.preferences as Preferences);
    setDegraded(false);
    setStep("confirm");
  }

  function restart() {
    sessionStorage.removeItem("pivot_session");
    quizFor.current = "";
    setProfile(null);
    setPreferences(DEFAULT_PREFERENCES);
    setQuiz(null);
    setResult(null);
    setAnswers([]);
    setStep("landing");
  }

  const stepNumber = STEP_NUMBER[step];

  return (
    <Shell>
      {stepNumber ? <StepBar step={stepNumber} /> : null}

      {step === "landing" ? (
        <Landing
          onStart={() => setStep("ingest")}
          onDemo={() => void startDemo()}
          corpusSize={meta?.corpus.total_postings ?? 428}
          liveAgents={meta?.live_agents ?? false}
        />
      ) : null}

      {step === "ingest" ? (
        <Ingest
          onBack={() => setStep("landing")}
          onDone={(p, wasDegraded) => {
            setProfile(p);
            setDegraded(wasDegraded);
            setStep("preferences");
          }}
        />
      ) : null}

      {step === "preferences" && meta ? (
        <PreferencesScreen
          metros={meta.metros}
          roles={meta.roles}
          initial={preferences}
          onDone={(p) => {
            setPreferences(p);
            setStep("confirm");
          }}
        />
      ) : null}

      {step === "confirm" && profile && meta ? (
        <SkillConfirm
          skills={profile.skills}
          taxonomy={meta.taxonomy}
          quizReady={Boolean(quiz)}
          degraded={degraded}
          onContinue={(skills) => {
            setProfile({ ...profile, skills });
            const key = skills.map((s) => s.skill_id).sort().join("|");
            if (key !== quizFor.current) {
              // The user edited the list, so the cached bank no longer matches.
              setQuiz(null);
              void generateQuiz(skills, preferences, profile.inferred_domain).then(() =>
                setStep("quiz"),
              );
            } else {
              setStep("quiz");
            }
          }}
        />
      ) : null}

      {step === "quiz" ? (
        quiz ? (
          <QuizScreen
            quiz={quiz}
            onComplete={(a) => {
              setAnswers(a);
              void score(a);
            }}
          />
        ) : (
          <Card>
            <h2 className="mb-1 text-xl font-semibold">Writing your questions</h2>
            <p className="mb-6 text-sm text-fog">
              Targeting the claims most likely to be overstated, then attacking our own questions.
            </p>
            <Narration
              lines={[
                "Ranking your claims by over-claim risk…",
                "Writing 21 items across three difficulty tiers…",
                "Adversarially reviewing every one…",
                "Discarding anything with two defensible answers…",
              ]}
              active={2}
            />
          </Card>
        )
      ) : null}

      {step === "scoring" ? (
        <Card>
          <h2 className="mb-1 text-xl font-semibold">Scoring what you proved</h2>
          <p className="mb-6 text-sm text-fog">
            Deterministic arithmetic, not a model — so we can explain every number.
          </p>
          <Narration lines={SCORING_NARRATION} active={scoringStep} />
        </Card>
      ) : null}

      {step === "results" && result && quiz && profile ? (
        <Results
          verified={result.verified}
          learner={result.learner}
          pace={result.pace}
          match={result.match}
          quiz={quiz}
          preferences={preferences}
          domain={profile.inferred_domain}
          onRestart={restart}
          onWeeklyHoursChange={(hours) => {
            const next = { ...preferences, weekly_hours: hours };
            setPreferences(next);
            void score(answers, next);
          }}
        />
      ) : null}
    </Shell>
  );
}
