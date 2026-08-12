"use client";

import { usePathname } from "next/navigation";
import { Compass, LayoutDashboard, Repeat, Table2, Trophy } from "lucide-react";

import { BrandTabs, type BrandTab } from "@/components/ui/BrandTabs";

const TABS: BrandTab[] = [
  { id: "/planejamento", label: "Painel", icon: LayoutDashboard, href: "/planejamento" },
  { id: "/planejamento/estrategico", label: "Estratégico", icon: Compass, href: "/planejamento/estrategico" },
  { id: "/planejamento/metas", label: "Metas", icon: Table2, href: "/planejamento/metas" },
  { id: "/planejamento/rotinas", label: "Rotinas", icon: Repeat, href: "/planejamento/rotinas" },
  { id: "/planejamento/incentivos", label: "Incentivos", icon: Trophy, href: "/planejamento/incentivos" },
];

export function PlanejamentoNav() {
  const pathname = usePathname();
  return <BrandTabs items={TABS} activeId={pathname} ariaLabel="Seções do planejamento" />;
}
