import { GraduationCap, Star, TrendingUp, Users } from "lucide-react";

import { requirePapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  ESCOLA_COLUNAS,
  HISTORICO_COLUNAS,
  mapearEscola,
  mapearHistorico,
  resumirBancoEscolas,
} from "@/lib/escolas/dados";
import { formatarPercentual } from "@/lib/escolas/apresentacao";
import type { HistoricoEscola, School } from "@/types/school";
import { EmptyState, PageHeader, StatCard } from "@/components/ui";
import { EscolasClient } from "@/components/escolas/EscolasClient";

type Linha = Record<string, unknown>;

export default async function EscolasPage() {
  await requirePapel("ceo");

  const supabase = await createServerSupabaseClient();

  // Exatamente 2 consultas: cadastro + histórico agregado (view, ≤ 1 linha
  // por escola — não esbarra no max_rows=1000 do PostgREST).
  const [escolasRes, historicoRes] = await Promise.all([
    supabase
      .from("escolas")
      .select(ESCOLA_COLUNAS)
      .is("deleted_at", null)
      .order("nome", { ascending: true }),
    supabase.from("escolas_historico_bausa").select(HISTORICO_COLUNAS),
  ]);

  if (escolasRes.error) {
    console.error({
      level: "error",
      action: "carregar_banco_escolas",
      code: escolasRes.error.code,
      erro: escolasRes.error.message,
    });
    return (
      <div className="space-y-5">
        <PageHeader dense eyebrow="Inteligência" title="Banco de Escolas" />
        <EmptyState
          icon={GraduationCap}
          title="Não foi possível carregar o Banco de Escolas"
          description="Tente recarregar a página. Se persistir, avise o time técnico."
        />
      </div>
    );
  }

  // Sinal secundário nunca derruba a tela: sem histórico, os cards mostram
  // "Histórico indisponível" em vez de zeros.
  const historicoDisponivel = !historicoRes.error;
  if (historicoRes.error) {
    console.error({
      level: "error",
      action: "carregar_historico_escolas",
      code: historicoRes.error.code,
      erro: historicoRes.error.message,
    });
  }

  const historicoPorEscola = new Map<string, HistoricoEscola>();
  for (const linha of (historicoRes.data ?? []) as Linha[]) {
    const par = mapearHistorico(linha);
    if (par) historicoPorEscola.set(par[0], par[1]);
  }

  const schools: School[] = ((escolasRes.data ?? []) as Linha[])
    .map((linha) => mapearEscola(linha, historicoPorEscola.get(String(linha.id))))
    .filter((e): e is School => e !== null);

  const resumo = resumirBancoEscolas(schools);
  const semDado = historicoDisponivel ? undefined : "histórico indisponível";

  return (
    <div className="space-y-5">
      <PageHeader
        dense
        eyebrow="Inteligência"
        title="Banco de Escolas"
        description={`High schools parceiras — ${schools.length} ${schools.length === 1 ? "escola cadastrada" : "escolas cadastradas"}`}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Escolas ativas"
          value={resumo.escolasAtivas}
          context={`de ${resumo.totalEscolas}`}
          icon={GraduationCap}
          accent="brand"
        />
        {/* Soma por escola = pares atleta×escola: o mesmo atleta em 2 escolas conta 2. */}
        <StatCard
          label="Candidaturas em andamento"
          value={historicoDisponivel ? resumo.emAndamento : "—"}
          context={semDado ?? "atleta × escola, aplicadas ou pré-acordadas"}
          icon={Users}
          accent="blue"
        />
        <StatCard
          label="Aceites"
          value={historicoDisponivel && resumo.respostas > 0 ? resumo.aceitos : "—"}
          context={
            semDado ??
            (resumo.taxaAceitePct != null
              ? `${resumo.taxaAceitePct}% das respostas`
              : "nenhuma resposta registrada")
          }
          icon={TrendingUp}
          accent="green"
        />
        <StatCard
          label="Bolsa média obtida"
          value={historicoDisponivel ? formatarPercentual(resumo.bolsaMediaPct) : "—"}
          context={
            semDado ??
            (resumo.bolsasInformadas > 0
              ? `${resumo.bolsasInformadas} ${resumo.bolsasInformadas === 1 ? "bolsa informada" : "bolsas informadas"}`
              : "sem bolsa registrada")
          }
          icon={Star}
          accent="orange"
        />
      </div>

      <EscolasClient
        schools={schools}
        historicoDisponivel={historicoDisponivel}
        // Página dinâmica (lê cookies): timestamp de request-time é intencional —
        // âncora única do "último contato há N dias" (sem mismatch de hidratação).
        // eslint-disable-next-line react-hooks/purity
        agoraMs={Date.now()}
      />
    </div>
  );
}
