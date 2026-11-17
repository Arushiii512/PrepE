import { cn } from "@/lib/utils";

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-12 text-center", className)}>
      {Icon && (
        <div className="grid h-12 w-12 place-items-center rounded-full bg-primary-soft text-primary">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div>
        <p className="text-[15px] font-medium">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
