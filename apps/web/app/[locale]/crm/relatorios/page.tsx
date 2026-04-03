import { createServerSupabaseClient } from "@/lib/crm/supabase-server";
import { requirePapel } from "@/lib/crm/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function RelatoriosPage({ params }: PageProps) {
  const { locale } = await params;
  await requirePapel("ceo", locale);
  const supabase = await createServerSupabaseClient();
  const mesAtual = new Date().toISOString().slice(0, 7);

  // === COMERCIAL ===
  const { data: allDeals } = await supabase.from("deals").select("etapa, valor_estimado, probabilidade_fechamento, motivo_perda, safra, created_at").is("deleted_at", null);
  const dealsAtivos = (allDeals || []).filter((d) => !["perdido", "concluido", "cancelamento_solicitado"].includes(d.etapa));
  const dealsPorEtapa: Record<string, number> = {};
  dealsAtivos.forEach((d) => { dealsPorEtapa[d.etapa] = (dealsPorEtapa[d.etapa] || 0) + 1; });

  const { data: contratosMes } = await supabase.from("contratos_financeiros").select("valor_total").is("deleted_at", null).gte("created_at", `${mesAtual}-01`);
  const receitaMes = (contratosMes || []).reduce((s, c) => s + Number(c.valor_total), 0);

  const { data: atletas } = await supabase.from("atletas").select("origem, lead_classificacao").is("deleted_at", null);
  const leadsPorOrigem: Record<string, number> = {};
  (atletas || []).forEach((a) => { leadsPorOrigem[a.origem || "outro"] = (leadsPorOrigem[a.origem || "outro"] || 0) + 1; });

  const motivosPerda: Record<string, number> = {};
  (allDeals || []).filter((d) => d.etapa === "perdido" && d.motivo_perda).forEach((d) => {
    motivosPerda[d.motivo_perda!] = (motivosPerda[d.motivo_perda!] || 0) + 1;
  });

  // === FINANCEIRO ===
  const { data: todasParcelas } = await supabase.from("parcelas").select("valor, status, vencimento, recebido_at").is("deleted_at", null);
  const recebidasMes = (todasParcelas || []).filter((p) => p.status === "recebido" && p.recebido_at?.startsWith(mesAtual));
  const receitaRecebida = recebidasMes.reduce((s, p) => s + Number(p.valor), 0);
  const atrasadas = (todasParcelas || []).filter((p) => p.status === "atrasado");
  const totalAtrasado = atrasadas.reduce((s, p) => s + Number(p.valor), 0);

  const hoje = new Date().toISOString().split("T")[0];
  const em30d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const em60d = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const em90d = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const previstas = (todasParcelas || []).filter((p) => p.status === "previsto");
  const prev30 = previstas.filter((p) => p.vencimento <= em30d && p.vencimento >= hoje).reduce((s, p) => s + Number(p.valor), 0);
  const prev60 = previstas.filter((p) => p.vencimento <= em60d && p.vencimento >= hoje).reduce((s, p) => s + Number(p.valor), 0);
  const prev90 = previstas.filter((p) => p.vencimento <= em90d && p.vencimento >= hoje).reduce((s, p) => s + Number(p.valor), 0);

  // === EXPERIÊNCIA ===
  const { data: exps } = await supabase.from("crm_experiencia").select("temperatura, status, ansiedade, satisfacao, fase").is("deleted_at", null);
  const tempDist: Record<string, number> = { verde: 0, amarelo: 0, vermelho: 0 };
  (exps || []).forEach((e) => { tempDist[e.temperatura] = (tempDist[e.temperatura] || 0) + 1; });
  const avgSat = (exps || []).length > 0 ? ((exps || []).reduce((s, e) => s + (Number(e.satisfacao) || 0), 0) / exps!.length).toFixed(1) : "—";
  const avgAns = (exps || []).length > 0 ? ((exps || []).reduce((s, e) => s + (Number(e.ansiedade) || 0), 0) / exps!.length).toFixed(1) : "—";

  // === ESCOLAS ===
  const { data: escolas } = await supabase.from("escolas").select("id, nome, total_aplicados, total_aceitos, taxa_aceitacao, bolsa_media_obtida, ultimo_contato_at").is("deleted_at", null).eq("status", "ativa").order("taxa_aceitacao", { ascending: false }).limit(20);
  const sem90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;

  // Bar helper
  const Bar = ({ value, max, color = "bg-[var(--crm-accent-500)]" }: { value: number; max: number; color?: string }) => (
    <div className="w-full bg-[var(--crm-neutral-200)] rounded-full h-3">
      <div className={`${color} h-3 rounded-full transition-all`} style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%` }} />
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="crm-page-title">Relatorios</h1>
        <p className="crm-page-subtitle">Analise consolidada do desempenho</p>
      </div>

      <Tabs defaultValue="comercial">
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="comercial">Comercial</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="experiencia">Experiencia</TabsTrigger>
          <TabsTrigger value="escolas">Escolas</TabsTrigger>
        </TabsList>

        <TabsContent value="comercial" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="crm-card text-center"><p className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">Receita mes</p><p className="text-xl font-[var(--crm-weight-bold)] text-[var(--crm-text-primary)]">{fmt(receitaMes)}</p></div>
            <div className="crm-card text-center"><p className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">Deals ativos</p><p className="text-xl font-[var(--crm-weight-bold)] text-[var(--crm-text-primary)]">{dealsAtivos.length}</p></div>
            <div className="crm-card text-center"><p className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">Atletas CRM</p><p className="text-xl font-[var(--crm-weight-bold)] text-[var(--crm-text-primary)]">{atletas?.length ?? 0}</p></div>
            <div className="crm-card text-center"><p className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">Perdidos</p><p className="text-xl font-[var(--crm-weight-bold)] text-[var(--crm-text-primary)]">{(allDeals || []).filter((d) => d.etapa === "perdido").length}</p></div>
          </div>
          <div className="crm-card">
            <p className="crm-section-label mb-4">Pipeline por etapa</p>
            <div className="space-y-2">
              {Object.entries(dealsPorEtapa).map(([etapa, count]) => (
                <div key={etapa} className="flex items-center gap-3 text-sm">
                  <span className="w-40 truncate capitalize text-[var(--crm-text-primary)]">{etapa.replace(/_/g, " ")}</span>
                  <Bar value={count} max={Math.max(...Object.values(dealsPorEtapa))} />
                  <span className="w-8 text-right font-[var(--crm-weight-medium)] text-[var(--crm-text-primary)]">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="crm-card">
              <p className="crm-section-label mb-4">Leads por origem</p>
              <div className="space-y-2">{Object.entries(leadsPorOrigem).map(([o, c]) => (
                <div key={o} className="flex justify-between text-sm"><span className="capitalize text-[var(--crm-text-primary)]">{o.replace("_", " ")}</span><span className="font-[var(--crm-weight-medium)] text-[var(--crm-text-primary)]">{c}</span></div>
              ))}</div>
            </div>
            <div className="crm-card">
              <p className="crm-section-label mb-4">Motivos de perda</p>
              <div className="space-y-2">{Object.entries(motivosPerda).length === 0 ? <p className="text-[var(--crm-text-sm)] text-[var(--crm-text-tertiary)]">Nenhum deal perdido.</p> : Object.entries(motivosPerda).map(([m, c]) => (
                <div key={m} className="flex justify-between text-sm"><span className="capitalize text-[var(--crm-text-primary)]">{m.replace("_", " ")}</span><span className="font-[var(--crm-weight-medium)] text-[var(--crm-text-primary)]">{c}</span></div>
              ))}</div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="financeiro" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="crm-card text-center"><p className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">Recebida mes</p><p className="text-xl font-[var(--crm-weight-bold)] text-[var(--crm-text-primary)]">{fmt(receitaRecebida)}</p></div>
            <div className={`crm-card text-center ${totalAtrasado > 0 ? "border-[var(--crm-error)]/30" : ""}`}><p className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">Inadimplencia</p><p className="text-xl font-[var(--crm-weight-bold)] text-[var(--crm-error)]">{fmt(totalAtrasado)}</p></div>
            <div className="crm-card text-center"><p className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">Previsao 30d</p><p className="text-xl font-[var(--crm-weight-bold)] text-[var(--crm-text-primary)]">{fmt(prev30)}</p></div>
            <div className="crm-card text-center"><p className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">Previsao 90d</p><p className="text-xl font-[var(--crm-weight-bold)] text-[var(--crm-text-primary)]">{fmt(prev90)}</p></div>
          </div>
          <div className="crm-card">
            <p className="crm-section-label mb-4">Previsao de recebiveis</p>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm"><span className="w-24 text-[var(--crm-text-primary)]">30 dias</span><Bar value={prev30} max={prev90 || 1} color="bg-[var(--crm-success)]" /><span className="w-24 text-right text-[var(--crm-text-primary)]">{fmt(prev30)}</span></div>
              <div className="flex items-center gap-3 text-sm"><span className="w-24 text-[var(--crm-text-primary)]">60 dias</span><Bar value={prev60} max={prev90 || 1} color="bg-[var(--crm-info)]" /><span className="w-24 text-right text-[var(--crm-text-primary)]">{fmt(prev60)}</span></div>
              <div className="flex items-center gap-3 text-sm"><span className="w-24 text-[var(--crm-text-primary)]">90 dias</span><Bar value={prev90} max={prev90 || 1} color="bg-[var(--crm-accent-500)]" /><span className="w-24 text-right text-[var(--crm-text-primary)]">{fmt(prev90)}</span></div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="experiencia" className="mt-4 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="crm-card text-center"><p className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">Total</p><p className="text-xl font-[var(--crm-weight-bold)] text-[var(--crm-text-primary)]">{exps?.length ?? 0}</p></div>
            <div className="crm-card text-center"><p className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">Verde</p><p className="text-xl font-[var(--crm-weight-bold)] text-[var(--crm-success)]">{tempDist.verde}</p></div>
            <div className="crm-card text-center"><p className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">Amarelo</p><p className="text-xl font-[var(--crm-weight-bold)] text-[var(--crm-warning)]">{tempDist.amarelo}</p></div>
            <div className="crm-card text-center"><p className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">Vermelho</p><p className="text-xl font-[var(--crm-weight-bold)] text-[var(--crm-error)]">{tempDist.vermelho}</p></div>
            <div className="crm-card text-center"><p className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">Satisfacao</p><p className="text-xl font-[var(--crm-weight-bold)] text-[var(--crm-text-primary)]">{avgSat}/5</p></div>
          </div>
        </TabsContent>

        <TabsContent value="escolas" className="mt-4 space-y-6">
          <div className="crm-card">
            <p className="crm-section-label mb-4">Ranking por taxa de aceitacao</p>
            {!escolas?.length ? <p className="text-[var(--crm-text-sm)] text-[var(--crm-text-tertiary)]">Nenhuma escola cadastrada.</p> : (
              <div className="space-y-2">{escolas.filter((e) => e.total_aplicados > 0).map((e) => (
                <div key={e.id} className="flex items-center gap-3 text-sm">
                  <span className="w-48 truncate text-[var(--crm-text-primary)]">{e.nome}</span>
                  <Bar value={Number(e.taxa_aceitacao)} max={100} color="bg-[var(--crm-success)]" />
                  <span className="w-16 text-right text-[var(--crm-text-primary)]">{Number(e.taxa_aceitacao).toFixed(0)}%</span>
                  <span className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">({e.total_aceitos}/{e.total_aplicados})</span>
                </div>
              ))}</div>
            )}
          </div>
          <div className="crm-card">
            <p className="crm-section-label mb-4">Escolas sem contato 90+ dias</p>
            {(() => {
              const semContato = (escolas || []).filter((e) => !e.ultimo_contato_at || e.ultimo_contato_at < sem90d);
              return semContato.length === 0 ? <p className="text-[var(--crm-text-sm)] text-[var(--crm-text-tertiary)]">Todas as escolas com contato recente.</p> : (
                <div className="space-y-1">{semContato.map((e) => (
                  <div key={e.id} className="flex justify-between text-sm">
                    <span className="text-[var(--crm-text-primary)]">{e.nome}</span>
                    <span className="crm-badge crm-badge-error">Sem contato</span>
                  </div>
                ))}</div>
              );
            })()}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
