import { getUserPapel, requirePapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { IndicacoesClient } from "./IndicacoesClient";

interface IndicacaoJoinRow {
  id: string;
  status: string;
  indicador_experiencia_id: string | null;
  indicador_nome: string | null;
  indicador: { id: string; nome: string } | null;
}

export default async function IndicacoesPage() {
  await requirePapel(["ceo", "head_sucesso"]);
  // Escrita em `indicacoes` é CEO-only pela RLS — head vê tudo em leitura.
  const podeGerenciar = (await getUserPapel()) === "ceo";

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

  // Top Indicadores — agrupa pelo responsável vinculado OU pelo nome livre
  // (indicações novas podem não ter FK de responsável).
  const indicadorMap = new Map<string, { id: string; nome: string; total: number; convertidos: number }>();
  for (const ind of (indicacoes ?? []) as unknown as IndicacaoJoinRow[]) {
    const nome = ind.indicador?.nome ?? ind.indicador_nome;
    if (!nome) continue;
    const chave = ind.indicador?.id ?? `nome:${nome.trim().toLowerCase()}`;
    const existing = indicadorMap.get(chave);
    if (existing) {
      existing.total += 1;
      if (ind.status === "convertido") existing.convertidos += 1;
    } else {
      indicadorMap.set(chave, {
        id: chave,
        nome,
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

  // Famílias clientes para o seletor de "Nova indicação" (query leve; só CEO cria)
  let familias: { id: string; atletaNome: string }[] = [];
  if (podeGerenciar) {
    const { data: familiasRaw } = await supabase
      .from("crm_experiencia")
      .select("id, atleta:atletas(nome_completo)")
      .is("deleted_at", null)
      .limit(300);
    familias = (familiasRaw ?? [])
      .map((f) => ({
        id: f.id as string,
        atletaNome:
          (f.atleta as unknown as { nome_completo: string | null } | null)?.nome_completo ??
          "Família sem nome",
      }))
      .sort((a, b) => a.atletaNome.localeCompare(b.atletaNome, "pt-BR"));
  }

  return (
    <IndicacoesClient
      indicacoesIniciais={indicacoes ?? []}
      topIndicadores={topIndicadores}
      origemLeads={origemLeads}
      familias={familias}
      podeGerenciar={podeGerenciar}
    />
  );
}
