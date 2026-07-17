import { ListChecks, Radar, type LucideIcon } from "lucide-react";

// Abas da Observabilidade (CEO). Cada aba é uma sub-rota real
// (`/observabilidade/<slug>`) — subpágina no sidebar, deep-link, back/forward
// e destaque por pathname (mesmo padrão de /minha-area). Módulo compartilhado
// por page.tsx (server, resolve o slug) e a nav (client).

export type ObservabilidadeTab = "filas" | "geral";

export interface ObservabilidadeTabDef {
  id: ObservabilidadeTab;
  /** Segmento de URL; `undefined` = rota base `/observabilidade` (Monitor de filas). */
  slug?: string;
  href: string;
  label: string;
  icon: LucideIcon;
}

export const OBSERVABILIDADE_TABS: ObservabilidadeTabDef[] = [
  { id: "filas", href: "/observabilidade", label: "Monitor de filas", icon: ListChecks },
  { id: "geral", slug: "geral", href: "/observabilidade/geral", label: "Observabilidade geral", icon: Radar },
];
