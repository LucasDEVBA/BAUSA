"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Route, List, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FamiliasTab {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Seção Famílias unificada (F2): as 3 visões operacionais (saúde, jornada,
// lista) compartilham esta navegação por abas. Cada aba é uma rota própria
// (dados distintos por visão), com uma única entrada "Famílias" na sidebar.
const TABS: FamiliasTab[] = [
  { href: "/familias-crm", label: "Experiência", icon: Heart },
  { href: "/familias-pipeline", label: "Jornada", icon: Route },
  { href: "/familias", label: "Lista", icon: List },
];

export function FamiliasNav() {
  const pathname = usePathname();

  return (
    <nav
      role="tablist"
      aria-label="Visões de famílias"
      className="flex gap-1 overflow-x-auto"
    >
      {TABS.map((tab) => {
        const isActive = pathname === tab.href;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border bg-card/60 text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
