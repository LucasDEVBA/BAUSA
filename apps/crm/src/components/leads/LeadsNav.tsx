"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, List, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeadsTab {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Leads unificado (F3): o antigo /dashboard vira a "Visão Geral" de Leads,
// ao lado da "Lista". Uma única entrada "Leads" na sidebar.
const TABS: LeadsTab[] = [
  { href: "/dashboard", label: "Visão Geral", icon: LayoutDashboard },
  { href: "/leads", label: "Lista", icon: List },
];

export function LeadsNav() {
  const pathname = usePathname();

  return (
    <nav
      role="tablist"
      aria-label="Visões de leads"
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
