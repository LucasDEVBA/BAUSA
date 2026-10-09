// ─────────────────────────────────────────────────────────────────────────────
// Schemas (Zod v4) e vocabulário do contrato financeiro — COMPARTILHADO entre
// formulários (client) e server actions. Sem "use server": um arquivo com essa
// diretiva só pode exportar funções async (constantes quebram o build).
// A RPC (fin_*) revalida os invariantes de dinheiro no banco.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from "zod";

import { ehValorIrrisorio } from "@/lib/financeiro/calculo.mjs";

// ─── Vocabulário (espelha os CHECKs da migration *_financeiro_contrato_flexivel) ─────────────

export const PLANOS = ["start", "journey", "legacy", "personalizado"] as const;
export type PlanoContrato = (typeof PLANOS)[number];

export const FORMAS_PLANO = ["padrao", "pix_avista"] as const;
export type FormaPlano = (typeof FORMAS_PLANO)[number];

export const FORMAS_ENTRADA = [
  "pix", "getnet_parcelado", "transferencia", "boleto", "cartao", "dinheiro", "outro",
] as const;
export type FormaEntradaContrato = (typeof FORMAS_ENTRADA)[number];

export const FORMAS_SALDO = [
  "pix_avista", "pix_parcelado", "getnet_parcelado", "transferencia", "boleto", "cartao", "dinheiro", "outro",
] as const;
export type FormaSaldoContrato = (typeof FORMAS_SALDO)[number];

export const METODOS_PARCELA = [
  "pix", "getnet", "transferencia", "boleto", "cartao", "dinheiro", "outro",
] as const;
export type MetodoParcelaContrato = (typeof METODOS_PARCELA)[number];

export const TIPOS_ITEM = ["servico", "desconto", "ajuste"] as const;
export type TipoItemContrato = (typeof TIPOS_ITEM)[number];

export const PLANO_LABEL: Record<PlanoContrato, string> = {
  start: "Start",
  journey: "Journey",
  legacy: "Legacy",
  personalizado: "Personalizado",
};

export const FORMA_PLANO_LABEL: Record<FormaPlano, string> = {
  padrao: "Padrão (parcelado)",
  pix_avista: "Pix à vista",
};

export const FORMA_LABEL: Record<FormaEntradaContrato | FormaSaldoContrato, string> = {
  pix: "Pix",
  pix_avista: "Pix à vista",
  pix_parcelado: "Pix parcelado",
  getnet_parcelado: "Getnet parcelado (cartão)",
  transferencia: "Transferência",
  boleto: "Boleto",
  cartao: "Cartão (outra maquininha)",
  dinheiro: "Dinheiro",
  outro: "Outro",
};

export const METODO_LABEL: Record<MetodoParcelaContrato, string> = {
  pix: "Pix",
  getnet: "Getnet",
  transferencia: "Transferência",
  boleto: "Boleto",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  outro: "Outro",
};

/** Formas com "vezes no cartão" (informativo numa parcela recebida). */
export const FORMAS_COM_CARTAO: ReadonlySet<string> = new Set(["getnet_parcelado", "cartao"]);
/** Saldo à vista = sempre 1 parcela. */
export const FORMAS_SALDO_UNICA: ReadonlySet<string> = new Set(["pix_avista"]);

export const JUSTIFICATIVA_MIN = 5;
export const JUSTIFICATIVA_MAX = 1000;

// ─── Primitivos ──────────────────────────────────────────────────────────────

/** No máximo 2 casas decimais (tolerância de ponto flutuante). */
const ateDuasCasas = (v: number) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6;
export const dinheiroSchema = z
  .number({ error: "Informe um valor." })
  .min(0, "Valor não pode ser negativo.")
  .max(99_999_999.99, "Valor alto demais.")
  .refine(ateDuasCasas, "Use no máximo 2 casas decimais.");
export const dinheiroPositivoSchema = dinheiroSchema.refine((v) => v > 0, "Informe um valor maior que zero.");
export const dataIsoSchema = z.iso.date("Data inválida.");
export const justificativaSchema = z
  .string()
  .trim()
  .min(JUSTIFICATIVA_MIN, `Justificativa obrigatória (mín. ${JUSTIFICATIVA_MIN} caracteres) — fica no histórico.`)
  .max(JUSTIFICATIVA_MAX);
export const uuidSchema = z.uuid("Identificador inválido.");

/** "Hoje" no fuso do negócio (America/Sao_Paulo), YYYY-MM-DD. */
export function hojeBRT(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}

export const itemContratoSchema = z
  .object({
    id: uuidSchema.optional(),
    tipo: z.enum(TIPOS_ITEM),
    descricao: z.string().trim().min(2, "Descreva o item.").max(160),
    /** Sempre POSITIVO no formulário; o sinal vem do tipo (desconto = −). */
    valorAbsoluto: dinheiroPositivoSchema,
    /** Só para ajuste: soma (+) ou subtrai (−). */
    ajusteNegativo: z.boolean().default(false),
    catalogoChave: z.string().regex(/^[a-z0-9_]{1,40}$/).optional(),
  });
export type ItemContratoInput = z.input<typeof itemContratoSchema>;

/** Valor com sinal, como a RPC espera. */
export function valorAssinadoDoItem(i: z.output<typeof itemContratoSchema>): number {
  if (i.tipo === "desconto") return -i.valorAbsoluto;
  if (i.tipo === "ajuste" && i.ajusteNegativo) return -i.valorAbsoluto;
  return i.valorAbsoluto;
}

// ─── Condições do contrato (criar / escolher plano / editar) ────────────────

export const condicoesContratoSchema = z
  .object({
    plano: z.enum(PLANOS, { error: "Escolha o plano." }),
    formaPagamentoPlano: z.enum(FORMAS_PLANO),
    valorBasePlano: dinheiroPositivoSchema,
    /** Preço de tabela no momento (null = personalizado). Só para a regra 3 na UI; o banco recalcula. */
    valorTabela: z.number().nullable(),
    justificativa: z.string().trim().max(JUSTIFICATIVA_MAX).default(""),
    sinalAbatido: z.boolean().default(true),
    itens: z.array(itemContratoSchema).max(30).default([]),
    incluiPsicologa: z.boolean(),
    custoPsicologa: dinheiroSchema.default(0),

    entrada: z.object({
      valor: dinheiroSchema,
      forma: z.enum(FORMAS_ENTRADA).nullable(),
      /** Total de parcelas da entrada (inclui as já recebidas). */
      quantidade: z.number().int().min(1).max(12).default(1),
      /** Entrada já paga na criação (registra como recebida). */
      jaRecebida: z.boolean().default(false),
      dataRecebimento: dataIsoSchema.nullable().default(null),
      primeiroVencimento: dataIsoSchema.nullable().default(null),
      parcelasCartao: z.number().int().min(1).max(24).nullable().default(null),
    }),

    saldo: z.object({
      definirDepois: z.boolean().default(false),
      forma: z.enum(FORMAS_SALDO).nullable(),
      quantidade: z.number().int().min(1).max(24).default(1),
      primeiroVencimento: dataIsoSchema.nullable().default(null),
    }),

    /** Confirma conscientemente entrada irrisória (< R$ 100 ou < 1% do total). */
    confirmarValorBaixo: z.boolean().default(false),
    /** Troca de plano com saldo já pago (T10). */
    confirmarComPagamentos: z.boolean().default(false),
    /** Editar contrato que já tem plano (T9) — o SERVIDOR define (nunca confia no client). */
    exigirJustificativa: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    const customizado = v.valorTabela === null || v.valorBasePlano !== v.valorTabela;
    const somaItens = v.itens.reduce((s, i) => s + valorAssinadoDoItem(i), 0);
    // Regra 3 completa (= RPC): o total difere da tabela também por itens ou sinal à parte.
    const negociado = customizado || Math.round(somaItens * 100) !== 0 || (!v.sinalAbatido && v.entrada.valor > 0);
    if ((negociado || v.exigirJustificativa) && v.justificativa.length < JUSTIFICATIVA_MIN) {
      ctx.addIssue({
        code: "custom",
        path: ["justificativa"],
        message: negociado
          ? "Condições fora da tabela (valor, serviços, descontos, ajustes ou sinal à parte) exigem justificativa (Regra 3)."
          : "Editar o contrato exige justificativa (fica no histórico).",
      });
    }
    if (v.entrada.valor > 0 && !v.entrada.forma) {
      ctx.addIssue({ code: "custom", path: ["entrada", "forma"], message: "Escolha a forma da entrada." });
    }
    if (v.entrada.valor > 0 && v.entrada.jaRecebida && !v.entrada.dataRecebimento) {
      ctx.addIssue({ code: "custom", path: ["entrada", "dataRecebimento"], message: "Informe a data em que a entrada foi paga." });
    }
    if (v.entrada.jaRecebida && v.entrada.dataRecebimento && v.entrada.dataRecebimento > hojeBRT()) {
      ctx.addIssue({ code: "custom", path: ["entrada", "dataRecebimento"], message: "A data do pagamento não pode ser futura." });
    }
    if (v.entrada.valor > 0 && !v.entrada.jaRecebida && !v.entrada.primeiroVencimento) {
      ctx.addIssue({ code: "custom", path: ["entrada", "primeiroVencimento"], message: "Informe o vencimento da entrada." });
    }
    if (!v.saldo.definirDepois) {
      if (!v.saldo.forma) {
        ctx.addIssue({ code: "custom", path: ["saldo", "forma"], message: "Escolha a forma do saldo (ou marque “definir depois”)." });
      }
      if (!v.saldo.primeiroVencimento) {
        ctx.addIssue({ code: "custom", path: ["saldo", "primeiroVencimento"], message: "Informe o 1º vencimento do saldo." });
      }
    }
    // Entrada irrisória (caso Amanda): exige confirmação explícita — client E server.
    const total =
      v.valorBasePlano +
      v.itens.reduce((s, i) => s + valorAssinadoDoItem(i), 0) +
      (v.sinalAbatido ? 0 : v.entrada.valor);
    if (total < v.entrada.valor) {
      ctx.addIssue({ code: "custom", path: ["entrada", "valor"], message: "A entrada não pode ser maior que o valor total." });
    }
    if (ehValorIrrisorio(v.entrada.valor, total) && !v.confirmarValorBaixo) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmarValorBaixo"],
        message: "Entrada muito baixa para este contrato — confirme que o valor está certo.",
      });
    }
  });
export type CondicoesContratoInput = z.input<typeof condicoesContratoSchema>;
export type CondicoesContrato = z.output<typeof condicoesContratoSchema>;

// ─── Sinal antes do plano (T11) ──────────────────────────────────────────────

export const registrarSinalSchema = z
  .object({
    dealId: uuidSchema,
    valor: dinheiroPositivoSchema,
    forma: z.enum(FORMAS_ENTRADA, { error: "Escolha a forma de pagamento do sinal." }),
    parcelasCartao: z.number().int().min(1).max(24).nullable().default(null),
    dataPagamento: dataIsoSchema,
    comprovanteUrl: z.url().max(2048).nullable().default(null),
    observacao: z.string().trim().max(500).default(""),
    confirmarValorBaixo: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.dataPagamento > hojeBRT()) {
      ctx.addIssue({ code: "custom", path: ["dataPagamento"], message: "A data do pagamento não pode ser futura." });
    }
    if (v.parcelasCartao !== null && !FORMAS_COM_CARTAO.has(v.forma)) {
      ctx.addIssue({ code: "custom", path: ["parcelasCartao"], message: "Vezes no cartão só para Getnet/cartão." });
    }
    if (ehValorIrrisorio(v.valor) && !v.confirmarValorBaixo) {
      ctx.addIssue({ code: "custom", path: ["confirmarValorBaixo"], message: "Sinal abaixo de R$ 100 — confirme que o valor está certo." });
    }
  });
export type RegistrarSinalInput = z.input<typeof registrarSinalSchema>;

// ─── Parcelas (T5/T9) ────────────────────────────────────────────────────────

export const baixarParcelaSchema = z
  .object({
    parcelaId: uuidSchema,
    data: dataIsoSchema,
    metodo: z.enum(METODOS_PARCELA, { error: "Escolha o método." }),
    /** null = valor cheio da parcela. Menor = pagamento parcial (gera "restante"). */
    valorRecebido: dinheiroPositivoSchema.nullable().default(null),
    valorParcela: dinheiroPositivoSchema,
    comprovanteUrl: z.url().max(2048).nullable().default(null),
    observacao: z.string().trim().max(500).default(""),
    parcelasCartao: z.number().int().min(1).max(24).nullable().default(null),
    confirmarValorBaixo: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.data > hojeBRT()) {
      ctx.addIssue({ code: "custom", path: ["data"], message: "A data do pagamento não pode ser futura." });
    }
    if (v.valorRecebido !== null && v.valorRecebido > v.valorParcela) {
      ctx.addIssue({ code: "custom", path: ["valorRecebido"], message: "Valor maior que a parcela — use “Quitar contrato” ou edite as parcelas." });
    }
    if (ehValorIrrisorio(v.valorRecebido ?? v.valorParcela) && !v.confirmarValorBaixo) {
      ctx.addIssue({ code: "custom", path: ["confirmarValorBaixo"], message: "Valor abaixo de R$ 100 — confirme que está certo." });
    }
  });
export type BaixarParcelaInput = z.input<typeof baixarParcelaSchema>;

export const estornarParcelaSchema = z
  .object({
    parcelaId: uuidSchema,
    justificativa: justificativaSchema,
    /** Opcional: novo vencimento (>= hoje). Sem ele, parcela vencida volta ATRASADA e a régua cobra. */
    novoVencimento: dataIsoSchema.nullable().default(null),
  })
  .refine((v) => v.novoVencimento === null || v.novoVencimento >= hojeBRT(), {
    path: ["novoVencimento"],
    message: "O novo vencimento não pode estar no passado.",
  });

export const editarParcelaSchema = z
  .object({
    parcelaId: uuidSchema,
    versao: z.string().min(8),
    valor: dinheiroPositivoSchema.nullable().default(null),
    vencimento: dataIsoSchema.nullable().default(null),
    metodo: z.enum(METODOS_PARCELA).nullable().default(null),
    modoValor: z.enum(["ajustar_ultima", "alterar_total"]).default("ajustar_ultima"),
    observacao: z.string().trim().max(500).default(""),
    justificativa: justificativaSchema,
  })
  .refine((v) => v.valor !== null || v.vencimento !== null || v.metodo !== null || v.observacao.length > 0, {
    message: "Nada mudou nesta parcela.",
  });

export const quitarContratoSchema = z
  .object({
    contratoId: uuidSchema,
    versao: z.string().min(8),
    data: dataIsoSchema,
    metodo: z.enum(METODOS_PARCELA, { error: "Escolha o método da quitação." }),
    observacao: z.string().trim().max(500).default(""),
  })
  .refine((v) => v.data <= hojeBRT(), { path: ["data"], message: "A data do pagamento não pode ser futura." });

// ─── Custos do aluno (T18b) — reusa despesas ────────────────────────────────

export const CATEGORIAS_CUSTO_ALUNO = [
  "psicologa", "taxas_escola", "testes_idioma", "traducao", "viagem", "comissoes", "servicos", "outros",
] as const;
export type CategoriaCustoAluno = (typeof CATEGORIAS_CUSTO_ALUNO)[number];

export const CATEGORIA_CUSTO_ALUNO_LABEL: Record<CategoriaCustoAluno, string> = {
  psicologa: "Psicóloga",
  taxas_escola: "Taxas de escola/aplicação",
  testes_idioma: "Testes de idioma (TOEFL/Duolingo)",
  traducao: "Tradução de documentos",
  viagem: "Viagem/deslocamento",
  comissoes: "Comissão",
  servicos: "Outros serviços",
  outros: "Outros",
};

export const custoAlunoSchema = z.object({
  contratoId: uuidSchema,
  descricao: z.string().trim().min(2, "Descreva o custo.").max(160),
  categoria: z.enum(CATEGORIAS_CUSTO_ALUNO),
  valor: dinheiroPositivoSchema,
  data: dataIsoSchema,
  pago: z.boolean().default(true),
  metodo: z.enum(["pix", "boleto", "cartao", "transferencia", "debito_automatico", "dinheiro", "outro"]).nullable().default(null),
  fornecedor: z.string().trim().max(160).nullable().default(null),
  observacao: z.string().trim().max(500).nullable().default(null),
});
export type CustoAlunoInput = z.input<typeof custoAlunoSchema>;

// ─── Catálogo de serviços adicionais (T18a, configuracoes_sistema) ───────────

export const servicoCatalogoSchema = z.object({
  chave: z.string().regex(/^[a-z0-9_]{1,40}$/, "Chave inválida."),
  nome: z.string().trim().min(2).max(120),
  valor: dinheiroPositivoSchema,
  ativo: z.boolean().default(true),
});
export const catalogoServicosSchema = z
  .array(servicoCatalogoSchema)
  .max(40)
  .refine((l) => new Set(l.map((s) => s.chave)).size === l.length, "Chaves repetidas no catálogo.");
export type ServicoCatalogo = z.output<typeof servicoCatalogoSchema>;
