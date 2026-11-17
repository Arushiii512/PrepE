import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, CheckCircle2, ChevronLeft, ChevronRight, RotateCcw, Sparkles, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { LoadingState } from "@/components/LoadingState";
import { Notice } from "@/components/Notice";
import { useWorkspace } from "@/context/WorkspaceContext";
import { getErrorMessage } from "@/services/api";
import { generateQuiz, looksLikeSampleQuiz } from "@/services/quizService";
import { cn, plural } from "@/lib/utils";

const DIFFICULTIES = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];
const DIFF_BADGE = { easy: "success", medium: "warning", hard: "destructive" };
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/* --------------------------------- Setup --------------------------------- */

function SetupCard() {
  const { rag, backend, setQuizState, activity } = useWorkspace();
  const [topic, setTopic] = useState("");
  const [useNotes, setUseNotes] = useState(true);
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const hasNotes = rag.chunks > 0;
  const groundInNotes = useNotes && hasNotes;

  const submit = async (e) => {
    e?.preventDefault();
    if (!topic.trim() && !groundInNotes) {
      setError("Enter a topic, or index some notes first so PrepE has something to write questions from.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const quiz = await generateQuiz({ topic, useIndexedNotes: groundInNotes, numQuestions: count, difficulty });
      if (!quiz?.questions?.length) throw new Error("The backend returned a quiz with no questions. Try again.");
      setQuizState({
        quiz,
        settings: { difficulty, topic: topic.trim(), groundedInNotes: groundInNotes },
        answers: {},
        index: 0,
        submitted: false,
        sample: looksLikeSampleQuiz(quiz),
      });
      activity.log("quiz-generate", quiz.title || "Practice quiz", `${plural(quiz.questions.length, "question")}, ${difficulty}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <LoadingState
          title="Writing your quiz…"
          description={`Generating ${plural(count, "question")} at ${difficulty} difficulty. This can take up to a minute.`}
          className="py-20"
        />
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle className="text-lg">Create a practice quiz</CardTitle>
        <CardDescription>Questions are multiple choice, with an explanation for each answer.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="topic">Topic <span className="font-normal text-muted-foreground">(optional if your notes are indexed)</span></Label>
            <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="For example, deadlock detection and recovery" />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border p-3.5">
            <div className="min-w-0">
              <Label htmlFor="use-notes" className="cursor-pointer">Base questions on my notes</Label>
              <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
                {hasNotes
                  ? `Uses your ${plural(rag.chunks, "indexed chunk")}. With a topic, PrepE searches your notes for it.`
                  : backend.online === false
                  ? "Backend offline, so the index can't be checked."
                  : "No notes indexed yet."}
                {!hasNotes && backend.online !== false && (
                  <> <Link to="/ask" className="font-medium text-primary hover:underline">Add notes in Ask PrepE</Link>.</>
                )}
              </p>
            </div>
            <button
              id="use-notes"
              type="button"
              role="switch"
              aria-checked={groundInNotes}
              disabled={!hasNotes}
              onClick={() => setUseNotes((v) => !v)}
              className={cn("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50", groundInNotes ? "bg-primary" : "bg-input")}
            >
              <span className={cn("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", groundInNotes && "translate-x-5")} />
            </button>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Difficulty</legend>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
              {DIFFICULTIES.map((d) => (
                <label key={d.value} className="cursor-pointer">
                  <input type="radio" name="difficulty" value={d.value} checked={difficulty === d.value} onChange={() => setDifficulty(d.value)} className="peer sr-only" />
                  <span className="block rounded-md py-2 text-center text-sm font-medium text-muted-foreground transition-all peer-checked:bg-card peer-checked:text-foreground peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                    {d.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="count">Number of questions</Label>
              <span className="rounded-md bg-primary-soft px-2 py-0.5 text-sm font-semibold text-accent-foreground">{count}</span>
            </div>
            <input id="count" type="range" min={1} max={15} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full accent-[hsl(var(--primary))]" />
            <div className="flex justify-between text-xs text-muted-foreground"><span>1</span><span>15</span></div>
          </div>

          {error && <Notice variant="error" onDismiss={() => setError(null)}>{error}</Notice>}

          <Button type="submit" size="lg" className="w-full" disabled={backend.online === false}>
            <Sparkles /> Generate quiz
          </Button>
          {backend.online === false && <p className="text-center text-[13px] text-destructive">The backend is offline. Start it to generate a quiz.</p>}
        </form>
      </CardContent>
    </Card>
  );
}

/* --------------------------------- Taking -------------------------------- */

function TakeQuiz() {
  const { quizState, setQuizState, resetQuiz, activity } = useWorkspace();
  const { quiz, answers, index, settings, sample } = quizState;
  const [confirming, setConfirming] = useState(false);

  const total = quiz.questions.length;
  const q = quiz.questions[index];
  const answered = Object.keys(answers).length;
  const unanswered = total - answered;

  const setIndex = (i) => {
    setConfirming(false);
    setQuizState((s) => ({ ...s, index: Math.min(Math.max(i, 0), total - 1) }));
  };
  const choose = (key) => setQuizState((s) => ({ ...s, answers: { ...s.answers, [s.index]: key } }));

  const submit = () => {
    const correct = quiz.questions.filter((qq, i) => answers[i] === qq.correct_key).length;
    const percent = Math.round((correct / total) * 100);
    setQuizState((s) => ({ ...s, submitted: true }));
    activity.log("quiz-complete", quiz.title || "Practice quiz", `Scored ${correct}/${total} (${percent}%)`, { percent, correct, total });
  };
  const requestSubmit = () => (unanswered > 0 && !confirming ? setConfirming(true) : submit());

  // Keyboard: A-D pick an option, arrows move between questions.
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^(input|textarea|select)$/i.test(e.target.tagName)) return;
      const k = e.key.toUpperCase();
      if (q.options.some((o) => o.key === k)) choose(k);
      else if (e.key === "ArrowRight") setIndex(index + 1);
      else if (e.key === "ArrowLeft") setIndex(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="space-y-5">
      {sample && <SampleNotice />}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-xl font-semibold">{quiz.title}</h2>
        <Badge variant="secondary">{plural(total, "question")}</Badge>
        {settings?.difficulty && <Badge variant={DIFF_BADGE[settings.difficulty]}>{cap(settings.difficulty)}</Badge>}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card>
          <CardContent className="p-5 sm:p-7">
            <div className="mb-5 flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-muted-foreground">Question {index + 1} of {total}</p>
              {q.difficulty && <Badge variant={DIFF_BADGE[q.difficulty] ?? "secondary"}>{cap(q.difficulty)}</Badge>}
            </div>
            <Progress value={((index + 1) / total) * 100} className="mb-6 h-1.5" aria-label="Quiz progress" />

            <h3 className="text-[19px] font-semibold leading-snug sm:text-xl">{q.question}</h3>

            <fieldset className="mt-6 space-y-2.5">
              <legend className="sr-only">Choose an answer</legend>
              {q.options.map((o) => {
                const selected = answers[index] === o.key;
                return (
                  <label key={o.key} className="block cursor-pointer">
                    <input type="radio" name={`q-${index}`} value={o.key} checked={selected} onChange={() => choose(o.key)} className="peer sr-only" />
                    <span
                      className={cn(
                        "flex items-start gap-3.5 rounded-xl border bg-card px-4 py-3.5 transition-colors hover:border-primary/40 hover:bg-primary-soft/50",
                        "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
                        selected && "border-primary bg-primary-soft hover:bg-primary-soft"
                      )}
                    >
                      <span className={cn("mt-px grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-semibold transition-colors", selected ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground")}>
                        {o.key}
                      </span>
                      <span className="text-[15px] leading-relaxed">{o.text}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <div className="mt-7 flex items-center justify-between gap-3">
              <Button variant="outline" onClick={() => setIndex(index - 1)} disabled={index === 0}>
                <ChevronLeft /> Previous
              </Button>
              {index < total - 1 ? (
                <Button onClick={() => setIndex(index + 1)}>Next <ChevronRight /></Button>
              ) : (
                <Button onClick={requestSubmit}><Check /> Submit quiz</Button>
              )}
            </div>
            <p className="mt-4 hidden text-xs text-muted-foreground sm:block">Tip: press A to D to answer and the arrow keys to move between questions.</p>
          </CardContent>
        </Card>

        <Card className="lg:sticky lg:top-24">
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px]">Questions</CardTitle>
            <CardDescription>{answered} of {total} answered</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-5 gap-2">
              {quiz.questions.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  aria-label={`Go to question ${i + 1}${answers[i] ? " (answered)" : ""}`}
                  aria-current={i === index ? "step" : undefined}
                  className={cn(
                    "grid h-9 place-items-center rounded-lg border text-sm font-medium transition-colors",
                    i === index ? "border-primary bg-card text-primary ring-2 ring-primary/20" : answers[i] ? "border-transparent bg-primary-soft text-accent-foreground" : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            {confirming && unanswered > 0 && (
              <Notice variant="warning">
                {plural(unanswered, "question")} still unanswered. Unanswered questions count as incorrect.
                <div className="mt-2.5 flex gap-2">
                  <Button size="sm" onClick={submit}>Submit anyway</Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>Keep going</Button>
                </div>
              </Notice>
            )}

            <Button className="w-full" variant={answered === total ? "default" : "outline"} onClick={requestSubmit}>
              <Check /> Submit quiz
            </Button>
            <Button className="w-full" variant="ghost" size="sm" onClick={resetQuiz}>
              <X /> Discard quiz
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* --------------------------------- Results ------------------------------- */

function ScoreRing({ percent }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const tone = percent >= 80 ? "stroke-success" : percent >= 50 ? "stroke-primary" : "stroke-warning";
  return (
    <div className="relative h-36 w-36 shrink-0" role="img" aria-label={`Score ${percent} percent`}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="9" className="stroke-primary-soft" />
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)} className={cn("transition-[stroke-dashoffset] duration-700 ease-out", tone)} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="text-3xl font-semibold tracking-tight">{percent}%</span>
      </div>
    </div>
  );
}

function SampleNotice() {
  return (
    <Notice variant="warning" title="This is a placeholder quiz">
      The backend couldn't generate real questions (no Gemini API key, or every attempt failed), so it returned generic sample questions. Check <code className="rounded bg-background/70 px-1">GEMINI_API_KEY</code> in the backend <code className="rounded bg-background/70 px-1">.env</code> and generate again.
    </Notice>
  );
}

function Results() {
  const { quizState, setQuizState, resetQuiz } = useWorkspace();
  const { quiz, answers, sample } = quizState;
  const [onlyWrong, setOnlyWrong] = useState(false);

  const total = quiz.questions.length;
  const rows = useMemo(
    () => quiz.questions.map((q, i) => ({ q, i, picked: answers[i] ?? null, correct: answers[i] === q.correct_key })),
    [quiz, answers]
  );
  const correct = rows.filter((r) => r.correct).length;
  const skipped = rows.filter((r) => !r.picked).length;
  const wrong = total - correct - skipped;
  const percent = Math.round((correct / total) * 100);

  const message =
    percent >= 80
      ? "Outstanding. You have these concepts down."
      : percent >= 50
      ? "Good effort. Review the explanations below to firm up the gaps."
      : "Keep practising. Read through the explanations below, then try again.";

  const retake = () => setQuizState((s) => ({ ...s, answers: {}, index: 0, submitted: false }));
  const shown = onlyWrong ? rows.filter((r) => !r.correct) : rows;

  return (
    <div className="space-y-6">
      {sample && <SampleNotice />}

      <Card>
        <CardContent className="flex flex-col items-center gap-7 p-6 sm:flex-row sm:p-8">
          <ScoreRing percent={percent} />
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-sm text-muted-foreground">{quiz.title}</p>
            <h2 className="mt-1 text-3xl font-semibold">{correct} of {total} correct</h2>
            <p className="mt-2 max-w-md text-[15px] leading-relaxed text-muted-foreground">{message}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              <Badge variant="success"><CheckCircle2 /> {correct} correct</Badge>
              <Badge variant="destructive"><XCircle /> {wrong} incorrect</Badge>
              {skipped > 0 && <Badge variant="secondary">{skipped} unanswered</Badge>}
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-3 sm:justify-start">
              <Button onClick={retake}><RotateCcw /> Retake quiz</Button>
              <Button variant="outline" onClick={resetQuiz}><Sparkles /> New quiz</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Review your answers</h3>
        {wrong + skipped > 0 && (
          <Button variant={onlyWrong ? "soft" : "outline"} size="sm" onClick={() => setOnlyWrong((v) => !v)}>
            {onlyWrong ? "Show all questions" : `Show ${plural(wrong + skipped, "missed question")}`}
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {shown.map(({ q, i, picked, correct: ok }) => (
          <Card key={i} className={cn("overflow-hidden border-l-4", ok ? "border-l-success" : "border-l-destructive")}>
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-start gap-3">
                {ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Question {i + 1}{picked ? "" : ", unanswered"}
                  </p>
                  <h4 className="mt-1 text-base font-semibold leading-snug">{q.question}</h4>
                </div>
                {q.difficulty && <Badge variant={DIFF_BADGE[q.difficulty] ?? "secondary"} className="shrink-0">{cap(q.difficulty)}</Badge>}
              </div>

              <ul className="mt-4 space-y-2">
                {q.options.map((o) => {
                  const isCorrect = o.key === q.correct_key;
                  const isPicked = o.key === picked;
                  return (
                    <li
                      key={o.key}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border px-3.5 py-2.5 text-sm",
                        isCorrect ? "border-success/30 bg-success-soft" : isPicked ? "border-destructive/30 bg-destructive-soft" : "border-transparent bg-muted/50"
                      )}
                    >
                      <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold", isCorrect ? "bg-success text-white" : isPicked ? "bg-destructive text-white" : "bg-card text-muted-foreground")}>
                        {isCorrect ? <Check className="h-3 w-3" /> : isPicked ? <X className="h-3 w-3" /> : o.key}
                      </span>
                      <span className="flex-1 leading-relaxed">{o.text}</span>
                      {isCorrect && <span className="shrink-0 text-xs font-medium text-success">Correct answer</span>}
                      {isPicked && !isCorrect && <span className="shrink-0 text-xs font-medium text-destructive">Your answer</span>}
                    </li>
                  );
                })}
              </ul>

              {q.explanation && (
                <div className="mt-4 rounded-lg bg-primary-soft/70 p-3.5 text-sm leading-relaxed">
                  <p className="font-medium text-accent-foreground">Explanation</p>
                  <p className="mt-1 text-foreground/85">{q.explanation}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function QuizPrepE() {
  const { quizState } = useWorkspace();
  if (!quizState.quiz) return <SetupCard />;
  return quizState.submitted ? <Results /> : <TakeQuiz />;
}
