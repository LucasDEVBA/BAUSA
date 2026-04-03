import { requirePapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { RelatoriosClient } from "./client";

async function fetchReportData() {
  const supabase = await createServerSupabaseClient();

  // --- Comercial ---
  const { data: deals } = await supabase
    .from("deals")
    .select("id, etapa, valor_estimado, created_at, safra, atleta:atletas(lead_classificacao, nome_completo)")
    .is("deleted_at", null);

  const allDeals = deals || [];

  const now = new Date();
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const firstOfThisMonthDate = new Date(now.getFullYear(), now.getMonth(), 1);

  const dealsThisMonth = allDeals.filter((d) => d.created_at >= firstOfThisMonth);
  const dealsLastMonth = allDeals.filter(
    (d) => d.created_at >= firstOfLastMonth && d.created_at < firstOfThisMonth
  );

  // Deals by etapa
  const dealsByEtapa: Record<string, { count: number; total: number }> = {};
  for (const d of allDeals) {
    if (!dealsByEtapa[d.etapa]) dealsByEtapa[d.etapa] = { count: 0, total: 0 };
    dealsByEtapa[d.etapa].count += 1;
    dealsByEtapa[d.etapa].total += Number(d.valor_estimado) || 0;
  }

  // Deals by classification
  const dealsByClassificacao: Record<string, number> = { hot: 0, warm: 0, cold: 0 };
  for (const d of allDeals) {
    const atleta = d.atleta as unknown as { lead_classificacao: string | null } | null;
    const cls = atleta?.lead_classificacao?.toLowerCase() ?? "cold";
    if (cls in dealsByClassificacao) {
      dealsByClassificacao[cls] += 1;
    }
  }

  // Conversion metrics
  const leadsRecebidos = allDeals.filter((d) => d.etapa === "lead" || d.created_at).length;
  const reunioes = allDeals.filter(
    (d) => d.etapa === "reuniao_realizada" || d.etapa === "reuniao_marcada"
  ).length;
  const propostas = allDeals.filter(
    (d) =>
      d.etapa === "proposta_enviada" ||
      d.etapa === "followup_proposta" ||
      d.etapa === "negociacao"
  ).length;
  const contratos = allDeals.filter(
    (d) =>
      d.etapa === "contrato_assinado" ||
      d.etapa === "sinal_pago" ||
      d.etapa === "admission_process" ||
      d.etapa === "concluido"
  ).length;
  const taxaConversao =
    leadsRecebidos > 0 ? Math.round((contratos / leadsRecebidos) * 100) : 0;

  // --- Financeiro ---
  const { data: parcelas } = await supabase
    .from("parcelas")
    .select("id, valor, vencimento, status, contrato_id, recebido_at")
    .is("deleted_at", null);

  const allParcelas = parcelas || [];

  // Group parcelas by month
  const parcelasByMonth: Record<
    string,
    { recebido: number; previsto: number; atrasado: number }
  > = {};

  for (const p of allParcelas) {
    const monthKey = p.vencimento?.slice(0, 7) ?? "unknown";
    if (!parcelasByMonth[monthKey])
      parcelasByMonth[monthKey] = { recebido: 0, previsto: 0, atrasado: 0 };

    const val = Number(p.valor) || 0;
    if (p.status === "recebido") parcelasByMonth[monthKey].recebido += val;
    else if (p.status === "atrasado") parcelasByMonth[monthKey].atrasado += val;
    else if (p.status === "previsto") parcelasByMonth[monthKey].previsto += val;
  }

  // Inadimplencia
  const totalAtrasado = allParcelas
    .filter((p) => p.status === "atrasado")
    .reduce((sum, p) => sum + (Number(p.valor) || 0), 0);

  // Aging
  const aging30 = allParcelas
    .filter((p) => {
      if (p.status !== "atrasado") return false;
      const dias = Math.floor(
        (now.getTime() - new Date(p.vencimento).getTime()) / (1000 * 60 * 60 * 24)
      );
      return dias <= 30;
    })
    .reduce((s, p) => s + (Number(p.valor) || 0), 0);

  const aging60 = allParcelas
    .filter((p) => {
      if (p.status !== "atrasado") return false;
      const dias = Math.floor(
        (now.getTime() - new Date(p.vencimento).getTime()) / (1000 * 60 * 60 * 24)
      );
      return dias > 30 && dias <= 60;
    })
    .reduce((s, p) => s + (Number(p.valor) || 0), 0);

  const aging90 = allParcelas
    .filter((p) => {
      if (p.status !== "atrasado") return false;
      const dias = Math.floor(
        (now.getTime() - new Date(p.vencimento).getTime()) / (1000 * 60 * 60 * 24)
      );
      return dias > 60;
    })
    .reduce((s, p) => s + (Number(p.valor) || 0), 0);

  // Top 5 contratos
  const { data: topContratos } = await supabase
    .from("contratos_financeiros")
    .select("id, deal_id, plano, valor_total, deals(atleta:atletas(nome_completo))")
    .is("deleted_at", null)
    .order("valor_total", { ascending: false })
    .limit(5);

  // --- Experiencia ---
  const { data: experiencias } = await supabase
    .from("crm_experiencia")
    .select("id, temperatura, fase, satisfacao, ansiedade, risco_percebido, status, atleta:atletas(nome_completo)")
    .is("deleted_at", null);

  const allExperiencias = experiencias || [];

  const expByTemperatura: Record<string, number> = { verde: 0, amarelo: 0, vermelho: 0 };
  const expByFase: Record<string, number> = {};
  let satisfacaoTotal = 0;
  let ansiedadeTotal = 0;
  let expCount = 0;

  for (const e of allExperiencias) {
    if (e.temperatura in expByTemperatura) expByTemperatura[e.temperatura] += 1;
    if (!expByFase[e.fase]) expByFase[e.fase] = 0;
    expByFase[e.fase] += 1;
    satisfacaoTotal += Number(e.satisfacao) || 0;
    ansiedadeTotal += Number(e.ansiedade) || 0;
    expCount += 1;
  }

  const satisfacaoMedia = expCount > 0 ? (satisfacaoTotal / expCount).toFixed(1) : "0";
  const ansiedadeMedia = expCount > 0 ? (ansiedadeTotal / expCount).toFixed(1) : "0";

  const familiasEmRisco = allExperiencias
    .filter((e) => e.temperatura === "vermelho" || e.status === "crise")
    .map((e) => {
      const atleta = e.atleta as unknown as { nome_completo: string } | null;
      return {
        id: e.id,
        nome: atleta?.nome_completo ?? "Desconhecido",
        temperatura: e.temperatura,
        status: e.status,
        fase: e.fase,
      };
    });

  // --- Safras ---
  const safrasSet = new Set<string>();
  for (const d of allDeals) {
    if (d.safra) safrasSet.add(d.safra);
  }
  const safras = Array.from(safrasSet).sort();

  // Per-safra data
  const safraData: Record<
    string,
    { deals: number; revenue: number; contratos: number; avgTicket: number }
  > = {};
  for (const safra of safras) {
    const safraDeals = allDeals.filter((d) => d.safra === safra);
    const safraContratos = safraDeals.filter(
      (d) =>
        d.etapa === "contrato_assinado" ||
        d.etapa === "sinal_pago" ||
        d.etapa === "admission_process" ||
        d.etapa === "concluido"
    );
    const totalRevenue = safraDeals.reduce(
      (s, d) => s + (Number(d.valor_estimado) || 0),
      0
    );
    safraData[safra] = {
      deals: safraDeals.length,
      revenue: totalRevenue,
      contratos: safraContratos.length,
      avgTicket:
        safraContratos.length > 0
          ? Math.round(totalRevenue / safraContratos.length)
          : 0,
    };
  }

  // --- Semanal ---
  const mondayThisWeek = new Date(now);
  const day = mondayThisWeek.getDay();
  const diff = day === 0 ? 6 : day - 1;
  mondayThisWeek.setDate(mondayThisWeek.getDate() - diff);
  mondayThisWeek.setHours(0, 0, 0, 0);
  const sundayThisWeek = new Date(mondayThisWeek);
  sundayThisWeek.setDate(sundayThisWeek.getDate() + 6);
  sundayThisWeek.setHours(23, 59, 59, 999);

  const leadsThisWeek = allDeals.filter(
    (d) =>
      new Date(d.created_at) >= mondayThisWeek &&
      new Date(d.created_at) <= sundayThisWeek
  ).length;

  // Deals that advanced this week (updated_at within the week and etapa changed)
  const { data: dealsUpdatedThisWeek } = await supabase
    .from("deals")
    .select("id")
    .is("deleted_at", null)
    .gte("updated_at", mondayThisWeek.toISOString())
    .lte("updated_at", sundayThisWeek.toISOString());

  const dealsAdvanced = dealsUpdatedThisWeek?.length ?? 0;

  // Families contacted this week
  const { data: contatosWeek } = await supabase
    .from("crm_experiencia")
    .select("id")
    .is("deleted_at", null)
    .gte("data_ultimo_contato", mondayThisWeek.toISOString().slice(0, 10))
    .lte("data_ultimo_contato", sundayThisWeek.toISOString().slice(0, 10));

  const familiasContatadas = contatosWeek?.length ?? 0;

  // Open tasks
  const { data: openTasks } = await supabase
    .from("tarefas")
    .select("id")
    .is("deleted_at", null)
    .in("status", ["pendente", "em_andamento", "atrasada"]);

  const tarefasAbertas = openTasks?.length ?? 0;

  return {
    comercial: {
      dealsByEtapa,
      dealsThisMonth: dealsThisMonth.length,
      dealsLastMonth: dealsLastMonth.length,
      dealsByClassificacao,
      leadsRecebidos,
      reunioes,
      propostas,
      contratos,
      taxaConversao,
    },
    financeiro: {
      parcelasByMonth,
      totalAtrasado,
      aging: { d30: aging30, d60: aging60, d90: aging90 },
      topContratos: (topContratos || []).map((c) => {
        const deal = c.deals as unknown as { atleta: { nome_completo: string } } | null;
        return {
          id: c.id,
          plano: c.plano,
          valorTotal: Number(c.valor_total),
          atleta: deal?.atleta?.nome_completo ?? "N/A",
        };
      }),
    },
    experiencia: {
      expByTemperatura,
      expByFase,
      satisfacaoMedia,
      ansiedadeMedia,
      familiasEmRisco,
    },
    safras: {
      list: safras,
      data: safraData,
    },
    semanal: {
      periodStart: mondayThisWeek.toISOString(),
      periodEnd: sundayThisWeek.toISOString(),
      leadsThisWeek,
      dealsAdvanced,
      familiasContatadas,
      familiasEmRisco: familiasEmRisco.length,
      tarefasAbertas,
    },
  };
}

export default async function RelatoriosPage() {
  await requirePapel("ceo");

  const data = await fetchReportData();

  return <RelatoriosClient data={data} />;
}
