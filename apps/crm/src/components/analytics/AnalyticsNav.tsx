"use client";

import { usePathname } from "next/navigation";
import { DollarSign, Share2, Percent, Link2, MessagesSquare, CalendarDays } from "lucide-react";

import { BrandTabs, type BrandTab } from "@/components/ui/BrandTabs";

// Seção Analytics unificada: as ferramentas compartilham as abas BAU (via layout).
const TABS: BrandTab[] = [
  { id: "/analytics", label: "Receita", icon: DollarSign, href: "/analytics" },
  { id: "/analytics/atribuicao", label: "Atribuição", icon: Share2, href: "/analytics/atribuicao" },
  { id: "/analytics/cac", label: "CAC / ROI", icon: Percent, href: "/analytics/cac" },
  { id: "/analytics/conversas", label: "Conversas", icon: MessagesSquare, href: "/analytics/conversas" },
  { id: "/analytics/reunioes", label: "Reuniões", icon: CalendarDays, href: "/analytics/reunioes" },
  { id: "/analytics/utm-builder", label: "Gerador UTM", icon: Link2, href: "/analytics/utm-builder" },
];

export function AnalyticsNav() {
  const pathname = usePathname();
  return <BrandTabs items={TABS} activeId={pathname} ariaLabel="Seções de analytics" />;
}
