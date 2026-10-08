"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";
import { hojeIsoBrasilia } from "@/lib/escolas/apresentacao";
import { normalizarEsportes } from "@/lib/escolas/formulario";
import {
  contatoEscolaSchema,
  escolaAtualizarSchema,
  escolaCriarSchema,
  mensagemValidacao,
  resultadoEstrategiaSchema,
} from "@/lib/escolas/schema";
import type { ContatoEscola } from "@/types/school";

/**
 * Banco de Escolas — escrita CEO/CTO (getUserPapel resolve cto→ceo; a RLS
 * escolas_ceo/hist_escola_ceo/estrategia_ceo é a segunda barreira).
 * Toda entrada é `unknown` validada por Zod com lista branca; erro do Postgres
 * nunca vai cru para a tela (o DETAIL do 23514 carrega a linha inteira).
 */

type Resultado<T = undefined> =
  | ({ success: true } & (T extends undefined ? object : { data: T }))
  | { success: false; error: string };

const uuidSchema = z.string().uuid();
const CONTATO_COLUNAS = "id, escola_id, data, tipo, resumo, created_at";

const SO_CEO_ESCOLAS = "Apenas o CEO pode alterar o Banco de Escolas.";

interface ErroPostgrest {
  code?: string;
  message: string;
}

function mensagemErroBanco(error: ErroPostgrest): string {
  switch (error.code) {
    case "22P02":
    case "23514":
      return "Um dos valores não é aceito pelo banco. Revise os campos e tente de novo.";
    case "42501":
      return "Sem permissão para alterar o Banco de Escolas.";
    default:
      return "Não foi possível salvar agora. Tente de novo.";
  }
}

function logErro(action: string, contexto: Record<string, unknown>, error: ErroPostgrest) {
  // Só código + mensagem: o `details` do PostgREST traz a linha (e-mail do officer).
  console.error({ level: "error", action, ...contexto, code: error.code, erro: error.message });
}

function revalidarTelasDeEscola() {
  revalidatePath("/escolas");
  revalidatePath("/matching");
}

export async function criarEscola(input: unknown): Promise<Resultado<{ escolaId: string }>> {
  if ((await getUserPapel()) !== "ceo") return { success: false, error: SO_CEO_ESCOLAS };

  const parsed = escolaCriarSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: mensagemValidacao(parsed.error) };

  const dados = { ...parsed.data };
  if (dados.esportes_oferecidos) dados.esportes_oferecidos = normalizarEsportes(dados.esportes_oferecidos);
  if (
    dados.budget_minimo_usd != null &&
    dados.budget_forte_usd != null &&
    dados.budget_forte_usd < dados.budget_minimo_usd
  ) {
    return { success: false, error: "Budget forte: deve ser maior ou igual ao mínimo." };
  }

  try {
    const supabase = await createAuditedSupabaseClient();

    const { data: homonimas, error: erroBusca } = await supabase
      .from("escolas")
      .select("id")
      .ilike("nome", dados.nome.replace(/[%_\\]/g, "\\$&"))
      .is("deleted_at", null)
      .limit(1);
    if (erroBusca) logErro("criar_escola_dedupe", {}, erroBusca);
    if ((homonimas ?? []).length > 0) {
      return { success: false, error: "Já existe uma escola com este nome no banco." };
    }

    const { data, error } = await supabase.from("escolas").insert(dados).select("id").single();
    if (error || !data) {
      if (error) logErro("criar_escola", {}, error);
      return { success: false, error: error ? mensagemErroBanco(error) : "Escola não foi criada." };
    }

    console.log({ level: "info", action: "criar_escola", escolaId: data.id });
    revalidarTelasDeEscola();
    return { success: true, data: { escolaId: data.id as string } };
  } catch (e) {
    console.error({ level: "error", action: "criar_escola", erro: String(e) });
    return { success: false, error: "Falha ao criar a escola. Tente de novo." };
  }
}

/**
 * Edição parcial: o cliente manda SÓ os campos alterados (diffEscola). Patch
 * vazio não toca o banco — "Salvar" sem mexer não grava nada nem gera audit.
 */
export async function atualizarEscola(escolaId: string, patch: unknown): Promise<Resultado> {
  if ((await getUserPapel()) !== "ceo") return { success: false, error: SO_CEO_ESCOLAS };
  if (!uuidSchema.safeParse(escolaId).success) return { success: false, error: "Escola inválida." };

  const parsed = escolaAtualizarSchema.safeParse(patch);
  if (!parsed.success) return { success: false, error: mensagemValidacao(parsed.error) };

  const dados = { ...parsed.data };
  const campos = Object.keys(dados);
  if (campos.length === 0) return { success: true };
  if (dados.esportes_oferecidos) dados.esportes_oferecidos = normalizarEsportes(dados.esportes_oferecidos);

  try {
    const supabase = await createAuditedSupabaseClient();

    const { data: atual, error: erroLeitura } = await supabase
      .from("escolas")
      .select("id, nome, budget_minimo_usd, budget_forte_usd")
      .eq("id", escolaId)
      .is("deleted_at", null)
      .maybeSingle();
    if (erroLeitura) {
      logErro("atualizar_escola_leitura", { escolaId }, erroLeitura);
      return { success: false, error: mensagemErroBanco(erroLeitura) };
    }
    if (!atual) return { success: false, error: "Escola não encontrada (pode ter sido removida)." };

    const minimo = "budget_minimo_usd" in dados ? dados.budget_minimo_usd : atual.budget_minimo_usd;
    const forte = "budget_forte_usd" in dados ? dados.budget_forte_usd : atual.budget_forte_usd;
    if (minimo != null && forte != null && Number(forte) < Number(minimo)) {
      return { success: false, error: "Budget forte: deve ser maior ou igual ao mínimo." };
    }

    if (dados.nome && dados.nome.toLowerCase() !== String(atual.nome).toLowerCase()) {
      const { data: homonimas } = await supabase
        .from("escolas")
        .select("id")
        .ilike("nome", dados.nome.replace(/[%_\\]/g, "\\$&"))
        .neq("id", escolaId)
        .is("deleted_at", null)
        .limit(1);
      if ((homonimas ?? []).length > 0) {
        return { success: false, error: "Já existe outra escola com este nome no banco." };
      }
    }

    const { data: alteradas, error } = await supabase
      .from("escolas")
      .update(dados)
      .eq("id", escolaId)
      .is("deleted_at", null)
      .select("id");
    if (error) {
      logErro("atualizar_escola", { escolaId, campos }, error);
      return { success: false, error: mensagemErroBanco(error) };
    }
    if ((alteradas ?? []).length === 0) {
      return { success: false, error: "Nada foi salvo: escola não encontrada ou sem permissão." };
    }

    console.log({ level: "info", action: "atualizar_escola", escolaId, campos });
    revalidarTelasDeEscola();
    return { success: true };
  } catch (e) {
    console.error({ level: "error", action: "atualizar_escola", escolaId, erro: String(e) });
    return { success: false, error: "Falha ao salvar a escola. Tente de novo." };
  }
}

export async function sugerirEscolas(atletaId: string) {
  const supabase = await createAuditedSupabaseClient();
  const { data, error } = await supabase.rpc("sugerir_escolas", {
    p_atleta_id: atletaId,
    p_limite: 10,
  });
  if (error) return { success: false, error: error.message, data: [] };
  return { success: true, data: data || [] };
}

export async function calcularMatch(atletaId: string, escolaId: string) {
  const supabase = await createAuditedSupabaseClient();
  const { data, error } = await supabase.rpc("calcular_match_score", {
    p_atleta_id: atletaId,
    p_escola_id: escolaId,
  });
  if (error) return { score: 0, error: error.message };
  const score = data as number;
  const classificacao = score >= 85 ? "excelente" : score >= 70 ? "forte" : score >= 50 ? "possivel" : "fraco";
  return { score, classificacao };
}

export async function adicionarEstrategia(atletaId: string, escolaId: string, prioridade: string) {
  const papel = await getUserPapel();
  if (papel !== "ceo") return { success: false, error: "Apenas o CEO." };

  const supabase = await createAuditedSupabaseClient();
  const match = await calcularMatch(atletaId, escolaId);

  const { error } = await supabase.from("estrategia_escolas").insert({
    atleta_id: atletaId,
    escola_id: escolaId,
    match_score: match.score,
    prioridade,
    status: "planejamento",
    resultado: "nao_aplicado",
  });

  if (error) return { success: false, error: error.message };
  return { success: true, matchScore: match.score };
}

/**
 * Registra contato na timeline (colunas reais: `data`/`tipo`) e avança
 * escolas.ultimo_contato_at — só para frente: contato antigo registrado
 * depois não "rejuvenesce" a escola.
 */
export async function registrarContatoEscola(
  escolaId: string,
  input: unknown,
): Promise<Resultado<ContatoEscola>> {
  if ((await getUserPapel()) !== "ceo") return { success: false, error: SO_CEO_ESCOLAS };
  if (!uuidSchema.safeParse(escolaId).success) return { success: false, error: "Escola inválida." };

  const parsed = contatoEscolaSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: mensagemValidacao(parsed.error) };
  const { data: dia, tipo, resumo } = parsed.data;
  // Data futura empurraria ultimo_contato_at para frente e, como ele só
  // avança, travaria o "último contato" até essa data (o max do input é só UX).
  if (dia > hojeIsoBrasilia(Date.now())) {
    return { success: false, error: "Data: o contato não pode ser no futuro." };
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    const { data: contato, error } = await supabase
      .from("historico_contatos_escola")
      .insert({ escola_id: escolaId, data: dia, tipo, resumo })
      .select(CONTATO_COLUNAS)
      .single();
    if (error || !contato) {
      if (error) logErro("registrar_contato_escola", { escolaId }, error);
      return { success: false, error: error ? mensagemErroBanco(error) : "Contato não foi registrado." };
    }

    const { error: erroUltimo } = await supabase
      .from("escolas")
      .update({ ultimo_contato_at: dia, tipo_ultimo_contato: tipo })
      .eq("id", escolaId)
      .or(`ultimo_contato_at.is.null,ultimo_contato_at.lte.${dia}`);
    if (erroUltimo) {
      // O contato já foi gravado: não desfazemos, só registramos a falha.
      logErro("registrar_contato_escola_ultimo", { escolaId }, erroUltimo);
    }

    revalidatePath("/escolas");
    return { success: true, data: contato as ContatoEscola };
  } catch (e) {
    console.error({ level: "error", action: "registrar_contato_escola", escolaId, erro: String(e) });
    return { success: false, error: "Falha ao registrar o contato. Tente de novo." };
  }
}

export async function listarContatosEscola(escolaId: string): Promise<Resultado<ContatoEscola[]>> {
  if (!uuidSchema.safeParse(escolaId).success) return { success: false, error: "Escola inválida." };
  try {
    const supabase = await createAuditedSupabaseClient();
    const { data, error } = await supabase
      .from("historico_contatos_escola")
      .select(CONTATO_COLUNAS)
      .eq("escola_id", escolaId)
      .is("deleted_at", null)
      .order("data", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      logErro("listar_contatos_escola", { escolaId }, error);
      return { success: false, error: "Não foi possível carregar os contatos." };
    }
    return { success: true, data: (data ?? []) as ContatoEscola[] };
  } catch (e) {
    console.error({ level: "error", action: "listar_contatos_escola", escolaId, erro: String(e) });
    return { success: false, error: "Não foi possível carregar os contatos." };
  }
}

/**
 * Resultado de uma estratégia (Motor de Match). O histórico da escola é
 * DERIVADO desta tabela pela view escolas_historico_bausa — não há mais
 * contador em escolas para incrementar (o incremento antigo era read-modify-
 * write com catch silencioso e não mexia no score: total_aplicados = 0).
 */
export async function atualizarResultadoEscola(estrategiaId: string, input: unknown): Promise<Resultado> {
  if ((await getUserPapel()) !== "ceo") return { success: false, error: "Apenas o CEO." };
  if (!uuidSchema.safeParse(estrategiaId).success) return { success: false, error: "Estratégia inválida." };

  const parsed = resultadoEstrategiaSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: mensagemValidacao(parsed.error) };
  if (Object.keys(parsed.data).length === 0) return { success: true };

  try {
    const supabase = await createAuditedSupabaseClient();
    const { data: alteradas, error } = await supabase
      .from("estrategia_escolas")
      .update(parsed.data)
      .eq("id", estrategiaId)
      .is("deleted_at", null)
      .select("id");
    if (error) {
      logErro("atualizar_resultado_escola", { estrategiaId }, error);
      return { success: false, error: mensagemErroBanco(error) };
    }
    if ((alteradas ?? []).length === 0) {
      return { success: false, error: "Estratégia não encontrada ou sem permissão." };
    }
    revalidarTelasDeEscola();
    return { success: true };
  } catch (e) {
    console.error({ level: "error", action: "atualizar_resultado_escola", estrategiaId, erro: String(e) });
    return { success: false, error: "Falha ao salvar o resultado. Tente de novo." };
  }
}
