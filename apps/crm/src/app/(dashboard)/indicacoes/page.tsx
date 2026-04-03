import { requirePapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { IndicacoesClient } from "./IndicacoesClient";

export default async function IndicacoesPage() {
  await requirePapel(["ceo", "head_sucesso"]);

  const supabase = await createServerSupabaseClient();

  const { data: indicacoes } = await supabase
    .from("indicacoes")
    .select(`
      *,
      indicador:responsaveis!responsavel_indicador_id(id, nome, email),
      atleta:atletas!atleta_indicado_id(id, nome_completo, esporte)
    `)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  // Calcula KPIs
  const total = indicacoes?.length ?? 0;
  const convertidos = indicacoes?.filter((i) => i.status === "convertido").length ?? 0;
  const taxaConversao = total > 0 ? Math.round((convertidos / total) * 100) : 0;
  const recompensasPendentes = indicacoes?.filter(
    (i) => i.recompensa_devida && !i.recompensa_entregue,
  ).length ?? 0;

  // Top Indicadores — agrupa por responsavel_indicador_id
  const indicadorMap = new Map<string, { id: string; nome: string; total: number; convertidos: number }>();
  for (const ind of indicacoes ?? []) {
    const indicador = ind.indicador as { id: string; nome: string } | null;
    if (!indicador) continue;
    const existing = indicadorMap.get(indicador.id);
    if (existing) {
      existing.total += 1;
      if (ind.status === "convertido") existing.convertidos += 1;
    } else {
      indicadorMap.set(indicador.id, {
        id: indicador.id,
        nome: indicador.nome,
        total: 1,
        convertidos: ind.status === "convertido" ? 1 : 0,
      });
    }
  }
  const topIndicadores = Array.from(indicadorMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .map((ind) => ({
      ...ind,
      taxa: ind.total > 0 ? Math.round((ind.convertidos / ind.total) * 100) : 0,
    }));

  // Origem dos Leads — agrupa atletas por campo origem
  const { data: atletas } = await supabase
    .from("atletas")
    .select("id, origem")
    .is("deleted_at", null);

  const origemMap = new Map<string, number>();
  for (const a of atletas ?? []) {
    const origem = (a.origem as string) || "outro";
    origemMap.set(origem, (origemMap.get(origem) ?? 0) + 1);
  }
  const totalAtletas = atletas?.length ?? 0;
  const ORIGEM_LABELS: Record<string, string> = {
    formulario_web: "Formulario web",
    indicacao: "Indicacao",
    instagram: "Instagram",
    meta_ads: "Meta Ads",
    outro: "Outro",
  };
  const origemLeads = Array.from(origemMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([canal, count]) => ({
      canal,
      label: ORIGEM_LABELS[canal] ?? canal,
      count,
      pct: totalAtletas > 0 ? Math.round((count / totalAtletas) * 100) : 0,
    }));

  return (
    <IndicacoesClient
      indicacoesIniciais={indicacoes ?? []}
      kpis={{ total, convertidos, taxaConversao, recompensasPendentes }}
      topIndicadores={topIndicadores}
      origemLeads={origemLeads}
    />
  );
}
