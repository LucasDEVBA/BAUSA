"use client";

import { usePathname } from "next/navigation";

import { BrandTabs, type BrandTab } from "@/components/ui/BrandTabs";
import { MINHA_AREA_TABS } from "./tabs";

// Espelha o padrão da `FamiliasNav` (F14): barra sticky de vidro coeso, a
// pílula `BrandTabs` é o elemento dominante. `-mx-4 -mt-4` sangram até as bordas
// do `<main>` (padding p-4 do layout), onde a nav é sempre o topo da página.
const TABS: BrandTab[] = MINHA_AREA_TABS.map((t) => ({
  id: t.href,
  label: t.label,
  icon: t.icon,
  href: t.href,
}));

export function MinhaAreaTabNav() {
  const pathname = usePathname();
  return (
    <div className="sticky top-0 z-20 -mx-4 -mt-4 bg-background/80 px-4 py-2.5 backdrop-blur-xl [-webkit-backdrop-filter:blur(20px)]">
      <BrandTabs items={TABS} activeId={pathname} ariaLabel="Seções da minha área" />
    </div>
  );
}
