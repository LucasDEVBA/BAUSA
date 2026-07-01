"use client";

import { usePathname } from "next/navigation";
import { LayoutDashboard, List } from "lucide-react";

import { BrandTabs, type BrandTab } from "@/components/ui/BrandTabs";

// Leads: /dashboard (Visão Geral) e /leads (Lista) compartilham as abas BAU.
const TABS: BrandTab[] = [
  { id: "/dashboard", label: "Visão Geral", icon: LayoutDashboard, href: "/dashboard" },
  { id: "/leads", label: "Lista", icon: List, href: "/leads" },
];

export function LeadsNav() {
  const pathname = usePathname();
  return <BrandTabs items={TABS} activeId={pathname} ariaLabel="Visões de leads" />;
}
