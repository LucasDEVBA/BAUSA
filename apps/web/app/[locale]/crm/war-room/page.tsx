import { createServerSupabaseClient } from "@/lib/crm/supabase-server";
import { requirePapel } from "@/lib/crm/auth";
import { verificarAlertas } from "@/lib/crm/automacoes/verificar-alertas";
import { MetricCard } from "@/components/crm/shared/MetricCard";
import { WarRoomSectionCard } from "@/components/crm/shared/WarRoomSectionCard";
import { GoalProgressCard } from "@/components/crm/shared/GoalProgressCard";
import { AlertsPanel } from "@/components/crm/shared/AlertsPanel";
import {
  Target, TrendingUp, DollarSign, Users, Kanban,
  AlertTriangle, Heart, BarChart3, Clock,
} from "lucide-react";
import Link from "next/link";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function WarRoomPage({ params }: PageProps) {
  const { locale } = await params;
  await requirePapel("ceo", locale);
  const supabase = await createServerSupabaseClient();

  const alertas = await verificarAlertas();
  const today = new Date().toISOString().split("T")[0];
  const mesAtual = new Date().toISOString().slice(0, 7);

  // Receita fechada (contratos do mês)
  const { data: contratosMes } = await supabase
    .from("contratos_financeiros").select("valor_total").is("deleted_at", null).gte("created_at", `${mesAtual}-01`);
  const receitaFechada = (contratosMes || []).reduce((s, c) => s + Number(c.valor_total), 0);

  // Receita recebida
  const { data: parcelasRecebidas } = await supabase
    .from("parcelas").select("valor").eq("status", "recebido").is("deleted_at", null).gte("recebido_at", `${mesAtual}-01`);
  const receitaRecebida = (parcelasRecebidas || []).reduce((s, p) => s + Number(p.valor), 0);

  // Pipeline provável
  const { data: dealsAtivos } = await supabase
    .from("deals").select("valor_estimado, probabilidade_fechamento, etapa")
    .is("deleted_at", null).not("etapa", "in", "(perdido,concluido,cancelamento_solicitado)");
  const pipelineTotal = (dealsAtivos || []).reduce((s, d) => s + (Number(d.valor_estimado) || 0), 0);
  const pipelineProvavel = (dealsAtivos || []).reduce(
    (s, d) => s + (Number(d.valor_estimado) || 0) * (Number(d.probabilidade_fechamento) || 0) / 100, 0);
  const totalDeals = dealsAtivos?.length || 0;

  // Conversão: deals concluídos / total
  const { count: dealsConcluidos } = await supabase
    .from("deals").select("*", { count: "exact", head: true }).eq("etapa", "concluido").is("deleted_at", null);
  const { count: dealsTotal } = await supabase
    .from("deals").select("*", { count: "exact", head: true }).is("deleted_at", null);
  const taxaConversao = dealsTotal && dealsTotal > 0 ? Math.round(((dealsConcluidos || 0) / dealsTotal) * 100) : 0;

  // Meta mensal
  const { data: metaConfig } = await supabase
    .from("configuracoes_sistema").select("valor").eq("chave", "meta_mensal_padrao").single();
  const metaMensal = metaConfig ? Number(metaConfig.valor) : 125000;

  // Experiência
  const { data: expStats } = await supabase
    .from("crm_experiencia").select("temperatura, status, ansiedade, satisfacao").is("deleted_at", null);
  const expTotal = expStats?.length || 0;
  const expVerde = expStats?.filter((e) => e.temperatura === "verde").length || 0;
  const expCrise = expStats?.filter((e) => e.status === "crise").length || 0;

  // Parcelas atrasadas
  const { data: parcelasAtrasadas } = await supabase
    .from("parcelas").select("valor").eq("status", "atrasado").is("deleted_at", null);
  const totalAtrasado = (parcelasAtrasadas || []).reduce((s, p) => s + Number(p.valor), 0);

  // Sem next action
  const { count: semNextAction } = await supabase
    .from("deals").select("*", { count: "exact", head: true })
    .is("deleted_at", null).is("next_action", null)
    .not("etapa", "in", "(perdido,concluido,cancelamento_solicitado)");

  // Leads recentes
  const { data: recentLeads } = await supabase
    .from("form_submissions")
    .select("id, athlete_name, qualification_classification, submitted_at, investment_range")
    .order("submitted_at", { ascending: false }).limit(5);

  // Proximas acoes
  const { data: proximasAcoes } = await supabase
    .from("deals")
    .select("id, next_action, data_proxima_acao, atleta:atletas(nome_completo), etapa")
    .is("deleted_at", null).not("next_action", "is", null)
    .not("etapa", "in", "(perdido,concluido,cancelamento_solicitado)")
    .order("data_proxima_acao", { ascending: true }).limit(10);

  // Pipeline por etapa
  const etapaStats = (dealsAtivos || []).reduce<Record<string, { count: number; valor: number }>>((acc, d) => {
    if (!acc[d.etapa]) acc[d.etapa] = { count: 0, valor: 0 };
    acc[d.etapa].count++;
    acc[d.etapa].valor += Number(d.valor_estimado) || 0;
    return acc;
  }, {});

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;
  const fmtK = (v: number) => `R$ ${(v / 1000).toFixed(0)}k`;
  const prefix = locale === "pt" ? "" : `/${locale}`;

  const classColor = (cls: string | null) => {
    if (cls === "QUENTE" || cls === "hot") return "text-[var(--crm-hot)] bg-[var(--crm-hot-tint)]";
    if (cls === "MORNO" || cls === "warm") return "text-[var(--crm-warm)] bg-[var(--crm-warm-tint)]";
    return "text-[var(--crm-cold)] bg-[var(--crm-cold-tint)]";
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="crm-page-title">War Room</h1>
        <p className="crm-page-subtitle">Visao executiva consolidada em tempo real</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Receita Fechada" value={fmtK(receitaFechada)} subtitle="mes corrente" icon={DollarSign} variant="hot" />
        <MetricCard title="Pipeline Total" value={fmtK(pipelineTotal)} subtitle={`${totalDeals} deals ativos`} icon={Kanban} variant="purple" />
        <MetricCard title="Taxa Conversao" value={`${taxaConversao}%`} subtitle="deals concluidos/total" icon={TrendingUp} variant="cold" />
        <MetricCard title="Familias Ativas" value={String(expTotal)} subtitle={expCrise > 0 ? `${expCrise} em crise` : "nenhuma crise"} icon={Heart} variant={expCrise > 0 ? "danger" : "default"} />
      </div>

      {/* Meta + Sections Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GoalProgressCard recebido={receitaRecebida} projetado={pipelineProvavel} meta={metaMensal} />

        <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-3">
          <WarRoomSectionCard href={`${prefix}/crm/relatorios`} title="Meta e Receita" icon={Target} variant="success"
            lines={[fmtK(receitaFechada), `Meta: ${fmtK(metaMensal)}`]}
            badge={receitaFechada >= metaMensal ? { label: "No target", variant: "success" } : { label: `Gap ${fmtK(metaMensal - receitaFechada)}`, variant: "warning" }} />
          <WarRoomSectionCard href={`${prefix}/crm/pipeline`} title="Funil Comercial" icon={Kanban} variant="indigo"
            lines={[`${totalDeals} deals ativos`, `Conversao: ${taxaConversao}%`]} />
          <WarRoomSectionCard href={`${prefix}/crm/relatorios`} title="Caixa" icon={DollarSign} variant="blue"
            lines={[`Recebido: ${fmtK(receitaRecebida)}`, `Projetado: ${fmtK(pipelineProvavel)}`]} />
          <WarRoomSectionCard href={`${prefix}/crm/relatorios`} title="Receita em Risco" icon={AlertTriangle}
            variant={totalAtrasado > 0 ? "danger" : "default"}
            lines={[totalAtrasado > 0 ? `Atrasado: ${fmt(totalAtrasado)}` : "Nenhum atraso", `Sem action: ${semNextAction || 0}`]}
            badge={totalAtrasado > 0 ? { label: "Atencao", variant: "danger" } : undefined} />
          <WarRoomSectionCard href={`${prefix}/crm/relatorios`} title="Posicionamento" icon={BarChart3} variant="purple"
            lines={[`Ticket medio: ${fmtK(totalDeals > 0 ? pipelineTotal / totalDeals : 0)}`, `${totalDeals} deals`]} />
          <WarRoomSectionCard href={`${prefix}/crm/experiencia`} title="Familias" icon={Heart} variant={expCrise > 0 ? "danger" : "success"}
            lines={[`${expTotal} ativas | ${expVerde} satisfeitas`, expCrise > 0 ? `${expCrise} em crise` : "Todas bem"]}
            badge={expCrise > 0 ? { label: `${expCrise} crise(s)`, variant: "danger" } : { label: "Saudavel", variant: "success" }} />
        </div>
      </div>

      {/* Alertas */}
      <AlertsPanel alertas={alertas} />

      {/* Leads + Acoes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="crm-card">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[var(--crm-text-xs)] font-[var(--crm-weight-semibold)] uppercase tracking-[var(--crm-tracking-widest)] text-[var(--crm-text-secondary)]">Leads Recentes</p>
            <Link href={`${prefix}/crm/leads`} className="text-[var(--crm-text-xs)] text-[var(--crm-text-link)] hover:text-[var(--crm-text-link-hover)]">Ver todos</Link>
          </div>
          {!recentLeads?.length ? (
            <p className="text-[var(--crm-text-base)] text-[var(--crm-text-tertiary)]">Nenhum lead recente.</p>
          ) : (
            <div className="space-y-3">
              {recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-[var(--crm-text-base)] font-[var(--crm-weight-medium)] text-[var(--crm-text-primary)]">{lead.athlete_name}</p>
                    <p className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">{lead.investment_range}</p>
                  </div>
                  <span className={`text-[var(--crm-text-xs)] font-[var(--crm-weight-semibold)] px-2 py-0.5 rounded-full ${classColor(lead.qualification_classification)}`}>
                    {lead.qualification_classification || "N/A"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="crm-card">
          <p className="text-[var(--crm-text-xs)] font-[var(--crm-weight-semibold)] uppercase tracking-[var(--crm-tracking-widest)] text-[var(--crm-text-secondary)] mb-4">Proximas Acoes</p>
          {!proximasAcoes?.length ? (
            <p className="text-[var(--crm-text-base)] text-[var(--crm-text-tertiary)]">Nenhuma acao pendente.</p>
          ) : (
            <div className="space-y-2">
              {proximasAcoes.map((deal: any) => {
                const vencido = deal.data_proxima_acao && deal.data_proxima_acao < today;
                return (
                  <Link key={deal.id} href={`${prefix}/crm/pipeline`} className="block">
                    <div className={`flex items-center justify-between p-2.5 rounded-[var(--crm-radius-lg)] transition-colors hover:bg-[var(--crm-hover-overlay)] ${vencido ? "bg-[var(--crm-error-subtle)] border border-[var(--crm-error-border)]" : ""}`}>
                      <div className="min-w-0">
                        <p className="text-[var(--crm-text-base)] font-[var(--crm-weight-medium)] text-[var(--crm-text-primary)]">{deal.atleta?.nome_completo || "—"}</p>
                        <p className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)] truncate max-w-[200px]">{deal.next_action}</p>
                      </div>
                      <span className={`text-[var(--crm-text-xs)] shrink-0 ${vencido ? "text-[var(--crm-error)] font-[var(--crm-weight-semibold)]" : "text-[var(--crm-text-tertiary)]"}`}>
                        {deal.data_proxima_acao || "—"}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Pipeline por Etapa */}
      <div className="crm-card">
        <p className="text-[var(--crm-text-xs)] font-[var(--crm-weight-semibold)] uppercase tracking-[var(--crm-tracking-widest)] text-[var(--crm-text-secondary)] mb-4">Pipeline por Etapa</p>
        {Object.keys(etapaStats).length === 0 ? (
          <p className="text-[var(--crm-text-base)] text-[var(--crm-text-tertiary)]">Nenhum deal no pipeline.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[var(--crm-text-base)]">
              <thead>
                <tr className="border-b border-[var(--crm-border)] text-left">
                  <th className="pb-2 font-[var(--crm-weight-medium)] text-[var(--crm-text-secondary)]">Etapa</th>
                  <th className="pb-2 font-[var(--crm-weight-medium)] text-[var(--crm-text-secondary)] text-right">Deals</th>
                  <th className="pb-2 font-[var(--crm-weight-medium)] text-[var(--crm-text-secondary)] text-right">Valor Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(etapaStats).map(([etapa, stats]) => (
                  <tr key={etapa} className="border-b border-[var(--crm-border)] last:border-0">
                    <td className="py-2.5 text-[var(--crm-text-primary)] capitalize">{etapa.replace(/_/g, " ")}</td>
                    <td className="py-2.5 text-[var(--crm-text-secondary)] text-right">{stats.count}</td>
                    <td className="py-2.5 text-[var(--crm-text-primary)] text-right font-[var(--crm-weight-medium)]">{fmt(stats.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
