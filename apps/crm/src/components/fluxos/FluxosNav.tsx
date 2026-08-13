"use client";

import { usePathname } from "next/navigation";
import { Workflow, BarChart3, Users } from "lucide-react";

import { BrandTabs, type BrandTab } from "@/components/ui/BrandTabs";

// Seção Fluxos: sub-rotas no mesmo padrão de /ads e /analytics.
const TABS: BrandTab[] = [
  { id: "/fluxos", label: "Fluxos", icon: Workflow, href: "/fluxos" },
  { id: "/fluxos/metricas", label: "Métricas", icon: BarChart3, href: "/fluxos/metricas" },
  { id: "/fluxos/contatos", label: "Contatos", icon: Users, href: "/fluxos/contatos" },
];

export function FluxosNav() {
  const pathname = usePathname();
  // Editor de um fluxo (/fluxos/[id]) mantém a primeira aba acesa.
  const activeId = TABS.some((t) => t.id === pathname) ? pathname : "/fluxos";
  return <BrandTabs items={TABS} activeId={activeId} ariaLabel="Seções de Fluxos" />;
}
