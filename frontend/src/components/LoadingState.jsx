import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

/** Centered busy state. Pass `progress` (0-100) for determinate work. */
export function LoadingState({ title = "Working…", description, progress, className }) {
  return (
    <div role="status" aria-live="polite" className={cn("flex flex-col items-center justify-center gap-3 px-6 py-14 text-center", className)}>
      <div className="grid h-12 w-12 place-items-center rounded-full bg-primary-soft">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
      <div>
        <p className="text-[15px] font-medium">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {typeof progress === "number" && <Progress value={progress} className="mt-1 w-56" />}
    </div>
  );
}
