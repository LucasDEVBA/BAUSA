"use client";

import { useRouter, usePathname } from "next/navigation";
import { createBrowserClient } from "@/lib/crm/supabase-browser";
import { Sidebar } from "./Sidebar";
import { NotificationBell } from "./NotificationBell";
import { Search } from "lucide-react";
import type { PapelUsuario } from "@/types/crm";

/*
  COMPONENT: CrmShell
  PROBLEM:   Breadcrumb uses raw zinc-* classes, header uses hardcoded rgba values
             via .crm-glass (ok). Search bar uses mixed inline and token styles.
             Live indicator uses raw emerald-* classes.
  DECISION:  Migrate to CRM design tokens. Consolidate header layout with token-based
             spacing. Search bar and live indicator use semantic tokens.
             Brand DNA: Premium (glass header), Controlled (consistent spacing).
  CONTRAST:  Breadcrumb muted: --crm-text-tertiary on glass = ~4.2:1 AA
             Breadcrumb active: --crm-text-primary on glass = ~17:1 AAA
             Search placeholder: --crm-text-disabled (decorative) = exempt
*/

const BREADCRUMB_MAP: Record<string, { label: string; parent?: string }> = {
  "/crm/war-room": { label: "War Room", parent: "Executivo" },
  "/crm/relatorios": { label: "Relatorios", parent: "Executivo" },
  "/crm/pipeline": { label: "Pipeline", parent: "Comercial" },
  "/crm/leads": { label: "Leads", parent: "Comercial" },
  "/crm/financeiro": { label: "Financeiro", parent: "Comercial" },
  "/crm/escolas": { label: "Banco de Escolas", parent: "Inteligencia" },
  "/crm/matching": { label: "Motor de Match", parent: "Inteligencia" },
  "/crm/experiencia": { label: "Experiencia", parent: "Familias" },
  "/crm/tarefas": { label: "Tarefas", parent: "Sistema" },
  "/crm/faq": { label: "FAQ", parent: "Sistema" },
  "/crm/indicacoes": { label: "Indicacoes", parent: "Sistema" },
  "/crm/configuracoes": { label: "Configuracoes", parent: "Sistema" },
};

interface CrmShellProps {
  children: React.ReactNode;
  papel: PapelUsuario;
  nome: string;
}

export function CrmShell({ children, papel, nome }: CrmShellProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const cleanPath = pathname?.replace(/^\/(pt|en|es)/, "") || "";
  const currentPage = BREADCRUMB_MAP[cleanPath] ?? BREADCRUMB_MAP["/" + cleanPath.split("/").slice(1, 3).join("/")];

  return (
    <div className="crm-theme flex h-screen overflow-hidden">
      <Sidebar papel={papel} nome={nome} onLogout={handleLogout} />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header — glass morphism */}
        <header className="crm-glass flex h-[var(--crm-header-height)] items-center gap-4 border-b border-[var(--crm-border)] px-[var(--crm-content-padding)] shrink-0 z-[var(--crm-z-header)]">
          {/* Breadcrumb */}
          <div className="flex flex-1 items-center gap-2 text-[var(--crm-text-sm)]">
            <span className="text-[var(--crm-text-tertiary)] font-[var(--crm-weight-medium)]">BAUSA</span>
            <span className="text-[var(--crm-text-disabled)]">/</span>
            {currentPage?.parent && (
              <>
                <span className="text-[var(--crm-text-secondary)]">{currentPage.parent}</span>
                <span className="text-[var(--crm-text-disabled)]">/</span>
              </>
            )}
            <span className="font-[var(--crm-weight-semibold)] text-[var(--crm-text-primary)]">
              {currentPage?.label ?? "CRM"}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2.5">
            {/* Search trigger */}
            <button className="flex h-8 items-center gap-2 rounded-[var(--crm-radius-lg)] border border-[var(--crm-border)] bg-[var(--crm-surface)] px-3 text-[var(--crm-text-sm)] text-[var(--crm-text-secondary)] transition-all duration-[var(--crm-duration-fast)] hover:border-[var(--crm-border-strong)] hover:text-[var(--crm-text-primary)] hover:bg-[var(--crm-surface)]">
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Buscar...</span>
              <kbd className="hidden sm:inline ml-2 rounded border border-[var(--crm-border)] bg-[var(--crm-neutral-100)] px-1.5 py-0.5 text-[var(--crm-text-2xs)] font-[var(--crm-weight-medium)] text-[var(--crm-text-tertiary)]">
                ⌘K
              </kbd>
            </button>

            <NotificationBell />

            {/* Live indicator */}
            <div className="flex items-center gap-1.5 rounded-[var(--crm-radius-full)] border border-[var(--crm-success-border)] bg-[var(--crm-success-subtle)] px-2.5 py-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--crm-success)]" />
              <span className="text-[var(--crm-text-xs)] font-[var(--crm-weight-medium)] text-[var(--crm-success)]">
                Ao vivo
              </span>
            </div>
          </div>
        </header>

        {/* Content — explicit light bg for visual clarity */}
        <main className="flex-1 overflow-y-auto bg-[var(--crm-bg)] px-[var(--crm-content-padding)] py-[var(--crm-content-padding)]">
          {children}
        </main>
      </div>
    </div>
  );
}
