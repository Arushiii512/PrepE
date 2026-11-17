import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle, BookOpen, ChevronDown, FileText, Loader2, MessageSquareText, Send, Sparkles, Trash2, X, CheckCircle2, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dropzone } from "@/components/Dropzone";
import { EmptyState } from "@/components/EmptyState";
import { Markdown } from "@/components/Markdown";
import { Notice } from "@/components/Notice";
import { useWorkspace } from "@/context/WorkspaceContext";
import { getErrorMessage } from "@/services/api";
import { queryNotes, resetRag, uploadPdf } from "@/services/ragService";
import { cn, formatBytes, plural, uid } from "@/lib/utils";

const STARTERS = [
  "Summarise the main ideas in my notes.",
  "What are the key definitions I should memorise?",
  "Explain the most important concept step by step.",
];

/* ------------------------------ Notes panel ------------------------------ */

function NotesPanel() {
  const { rag, refreshRag, docs, addDoc, clearDocs, activity, backend } = useWorkspace();
  const [queue, setQueue] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null); // { variant, text }
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const patch = (id, p) => setQueue((q) => q.map((i) => (i.id === id ? { ...i, ...p } : i)));
  const pending = queue.filter((i) => i.status === "ready" || i.status === "error");

  const addFiles = (files) => {
    setNotice(null);
    setQueue((q) => [
      ...q,
      ...files.map((file) => ({
        id: uid(),
        file,
        status: "ready",
        progress: 0,
        error: null,
        duplicate: docs.some((d) => d.name === file.name) || q.some((x) => x.file.name === file.name),
      })),
    ]);
  };

  const indexAll = async () => {
    setBusy(true);
    setNotice(null);
    let ok = 0;
    let totalChunks = 0;
    for (const item of queue.filter((i) => i.status === "ready" || i.status === "error")) {
      patch(item.id, { status: "uploading", progress: 0, error: null });
      try {
        const res = await uploadPdf(item.file, {
          onProgress: (p) => patch(item.id, { progress: p, status: p >= 100 ? "indexing" : "uploading" }),
        });
        addDoc({ id: item.id, name: res.filename, size: item.file.size, pages: res.total_pages, chunks: res.chunks_indexed });
        activity.log("index", `Indexed ${res.filename}`, `${plural(res.total_pages, "page")}, ${plural(res.chunks_indexed, "chunk")}`);
        setQueue((q) => q.filter((i) => i.id !== item.id));
        ok += 1;
        totalChunks += res.chunks_indexed;
      } catch (e) {
        patch(item.id, { status: "error", progress: 0, error: getErrorMessage(e) });
      }
    }
    await refreshRag();
    setBusy(false);
    if (ok > 0) setNotice({ variant: "success", text: `Indexed ${plural(ok, "document")} (${plural(totalChunks, "chunk")}). You can start asking questions.` });
  };

  const clearIndex = async () => {
    setClearing(true);
    try {
      await resetRag();
      clearDocs();
      await refreshRag();
      setConfirmClear(false);
      setNotice({ variant: "info", text: "Index cleared. Upload notes again to keep asking questions." });
    } catch (e) {
      setNotice({ variant: "error", text: getErrorMessage(e) });
    } finally {
      setClearing(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle>Study notes</CardTitle>
        <CardDescription>PDFs are read page by page and indexed so answers can cite them.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Dropzone
          multiple
          disabled={busy}
          accept={[".pdf"]}
          title="Drop PDFs here or browse"
          hint="PDF files only"
          onFiles={addFiles}
          onReject={(bad) => setNotice({ variant: "error", text: `${bad.map((f) => f.name).join(", ")} ${bad.length > 1 ? "aren't" : "isn't"} a PDF. Only PDF files can be indexed.` })}
        />

        {queue.length > 0 && (
          <ul className="space-y-2">
            {queue.map((item) => (
              <li key={item.id} className="rounded-lg border bg-muted/40 p-3">
                <div className="flex items-start gap-2.5">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={item.file.name}>{item.file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(item.file.size)}</p>
                  </div>
                  {(item.status === "ready" || item.status === "error") && !busy && (
                    <button onClick={() => setQueue((q) => q.filter((i) => i.id !== item.id))} aria-label={`Remove ${item.file.name}`} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {item.status === "uploading" && (
                  <div className="mt-2.5">
                    <Progress value={item.progress} className="h-1.5" />
                    <p className="mt-1 text-xs text-muted-foreground">Uploading {item.progress}%</p>
                  </div>
                )}
                {item.status === "indexing" && (
                  <div className="mt-2.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    Reading pages and building embeddings. Large files can take a minute.
                  </div>
                )}
                {item.status === "error" && <p className="mt-2 text-xs text-destructive">{item.error}</p>}
                {item.duplicate && item.status === "ready" && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-warning">
                    <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                    A file with this name is already indexed. Indexing it again adds duplicate chunks.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {pending.length > 0 && (
          <Button className="w-full" onClick={indexAll} disabled={busy || backend.online === false}>
            {busy ? <Loader2 className="animate-spin" /> : <Layers />}
            {busy ? "Indexing…" : pending.length > 1 ? `Index ${pending.length} documents` : "Index document"}
          </Button>
        )}

        {notice && (
          <Notice variant={notice.variant} onDismiss={() => setNotice(null)}>{notice.text}</Notice>
        )}

        {/* Index state, from GET /rag/status */}
        <div className="rounded-lg border p-3.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] text-muted-foreground">Indexed chunks</p>
              <p className="text-2xl font-semibold leading-tight">{rag.loading ? "…" : backend.online === false || rag.error ? "–" : rag.chunks}</p>
            </div>
            {rag.chunks > 0 && !confirmClear && (
              <Button variant="destructive-ghost" size="sm" onClick={() => setConfirmClear(true)}>
                <Trash2 /> Clear index
              </Button>
            )}
          </div>

          {confirmClear && (
            <div className="mt-3 rounded-lg bg-destructive-soft p-3 text-sm">
              <p className="font-medium text-destructive">Clear all indexed notes?</p>
              <p className="mt-0.5 text-[13px] text-foreground/75">You'll need to upload your PDFs again.</p>
              <div className="mt-2.5 flex gap-2">
                <Button size="sm" variant="destructive" onClick={clearIndex} disabled={clearing}>
                  {clearing && <Loader2 className="animate-spin" />} Clear index
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmClear(false)} disabled={clearing}>Cancel</Button>
              </div>
            </div>
          )}

          {rag.chunks === 0 && !rag.loading && !rag.error && <p className="mt-1 text-[13px] text-muted-foreground">No documents indexed yet.</p>}
          {rag.error && <p className="mt-1 text-[13px] text-destructive">{rag.error}</p>}
        </div>

        {docs.length > 0 && (
          <div>
            <p className="mb-2 text-[13px] font-medium">Indexed this session</p>
            <ul className="space-y-2">
              {docs.map((d) => (
                <li key={d.id} className="flex items-start gap-2.5 rounded-lg bg-success-soft/60 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" title={d.name}>{d.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(d.size)}, {plural(d.pages, "page")}, {plural(d.chunks, "chunk")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* --------------------------------- Chat ---------------------------------- */

function Citations({ citations, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-4 border-t pt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <BookOpen className="h-4 w-4" />
        {plural(citations.length, "source")}
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ol className="mt-3 space-y-2.5">
          {citations.map((c, i) => (
            <li key={`${c.source_file}-${c.page_number}-${i}`} className="rounded-lg bg-muted/60 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-primary-soft text-[11px] font-semibold text-accent-foreground">{i + 1}</span>
                <span className="min-w-0 truncate text-[13px] font-medium" title={c.source_file}>{c.source_file}</span>
                <Badge variant="blue">Page {c.page_number}</Badge>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{c.snippet}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function AssistantAvatar() {
  return (
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
      <Sparkles className="h-4 w-4" />
    </div>
  );
}

function Message({ m, isLast }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-foreground px-4 py-2.5 text-[15px] leading-relaxed text-background">{m.content}</div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <AssistantAvatar />
      <div className="min-w-0 max-w-[92%] flex-1">
        <div className={cn("rounded-2xl rounded-tl-md border bg-card px-4 py-3.5 shadow-soft", m.error && "border-destructive/25 bg-destructive-soft")}>
          {m.error ? (
            <p className="text-sm text-destructive">{m.content}</p>
          ) : (
            <>
              {m.notFound && (
                <Badge variant="warning" className="mb-2.5">
                  <AlertTriangle /> Not found in your notes
                </Badge>
              )}
              {m.mock && (
                <Notice variant="warning" className="mb-3">
                  The backend is running without a Gemini API key, so this is a plain excerpt from your notes rather than a written answer.
                </Notice>
              )}
              <Markdown>{m.content}</Markdown>
              {m.citations?.length > 0 && <Citations citations={m.citations} defaultOpen={isLast} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ChatPanel() {
  const { rag, messages, setMessages, activity, backend } = useWorkspace();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [topK, setTopK] = useState(3);
  const endRef = useRef(null);
  const taRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  const canAsk = rag.ready && backend.online !== false;

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (q.length < 2 || sending || !canAsk) return; // the API requires min_length 2
    setInput("");
    setMessages((m) => [...m, { id: uid(), role: "user", content: q }]);
    setSending(true);
    try {
      const res = await queryNotes(q, topK);
      const answer = res.answer ?? "";
      const geminiError = answer.startsWith("Error communicating with Gemini");
      setMessages((m) => [
        ...m,
        {
          id: uid(),
          role: "assistant",
          content: answer,
          citations: res.citations ?? [],
          notFound: res.found_in_notes === false && !geminiError,
          error: geminiError,
          mock: answer.startsWith("[Offline Mock Mode]"),
        },
      ]);
      if (!geminiError) activity.log("ask", q.length > 70 ? `${q.slice(0, 70)}…` : q, res.found_in_notes === false ? "Not found in notes" : plural((res.citations ?? []).length, "source"));
    } catch (e) {
      setMessages((m) => [...m, { id: uid(), role: "assistant", error: true, content: getErrorMessage(e) }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="flex h-[72dvh] min-h-[520px] flex-col overflow-hidden xl:h-[calc(100dvh-8.5rem)]">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <MessageSquareText className="h-[18px] w-[18px] text-primary" />
          <h2 className="text-[15px] font-semibold">Conversation</h2>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setMessages([])}>New conversation</Button>
        )}
      </div>

      <div className="scroll-thin flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6" aria-live="polite">
        {messages.length === 0 ? (
          rag.ready ? (
            <EmptyState
              icon={Sparkles}
              title="Ask your first question"
              description="PrepE answers only from your uploaded notes and shows where each answer came from."
              className="h-full"
              action={
                <div className="mt-1 flex max-w-md flex-wrap justify-center gap-2">
                  {STARTERS.map((s) => (
                    <button key={s} onClick={() => send(s)} className="rounded-full border bg-card px-3.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-accent-foreground">
                      {s}
                    </button>
                  ))}
                </div>
              }
            />
          ) : (
            <EmptyState
              icon={FileText}
              title={backend.online === false ? "Backend is offline" : "Add your notes to begin"}
              description={backend.online === false ? "Start the FastAPI server, then come back. The status badge above updates automatically." : "Upload a PDF in the Study notes panel and choose Index document. Then ask anything about it."}
              className="h-full"
            />
          )
        ) : (
          messages.map((m, i) => <Message key={m.id} m={m} isLast={i === messages.length - 1} />)
        )}

        {sending && (
          <div className="flex gap-3" role="status" aria-label="PrepE is searching your notes">
            <AssistantAvatar />
            <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border bg-card px-4 py-3.5 shadow-soft">
              {[0, 1, 2].map((d) => (
                <span key={d} className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-primary" style={{ animationDelay: `${d * 0.18}s` }} />
              ))}
              <span className="ml-2 text-[13px] text-muted-foreground">Searching your notes…</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t bg-card p-3 sm:p-4">
        <div className={cn("flex items-end gap-2 rounded-xl border bg-background p-2 transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring/20", !canAsk && "opacity-60")}>
          <textarea
            ref={taRef}
            rows={1}
            value={input}
            disabled={!canAsk || sending}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            aria-label="Ask a question about your notes"
            placeholder={canAsk ? "Ask a question about your notes" : "Index a PDF to start asking questions"}
            className="max-h-36 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[15px] outline-none placeholder:text-muted-foreground/70"
          />
          <Button size="icon" onClick={() => send()} disabled={!canAsk || sending || input.trim().length < 2} aria-label="Send question" className="h-10 w-10 shrink-0 rounded-lg">
            {sending ? <Loader2 className="animate-spin" /> : <Send />}
          </Button>
        </div>
        <div className="mt-2 flex items-center justify-between px-1 text-xs text-muted-foreground">
          <span className="hidden sm:inline">Enter to send, Shift+Enter for a new line</span>
          <label className="ml-auto flex items-center gap-2">
            Passages searched
            <select
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="rounded-md border border-input bg-card px-1.5 py-1 text-xs text-foreground"
            >
              {[3, 5, 8].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
      </div>
    </Card>
  );
}

export default function AskPrepE() {
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="order-2 xl:order-1"><ChatPanel /></div>
      <div className="order-1 xl:order-2"><NotesPanel /></div>
    </div>
  );
}
