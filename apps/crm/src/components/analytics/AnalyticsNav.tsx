"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DollarSign, Share2, Percent, Link2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnalyticsTab {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Seção Analytics unificada (F3): as 4 ferramentas (receita, atribuição, CAC,
// gerador UTM) compartilham esta navegação por abas via layout. Cada aba é uma
// rota própria (dados/propósitos distintos), com uma entrada "Analytics" na sidebar.
const TABS: AnalyticsTab[] = [
  { href: "/analytics", label: "Receita", icon: DollarSign },
  { href: "/analytics/atribuicao", label: "Atribuição", icon: Share2 },
  { href: "/analytics/cac", label: "CAC / ROI", icon: Percent },
  { href: "/analytics/utm-builder", label: "Gerador UTM", icon: Link2 },
];

export function AnalyticsNav() {
  const pathname = usePathname();

  return (
    <nav
      role="tablist"
      aria-label="Seções de analytics"
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
