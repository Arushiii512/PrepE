import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/context/WorkspaceContext";

/** Live backend connectivity (GET /health). */
export function StatusPill({ className, showRefresh = true }) {
  const { backend } = useWorkspace();
  const { online, checking, refresh } = backend;

  const label = online === null ? "Checking backend" : online ? "Backend online" : "Backend offline";
  const dot = online === null ? "bg-muted-foreground/50 animate-pulse-dot" : online ? "bg-success" : "bg-destructive";
  const tone = online === false ? "bg-destructive-soft text-destructive" : "bg-muted text-muted-foreground";

  return (
    <div className={cn("inline-flex items-center gap-2 rounded-full py-1 pl-3 pr-1.5 text-xs font-medium", tone, className)} role="status">
      <span className={cn("h-2 w-2 rounded-full", dot)} />
      {label}
      {showRefresh && (
        <button
          onClick={refresh}
          aria-label="Re-check backend connection"
          className="grid h-6 w-6 place-items-center rounded-full transition-colors hover:bg-background/80"
        >
          <RefreshCw className={cn("h-3 w-3", checking && "animate-spin")} />
        </button>
      )}
    </div>
  );
}
