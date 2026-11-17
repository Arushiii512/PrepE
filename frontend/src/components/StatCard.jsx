import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const TONES = {
  primary: "bg-primary-soft text-primary",
  blue: "bg-blue-soft text-blue",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  muted: "bg-muted text-muted-foreground",
};

export function StatCard({ icon: Icon, label, value, hint, tone = "primary", loading = false, className }) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-20" />
          ) : (
            <p
              className={cn(
                "mt-1.5 font-semibold tracking-tight",
                typeof value === "string" && value.length > 10 ? "line-clamp-2 text-xl leading-snug" : "truncate text-[28px] leading-none"
              )}
              title={typeof value === "string" ? value : undefined}
            >
              {value}
            </p>
          )}
          {hint && <p className="mt-2 text-xs leading-snug text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", TONES[tone])}>
            <Icon className="h-[18px] w-[18px]" />
          </div>
        )}
      </div>
    </Card>
  );
}
