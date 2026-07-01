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
  // Sticky — a barra de abas fica sempre visível ao rolar (mesmo padrão do
  // War Room e do Analytics). Os -mx-4/-mt-4 sangram até as bordas do <main>
  // (padding p-4 do (dashboard)/layout.tsx), onde a nav é sempre o topo da página.
  return (
    <div className="sticky top-0 z-20 -mx-4 -mt-4 border-b border-border bg-background/80 px-4 py-2.5 backdrop-blur-xl">
      <BrandTabs items={TABS} activeId={pathname} ariaLabel="Visões de famílias" />
    </div>
  );
}
