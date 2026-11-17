import { Link } from "react-router-dom";
import {
  ChartColumn, CheckCircle2, Circle, Database, FileText, ListChecks, MessageSquareText, Trophy, Upload, Play, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { FeatureCard } from "@/components/FeatureCard";
import { EmptyState } from "@/components/EmptyState";
import { useWorkspace } from "@/context/WorkspaceContext";
import { cn, timeAgo } from "@/lib/utils";

const ACTIVITY_ICONS = {
  index: Database,
  ask: MessageSquareText,
  "quiz-generate": ListChecks,
  "quiz-complete": Trophy,
  insights: ChartColumn,
};

export default function Dashboard() {
  const { rag, backend, activity } = useWorkspace();
  const items = activity.items;

  const count = (type) => items.filter((i) => i.type === type).length;
  const quizzes = items.filter((i) => i.type === "quiz-complete");
  const avgScore = quizzes.length ? Math.round(quizzes.reduce((a, q) => a + (q.meta?.percent ?? 0), 0) / quizzes.length) : null;

  const offline = backend.online === false;

  const steps = [
    { done: rag.chunks > 0, label: "Index your notes", detail: "Upload a PDF so PrepE can answer from it.", to: "/ask" },
    { done: count("ask") > 0, label: "Ask a question", detail: "Get an answer with the page it came from.", to: "/ask" },
    { done: count("quiz-complete") > 0, label: "Take a practice quiz", detail: "Check what you remember.", to: "/quiz" },
    { done: count("insights") > 0, label: "Analyse a past paper", detail: "See which topics come up most.", to: "/insights" },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <section className="relative overflow-hidden rounded-2xl border bg-card px-6 py-9 shadow-soft sm:px-10 sm:py-12">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative max-w-2xl">
          <h2 className="text-[34px] font-semibold leading-[1.1] sm:text-[44px]">Your AI-powered study companion.</h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            Upload your notes, ask questions and get cited answers, practise with quizzes, and see which topics past papers test most.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/ask"><Upload /> Upload notes</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/quiz"><Play /> Start a quiz</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/insights"><ChartColumn /> Analyse a past paper</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stats: only values we can really measure */}
      <section aria-label="Statistics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Database}
          label="Indexed chunks"
          value={offline || rag.error ? "–" : rag.chunks}
          loading={rag.loading && !offline}
          hint={offline ? "Backend offline" : rag.chunks > 0 ? "Searchable pieces of your notes" : "Upload a PDF to get started"}
        />
        <StatCard icon={MessageSquareText} label="Questions asked" value={count("ask")} tone="blue" hint="Tracked on this device" />
        <StatCard
          icon={Trophy}
          label="Quizzes completed"
          value={quizzes.length}
          tone="success"
          hint={avgScore != null ? `Average score ${avgScore}%` : "Tracked on this device"}
        />
        <StatCard icon={ChartColumn} label="Papers analysed" value={count("insights")} tone="warning" hint="Tracked on this device" />
      </section>

      {/* Feature cards */}
      <section aria-label="Features" className="grid gap-5 lg:grid-cols-3">
        <FeatureCard
          icon={MessageSquareText}
          title="Ask PrepE"
          description="Ask anything about your notes. Answers come only from what you uploaded."
          points={["Drag and drop your PDF notes", "Answers cite the file and page", "Says so when your notes don't cover it"]}
          to="/ask"
          cta="Open Ask PrepE"
          tone="primary"
        />
        <FeatureCard
          icon={ListChecks}
          title="Quiz PrepE"
          description="Generate multiple-choice practice from your notes or any topic."
          points={["Easy, medium or hard", "Up to 15 questions per quiz", "Explanations for every answer"]}
          to="/quiz"
          cta="Open Quiz PrepE"
          tone="blue"
        />
        <FeatureCard
          icon={ChartColumn}
          title="PrepE Insights"
          description="Upload past papers and find the topics that keep coming back."
          points={["Groups questions into topics", "Ranks topics by how often they appear", "Maps related questions together"]}
          to="/insights"
          cta="Open PrepE Insights"
          tone="violet"
        />
      </section>

      {/* Getting started + activity */}
      <section className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Getting started</CardTitle>
              <span className="text-xs font-medium text-muted-foreground">{doneCount} of {steps.length} done</span>
            </div>
            <CardDescription>A good order to work through PrepE the first time.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {steps.map((s) => (
                <li key={s.label}>
                  <Link to={s.to} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/70">
                    {s.done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" /> : <Circle className="h-5 w-5 shrink-0 text-input" />}
                    <div className="min-w-0">
                      <p className={cn("text-sm font-medium", s.done && "text-muted-foreground line-through decoration-muted-foreground/40")}>{s.label}</p>
                      <p className="text-[13px] text-muted-foreground">{s.detail}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Recent activity</CardTitle>
              {items.length > 0 && (
                <Button variant="ghost" size="sm" onClick={activity.clear}>Clear</Button>
              )}
            </div>
            <CardDescription>What you've done in PrepE on this device.</CardDescription>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <EmptyState icon={Sparkles} title="Nothing here yet" description="Index a PDF, ask a question or finish a quiz and it will show up here." className="py-8" />
            ) : (
              <ul className="space-y-1">
                {items.slice(0, 6).map((a) => {
                  const Icon = ACTIVITY_ICONS[a.type] ?? FileText;
                  return (
                    <li key={a.id} className="flex items-start gap-3 py-2">
                      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{a.title}</p>
                        {a.detail && <p className="truncate text-[13px] text-muted-foreground">{a.detail}</p>}
                      </div>
                      <span className="shrink-0 pt-0.5 text-xs text-muted-foreground">{timeAgo(a.ts)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
