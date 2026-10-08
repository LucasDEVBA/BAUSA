"use server";

import { z } from "zod";

import { getSession, getUserPapel } from "@/lib/auth";
import { FILTROS_LEADS_PADRAO, parseFiltrosLeads, type FiltrosLeads } from "@/lib/leads-filtros";
import { linhasParaExport, obterLeadDossieInterno } from "@/lib/leads-lista";
import { mapLinhaListaLead } from "@/lib/leads-mapper";
import {
  BUSCA_PIPELINE_LIMITE,
  BUSCA_PIPELINE_MAX,
  BUSCA_PIPELINE_MIN,
  FRIOS_REVISAO_DIAS,
  INCOMPLETOS_REVISAO_DIAS,
  localizarCadastroCore,
  montarFiltroBusca,
  type LocalCadastro,
} from "@/lib/revisao-leads";
import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { type Lead } from "@/types/lead";

// ════════════════════════════════════════════════════════════════════════
// Busca de cadastros em TODA a base + dossiê sob demanda + export (T8/T13).
// SÓ LEITURA: nenhuma action daqui escreve em classe, aprovação ou deal —
// as ações de escrita da faixa "Fora do pipeline" reusam as actions
// existentes (enviarFrioParaAprovacao etc.), com os CAS de sempre.
// Gate CEO/CTO (getUserPapel resolve cto→ceo) em TODAS — "use server"
// transforma cada export em endpoint público.
// ════════════════════════════════════════════════════════════════════════

const APENAS_CEO = "Apenas CEO/CTO podem buscar cadastros.";

/** Colunas da busca: SEM e-mail/telefone (casam no banco, não vão ao client). */
const COLUNAS_BUSCA_PIPELINE =
  "id, athlete_name, guardian_name, qualification_classification, qualification_reason, " +
  "aprovacao_status, aprovacao_decidida_em, aprovacao_motivo, timing_status, submitted_at, " +
  "meeting_scheduled, meeting_scheduled_at, deal_id, deal_etapa, deal_motivo_perda";

export interface CadastroEncontrado {
  id: string;
  athlete_name: string;
  guardian_name: string | null;
  qualification_classification: string | null;
  qualification_reason: string | null;
  aprovacao_status: string | null;
  aprovacao_decidida_em: string | null;
  aprovacao_motivo: string | null;
  timing_status: string | null;
  submitted_at: string;
  meeting_scheduled: boolean | null;
  meeting_scheduled_at: string | null;
  deal_id: string | null;
  deal_etapa: string | null;
  deal_motivo_perda: string | null;
  local: LocalCadastro;
}

export type ResultadoBuscaCadastros =
  | { success: true; itens: CadastroEncontrado[]; total: number }
  | { success: false; error: string };

const termoSchema = z
  .string()
  .trim()
  .min(BUSCA_PIPELINE_MIN, "Digite ao menos 3 letras.")
  .max(BUSCA_PIPELINE_MAX, `Busca muito longa (máx. ${BUSCA_PIPELINE_MAX} caracteres).`);

/**
 * Busca de apoio do Pipeline (T13): nome do atleta, responsáveis, e-mails e
 * telefones, sem acento, em TODOS os cadastros não excluídos — e diz ONDE
 * cada um está (coluna, deal/etapa, ou por que está fora do board).
 */
export async function buscarCadastrosPipeline(termo: string): Promise<ResultadoBuscaCadastros> {
  if ((await getUserPapel()) !== "ceo") return { success: false, error: APENAS_CEO };
  const parsed = termoSchema.safeParse(termo);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Termo inválido." };
  const filtro = montarFiltroBusca(parsed.data, BUSCA_PIPELINE_MIN);
  if (!filtro) return { success: true, itens: [], total: 0 };

  const supabase = await createAuditedSupabaseClient();
  // Quem buscou (trilha de auditoria da busca, T13) — em paralelo, sem custo.
  const [usuario, { data, error, count }] = await Promise.all([
    getSession().catch(() => null),
    supabase
      .from("vw_cadastros_situacao")
      .select(COLUNAS_BUSCA_PIPELINE, { count: "exact" })
      .or(filtro)
      .order("meeting_scheduled", { ascending: false, nullsFirst: false })
      .order("submitted_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(BUSCA_PIPELINE_LIMITE),
  ]);
  if (error) {
    console.error({
      level: "error",
      action: "buscar_cadastros_pipeline",
      usuarioId: usuario?.id ?? null,
      message: error.message,
    });
    return { success: false, error: "Erro ao buscar cadastros. Tente de novo." };
  }

  const agora = Date.now();
  const itens = ((data ?? []) as unknown as Omit<CadastroEncontrado, "local">[]).map((r) => ({
    ...r,
    local: localizarCadastroCore(r, agora, FRIOS_REVISAO_DIAS, INCOMPLETOS_REVISAO_DIAS),
  }));
  // Trilha sem PII: nunca o termo (pode ser e-mail/telefone).
  console.log({
    level: "info",
    action: "buscar_cadastros_pipeline",
    usuarioId: usuario?.id ?? null,
    termoTamanho: parsed.data.length,
    resultados: itens.length,
    total: count ?? itens.length,
  });
  return { success: true, itens, total: count ?? itens.length };
}

/** Dossiê completo de 1 cadastro (clique na tabela /leads e na faixa do Pipeline). */
export async function obterLeadDossie(
  formSubmissionId: string,
): Promise<{ success: true; lead: Lead } | { success: false; error: string }> {
  if ((await getUserPapel()) !== "ceo") return { success: false, error: "Apenas CEO/CTO podem abrir o dossiê." };
  const id = z.uuid().safeParse(formSubmissionId);
  if (!id.success) return { success: false, error: "Cadastro inválido." };
  try {
    const supabase = await createAuditedSupabaseClient();
    const lead = await obterLeadDossieInterno(supabase, id.data);
    return lead ? { success: true, lead } : { success: false, error: "Cadastro não encontrado (excluído?)." };
  } catch (e) {
    console.error({ level: "error", action: "obter_lead_dossie", message: e instanceof Error ? e.message : String(e) });
    return { success: false, error: "Erro ao abrir o dossiê. Tente de novo." };
  }
}

/** CSV de /leads: TODOS os leads do filtro atual (antes: os carregados = todos). */
export async function exportarLeadsCsv(
  filtros: FiltrosLeads,
): Promise<{ success: true; linhas: string[][]; truncado: boolean } | { success: false; error: string }> {
  if ((await getUserPapel()) !== "ceo") return { success: false, error: "Apenas CEO/CTO podem exportar leads." };
  // Revalida no servidor: o objeto vem do client (pode chegar null/qualquer coisa).
  const bruto: Partial<FiltrosLeads> = filtros ?? FILTROS_LEADS_PADRAO;
  const f = parseFiltrosLeads({
    q: bruto.q,
    classe: bruto.classe,
    ordem: bruto.ordem,
    dir: bruto.dir,
  });
  try {
    const supabase = await createAuditedSupabaseClient();
    const [usuario, { linhas, truncado }] = await Promise.all([
      getSession().catch(() => null),
      linhasParaExport(supabase, f),
    ]);
    // Exportação em massa de PII (e-mail): trilha de quem/quando/quantas
    // linhas para responder a um incidente LGPD. Sem o termo da busca.
    console.log({
      level: "info",
      action: "exportar_leads_csv",
      usuarioId: usuario?.id ?? null,
      linhas: linhas.length,
      truncado,
      classe: f.classe,
      comBusca: f.q.length > 0,
    });
    // Fuso de Brasília: o CSV antigo era gerado no navegador (BRT); no servidor
    // (UTC) um lead das 22h sairia com a data do dia seguinte.
    const data = (iso: string | null) =>
      iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";
    return {
      success: true,
      truncado,
      linhas: linhas.map(mapLinhaListaLead).map((l) => [
        l.athlete_name,
        l.email,
        l.qualification_classification ?? "",
        l.investment_range ?? "",
        l.position ?? "",
        l.school_city_state ?? "",
        data(l.submitted_at),
        data(l.whatsapp_sent_at),
        l.meeting_scheduled ? "Sim" : "Nao",
        l.pipeline_stage ?? "",
      ]),
    };
  } catch (e) {
    console.error({ level: "error", action: "exportar_leads_csv", message: e instanceof Error ? e.message : String(e) });
    return { success: false, error: "Erro ao exportar. Tente de novo." };
  }
}
