"use client";

import { usePathname } from "next/navigation";
import { Megaphone, TrendingUp } from "lucide-react";

import { BrandTabs, type BrandTab } from "@/components/ui/BrandTabs";

// Seção Ads: telinhas como sub-rotas (mesmo padrão de /analytics).
const TABS: BrandTab[] = [
  { id: "/ads", label: "Campanhas", icon: Megaphone, href: "/ads" },
  { id: "/ads/desempenho", label: "Desempenho", icon: TrendingUp, href: "/ads/desempenho" },
];

export function AdsNav() {
  const pathname = usePathname();
  return <BrandTabs items={TABS} activeId={pathname} ariaLabel="Seções de Meta Ads" />;
}
