import { NavLink, Link } from "react-router-dom";
import { Database } from "lucide-react";
import { cn, plural } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { NAV_ITEMS } from "@/components/nav";
import { useWorkspace } from "@/context/WorkspaceContext";

export function Sidebar({ onNavigate, className }) {
  const { rag, backend } = useWorkspace();

  return (
    <aside className={cn("flex h-full w-64 flex-col border-r bg-card/60 px-3 py-5", className)}>
      <Link to="/" onClick={onNavigate} className="mb-7 px-3" aria-label="PrepE home">
        <Logo />
      </Link>

      <nav aria-label="Main" className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ to, end, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive ? "bg-primary-soft text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn("h-[18px] w-[18px]", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Live index status, from GET /rag/status */}
      <div className="mt-auto rounded-xl border bg-card p-3.5 shadow-soft">
        <div className="flex items-center gap-2 text-[13px] font-medium">
          <Database className="h-4 w-4 text-primary" />
          Notes index
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {backend.online === false
            ? "Backend offline, so the index can't be read."
            : rag.loading
            ? "Checking…"
            : rag.chunks > 0
            ? `${plural(rag.chunks, "chunk")} ready to search.`
            : "Nothing indexed yet."}
        </p>
        {backend.online !== false && !rag.loading && rag.chunks === 0 && (
          <Link to="/ask" onClick={onNavigate} className="mt-2 inline-block text-xs font-medium text-primary hover:underline">
            Upload notes
          </Link>
        )}
      </div>
    </aside>
  );
}
