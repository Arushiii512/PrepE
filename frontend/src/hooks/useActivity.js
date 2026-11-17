import { useCallback, useEffect, useState } from "react";
import { uid } from "@/lib/utils";

const KEY = "prepe.activity.v1";
const MAX = 40;

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * A small log of things the person actually did in this browser (indexed a PDF,
 * asked a question, finished a quiz, analysed a paper). Entries are only written
 * after a real API call succeeds, and are stored on this device only: the backend
 * has no activity endpoint.
 */
export function useActivity() {
  const [items, setItems] = useState(read);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* storage unavailable: keep in memory only */
    }
  }, [items]);

  const log = useCallback((type, title, detail = "", meta = {}) => {
    setItems((prev) => [{ id: uid(), type, title, detail, meta, ts: Date.now() }, ...prev].slice(0, MAX));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  return { items, log, clear };
}
