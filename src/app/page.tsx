"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Ingest } from "@/components/Ingest";
import { Landing } from "@/components/Landing";
import { PreferencesScreen } from "@/components/PreferencesScreen";
import { QuizScreen } from "@/components/QuizScreen";
import { Rail } from "@/components/Rail";
import { Results } from "@/components/Results";
import { SkillConfirm } from "@/components/SkillConfirm";
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

type Step = "landing" | "ingest" | "prefs" | "confirm" | "quiz" | "scoring" | "results";

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

/** The rail is a six-stop transit line; these are the stops. */
const RAIL_STOP: Record<Step, number> = {
  landing: 1,
  ingest: 2,
  prefs: 3,
  confirm: 4,
  quiz: 5,
  scoring: 6,
  results: 6,
};

export default function Page() {
  const [step, setStep] = useState<Step>("landing");
  const [meta, setMeta] = useState<Meta | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [quiz, setQuiz] = useState<QuizBank | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [result, setResult] = useState<MatchPayload | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);

  const quizFor = useRef("");
  const inFlight = useRef(false);

  useEffect(() => {
    void fetch("/api/meta")
      .then((r) => r.json())
      .then(setMeta)
      .catch(() => setMeta(null));
  }, []);

  // Session-only: survives a refresh, dies with the tab.
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
      if (inFlight.current) return null;

      inFlight.current = true;
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
        inFlight.current = false;
      }
    },
    [quiz],
  );

  // Generation starts the moment the trust gate mounts — that is what hides it.
  useEffect(() => {
    if (step !== "confirm" || !profile) return;
    void generateQuiz(profile.skills, preferences, profile.inferred_domain);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, profile]);

  async function score(a: Answer[], prefs = preferences) {
    setStep("scoring");
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skills: profile?.skills ?? [], answers: a, preferences: prefs }),
      });
      setResult((await res.json()) as MatchPayload);
      setStep("results");
    } catch {
      setStep("quiz");
    }
  }

  async function startDemo() {
    setDemoBusy(true);
    try {
      const data = await (await fetch("/api/demo")).json();
      setProfile(data.profile as Profile);
      setPreferences(data.preferences as Preferences);
      setStep("confirm");
    } finally {
      setDemoBusy(false);
    }
  }

  function restart() {
    sessionStorage.removeItem("pivot_session");
    quizFor.current = "";
    setProfile(null);
    setPreferences(DEFAULT_PREFERENCES);
    setQuiz(null);
    setAnswers([]);
    setResult(null);
    setStep("landing");
  }

  return (
    <>
      <Rail current={RAIL_STOP[step]} />
      <main className="wrap">
        {step === "landing" ? (
          <Landing
            onStart={() => setStep("ingest")}
            onDemo={() => void startDemo()}
            demoBusy={demoBusy}
          />
        ) : null}

        {step === "ingest" ? (
          <Ingest
            onBack={() => setStep("landing")}
            onDone={(p) => {
              setProfile(p);
              setStep("prefs");
            }}
          />
        ) : null}

        {step === "prefs" && meta ? (
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
            quiz={quiz}
            onContinue={(skills) => {
              setProfile({ ...profile, skills });
              const key = skills.map((s) => s.skill_id).sort().join("|");
              if (key !== quizFor.current) {
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
            <section className="card" style={{ marginTop: 30 }}>
              <div className="bggen">
                <span className="pulse" />
                <span>Writing your questions…</span>
              </div>
            </section>
          )
        ) : null}

        {step === "scoring" ? (
          <section className="card" style={{ marginTop: 30 }}>
            <div className="bggen">
              <span className="pulse" />
              <span>Mapping your route…</span>
            </div>
          </section>
        ) : null}

        {step === "results" && result && quiz && profile ? (
          <Results
            verified={result.verified}
            learner={result.learner}
            pace={result.pace}
            match={result.match}
            quiz={quiz}
            answers={answers}
            preferences={preferences}
            domain={profile.inferred_domain}
            onRestart={restart}
            onWeeklyHoursChange={(h) => {
              const next = { ...preferences, weekly_hours: h };
              setPreferences(next);
              void score(answers, next);
            }}
          />
        ) : null}
      </main>
    </>
  );
}
