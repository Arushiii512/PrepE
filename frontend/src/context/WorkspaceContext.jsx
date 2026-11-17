import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useBackendStatus } from "@/hooks/useBackendStatus";
import { useActivity } from "@/hooks/useActivity";
import { getErrorMessage } from "@/services/api";
import { getRagStatus } from "@/services/ragService";

/**
 * App-wide state. Pages unmount when you navigate, so anything that should survive a
 * route change (chat history, the quiz in progress, the last analysis) lives here,
 * the same way Streamlit's st.session_state kept it.
 */
const WorkspaceContext = createContext(null);

const INITIAL_QUIZ = { quiz: null, settings: null, answers: {}, index: 0, submitted: false, sample: false };
const INITIAL_INSIGHTS = { analysis: null, source: null };

export function WorkspaceProvider({ children }) {
  const [rag, setRag] = useState({ chunks: 0, ready: false, loading: true, error: null });
  const [docs, setDocs] = useState([]); // PDFs indexed during this session (backend only exposes a chunk count)
  const [messages, setMessages] = useState([]);
  const [quizState, setQuizState] = useState(INITIAL_QUIZ);
  const [insights, setInsights] = useState(INITIAL_INSIGHTS);
  const activity = useActivity();

  const refreshRag = useCallback(async () => {
    try {
      const s = await getRagStatus();
      setRag({ ...s, loading: false, error: null });
      // The index lives in server memory: if it was cleared or the server restarted,
      // our list of session documents would be stale.
      if (s.chunks === 0) setDocs([]);
      return s;
    } catch (e) {
      setRag((r) => ({ ...r, loading: false, error: getErrorMessage(e) }));
      return null;
    }
  }, []);

  const backend = useBackendStatus({ onReconnect: refreshRag });

  useEffect(() => {
    refreshRag();
  }, [refreshRag]);

  const value = useMemo(
    () => ({
      backend,
      rag,
      refreshRag,
      docs,
      addDoc: (doc) => setDocs((d) => [...d, doc]),
      clearDocs: () => setDocs([]),
      messages,
      setMessages,
      quizState,
      setQuizState,
      resetQuiz: () => setQuizState(INITIAL_QUIZ),
      insights,
      setInsights,
      activity,
    }),
    [backend, rag, refreshRag, docs, messages, quizState, insights, activity]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return ctx;
}
