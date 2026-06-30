"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Zap,
  Target,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  BarChart2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Ícone por aba (mapeado por id no client — funções não cruzam o boundary server→client).
const TAB_ICONS: Record<string, LucideIcon> = {
  visao: Zap,
  meta: Target,
  funil: TrendingUp,
  caixa: DollarSign,
  risco: AlertTriangle,
  posicionamento: BarChart2,
  familias: Users,
};

export interface WarRoomTab {
  id: string;
  label: string;
  content: ReactNode;
}

interface WarRoomTabsProps {
  tabs: WarRoomTab[];
  /** Conteúdo do canto direito do header (SafraFilter, export, indicador ao vivo). */
  header?: ReactNode;
}

/**
 * Shell de abas do War Room unificado. A aba ativa vive no hash da URL
 * (`/war-room#funil`) — troca instantânea (sem refetch), deep-linkável, e os
 * cards de drill da Visão Geral navegam com `<a href="#funil">`.
 */
export function WarRoomTabs({ tabs, header }: WarRoomTabsProps) {
  const fallback = tabs[0]?.id ?? "visao";
  const [active, setActive] = useState<string>(fallback);

  useEffect(() => {
    const sync = () => {
      // Hash tem prioridade (navegação in-page); ?tab= é o fallback dos redirects
      // das antigas subrotas (sobrevive a redirect server-side com confiança).
      const hash = window.location.hash.replace("#", "");
      const queryTab = new URLSearchParams(window.location.search).get("tab") ?? "";
      const target = hash || queryTab;
      setActive(target && tabs.some((t) => t.id === target) ? target : fallback);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [tabs, fallback]);

  const select = (id: string) => {
    setActive(id);
    window.history.replaceState(null, "", `#${id}`);
  };

  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="mb-0.5 flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h1 className="text-title-2 text-foreground">War Room</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Painel central do CEO — uma tela, navegação por seções
          </p>
        </div>
        {header}
      </div>

      {/* Barra de abas */}
      <div
        role="tablist"
        aria-label="Seções do War Room"
        className="flex gap-1 overflow-x-auto border-b border-border"
      >
        {tabs.map((tab) => {
          const Icon = TAB_ICONS[tab.id] ?? Zap;
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => select(tab.id)}
              className={cn(
                "-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Conteúdo da aba ativa */}
      <div className="flex-1">{activeTab?.content}</div>
    </div>
  );
}
