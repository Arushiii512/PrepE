import { useCallback, useEffect, useRef, useState } from "react";
import { checkHealth } from "@/services/api";

/**
 * Polls GET /health. `online` is null until the first check completes.
 * Calls `onReconnect` when the backend goes from offline to online.
 */
export function useBackendStatus({ intervalMs = 15000, onReconnect } = {}) {
  const [online, setOnline] = useState(null);
  const [checking, setChecking] = useState(false);
  const prev = useRef(null);
  const cb = useRef(onReconnect);
  cb.current = onReconnect;

  const refresh = useCallback(async () => {
    setChecking(true);
    const ok = await checkHealth();
    setChecking(false);
    setOnline(ok);
    if (ok && prev.current === false) cb.current?.();
    prev.current = ok;
    return ok;
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);

  return { online, checking, refresh };
}
