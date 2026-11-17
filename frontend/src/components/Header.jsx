import { useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/Logo";
import { StatusPill } from "@/components/StatusPill";
import { NAV_ITEMS } from "@/components/nav";

export function Header({ onOpenMenu }) {
  const { pathname } = useLocation();
  const current = NAV_ITEMS.find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to))) ?? NAV_ITEMS[0];

  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMenu} aria-label="Open navigation">
          <Menu className="h-5 w-5" />
        </Button>
        <LogoMark className="h-7 w-7 lg:hidden" />

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-semibold leading-tight">{current.title}</h1>
          <p className="hidden truncate text-[13px] text-muted-foreground sm:block">{current.description}</p>
        </div>

        <StatusPill />
      </div>
    </header>
  );
}
