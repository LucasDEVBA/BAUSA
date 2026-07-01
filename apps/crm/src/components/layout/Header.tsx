"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotificationCenter } from "./NotificationCenter";
import { ThemeToggle } from "./ThemeToggle";
import { getInitials } from "@/lib/utils";

const BREADCRUMB_MAP: Record<string, { label: string; parent?: string }> = {
  "/dashboard": { label: "Dashboard", parent: "Leads" },
  "/leads": { label: "Lista", parent: "Leads" },
  "/pipeline": { label: "Pipeline" },
  "/war-room": { label: "War Room" },
  "/war-room/familias": { label: "Famílias (gerencial)", parent: "War Room" },
  "/war-room/familias-onboarding": { label: "Onboarding Famílias", parent: "War Room" },
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
  avatarUrl?: string | null;
}

export function Header({ nome, avatarUrl }: HeaderProps) {
  const pathname = usePathname();

  const currentPage = BREADCRUMB_MAP[pathname] ?? BREADCRUMB_MAP["/" + pathname.split("/")[1]];

  return (
    <header className="flex h-14 items-center gap-4 border-b border-border bg-background/80 px-6 backdrop-blur-xl">
      {/* Breadcrumb */}
      <div className="flex flex-1 items-center gap-2 text-sm">
        <span className="text-muted-foreground">BAU Global</span>
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
        {/* Alternar tema claro/escuro */}
        <ThemeToggle />

        {/* Notificações */}
        <NotificationCenter />

        {/* Avatar → Meu Perfil */}
        <Link href="/perfil" title="Meu perfil" className="ml-1 flex-shrink-0">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={nome ?? "Perfil"}
              width={32}
              height={32}
              unoptimized
              className="h-8 w-8 rounded-full object-cover ring-1 ring-border transition-opacity hover:opacity-80"
            />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-brand text-xs font-bold text-white transition-opacity hover:opacity-80">
              {nome ? getInitials(nome) : "U"}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
