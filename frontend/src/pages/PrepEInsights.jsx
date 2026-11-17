import { useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import {
  ChartColumn, ChevronDown, FileText, Flame, Hash, Layers, Search, Trophy, X, Zap, Map as MapIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dropzone } from "@/components/Dropzone";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { Notice } from "@/components/Notice";
import { StatCard } from "@/components/StatCard";
import { useWorkspace } from "@/context/WorkspaceContext";
import { getErrorMessage } from "@/services/api";
import { clusterQuestions, uploadPyqs } from "@/services/insightsService";
import { clusterColor } from "@/lib/chartColors";
import { cn, formatBytes, plural } from "@/lib/utils";

const K_OPTIONS = [null, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const truncate = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s);

/* ------------------------------- Input card ------------------------------ */

function InputCard() {
  const { setInsights, activity, backend } = useWorkspace();
  const [mode, setMode] = useState("upload");
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [k, setK] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  // Same rule the Streamlit app uses for pasted text: one question per line.
  const pasted = useMemo(() => text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 8), [text]);
  const canRun = mode === "upload" ? Boolean(file) : pasted.length >= 2;

  const run = async () => {
    setError(null);
    setLoading(true);
    setProgress(0);
    try {
      const analysis =
        mode === "upload"
          ? await uploadPyqs(file, k, { onProgress: setProgress })
          : await clusterQuestions(pasted, k);
      const label = mode === "upload" ? file.name : "Pasted questions";
      setInsights({ analysis, source: { label, size: mode === "upload" ? file.size : null } });
      setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
      activity.log("insights", `Analysed ${label}`, `${plural(analysis.totalQuestions, "question")}, ${plural(analysis.clusters.length, "topic")}`);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <LoadingState
          title="Analysing your questions…"
          description={progress != null && progress < 100 ? `Uploading ${progress}%` : "Reading the questions, embedding them and grouping similar ones into topics. The first run can take longer while the model loads."}
          progress={progress != null && progress < 100 ? progress : undefined}
        />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Analyse past papers</CardTitle>
        <CardDescription>PrepE groups similar questions into topics and ranks them by how often they appear.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <Tabs value={mode} onValueChange={(v) => { setMode(v); setError(null); }}>
          <TabsList>
            <TabsTrigger value="upload"><FileText /> Upload paper</TabsTrigger>
            <TabsTrigger value="paste"><Hash /> Paste questions</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-3">
            {!file ? (
              <Dropzone
                accept={[".pdf", ".txt"]}
                title="Drop a question paper here or browse"
                hint="PDF or TXT. Questions should be numbered or on separate lines."
                onFiles={([f]) => { setFile(f); setError(null); }}
                onReject={(bad) => setError(`${bad[0].name} isn't supported. Upload a PDF or TXT file.`)}
              />
            ) : (
              <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3.5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><FileText className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={file.name}>{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(file.size)}, {file.name.toLowerCase().endsWith(".pdf") ? "PDF" : "Text file"}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setFile(null)} aria-label="Remove file"><X /></Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="paste" className="space-y-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={7}
              aria-label="Past exam questions"
              placeholder={"Paste questions, one per line. Numbering is optional.\n1. Explain ...\n2. What is ..."}
            />
            <p className="text-xs text-muted-foreground">{plural(pasted.length, "question")} detected. At least 2 are needed.</p>
          </TabsContent>
        </Tabs>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <Label htmlFor="k">Number of topics</Label>
            <select id="k" value={k ?? "auto"} onChange={(e) => setK(e.target.value === "auto" ? null : Number(e.target.value))} className="flex h-10 w-44 rounded-lg border border-input bg-card px-3 text-sm shadow-sm">
              {K_OPTIONS.map((o) => <option key={o ?? "auto"} value={o ?? "auto"}>{o ?? "Detect automatically"}</option>)}
            </select>
          </div>
          <Button size="lg" onClick={run} disabled={!canRun || backend.online === false}>
            <Search /> Analyse questions
          </Button>
        </div>

        {backend.online === false && <p className="text-[13px] text-destructive">The backend is offline. Start it to run an analysis.</p>}
        {error && <Notice variant="error" onDismiss={() => setError(null)}>{error}</Notice>}
      </CardContent>
    </Card>
  );
}

/* --------------------------------- Charts -------------------------------- */

function ChartTip({ active, payload, children }) {
  if (!active || !payload?.length) return null;
  return <div className="max-w-xs rounded-lg border bg-card px-3 py-2.5 text-[13px] shadow-lift">{children(payload[0].payload)}</div>;
}

function useNarrow(breakpoint = 640) {
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.innerWidth < breakpoint);
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < breakpoint);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [breakpoint]);
  return narrow;
}

function FrequencyChart({ bar, activeId, onSelect }) {
  const narrow = useNarrow();
  const fill = (d) => (d.rank === 0 ? "#0F857B" : d.aboveAverage ? "#5BBFB4" : "#BFE6E1");
  return (
    <div>
      <div style={{ height: Math.max(240, bar.length * 60 + 50) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bar} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: narrow ? 0 : 4 }} barCategoryGap="28%">
            <CartesianGrid horizontal={false} stroke="hsl(175 80% 29% / 0.4)" />
            <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#6B7090" }} />
            <YAxis type="category" dataKey="label" width={narrow ? 104 : 220} tickLine={false} axisLine={false} tick={{ fontSize: 12.5, fill: "#141B3D" }} tickFormatter={(v) => truncate(v, narrow ? 15 : 34)} />
            <Tooltip
              cursor={{ fill: "hsl(174 60% 95%)" }}
              content={
                <ChartTip>
                  {(d) => (
                    <>
                      <p className="font-semibold">{d.label}</p>
                      <p className="mt-1 text-muted-foreground">{plural(d.count, "question")} ({d.percentage}% of the paper)</p>
                      {d.keywords?.length > 0 && <p className="mt-1 text-muted-foreground">Keywords: {d.keywords.join(", ")}</p>}
                    </>
                  )}
                </ChartTip>
              }
            />
            <Bar dataKey="count" radius={[0, 8, 8, 0]} cursor="pointer" onClick={(d) => onSelect(d?.payload?.id ?? d?.id)}>
              {bar.map((d) => (
                <Cell key={d.id} fill={fill(d)} fillOpacity={activeId == null || activeId === d.id ? 1 : 0.35} />
              ))}
              <LabelList dataKey="percentage" position="right" formatter={(v) => `${v}%`} style={{ fontSize: 12, fontWeight: 600, fill: "#141B3D" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#6355E0]" /> Highest-yield topic</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#8E83EC]" /> Above-average frequency</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#C9C4F5]" /> Below average</span>
        <span className="ml-auto">Select a bar to highlight a topic</span>
      </div>
    </div>
  );
}

function SemanticMap({ analysis, activeId, onSelect }) {
  const { clusters, scatter } = analysis;

  // Match each Plotly trace back to its cluster so colours agree with the rest of the page.
  const series = scatter.map((s, i) => {
    const idx = clusters.findIndex((c) => c.topic_label === s.name);
    const cluster = clusters[idx];
    return {
      id: cluster?.cluster_id ?? `s${i}`,
      name: s.name,
      color: clusterColor(idx >= 0 ? idx : i),
      data: s.points.map((p) => ({ x: p.x, y: p.y, preview: p.preview, topic: s.name })),
    };
  });

  if (series.length === 0) {
    return <EmptyState icon={MapIcon} title="No semantic map for this analysis" description="The backend only draws the map when it has at least two questions to place." />;
  }

  return (
    <div>
      <div className="h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 16, bottom: 22, left: 8 }}>
            <CartesianGrid stroke="hsl(240 24% 93%)" />
            <XAxis type="number" dataKey="x" tick={false} tickLine={false} axisLine={{ stroke: "hsl(240 22% 88%)" }} label={{ value: "Semantic dimension 1", position: "insideBottom", offset: -10, fontSize: 12, fill: "#6B7090" }} />
            <YAxis type="number" dataKey="y" tick={false} tickLine={false} axisLine={{ stroke: "hsl(240 22% 88%)" }} label={{ value: "Semantic dimension 2", angle: -90, position: "insideLeft", offset: 12, fontSize: 12, fill: "#6B7090", style: { textAnchor: "middle" } }} />
            <ZAxis range={[140, 140]} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3", stroke: "hsl(247 68% 60% / 0.4)" }}
              content={
                <ChartTip>
                  {(d) => (
                    <>
                      <p className="font-semibold leading-snug">{d.topic}</p>
                      <p className="mt-1 leading-snug text-muted-foreground">{d.preview}</p>
                    </>
                  )}
                </ChartTip>
              }
            />
            {series.map((s) => (
              <Scatter key={s.id} name={s.name} data={s.data} fill={s.color} fillOpacity={activeId == null || activeId === s.id ? 0.9 : 0.14} stroke="#fff" strokeWidth={1.5} isAnimationActive={false} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {series.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            aria-pressed={activeId === s.id}
            className={cn("flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors hover:bg-muted", activeId === s.id && "border-primary/50 bg-primary-soft")}
          >
            <i className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            <span className="max-w-[200px] truncate">{s.name}</span>
            <span className="text-muted-foreground">{s.data.length}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Questions that sit close together are about similar things. The axes are compressed meaning, so they have no units.</p>
    </div>
  );
}

/* ------------------------------ Cluster cards ---------------------------- */

function ClusterCard({ c, rank, aboveAverage, color, active, onSelect }) {
  const [open, setOpen] = useState(false);
  const extra = c.questionPreviews?.length > c.sample_questions.length;
  const priority =
    rank === 0 ? { label: "High priority", variant: "destructive", icon: Flame } : aboveAverage ? { label: "Frequently tested", variant: "warning", icon: Zap } : null;

  return (
    <Card className={cn("transition-shadow", active && "ring-2 ring-primary/40")}>
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <i className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => onSelect(c.cluster_id)} className="text-left text-base font-semibold leading-snug hover:text-primary">{c.topic_label}</button>
              {priority && <Badge variant={priority.variant}><priority.icon /> {priority.label}</Badge>}
            </div>
            <div className="mt-2.5 flex items-center gap-3">
              <Progress value={c.percentage} className="h-1.5 max-w-[200px]" />
              <span className="text-[13px] text-muted-foreground">{plural(c.question_count, "question")}, {c.percentage}% of the paper</span>
            </div>
          </div>
        </div>

        {c.keywords?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {c.keywords.map((k) => <Badge key={k} variant="secondary">{k}</Badge>)}
          </div>
        )}

        <div className="mt-4">
          <p className="mb-2 text-[13px] font-medium">Sample questions</p>
          <ul className="space-y-2">
            {c.sample_questions.map((q, i) => (
              <li key={i} className="rounded-lg bg-muted/60 px-3.5 py-2.5 text-sm leading-relaxed">{q}</li>
            ))}
          </ul>
        </div>

        {extra && (
          <div className="mt-3">
            <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline">
              {open ? "Hide" : "Show"} all {c.questionPreviews.length} questions in this topic
              <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
            </button>
            {open && (
              <ul className="mt-2.5 space-y-1.5 border-l-2 border-primary/20 pl-4">
                {c.questionPreviews.map((q, i) => <li key={i} className="text-[13px] leading-relaxed text-muted-foreground">{q}</li>)}
                {c.questionPreviews.some((q) => q.endsWith("...")) && (
                  <li className="text-xs italic text-muted-foreground/80">Longer questions are shortened to about 100 characters.</li>
                )}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------------------------- Page --------------------------------- */

export default function PrepEInsights() {
  const { insights } = useWorkspace();
  const [activeId, setActiveId] = useState(null);
  const { analysis, source } = insights;
  const toggle = (id) => setActiveId((cur) => (cur === id || id == null ? null : id));

  return (
    <div className="space-y-6">
      <InputCard />

      {analysis ? (
        <>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 id="results" className="scroll-mt-24 text-xl font-semibold">Results</h2>
            <p className="text-sm text-muted-foreground">for {source?.label}</p>
          </div>

          <section aria-label="Summary" className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={ChartColumn} label="Questions analysed" value={analysis.totalQuestions} />
            <StatCard icon={Layers} label="Distinct topics found" value={analysis.clusters.length} tone="blue" />
            <StatCard
              icon={Trophy}
              label="Highest-yield topic"
              value={analysis.topCluster?.topic_label ?? "None"}
              tone="warning"
              hint={analysis.topCluster ? `${analysis.topCluster.percentage}% of questions` : undefined}
            />
          </section>

          <Card>
            <CardContent className="p-5 sm:p-6">
              <Tabs defaultValue="frequency">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <TabsList>
                    <TabsTrigger value="frequency"><ChartColumn /> Topic frequency</TabsTrigger>
                    <TabsTrigger value="map"><MapIcon /> Semantic map</TabsTrigger>
                  </TabsList>
                  {activeId != null && <Button variant="ghost" size="sm" onClick={() => setActiveId(null)}><X /> Clear highlight</Button>}
                </div>
                <TabsContent value="frequency" className="mt-6">
                  <FrequencyChart bar={analysis.bar} activeId={activeId} onSelect={toggle} />
                </TabsContent>
                <TabsContent value="map" className="mt-6">
                  <SemanticMap analysis={analysis} activeId={activeId} onSelect={toggle} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <div>
            <h3 className="mb-1 text-lg font-semibold">Topics and their questions</h3>
            <p className="mb-4 text-sm text-muted-foreground">Ordered by how often each topic appears. Start revising from the top.</p>
            <div className="space-y-4">
              {analysis.clusters.map((c, i) => (
                <ClusterCard
                  key={c.cluster_id}
                  c={c}
                  rank={i}
                  aboveAverage={analysis.bar[i]?.aboveAverage}
                  color={clusterColor(i)}
                  active={activeId === c.cluster_id}
                  onSelect={toggle}
                />
              ))}
            </div>
          </div>
        </>
      ) : (
        <Card>
          <EmptyState
            icon={ChartColumn}
            title="No analysis yet"
            description="Upload a previous-year question paper or paste some questions. You'll see which topics come up most and how the questions relate."
          />
        </Card>
      )}
    </div>
  );
}
