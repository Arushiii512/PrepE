import { cn } from "@/lib/utils";

export function LogoMark({ className }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-8 w-8", className)} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="hsl(175 80% 29%)" />
      <path d="M11 23V9h6.2a4.6 4.6 0 0 1 0 9.2H11" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="22.6" cy="22.2" r="1.7" fill="#BFE6E1" />
    </svg>
  );
}

export function Logo({ className }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-tight">PrepE</span>
    </div>
  );
}
