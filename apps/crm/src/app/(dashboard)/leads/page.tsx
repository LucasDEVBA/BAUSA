import type { Metadata } from "next";
import { Suspense } from "react";
import { Flame, Thermometer, Snowflake, Clock, Users, AlertTriangle } from "lucide-react";

import { LeadsTable } from "@/components/leads/LeadsTable";
import { LeadsExportButton } from "@/components/leads/LeadsExportButton";
import { AprovacoesLeads } from "@/components/leads/AprovacoesLeads";
import { EmptyState, PageHeader, StatCard } from "@/components/ui";
import { requirePapel } from "@/lib/auth";
import { parseFiltrosLeads } from "@/lib/leads-filtros";
import {
  carregarKpisLeads,
  carregarPaginaLeads,
  formSubmissionDoAtleta,
  obterLeadDossieInterno,
} from "@/lib/leads-lista";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { type Lead } from "@/types/lead";

export const metadata: Metadata = {
  title: "Leads",
};

const traco = (n: number | null): string | number => (n === null ? "—" : n);
const pct = (parte: number | null, todo: number): string =>
  parte === null ? "—" : `${Math.round((parte / todo) * 100)}%`;

/**
 * /leads paginada NO SERVIDOR (T8). Antes: select("*") de form_submissions
 * inteiro + atletas inteiro e tudo filtrado no navegador — o PostgREST corta
 * em 1000 linhas em silêncio (909 ativos em 08/10, ~250 novos/mês).
 * Agora: KPIs da base por head count; a tabela recebe UMA página (range +
 * count exact) e a busca/filtro/ordem vivem na URL.
 */
export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Telefone/e-mail de lead só para nível CEO (o menu já escondia; agora a rota barra).
  await requirePapel("ceo");
  const filtros = parseFiltrosLeads(await searchParams);
  const supabase = await createServerSupabaseClient();

  const carregarLeadInicial = async (): Promise<Lead | null> => {
    if (!filtros.lead && !filtros.atleta) return null;
    try {
      // T14: ?lead=<form_submission_id> (notificação "Reunião detectada —
      // fora do pipeline") abre o dossiê direto, mesmo sem atleta/deal.
      if (filtros.lead) return await obterLeadDossieInterno(supabase, filtros.lead);
      if (!filtros.atleta) return null;
      const fsId = await formSubmissionDoAtleta(supabase, filtros.atleta);
      return fsId ? await obterLeadDossieInterno(supabase, fsId) : null;
    } catch (e) {
      // Deep-link quebrado nunca derruba a lista.
      console.error({
        level: "error",
        action: filtros.lead ? "leads_deeplink_lead" : "leads_deeplink_atleta",
        message: e instanceof Error ? e.message : String(e),
      });
      return null;
    }
  };

  const [kpis, pagina, leadInicial] = await Promise.all([
    carregarKpisLeads(supabase),
    carregarPaginaLeads(supabase, filtros),
    carregarLeadInicial(),
  ]);

  const qualificados =
    kpis.quente !== null && kpis.morno !== null && kpis.frio !== null ? kpis.quente + kpis.morno + kpis.frio : null;
  const totalClass = qualificados || 1;
  const timingAlt = kpis.timingAlternativo ?? 0;

  return (
    <div className="space-y-5">
      {/* Header + botão de Aprovações ao lado do menu ⋯ (sempre visível) */}
      <div className="flex items-center justify-between gap-3">
        <PageHeader dense
          eyebrow="Comercial"
          title="Leads"
          description={`${traco(kpis.total)} leads recebidos${timingAlt > 0 ? ` · ${timingAlt} fora da janela ideal` : ""}`}
          actions={<LeadsExportButton filtros={filtros} total={pagina.ok ? pagina.total : null} />}
          className="min-w-0 flex-1"
        />
        <Suspense fallback={null}>
          <AprovacoesLeads count={kpis.pendentesAprovacao ?? 0} />
        </Suspense>
      </div>

      {/* KPI strip — base INTEIRA (não muda com a busca/filtro da tabela) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total de leads"
          value={traco(kpis.total)}
          context={`${traco(qualificados)} qualificados`}
          icon={Users}
          accent="brand"
        />
        <StatCard
          label="Quente"
          value={traco(kpis.quente)}
          context={`${pct(kpis.quente, totalClass)} do qualificado`}
          icon={Flame}
          accent="green"
        />
        <StatCard
          label="Morno"
          value={traco(kpis.morno)}
          context={`${pct(kpis.morno, totalClass)} do qualificado`}
          icon={Thermometer}
          accent="orange"
        />
        <StatCard
          label="Frio"
          value={traco(kpis.frio)}
          context={timingAlt > 0 ? `${timingAlt} timing alternativo` : `${pct(kpis.frio, totalClass)} do qualificado`}
          icon={timingAlt > 0 ? Clock : Snowflake}
          accent="blue"
        />
      </div>

      {/* Table */}
      {pagina.ok ? (
        <LeadsTable
          linhas={pagina.linhas}
          total={pagina.total}
          filtros={{ ...filtros, pagina: pagina.paginaEfetiva }}
          prioridades={pagina.prioridades}
          aviso={pagina.aviso}
          leadInicial={leadInicial}
        />
      ) : (
        <EmptyState icon={AlertTriangle} title="Erro ao carregar os leads" description={pagina.erro} />
      )}
    </div>
  );
}
