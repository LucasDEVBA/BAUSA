"use server";

import { revalidatePath } from "next/cache";

import { getUserPapel } from "@/lib/auth";
import { getParametrosSistema } from "@/lib/actions/parametros";
import {
  ehValorIrrisorio,
  estadoContrato,
  gerarCronograma,
  metodoDaForma,
  planejarAbertas,
  resumoFinanceiro,
  type EstadoContrato,
  type ParcelaGerada,
} from "@/lib/financeiro/calculo.mjs";
import { chamarRpcFinanceira, type FinErroCodigo } from "@/lib/financeiro/rpc";
import {
  baixarParcelaSchema,
  catalogoServicosSchema,
  condicoesContratoSchema,
  custoAlunoSchema,
  editarParcelaSchema,
  estornarParcelaSchema,
  FORMAS_SALDO_UNICA,
  hojeBRT,
  quitarContratoSchema,
  registrarSinalSchema,
  saldoDoContrato,
  uuidSchema,
  valorAssinadoDoItem,
  type BaixarParcelaInput,
  type CondicoesContrato,
  type CondicoesContratoInput,
  type CustoAlunoInput,
  type RegistrarSinalInput,
  type ServicoCatalogo,
} from "@/lib/financeiro/schemas";
import { aplicarEfeitosDoSinal } from "@/lib/financeiro/sinal-deal";
import type { ResultadoGamificacao } from "@/lib/gamificacao";
import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type {
  ContratoCompleto,
  ContratoEventoRow,
  ContratoItemRow,
  ContratoRow,
  CustoAlunoRow,
  ParcelaRow,
} from "@/types/contrato";

/**
 * Contrato financeiro de ponta a ponta (T5/T6/T9/T10/T11/T18).
 *
 * Toda ESCRITA de dinheiro passa por uma RPC fin_* (atômica, com lock no
 * contrato, autor no audit e validação de soma no banco). Aqui ficam:
 * papel (defense in depth), Zod, geração das parcelas (calculo.mjs — a MESMA
 * função da prévia na tela), efeitos no deal (etapa pela ordem do board,
 * handoff, XP) e revalidatePath.
 *
 * ⚠️ "use server": todo export é endpoint público. Só exportar actions async,
 * cada uma checando papel. Helpers puros moram em lib/financeiro/*.
 */

export type AcaoResult<T> =
  | { success: true; data: T; avisos: string[]; gamificacao: ResultadoGamificacao | null }
  | { success: false; code: FinErroCodigo | "FIN_VALIDACAO" | "FIN_PERMISSAO"; error: string; campo?: string };

const SEM_PERMISSAO = { success: false as const, code: "FIN_PERMISSAO" as const, error: "Apenas CEO/CTO podem alterar dados financeiros." };

function erroZod(issues: { message: string; path: PropertyKey[] }[]) {
  const i = issues[0];
  return {
    success: false as const,
    code: "FIN_VALIDACAO" as const,
    error: i?.message ?? "Dados inválidos.",
    campo: i?.path.map(String).join("."),
  };
}

function revalidarFinanceiro(contratoId?: string | null) {
  revalidatePath("/pipeline");
  revalidatePath("/financeiro");
  revalidatePath("/contratos");
  if (contratoId) revalidatePath(`/contratos/${contratoId}`);
}

// ─── Leitura ─────────────────────────────────────────────────────────────

const COLUNAS_CONTRATO =
  "id, deal_id, plano, forma_pagamento_plano, valor_total, valor_base_plano, valor_customizado, " +
  "justificativa_customizacao, sinal_abatido, entrada_valor, entrada_forma, entrada_parcelas, " +
  "entrada_paga, entrada_paga_at, saldo_remanescente, saldo_forma, saldo_parcelas, inclui_psicologa, " +
  "custo_psicologa, nf_status, nf_numero, nf_emitida_at, nf_valor, plano_definido_at, created_at, updated_at";
const COLUNAS_PARCELA =
  "id, contrato_id, tipo, numero_parcela, valor, vencimento, metodo, status, recebido_at, " +
  "comprovante_url, parcelas_cartao, observacao, created_at, updated_at";

/**
 * Falha de LEITURA vira exceção (a aba/modal mostram "Tentar de novo"): devolver
 * "sem contrato" ou parcelas vazias induzia o CEO a recriar um contrato que
 * existe ou mostrava estado/saldo errados.
 */
function falhaDeLeitura(action: string, contexto: Record<string, unknown>, mensagem: string): never {
  console.error({ level: "error", action, ...contexto, error: mensagem });
  throw new Error("Não foi possível carregar o contrato.");
}

async function montarCompleto(contrato: ContratoRow | null, dealId: string): Promise<ContratoCompleto> {
  const supabase = await createServerSupabaseClient();
  const [parametros, catalogo, dealRes] = await Promise.all([
    getParametrosSistema(),
    // Catálogo só alimenta atalhos do formulário: falha não impede ver o contrato.
    lerCatalogo().catch(() => [] as ServicoCatalogo[]),
    supabase.from("deals").select("etapa, atleta_id, atleta:atletas(nome_completo)").eq("id", dealId).maybeSingle(),
  ]);
  if (dealRes.error) falhaDeLeitura("contrato_deal_leitura_falhou", { dealId }, dealRes.error.message);
  const atletaRaw = dealRes.data?.atleta as unknown;
  const atleta = (Array.isArray(atletaRaw) ? atletaRaw[0] : atletaRaw) as { nome_completo?: string } | null;
  const base = {
    dealId,
    etapaDeal: (dealRes.data?.etapa as string | undefined) ?? null,
    atletaId: (dealRes.data?.atleta_id as string | undefined) ?? null,
    atletaNome: atleta?.nome_completo ?? null,
    planosTabela: parametros.valores.planos,
    entradaPadrao: parametros.valores.entrada_padrao,
    psicologaPadrao: parametros.valores.psicologa_custo_padrao,
    catalogo,
    hoje: hojeBRT(),
  };
  if (!contrato) {
    return { ...base, contrato: null, parcelas: [], itens: [], eventos: [], custos: [], versao: null, estado: "sem_contrato", resumo: null };
  }

  // 1 consulta por relação (sem N+1) + versão calculada no banco (mesma da RPC).
  const [parcelasRes, itensRes, eventosRes, custosRes, versaoRes] = await Promise.all([
    supabase.from("parcelas").select(COLUNAS_PARCELA).eq("contrato_id", contrato.id).is("deleted_at", null)
      .order("vencimento", { ascending: true }).order("created_at", { ascending: true }),
    supabase.from("contrato_itens").select("id, tipo, descricao, valor, catalogo_chave, created_at")
      .eq("contrato_id", contrato.id).is("deleted_at", null).order("created_at", { ascending: true }),
    supabase.from("contrato_eventos").select("id, tipo, justificativa, detalhes, created_at, created_by")
      .eq("contrato_id", contrato.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("despesas").select("id, descricao, categoria, valor_brl, competencia, vencimento, status, pago_at, metodo, fornecedor, observacao")
      .eq("contrato_id", contrato.id).is("deleted_at", null).order("competencia", { ascending: false }),
    supabase.rpc("fin_versao_contrato", { p_contrato_id: contrato.id }),
  ]);
  // Parcelas, itens, custos e versão decidem estado, saldo, margem e as edições: sem eles, erro.
  for (const r of [parcelasRes, itensRes, custosRes, versaoRes]) {
    if (r.error) falhaDeLeitura("contrato_leitura_falhou", { contratoId: contrato.id }, r.error.message);
  }
  // Histórico é informativo: sem ele o contrato continua utilizável.
  if (eventosRes.error) {
    console.error({ level: "error", action: "contrato_eventos_leitura_falhou", contratoId: contrato.id, error: eventosRes.error.message });
  }
  const parcelas = ((parcelasRes.data ?? []) as unknown as ParcelaRow[]).map((p) => ({ ...p, valor: Number(p.valor) }));
  // Autor dos eventos: created_by → auth.users (sem FK p/ user_profiles) ⇒ 1 consulta extra, sem N+1.
  const eventosBrutos = (eventosRes.data ?? []) as unknown as Omit<ContratoEventoRow, "autorNome">[];
  const autores = [...new Set(eventosBrutos.map((e) => e.created_by).filter((id): id is string => Boolean(id)))];
  const nomes = new Map<string, string>();
  if (autores.length > 0) {
    const { data: perfis } = await supabase.from("user_profiles").select("id, nome").in("id", autores);
    for (const p of (perfis ?? []) as { id: string; nome: string }[]) nomes.set(p.id, p.nome);
  }
  return {
    ...base,
    contrato,
    parcelas,
    itens: ((itensRes.data ?? []) as unknown as ContratoItemRow[]).map((i) => ({ ...i, valor: Number(i.valor) })),
    eventos: eventosBrutos.map((e) => ({ ...e, autorNome: e.created_by ? (nomes.get(e.created_by) ?? null) : null })),
    custos: ((custosRes.data ?? []) as unknown as CustoAlunoRow[]).map((c) => ({ ...c, valor_brl: Number(c.valor_brl) })),
    versao: (versaoRes.data as string | null) ?? null,
    estado: estadoContrato(contrato, parcelas) as EstadoContrato,
    resumo: resumoFinanceiro(contrato, parcelas, base.hoje),
  };
}

function normalizarContrato(raw: Record<string, unknown>): ContratoRow {
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    ...(raw as unknown as ContratoRow),
    valor_total: Number(raw.valor_total),
    valor_base_plano: n(raw.valor_base_plano),
    valor_customizado: n(raw.valor_customizado),
    entrada_valor: Number(raw.entrada_valor),
    saldo_remanescente: Number(raw.saldo_remanescente),
    custo_psicologa: n(raw.custo_psicologa),
    nf_valor: n(raw.nf_valor),
  };
}

/** Contrato vivo do deal + parcelas/itens/eventos/custos + parâmetros (tabela/catálogo). */
export async function carregarContratoDoDeal(dealId: string): Promise<ContratoCompleto | null> {
  if ((await getUserPapel()) !== "ceo") return null;
  if (!uuidSchema.safeParse(dealId).success) return null;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("contratos_financeiros")
    .select(COLUNAS_CONTRATO)
    .eq("deal_id", dealId)
    .is("deleted_at", null) // policy ALL do CEO enxerga excluídos — filtro explícito obrigatório
    .maybeSingle();
  if (error) falhaDeLeitura("contrato_do_deal_falhou", { dealId }, error.message);
  return montarCompleto(data ? normalizarContrato(data as unknown as Record<string, unknown>) : null, dealId);
}

/** null = sem permissão/inexistente; erro de leitura LANÇA (nunca vira "não encontrado"). */
export async function carregarContrato(contratoId: string): Promise<ContratoCompleto | null> {
  if ((await getUserPapel()) !== "ceo") return null;
  if (!uuidSchema.safeParse(contratoId).success) return null;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("contratos_financeiros")
    .select(COLUNAS_CONTRATO)
    .eq("id", contratoId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) falhaDeLeitura("contrato_leitura_falhou", { contratoId }, error.message);
  if (!data) return null;
  const c = normalizarContrato(data as unknown as Record<string, unknown>);
  return montarCompleto(c, c.deal_id);
}

// ─── Montagem das parcelas (servidor; nunca confia em lista vinda do client) ─

interface GrupoPlanejado {
  regerar: boolean;
  parcelas: Array<ParcelaGerada & { status?: "previsto" | "recebido"; recebido_em?: string; parcelas_cartao?: number | null }>;
}

function planejarEntradaNova(c: CondicoesContrato): GrupoPlanejado {
  const e = c.entrada;
  if (e.valor <= 0 || !e.forma) return { regerar: true, parcelas: [] };
  const metodo = metodoDaForma(e.forma) ?? "outro";
  if (e.jaRecebida && e.dataRecebimento) {
    // Entrada já paga: UMA parcela recebida na data real (cartão = venda única; vezes é informativo).
    return {
      regerar: true,
      parcelas: [{
        numero_parcela: "Entrada", valor: e.valor, vencimento: e.dataRecebimento, metodo,
        status: "recebido", recebido_em: e.dataRecebimento, parcelas_cartao: e.parcelasCartao,
      }],
    };
  }
  return {
    regerar: true,
    parcelas: gerarCronograma({
      total: e.valor, quantidade: e.quantidade, primeiroVencimento: e.primeiroVencimento ?? hojeBRT(),
      metodo, rotuloUnico: "Entrada",
      ...(e.quantidade > 1 ? { numeracaoTotal: e.quantidade } : {}),
    }).map((p, i) => (e.quantidade > 1 ? { ...p, numero_parcela: `Entrada ${i + 1}/${e.quantidade}` } : p)),
  };
}

function planejarSaldoNovo(c: CondicoesContrato, totalSaldo: number, recebidas: Array<{ valor: number }>): GrupoPlanejado | { erro: string } {
  if (c.saldo.definirDepois || !c.saldo.forma) return { regerar: false, parcelas: [] };
  const qtd = FORMAS_SALDO_UNICA.has(c.saldo.forma) ? 1 : c.saldo.quantidade;
  const plano = planejarAbertas({
    totalGrupo: totalSaldo, recebidas, quantidadeTotal: recebidas.length + qtd,
    primeiroVencimento: c.saldo.primeiroVencimento ?? hojeBRT(),
    metodo: metodoDaForma(c.saldo.forma) ?? "outro",
    rotuloUnico: c.saldo.forma === "pix_avista" ? "Saldo (Pix)" : "Saldo",
  });
  if (plano.erro) return { erro: "O saldo ficaria menor que o valor já recebido. Estorne antes ou ajuste os valores." };
  return { regerar: true, parcelas: plano.parcelas };
}

function payloadCondicoes(c: CondicoesContrato) {
  return {
    plano: c.plano,
    forma_pagamento_plano: c.formaPagamentoPlano,
    valor_base_plano: c.valorBasePlano,
    justificativa: c.justificativa,
    sinal_abatido: c.sinalAbatido,
    itens: c.itens.map((i) => ({
      ...(i.id ? { id: i.id } : {}),
      tipo: i.tipo,
      descricao: i.descricao,
      valor: valorAssinadoDoItem(i),
      catalogo_chave: i.catalogoChave ?? null,
    })),
    inclui_psicologa: c.incluiPsicologa,
    custo_psicologa: c.incluiPsicologa ? c.custoPsicologa : 0,
    confirmar_com_pagamentos: c.confirmarComPagamentos,
  };
}

const totalDoContrato = (c: CondicoesContrato) =>
  Math.round(
    (c.valorBasePlano + c.itens.reduce((s, i) => s + valorAssinadoDoItem(i), 0) + (c.sinalAbatido ? 0 : c.entrada.valor)) * 100,
  ) / 100;

// ─── T6: criar contrato completo (com plano) ─────────────────────────────

export async function criarContratoCompleto(
  dealId: string,
  input: CondicoesContratoInput,
): Promise<AcaoResult<{ contratoId: string; movidoParaSinalPago: boolean }>> {
  if ((await getUserPapel()) !== "ceo") return SEM_PERMISSAO;
  if (!uuidSchema.safeParse(dealId).success) return { success: false, code: "FIN_VALIDACAO", error: "Negócio inválido." };
  const parsed = condicoesContratoSchema.safeParse(input);
  if (!parsed.success) return erroZod(parsed.error.issues);
  const c = parsed.data;

  const entrada = planejarEntradaNova(c);
  const totalSaldo = saldoDoContrato(totalDoContrato(c), c.entrada.valor);
  const saldo = planejarSaldoNovo(c, totalSaldo, []);
  if ("erro" in saldo) return { success: false, code: "FIN_VALIDACAO", error: saldo.erro };

  const r = await chamarRpcFinanceira<{ contrato_id: string; sinal_confirmado_agora: boolean }>(
    "fin_criar_contrato",
    {
      p_deal_id: dealId,
      p_dados: {
        ...payloadCondicoes(c),
        entrada: { valor: c.entrada.valor, forma: c.entrada.forma, parcelas: entrada.parcelas },
        // Saldo R$ 0 (entrada = total): sem forma — nada a parcelar.
        saldo: { forma: c.saldo.definirDepois || totalSaldo === 0 ? null : c.saldo.forma, parcelas: saldo.parcelas },
      },
    },
    { dealId },
  );
  if (!r.success) return r;

  const efeitos = r.data.sinal_confirmado_agora
    ? await aplicarEfeitosDoSinal(dealId, { sinalConfirmadoAgora: true })
    : null;
  const { registrarEventoGamificacao } = await import("@/lib/gamificacao");
  const xpContrato = await registrarEventoGamificacao("contrato_criado", { tipo: "contrato", id: r.data.contrato_id });

  revalidarFinanceiro(r.data.contrato_id);
  return {
    success: true,
    data: { contratoId: r.data.contrato_id, movidoParaSinalPago: efeitos?.movidoParaSinalPago ?? false },
    avisos: efeitos?.avisos ?? [],
    gamificacao: mesclarXp(xpContrato, efeitos?.gamificacao ?? null),
  };
}

// ─── T11: registrar sinal (sem plano) ────────────────────────────────────

export async function registrarSinal(
  input: RegistrarSinalInput,
): Promise<AcaoResult<{ contratoId: string; sinalTotal: number; movidoParaSinalPago: boolean }>> {
  if ((await getUserPapel()) !== "ceo") return SEM_PERMISSAO;
  const parsed = registrarSinalSchema.safeParse(input);
  if (!parsed.success) return erroZod(parsed.error.issues);
  const s = parsed.data;

  const r = await chamarRpcFinanceira<{ contrato_id: string; valor_total: number; sinal_confirmado_agora: boolean }>(
    "fin_registrar_sinal",
    {
      p_deal_id: s.dealId,
      p_dados: {
        valor: s.valor,
        forma: s.forma,
        parcelas_cartao: s.parcelasCartao,
        data_pagamento: s.dataPagamento,
        comprovante_url: s.comprovanteUrl,
        observacao: s.observacao,
      },
    },
    { dealId: s.dealId },
  );
  if (!r.success) return r;

  const efeitos = await aplicarEfeitosDoSinal(s.dealId, { sinalConfirmadoAgora: r.data.sinal_confirmado_agora });
  revalidarFinanceiro(r.data.contrato_id);
  return {
    success: true,
    data: { contratoId: r.data.contrato_id, sinalTotal: Number(r.data.valor_total), movidoParaSinalPago: efeitos.movidoParaSinalPago },
    avisos: efeitos.avisos,
    gamificacao: efeitos.gamificacao,
  };
}

// ─── T10/T9/T18a: escolher plano / editar condições ──────────────────────

export async function salvarCondicoesContrato(
  contratoId: string,
  versao: string,
  input: CondicoesContratoInput,
  opcoes: { regerarEntrada: boolean; regerarSaldo: boolean },
): Promise<AcaoResult<{ contratoId: string; primeiraEscolha: boolean; movidoParaSinalPago: boolean }>> {
  if ((await getUserPapel()) !== "ceo") return SEM_PERMISSAO;
  let atual: ContratoCompleto | null;
  try {
    atual = await carregarContrato(contratoId);
  } catch {
    return { success: false, code: "FIN_INESPERADO", error: "Não foi possível ler o contrato. Tente de novo." };
  }
  if (!atual?.contrato) return { success: false, code: "FIN_VALIDACAO", error: "Contrato não encontrado." };
  if (atual.versao !== versao) {
    return { success: false, code: "FIN_CONTRATO_MUDOU", error: "O contrato mudou em outra aba — recarregue para ver a versão atual." };
  }
  const recebidasEnt = atual.parcelas.filter((p) => p.tipo === "entrada" && p.status === "recebido");
  const recebidasSal = atual.parcelas.filter((p) => p.tipo === "saldo" && p.status === "recebido");

  // Justificativa (T9) e confirmação de troca de plano com saldo pago (T10) —
  // decididas aqui, pelo estado real do banco, nunca pelo client.
  const parsed = condicoesContratoSchema.safeParse({
    ...input,
    exigirJustificativa: atual.contrato.plano !== null,
    planoAtual: atual.contrato.plano,
    pagosNoSaldo: recebidasSal.reduce((s, p) => s + p.valor, 0),
  });
  if (!parsed.success) return erroZod(parsed.error.issues);
  const c = parsed.data;

  // Entrada: só refaz as ABERTAS (recebidas preservadas).
  let entradaParcelas: ParcelaGerada[] = [];
  if (opcoes.regerarEntrada && c.entrada.valor > 0 && c.entrada.forma) {
    const pe = planejarAbertas({
      totalGrupo: c.entrada.valor, recebidas: recebidasEnt, quantidadeTotal: Math.max(c.entrada.quantidade, recebidasEnt.length + 1),
      primeiroVencimento: c.entrada.primeiroVencimento ?? hojeBRT(),
      metodo: metodoDaForma(c.entrada.forma) ?? "outro", rotuloUnico: "Entrada",
    });
    if (pe.erro) return { success: false, code: "FIN_VALIDACAO", error: "A entrada não pode ser menor que o já recebido. Estorne antes." };
    entradaParcelas = pe.parcelas;
  }
  const totalSaldo = saldoDoContrato(totalDoContrato(c), c.entrada.valor);
  const saldo = opcoes.regerarSaldo
    ? planejarSaldoNovo(c, totalSaldo, recebidasSal)
    : { regerar: false, parcelas: [] };
  if ("erro" in saldo) return { success: false, code: "FIN_VALIDACAO", error: saldo.erro };

  const r = await chamarRpcFinanceira<{ contrato_id: string; deal_id: string; primeira_escolha: boolean; sinal_confirmado_agora: boolean }>(
    "fin_salvar_condicoes",
    {
      p_contrato_id: contratoId,
      p_dados: {
        versao,
        ...payloadCondicoes(c),
        entrada: { valor: c.entrada.valor, forma: c.entrada.forma, regerar: opcoes.regerarEntrada, parcelas: entradaParcelas },
        saldo: { forma: c.saldo.definirDepois || totalSaldo === 0 ? null : c.saldo.forma, regerar: saldo.regerar, parcelas: saldo.parcelas },
      },
    },
    { contratoId },
  );
  if (!r.success) return r;

  const efeitos = r.data.sinal_confirmado_agora
    ? await aplicarEfeitosDoSinal(r.data.deal_id, { sinalConfirmadoAgora: true })
    : null;
  revalidarFinanceiro(contratoId);
  return {
    success: true,
    data: { contratoId, primeiraEscolha: r.data.primeira_escolha, movidoParaSinalPago: efeitos?.movidoParaSinalPago ?? false },
    avisos: efeitos?.avisos ?? [],
    gamificacao: efeitos?.gamificacao ?? null,
  };
}

// ─── T5/T9: baixa, estorno, edição de parcela, quitação ──────────────────

export async function baixarParcela(
  input: BaixarParcelaInput,
): Promise<AcaoResult<{ contratoId: string; entradaPagaAgora: boolean; movidoParaSinalPago: boolean }>> {
  if ((await getUserPapel()) !== "ceo") return SEM_PERMISSAO;
  const parsed = baixarParcelaSchema.safeParse(input);
  if (!parsed.success) return erroZod(parsed.error.issues);
  const b = parsed.data;

  // Valor irrisório (caso R$ 7,80) checado contra o valor REAL da parcela no
  // banco — o valorParcela do client só serve para a mensagem no formulário.
  const leitor = await createServerSupabaseClient();
  const { data: parc, error: parcErr } = await leitor
    .from("parcelas")
    .select("valor")
    .eq("id", b.parcelaId)
    .is("deleted_at", null)
    .maybeSingle();
  if (parcErr || !parc) return { success: false, code: "FIN_VALIDACAO", error: "Parcela não encontrada." };
  if (ehValorIrrisorio(b.valorRecebido ?? Number(parc.valor)) && !b.confirmarValorBaixo) {
    return { success: false, code: "FIN_VALIDACAO", error: "Valor abaixo de R$ 100 — confirme que está certo.", campo: "confirmarValorBaixo" };
  }

  const r = await chamarRpcFinanceira<{
    contrato_id: string; deal_id: string; tipo: string; entrada_paga_agora: boolean; sinal_confirmado_agora: boolean;
  }>("fin_baixar_parcela", {
    p_parcela_id: b.parcelaId,
    p_dados: {
      data: b.data, metodo: b.metodo, valor_recebido: b.valorRecebido, comprovante_url: b.comprovanteUrl,
      observacao: b.observacao, parcelas_cartao: b.parcelasCartao,
    },
  }, { parcelaId: b.parcelaId });
  if (!r.success) return r;

  const { registrarEventoGamificacao } = await import("@/lib/gamificacao");
  const xpPagamento = (await jaPontuouPagamento(b.parcelaId))
    ? null
    : await registrarEventoGamificacao("pagamento_confirmado", { tipo: "parcela", id: b.parcelaId });
  const efeitos = r.data.tipo === "entrada"
    ? await aplicarEfeitosDoSinal(r.data.deal_id, { sinalConfirmadoAgora: r.data.sinal_confirmado_agora })
    : null;

  revalidarFinanceiro(r.data.contrato_id);
  return {
    success: true,
    data: { contratoId: r.data.contrato_id, entradaPagaAgora: r.data.entrada_paga_agora, movidoParaSinalPago: efeitos?.movidoParaSinalPago ?? false },
    avisos: efeitos?.avisos ?? [],
    gamificacao: mesclarXp(xpPagamento, efeitos?.gamificacao ?? null),
  };
}

export async function estornarParcela(input: {
  parcelaId: string; justificativa: string; novoVencimento?: string | null;
}): Promise<AcaoResult<{ contratoId: string; sinalRemovido: boolean; contratoDescartado: boolean; sinalDesconfirmado: boolean }>> {
  if ((await getUserPapel()) !== "ceo") return SEM_PERMISSAO;
  const parsed = estornarParcelaSchema.safeParse(input);
  if (!parsed.success) return erroZod(parsed.error.issues);

  const r = await chamarRpcFinanceira<{
    contrato_id: string; sinal_removido: boolean; contrato_descartado: boolean; sinal_desconfirmado: boolean;
  }>("fin_estornar_parcela", {
    p_parcela_id: parsed.data.parcelaId,
    p_justificativa: parsed.data.justificativa,
    p_novo_vencimento: parsed.data.novoVencimento,
  });
  if (!r.success) return r;

  revalidarFinanceiro(r.data.contrato_id);
  const avisos = r.data.sinal_desconfirmado
    ? ["O negócio perdeu a confirmação de sinal. A etapa não foi alterada — mova o card se precisar."]
    : [];
  return {
    success: true,
    data: {
      contratoId: r.data.contrato_id, sinalRemovido: r.data.sinal_removido,
      contratoDescartado: r.data.contrato_descartado, sinalDesconfirmado: r.data.sinal_desconfirmado,
    },
    avisos,
    gamificacao: null,
  };
}

export async function editarParcela(input: {
  parcelaId: string; versao: string; valor?: number | null; vencimento?: string | null;
  metodo?: string | null; modoValor?: "ajustar_ultima" | "alterar_total"; observacao?: string; justificativa: string;
}): Promise<AcaoResult<{ contratoId: string }>> {
  if ((await getUserPapel()) !== "ceo") return SEM_PERMISSAO;
  const parsed = editarParcelaSchema.safeParse(input);
  if (!parsed.success) return erroZod(parsed.error.issues);
  const e = parsed.data;
  const r = await chamarRpcFinanceira<{ contrato_id: string }>("fin_editar_parcela", {
    p_parcela_id: e.parcelaId,
    p_dados: {
      versao: e.versao, valor: e.valor, vencimento: e.vencimento, metodo: e.metodo,
      modo_valor: e.modoValor, observacao: e.observacao, justificativa: e.justificativa,
    },
  }, { parcelaId: e.parcelaId });
  if (!r.success) return r;
  revalidarFinanceiro(r.data.contrato_id);
  return { success: true, data: { contratoId: r.data.contrato_id }, avisos: [], gamificacao: null };
}

export async function quitarContrato(input: {
  contratoId: string; versao: string; data: string; metodo: string; observacao?: string;
}): Promise<AcaoResult<{ contratoId: string; parcelasQuitadas: number; valorQuitado: number; movidoParaSinalPago: boolean }>> {
  if ((await getUserPapel()) !== "ceo") return SEM_PERMISSAO;
  const parsed = quitarContratoSchema.safeParse(input);
  if (!parsed.success) return erroZod(parsed.error.issues);
  const q = parsed.data;
  const r = await chamarRpcFinanceira<{
    contrato_id: string; deal_id: string; parcelas_quitadas: number; valor_quitado: number; sinal_confirmado_agora: boolean;
  }>("fin_quitar_contrato", {
    p_contrato_id: q.contratoId,
    p_dados: { versao: q.versao, data: q.data, metodo: q.metodo, observacao: q.observacao },
  }, { contratoId: q.contratoId });
  if (!r.success) return r;
  // Quitar NUNCA move o deal (critério do T9: "o deal CONTINUA na etapa onde
  // estava"). Se o sinal foi confirmado agora, roda só handoff + XP.
  const efeitos = r.data.sinal_confirmado_agora
    ? await aplicarEfeitosDoSinal(r.data.deal_id, { sinalConfirmadoAgora: true, moverEtapa: false })
    : null;
  revalidarFinanceiro(q.contratoId);
  return {
    success: true,
    data: {
      contratoId: q.contratoId, parcelasQuitadas: r.data.parcelas_quitadas,
      valorQuitado: Number(r.data.valor_quitado), movidoParaSinalPago: efeitos?.movidoParaSinalPago ?? false,
    },
    avisos: efeitos?.avisos ?? [],
    gamificacao: efeitos?.gamificacao ?? null,
  };
}

// ─── T18b: custos internos do aluno (REUSA despesas) ─────────────────────

export async function lancarCustoAluno(
  input: CustoAlunoInput,
  despesaId?: string,
): Promise<AcaoResult<{ id: string }>> {
  if ((await getUserPapel()) !== "ceo") return SEM_PERMISSAO;
  const parsed = custoAlunoSchema.safeParse(input);
  if (!parsed.success) return erroZod(parsed.error.issues);
  const c = parsed.data;
  const supabase = await createAuditedSupabaseClient();

  const linha = {
    descricao: c.descricao,
    categoria: c.categoria,
    tipo: "variavel" as const,
    valor_brl: c.valor,
    competencia: `${c.data.slice(0, 7)}-01`,
    vencimento: c.data,
    status: c.pago ? "pago" : "previsto",
    pago_at: c.pago ? `${c.data}T12:00:00-03:00` : null,
    metodo: c.metodo,
    fornecedor: c.fornecedor,
    observacao: c.observacao,
    recorrente: false, // CHECK despesas_custo_aluno_check
    contrato_id: c.contratoId,
  };
  const q = despesaId
    ? supabase.from("despesas").update(linha).eq("id", despesaId).eq("contrato_id", c.contratoId).is("deleted_at", null).select("id").maybeSingle()
    : supabase.from("despesas").insert(linha).select("id").single();
  const { data, error } = await q;
  if (error || !data) {
    console.error({ level: "error", action: "custo_aluno_falhou", contratoId: c.contratoId, error: error?.message });
    return { success: false, code: "FIN_VALIDACAO", error: "Não foi possível salvar o custo." };
  }
  revalidarFinanceiro(c.contratoId);
  return { success: true, data: { id: (data as { id: string }).id }, avisos: [], gamificacao: null };
}

export async function removerCustoAluno(despesaId: string, contratoId: string): Promise<AcaoResult<{ id: string }>> {
  if ((await getUserPapel()) !== "ceo") return SEM_PERMISSAO;
  if (!uuidSchema.safeParse(despesaId).success || !uuidSchema.safeParse(contratoId).success) {
    return { success: false, code: "FIN_VALIDACAO", error: "Custo inválido." };
  }
  const supabase = await createAuditedSupabaseClient();
  const { data, error } = await supabase
    .from("despesas")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", despesaId)
    .eq("contrato_id", contratoId)
    .is("deleted_at", null)
    .select("id");
  if (error || !data?.length) {
    return { success: false, code: "FIN_VALIDACAO", error: "Custo não encontrado (já removido?)." };
  }
  revalidarFinanceiro(contratoId);
  return { success: true, data: { id: despesaId }, avisos: [], gamificacao: null };
}

// ─── T18a: catálogo de serviços adicionais (configuracoes_sistema) ───────

/**
 * Erro de leitura ou catálogo ilegível LANÇA: tratar como lista vazia fazia a
 * tela de Configurações parecer sem serviços e o próximo Salvar sobrescrever
 * o catálogo inteiro. Chave ausente = catálogo vazio de verdade.
 */
async function lerCatalogo(): Promise<ServicoCatalogo[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("configuracoes_sistema")
    .select("valor")
    .eq("chave", "servicos_adicionais")
    .maybeSingle();
  if (error) {
    console.error({ level: "error", action: "catalogo_servicos_ilegivel", error: error.message });
    throw new Error("Não foi possível carregar o catálogo de serviços.");
  }
  const parsed = catalogoServicosSchema.safeParse(data?.valor ?? []);
  if (!parsed.success) {
    console.error({ level: "error", action: "catalogo_servicos_invalido", error: parsed.error.issues[0]?.message });
    throw new Error("O catálogo de serviços salvo está ilegível.");
  }
  return parsed.data;
}

export async function listarCatalogoServicos(): Promise<ServicoCatalogo[]> {
  if ((await getUserPapel()) !== "ceo") return [];
  return lerCatalogo();
}

export async function salvarCatalogoServicos(lista: ServicoCatalogo[]): Promise<AcaoResult<{ total: number }>> {
  if ((await getUserPapel()) !== "ceo") return SEM_PERMISSAO;
  const parsed = catalogoServicosSchema.safeParse(lista);
  if (!parsed.success) return erroZod(parsed.error.issues);
  const supabase = await createAuditedSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  // UPSERT (a chave nasce na migration *_financeiro_contrato_flexivel; upsert cobre ambiente sem seed).
  const { error } = await supabase.from("configuracoes_sistema").upsert(
    { chave: "servicos_adicionais", valor: parsed.data, updated_by: user?.id, updated_at: new Date().toISOString() },
    { onConflict: "chave" },
  );
  if (error) return { success: false, code: "FIN_VALIDACAO", error: `Não foi possível salvar: ${error.message}` };
  revalidatePath("/configuracoes");
  revalidatePath("/pipeline");
  return { success: true, data: { total: parsed.data.length }, avisos: [], gamificacao: null };
}

// ─── Helpers internos (NÃO exportados — arquivo "use server") ────────────

async function jaPontuouPagamento(parcelaId: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("gamificacao_eventos")
    .select("id")
    .eq("tipo", "pagamento_confirmado")
    .eq("ref_tipo", "parcela")
    .eq("ref_id", parcelaId)
    .limit(1);
  if (error) return true;
  return (data ?? []).length > 0;
}

function mesclarXp(a: ResultadoGamificacao | null, b: ResultadoGamificacao | null): ResultadoGamificacao | null {
  if (!a) return b;
  if (!b) return a;
  return {
    pontos: a.pontos + b.pontos,
    xpTotal: Math.max(a.xpTotal, b.xpTotal),
    nivel: b.nivel,
    nivelNome: b.nivelNome,
    subiuDeNivel: a.subiuDeNivel || b.subiuDeNivel,
    conquistasNovas: [...a.conquistasNovas, ...b.conquistasNovas],
  };
}
