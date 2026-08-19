"use client";

import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { NotificationCenter } from "./NotificationCenter";
import { ThemeToggle } from "./ThemeToggle";
import { AprovacoesLeads } from "@/components/leads/AprovacoesLeads";
import { getInitials } from "@/lib/utils";

const BREADCRUMB_MAP: Record<string, { label: string; parent?: string }> = {
  "/dashboard": { label: "Dashboard", parent: "Leads" },
  "/leads": { label: "Lista", parent: "Leads" },
  "/pipeline": { label: "Pipeline" },
  "/ads": { label: "Campanhas", parent: "Ads" },
  "/ads/desempenho": { label: "Desempenho", parent: "Ads" },
  "/ads/roi": { label: "CAC / ROI", parent: "Ads" },
  "/ads/planejar": { label: "Planejar campanha", parent: "Ads" },
  "/ads/campanha": { label: "Campanha", parent: "Ads" },
  "/agenda": { label: "Agenda", parent: "Comercial" },
  "/war-room": { label: "War Room" },
  "/war-room/familias": { label: "Famílias (gerencial)", parent: "War Room" },
  "/war-room/familias-onboarding": { label: "Onboarding Famílias", parent: "War Room" },
  "/analytics": { label: "Analytics", parent: "Executivo" },
  "/analytics/atribuicao": { label: "Atribuição", parent: "Analytics" },
  "/analytics/cac": { label: "CAC/ROI", parent: "Analytics" },
  "/analytics/conversas": { label: "Conversas", parent: "Analytics" },
  "/analytics/reunioes": { label: "Reuniões", parent: "Analytics" },
  "/analytics/utm-builder": { label: "Gerador UTM", parent: "Analytics" },
  "/familias-crm/onboarding": { label: "Onboarding da família", parent: "Famílias" },
  "/messages": { label: "Mensagens" },
  "/minha-area": { label: "Minha Área" },
  "/minha-area/familias": { label: "Famílias", parent: "Minha Área" },
  "/minha-area/onboarding": { label: "Onboarding", parent: "Minha Área" },
  "/minha-area/desempenho": { label: "Desempenho", parent: "Minha Área" },
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
  "/emails": { label: "E-mails", parent: "Comercial" },
  "/automacoes": { label: "Automações", parent: "Comercial" },
  "/fluxos": { label: "Fluxos", parent: "Comercial" },
  "/fluxos/metricas": { label: "Métricas", parent: "Fluxos" },
  "/fluxos/contatos": { label: "Contatos", parent: "Fluxos" },
  "/automacoes-monitor": { label: "Monitor de filas", parent: "Sistema" },
  "/observabilidade": { label: "Monitor de filas", parent: "Observabilidade" },
  "/observabilidade/geral": { label: "Geral", parent: "Observabilidade" },
  "/observabilidade/automacoes": { label: "Saúde das automações", parent: "Observabilidade" },
  "/agents": { label: "Agents de IA", parent: "Sistema" },
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
  Famílias: "/familias-crm",
};

interface HeaderProps {
  nome?: string;
  avatarUrl?: string | null;
}

export function Header({ nome, avatarUrl }: HeaderProps) {
  const pathname = usePathname();
  // Lookup: exato → prefixo de 2 segmentos (rotas dinâmicas, ex.
  // /familias-crm/onboarding/<id>) → prefixo de 1 segmento.
  const segs = pathname.split("/");
  const currentPage =
    BREADCRUMB_MAP[pathname] ??
    BREADCRUMB_MAP["/" + segs.slice(1, 3).join("/")] ??
    BREADCRUMB_MAP["/" + segs[1]];

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
        {/* Fila de aprovação de leads — ícone com badge; só CEO/CTO enxergam */}
        <Suspense fallback={null}>
          <AprovacoesLeads variant="icon" />
        </Suspense>
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
