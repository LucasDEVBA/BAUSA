"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { NotificationCenter } from "./NotificationCenter";
import { ThemeToggle } from "./ThemeToggle";
import { getInitials } from "@/lib/utils";

const BREADCRUMB_MAP: Record<string, { label: string; parent?: string }> = {
  "/dashboard": { label: "Dashboard", parent: "Leads" },
  "/leads": { label: "Lista", parent: "Leads" },
  "/pipeline": { label: "Pipeline" },
  "/agenda": { label: "Agenda", parent: "Comercial" },
  "/war-room": { label: "War Room" },
  "/war-room/familias": { label: "Famílias (gerencial)", parent: "War Room" },
  "/war-room/familias-onboarding": { label: "Onboarding Famílias", parent: "War Room" },
  "/analytics": { label: "Analytics", parent: "Executivo" },
  "/analytics/atribuicao": { label: "Atribuição", parent: "Analytics" },
  "/analytics/cac": { label: "CAC/ROI", parent: "Analytics" },
  "/analytics/conversas": { label: "Conversas", parent: "Analytics" },
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
  "/whatsapp": { label: "WhatsApp", parent: "Comercial" },
  "/automacoes": { label: "Automações", parent: "Comercial" },
  "/automacoes-monitor": { label: "Monitor de filas", parent: "Sistema" },
  "/sistema": { label: "Sistema" },
};

// Crumbs que mapeiam para uma rota real (viram links). Grupos sem rota própria
// (Executivo, Comercial, Inteligência…) ficam como texto.
const CRUMB_HREF: Record<string, string> = {
  "BAU Engine": "/war-room",
  Leads: "/leads",
  "War Room": "/war-room",
  Analytics: "/analytics",
  Sistema: "/sistema",
};

interface HeaderProps {
  nome?: string;
  avatarUrl?: string | null;
}

export function Header({ nome, avatarUrl }: HeaderProps) {
  const pathname = usePathname();
  const currentPage = BREADCRUMB_MAP[pathname] ?? BREADCRUMB_MAP["/" + pathname.split("/")[1]];

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/70 px-5 backdrop-blur-xl">
      {/* Breadcrumb navegável */}
      <nav aria-label="Trilha de navegação" className="flex min-w-0 flex-1 items-center gap-1.5">
        <Link
          href="/war-room"
          className="hidden text-xs text-muted-foreground transition-colors hover:text-foreground sm:inline"
        >
          BAU Engine
        </Link>
        <ChevronRight aria-hidden className="hidden size-3 text-label-tertiary sm:inline" />
        {currentPage?.parent && (
          <>
            {CRUMB_HREF[currentPage.parent] ? (
              <Link
                href={CRUMB_HREF[currentPage.parent]}
                className="hidden text-xs text-muted-foreground transition-colors hover:text-foreground md:inline"
              >
                {currentPage.parent}
              </Link>
            ) : (
              <span className="hidden text-xs text-muted-foreground md:inline">{currentPage.parent}</span>
            )}
            <ChevronRight aria-hidden className="hidden size-3 text-label-tertiary md:inline" />
          </>
        )}
        <span aria-current="page" className="truncate text-base font-semibold tracking-tight text-foreground">
          {currentPage?.label ?? "Página"}
        </span>
      </nav>

      {/* Ações */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <NotificationCenter />
        <Link href="/perfil" title="Meu perfil" className="ml-0.5 shrink-0">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={nome ?? "Perfil"}
              width={32}
              height={32}
              unoptimized
              className="size-8 rounded-full object-cover ring-1 ring-border transition-opacity hover:opacity-80"
            />
          ) : (
            <span className="flex size-8 items-center justify-center rounded-full bg-gradient-brand text-xs font-bold text-white transition-opacity hover:opacity-80">
              {nome ? getInitials(nome) : "U"}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
