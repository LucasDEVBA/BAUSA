"use server";

import { z } from "zod";

import { getUserPapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";

/**
 * Módulo de Contratos: lista própria no menu + detalhe reusado na aba do
 * lead.
 *
 * Antes o contrato só existia dentro do painel do deal — para achar um, era
 * preciso lembrar de qual atleta era. Aqui ele vira entidade de primeira
 * classe, com busca, filtro por situação e visão de carteira.
 */

export type SituacaoContrato = "em_dia" | "atrasado" | "quitado" | "cancelado";

export interface ContratoLista {
  id: string;
  dealId: string;
  atletaId: string | null;
  atleta: string;
  plano: string;
  valorTotal: number;
  /** Somatório das parcelas já recebidas. */
  recebido: number;
  aReceber: number;
  parcelasTotal: number;
  parcelasPagas: number;
  /** Vencida e não paga. */
  parcelasAtrasadas: number;
  proximoVencimento: string | null;
  situacao: SituacaoContrato;
  nfStatus: string;
  criadoEm: string;
}

export interface ResumoCarteira {
  contratos: number;
  valorContratado: number;
  recebido: number;
  aReceber: number;
  emAtraso: number;
  contratosComAtraso: number;
}

type Parcela = {
  id: string;
  contrato_id: string;
  valor: number | string;
  status: string;
  vencimento: string;
  tipo?: string | null;
  numero_parcela?: string | null;
  metodo?: string | null;
  recebido_at?: string | null;
};

/**
 * Carteira inteira em UMA passada.
 *
 * Buscar as parcelas de cada contrato num laço seria N+1 — com 60 contratos
 * a lista faria 61 consultas. Aqui são 2, e a agregação acontece em memória.
 */
export async function getContratos(): Promise<{
  contratos: ContratoLista[];
  resumo: ResumoCarteira;
}> {
  const vazio = {
    contratos: [],
    resumo: {
      contratos: 0,
      valorContratado: 0,
      recebido: 0,
      aReceber: 0,
      emAtraso: 0,
      contratosComAtraso: 0,
    },
  };
  if ((await getUserPapel()) !== "ceo") return vazio;

  const supabase = await createServerSupabaseClient();

  const { data: contratosRaw } = await supabase
    .from("contratos_financeiros")
    .select(
      "id, deal_id, plano, valor_total, nf_status, created_at, " +
        "deal:deals(id, atleta_id, etapa, atleta:atletas(id, nome_completo))",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const linhas = (contratosRaw ?? []) as unknown as Array<{
    id: string;
    deal_id: string;
    plano: string;
    valor_total: number | string;
    nf_status: string;
    created_at: string;
    deal:
      | {
          id: string;
          atleta_id: string | null;
          etapa: string;
          atleta: { id: string; nome_completo: string } | { id: string; nome_completo: string }[] | null;
        }
      | null;
  }>;
  if (linhas.length === 0) return vazio;

  const { data: parcelasRaw } = await supabase
    .from("parcelas")
    .select("id, contrato_id, valor, status, vencimento, tipo, numero_parcela, metodo, recebido_at")
    .in("contrato_id", linhas.map((c) => c.id))
    .is("deleted_at", null);

  const porContrato = new Map<string, Parcela[]>();
  for (const p of (parcelasRaw ?? []) as unknown as Parcela[]) {
    const lista = porContrato.get(p.contrato_id);
    if (lista) lista.push(p);
    else porContrato.set(p.contrato_id, [p]);
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const contratos: ContratoLista[] = linhas.map((c) => {
    const parcelas = porContrato.get(c.id) ?? [];
    const atletaEmbed = Array.isArray(c.deal?.atleta) ? c.deal?.atleta[0] : c.deal?.atleta;

    const recebido = parcelas
      .filter((p) => p.status === "recebido")
      .reduce((s, p) => s + Number(p.valor ?? 0), 0);
    const emAberto = parcelas.filter((p) => p.status !== "recebido" && p.status !== "cancelado");
    const atrasadas = emAberto.filter((p) => p.vencimento < hoje);
    const proximo = emAberto
      .filter((p) => p.vencimento >= hoje)
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0];

    const cancelado = c.deal?.etapa === "cancelamento_solicitado";
    const situacao: SituacaoContrato = cancelado
      ? "cancelado"
      : emAberto.length === 0 && parcelas.length > 0
        ? "quitado"
        : atrasadas.length > 0
          ? "atrasado"
          : "em_dia";

    return {
      id: c.id,
      dealId: c.deal_id,
      atletaId: atletaEmbed?.id ?? null,
      atleta: atletaEmbed?.nome_completo ?? "—",
      plano: c.plano,
      valorTotal: Number(c.valor_total ?? 0),
      recebido,
      aReceber: emAberto.reduce((s, p) => s + Number(p.valor ?? 0), 0),
      parcelasTotal: parcelas.length,
      parcelasPagas: parcelas.filter((p) => p.status === "recebido").length,
      parcelasAtrasadas: atrasadas.length,
      proximoVencimento: proximo?.vencimento ?? null,
      situacao,
      nfStatus: c.nf_status,
      criadoEm: c.created_at,
    };
  });

  const resumo: ResumoCarteira = {
    contratos: contratos.length,
    valorContratado: contratos.reduce((s, c) => s + c.valorTotal, 0),
    recebido: contratos.reduce((s, c) => s + c.recebido, 0),
    aReceber: contratos.reduce((s, c) => s + c.aReceber, 0),
    emAtraso: contratos
      .filter((c) => c.situacao === "atrasado")
      .reduce((s, c) => {
        const parcelas = porContrato.get(c.id) ?? [];
        return (
          s +
          parcelas
            .filter((p) => p.status !== "recebido" && p.status !== "cancelado" && p.vencimento < hoje)
            .reduce((t, p) => t + Number(p.valor ?? 0), 0)
        );
      }, 0),
    contratosComAtraso: contratos.filter((c) => c.situacao === "atrasado").length,
  };

  return { contratos, resumo };
}

export interface ContratoDetalhe {
  contrato: Record<string, unknown> | null;
  parcelas: Parcela[];
  atleta: { id: string; nome: string; email: string | null; whatsapp: string | null } | null;
  responsavel: { nome: string | null; email: string | null; whatsapp: string | null } | null;
  dealId: string | null;
  etapa: string | null;
}

/** Detalhe completo — usado pela tela dedicada e pela aba do lead. */
export async function getContratoDetalhe(contratoId: string): Promise<ContratoDetalhe> {
  const vazio: ContratoDetalhe = {
    contrato: null,
    parcelas: [],
    atleta: null,
    responsavel: null,
    dealId: null,
    etapa: null,
  };
  if ((await getUserPapel()) !== "ceo") return vazio;
  if (!z.string().uuid().safeParse(contratoId).success) return vazio;

  const supabase = await createServerSupabaseClient();
  const { data: contrato } = await supabase
    .from("contratos_financeiros")
    .select(
      "*, deal:deals(id, etapa, atleta:atletas(id, nome_completo, email, whatsapp, " +
        "responsavel:responsaveis!atletas_responsavel_id_fkey(nome, email, whatsapp)))",
    )
    .eq("id", contratoId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!contrato) return vazio;

  const { data: parcelas } = await supabase
    .from("parcelas")
    .select("*")
    .eq("contrato_id", contratoId)
    .is("deleted_at", null)
    .order("vencimento", { ascending: true });

  const deal = (contrato as unknown as Record<string, unknown>).deal as
    | { id: string; etapa: string; atleta: Record<string, unknown> | Record<string, unknown>[] | null }
    | null;
  const atletaRaw = Array.isArray(deal?.atleta) ? deal?.atleta[0] : deal?.atleta;
  const respRaw = atletaRaw?.responsavel as
    | { nome: string | null; email: string | null; whatsapp: string | null }
    | Array<{ nome: string | null; email: string | null; whatsapp: string | null }>
    | null
    | undefined;
  const resp = Array.isArray(respRaw) ? respRaw[0] : respRaw;

  return {
    contrato: contrato as unknown as Record<string, unknown>,
    parcelas: (parcelas ?? []) as unknown as Parcela[],
    atleta: atletaRaw
      ? {
          id: String(atletaRaw.id),
          nome: String(atletaRaw.nome_completo ?? "—"),
          email: (atletaRaw.email as string) ?? null,
          whatsapp: (atletaRaw.whatsapp as string) ?? null,
        }
      : null,
    responsavel: resp ?? null,
    dealId: deal?.id ?? null,
    etapa: deal?.etapa ?? null,
  };
}
