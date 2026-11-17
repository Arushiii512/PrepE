import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const TONES = {
  primary: { tile: "bg-primary-soft text-primary", ring: "hover:border-primary/40" },
  blue: { tile: "bg-blue-soft text-blue", ring: "hover:border-blue/40" },
  violet: { tile: "bg-[hsl(268_85%_96%)] text-[hsl(268_60%_52%)]", ring: "hover:border-[hsl(268_60%_52%/0.4)]" },
};

export function FeatureCard({ icon: Icon, title, description, points = [], to, cta, tone = "primary", className }) {
  const t = TONES[tone] ?? TONES.primary;
  return (
    <div className={cn("flex flex-col rounded-xl border bg-card p-6 shadow-soft transition-[border-color,box-shadow] duration-200 hover:shadow-lift", t.ring, className)}>
      <div className={cn("grid h-11 w-11 place-items-center rounded-xl", t.tile)}>
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-5 text-lg font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
      <ul className="mt-4 space-y-2 text-sm">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2 text-foreground/85">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            {p}
          </li>
        ))}
      </ul>
      <Button asChild variant="soft" className="mt-6 self-start">
        <Link to={to}>{cta}</Link>
      </Button>
    </div>
  );
}
