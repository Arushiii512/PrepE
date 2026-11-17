import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

const VARIANTS = {
  error: { icon: AlertCircle, cls: "border-destructive/20 bg-destructive-soft text-destructive" },
  warning: { icon: AlertTriangle, cls: "border-warning/25 bg-warning-soft text-warning" },
  success: { icon: CheckCircle2, cls: "border-success/20 bg-success-soft text-success" },
  info: { icon: Info, cls: "border-primary/15 bg-primary-soft text-accent-foreground" },
};

/** Inline message banner for errors, warnings and confirmations. */
export function Notice({ variant = "info", title, children, onDismiss, action, className }) {
  const { icon: Icon, cls } = VARIANTS[variant];
  return (
    <div role={variant === "error" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-lg border px-3.5 py-3 text-sm", cls, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1 leading-relaxed">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "text-foreground/80")}>{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
      {onDismiss && (
        <button onClick={onDismiss} aria-label="Dismiss" className="rounded p-0.5 opacity-70 transition-opacity hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
