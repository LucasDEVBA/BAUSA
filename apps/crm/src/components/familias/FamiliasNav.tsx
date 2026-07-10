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

/**
 * Sub-nav sticky das visões de Famílias (Experiência/Jornada/Lista).
 *
 * Padrão premium redesign v2 (espelha `WarRoomTabs`, F14): barra sticky de
 * *vidro coeso* — a pílula `BrandTabs` (variant segmented, com sua própria borda
 * `--glass-border`) é o elemento visual dominante; a barra dá só suporte de fundo
 * translúcido + blur. Sem `border-b` sólida (contradiz o glass-first do v2 e
 * duplicaria a borda da pílula). `backdrop-blur-xl` + prefixo `-webkit-` são
 * exigidos pelo liquid glass — manter ambos. Os `-mx-4/-mt-4` sangram até as
 * bordas do `<main>` (padding `p-4` do `(dashboard)/layout.tsx`), onde a nav é
 * sempre o topo da página.
 */
export function FamiliasNav() {
  const pathname = usePathname();
  return (
    <div className="sticky top-0 z-20 -mx-4 -mt-4 bg-background/80 px-4 py-2.5 backdrop-blur-xl [-webkit-backdrop-filter:blur(20px)]">
      <BrandTabs items={TABS} activeId={pathname} ariaLabel="Visões de famílias" />
    </div>
  );
}
