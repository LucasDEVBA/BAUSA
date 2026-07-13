import { Flame, Users, Sparkles, BarChart3, type LucideIcon } from "lucide-react";

// Abas da "Minha Área" (Head). Cada aba é uma sub-rota real
// (`/minha-area/<slug>`), o que permite: subpágina no sidebar, deep-link,
// back/forward e destaque de aba por pathname. Módulo compartilhado por
// page.tsx (server, resolve o slug) e a nav/cliente (client).

export type MinhaAreaTab = "hoje" | "familias" | "onboarding" | "desempenho";

export interface MinhaAreaTabDef {
  id: MinhaAreaTab;
  /** Segmento de URL; `undefined` = rota base `/minha-area` (aba Hoje). */
  slug?: string;
  href: string;
  label: string;
  icon: LucideIcon;
}

export const MINHA_AREA_TABS: MinhaAreaTabDef[] = [
  { id: "hoje", href: "/minha-area", label: "Hoje", icon: Flame },
  { id: "familias", slug: "familias", href: "/minha-area/familias", label: "Famílias", icon: Users },
  { id: "onboarding", slug: "onboarding", href: "/minha-area/onboarding", label: "Onboarding", icon: Sparkles },
  { id: "desempenho", slug: "desempenho", href: "/minha-area/desempenho", label: "Desempenho", icon: BarChart3 },
];
