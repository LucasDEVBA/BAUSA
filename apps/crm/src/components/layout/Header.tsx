"use client";

import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { NotificationCenter } from "./NotificationCenter";

const BREADCRUMB_MAP: Record<string, { label: string; parent?: string }> = {
  "/dashboard": { label: "Dashboard", parent: "Leads" },
  "/leads": { label: "Lista", parent: "Leads" },
  "/pipeline": { label: "Pipeline" },
  "/families": { label: "Famílias Ativas" },
  "/war-room": { label: "War Room" },
  "/war-room/dashboard": { label: "Dashboard", parent: "War Room" },
  "/war-room/meta": { label: "Meta e Receita", parent: "War Room" },
  "/war-room/funil": { label: "Funil Comercial", parent: "War Room" },
  "/war-room/caixa": { label: "Caixa", parent: "War Room" },
  "/war-room/risco": { label: "Receita em Risco", parent: "War Room" },
  "/war-room/posicionamento": { label: "Posicionamento", parent: "War Room" },
  "/war-room/familias": { label: "Famílias", parent: "War Room" },
  "/analytics": { label: "Analytics", parent: "Executivo" },
  "/analytics/atribuicao": { label: "Atribuição", parent: "Analytics" },
  "/analytics/cac": { label: "CAC/ROI", parent: "Analytics" },
  "/analytics/utm-builder": { label: "Gerador UTM", parent: "Analytics" },
  "/messages": { label: "Mensagens" },
  "/minha-area": { label: "Minha Área" },
  "/settings": { label: "Configurações" },
  "/proposals": { label: "Propostas" },
  "/revenue": { label: "Financeiro" },
  "/risk": { label: "Risco" },
  "/satisfaction": { label: "Satisfação" },
  "/tarefas": { label: "Tarefas", parent: "Sistema" },
  "/faq": { label: "FAQ", parent: "Sistema" },
  "/indicacoes": { label: "Indicações", parent: "Sistema" },
  "/configuracoes": { label: "Configurações", parent: "Sistema" },
  "/audit": { label: "Audit Trail", parent: "Sistema" },
  "/relatorios": { label: "Relatorios", parent: "Executivo" },
  "/escolas": { label: "Banco de Escolas", parent: "Inteligencia" },
  "/matching": { label: "Motor de Match", parent: "Inteligencia" },
  "/financeiro": { label: "Financeiro", parent: "Comercial" },
  "/remarketing": { label: "Re-marketing", parent: "Comercial" },
  "/documentos": { label: "Documentos", parent: "Sistema" },
  "/automacoes-monitor": { label: "Automacoes", parent: "Sistema" },
};

interface HeaderProps {
  nome?: string;
}

export function Header({ nome }: HeaderProps) {
  const pathname = usePathname();

  const currentPage = BREADCRUMB_MAP[pathname] ?? BREADCRUMB_MAP["/" + pathname.split("/")[1]];

  return (
    <header className="flex h-14 items-center gap-4 border-b border-border bg-background/80 px-6 backdrop-blur-xl">
      {/* Breadcrumb */}
      <div className="flex flex-1 items-center gap-2 text-sm">
        <span className="text-muted-foreground">BAUSA Engine</span>
        <span className="text-label-tertiary">/</span>
        {currentPage?.parent && (
          <>
            <span className="text-muted-foreground">{currentPage.parent}</span>
            <span className="text-label-tertiary">/</span>
          </>
        )}
        <span className="font-medium text-foreground">
          {currentPage?.label ?? "Página"}
        </span>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <button className="flex h-8 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <Search className="h-3.5 w-3.5" />
          <span>Buscar...</span>
          <kbd className="ml-2 rounded border border-border px-1 text-[10px] text-muted-foreground">⌘K</kbd>
        </button>

        {/* Notificações */}
        <NotificationCenter />

        {/* Indicador Realtime */}
        <div className="flex items-center gap-1.5 rounded-full border border-sys-green/20 bg-sys-green/15 px-2.5 py-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sys-green" />
          <span className="text-[10px] font-medium text-sys-green">Ao vivo</span>
        </div>
      </div>
    </header>
  );
}
