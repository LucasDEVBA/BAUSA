"use client";

import { usePathname } from "next/navigation";
import { Heart, Route, List } from "lucide-react";

import { BrandTabs, type BrandTab } from "@/components/ui/BrandTabs";

// Seção Famílias unificada: as 3 visões operacionais compartilham as abas BAU.
const TABS: BrandTab[] = [
  { id: "/familias-crm", label: "Experiência", icon: Heart, href: "/familias-crm" },
  { id: "/familias-pipeline", label: "Jornada", icon: Route, href: "/familias-pipeline" },
  { id: "/familias", label: "Lista", icon: List, href: "/familias" },
];

export function FamiliasNav() {
  const pathname = usePathname();
  return <BrandTabs items={TABS} activeId={pathname} ariaLabel="Visões de famílias" />;
}
