"use client";

import { usePathname } from "next/navigation";
import { Megaphone, TrendingUp, Percent, Sparkles } from "lucide-react";

import { BrandTabs, type BrandTab } from "@/components/ui/BrandTabs";

// Seção Ads: telinhas como sub-rotas (mesmo padrão de /analytics).
const TABS: BrandTab[] = [
  { id: "/ads", label: "Campanhas", icon: Megaphone, href: "/ads" },
  { id: "/ads/desempenho", label: "Desempenho", icon: TrendingUp, href: "/ads/desempenho" },
  { id: "/ads/roi", label: "CAC / ROI", icon: Percent, href: "/ads/roi" },
  { id: "/ads/planejar", label: "Planejar", icon: Sparkles, href: "/ads/planejar" },
];

export function AdsNav() {
  const pathname = usePathname();
  // Detalhe de campanha (/ads/campanha/[id]) mantém a aba Campanhas acesa.
  const activeId = pathname.startsWith("/ads/campanha") ? "/ads" : pathname;
  return <BrandTabs items={TABS} activeId={activeId} ariaLabel="Seções de Meta Ads" />;
}
