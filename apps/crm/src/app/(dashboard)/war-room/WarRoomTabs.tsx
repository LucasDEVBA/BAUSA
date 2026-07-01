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
import { BrandTabs } from "@/components/ui/BrandTabs";

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
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Zone STICKY: título compacto + barra de abas sempre visível ao rolar */}
      <div className="sticky top-0 z-20 -mx-4 -mt-4 border-b border-border bg-background/80 px-4 pt-3 backdrop-blur-xl">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
              <Zap className="size-4 text-primary" />
            </span>
            <h1 className="text-title-3 text-foreground">War Room</h1>
          </div>
          {header}
        </div>
        <BrandTabs
          items={tabs.map((tab) => ({
            id: tab.id,
            label: tab.label,
            icon: TAB_ICONS[tab.id] ?? Zap,
          }))}
          activeId={active}
          onSelect={select}
          variant="underline"
          ariaLabel="Seções do War Room"
        />
      </div>

      {/* Conteúdo da aba ativa */}
      <div className="flex-1 pt-4">{activeTab?.content}</div>
    </div>
  );
}
