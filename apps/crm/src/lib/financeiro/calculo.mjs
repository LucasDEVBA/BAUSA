// ─────────────────────────────────────────────────────────────────────────────
// Cálculo financeiro PURO do contrato (T6/T9/T10/T11/T18).
//
// Por que .mjs (e não .ts): é a ÚNICA fonte de regra de dinheiro usada pelo
// navegador (prévia do formulário), pelas server actions (geram as parcelas que
// a RPC grava) e pelo guard de CI `tests/financeiro-calculo.test.js` — que roda
// com node puro, sem dependências e sem transpilar TS. Os tipos ficam em
// `calculo.d.mts` (o tsc resolve `./calculo.mjs` → `./calculo.d.mts`).
//
// Todo valor monetário é processado em CENTAVOS inteiros para não acumular
// erro de ponto flutuante (o bug 12 × 2.166,02 ≠ 25.992,20 nasceu disso).
// ─────────────────────────────────────────────────────────────────────────────

export const VALOR_MAXIMO = 99_999_999.99;
/** Entrada/parcela abaixo disso pede confirmação explícita (caso R$ 7,80). */
export const VALOR_IRRISORIO_ABSOLUTO = 100;
/** …ou abaixo de 1% do total do contrato. */
export const VALOR_IRRISORIO_PERCENTUAL = 0.01;
export const MAX_PARCELAS = 60;

export const paraCentavos = (valor) => Math.round(Number(valor) * 100);
export const deCentavos = (centavos) => centavos / 100;
export const somarValores = (valores) =>
  deCentavos(valores.reduce((s, v) => s + paraCentavos(v), 0));

/**
 * Interpreta o que a pessoa digitou no padrão brasileiro.
 *   "7800" | "7.800" | "7.800,00" | "R$ 7.800" → 7800
 *   "7.800,5" → 7800.5   ","/"." finais incompletos → null (ainda digitando)
 *   "4500.50" | "7.8" (hábito en-US, 1–2 casas após UM ponto) → decimal
 * Retorna null quando inválido. Nunca devolve NaN.
 */
export function parseValorBRL(texto) {
  if (typeof texto !== "string") return null;
  const s = texto.replace(/R\$/gi, "").replace(/\s/g, "");
  if (!s || !/^[\d.,]+$/.test(s)) return null;

  let reais;
  if (s.includes(",")) {
    const i = s.lastIndexOf(",");
    const inteiro = s.slice(0, i);
    const decimal = s.slice(i + 1);
    if (inteiro.includes(",") || !/^\d{0,2}$/.test(decimal) || decimal.length === 0) return null;
    if (inteiro.includes(".")) {
      const grupos = inteiro.split(".");
      if (!/^\d{1,3}$/.test(grupos[0]) || !grupos.slice(1).every((g) => /^\d{3}$/.test(g))) return null;
    }
    const inteiroLimpo = inteiro.replace(/\./g, "") || "0";
    if (!/^\d+$/.test(inteiroLimpo)) return null;
    reais = Number(inteiroLimpo) + Number(decimal.padEnd(2, "0")) / 100;
  } else {
    const partes = s.split(".");
    if (partes.length === 1) {
      reais = Number(s);
    } else if (partes.length === 2 && /^\d+$/.test(partes[0]) && /^\d{1,2}$/.test(partes[1])) {
      reais = Number(partes[0]) + Number(partes[1].padEnd(2, "0")) / 100;
    } else if (/^\d{1,3}$/.test(partes[0]) && partes.slice(1).every((g) => /^\d{3}$/.test(g))) {
      reais = Number(partes.join(""));
    } else {
      return null;
    }
  }
  if (!Number.isFinite(reais) || reais < 0 || reais > VALOR_MAXIMO) return null;
  return deCentavos(paraCentavos(reais));
}

const FORMATO_BRL = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "7.800,00" (sem "R$" — o input mostra o prefixo). */
export const formatarValorBRL = (valor) =>
  valor === null || valor === undefined || !Number.isFinite(valor) ? "" : FORMATO_BRL.format(valor);

/** "R$ 7.800,00" — para textos e resumos. null/NaN → "—". */
export const formatarMoeda = (valor) =>
  valor === null || valor === undefined || !Number.isFinite(valor) ? "—" : `R$ ${FORMATO_BRL.format(valor)}`;

export function ehValorIrrisorio(valor, total) {
  if (!Number.isFinite(valor) || valor <= 0) return false;
  if (valor < VALOR_IRRISORIO_ABSOLUTO) return true;
  return Number.isFinite(total) && total > 0 && valor < total * VALOR_IRRISORIO_PERCENTUAL;
}

const ISO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

export function dataIsoValida(iso) {
  const m = typeof iso === "string" ? ISO_DATA.exec(iso) : null;
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

/**
 * Soma N meses mantendo o DIA do mês da data base (31/01 + 1 → 28/02;
 * 31/01 + 2 → 31/03). Sempre a partir da base — não acumula o "escorregão"
 * do +30 dias antigo.
 */
export function somarMesesMesmoDia(iso, meses) {
  if (!dataIsoValida(iso)) throw new Error(`data inválida: ${iso}`);
  const [, a, m, d] = ISO_DATA.exec(iso).map(Number);
  const alvo = m - 1 + meses;
  const ano = a + Math.floor(alvo / 12);
  const mes = ((alvo % 12) + 12) % 12;
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  const dia = Math.min(d, ultimoDia);
  return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export const METODO_DA_FORMA = Object.freeze({
  pix: "pix",
  pix_avista: "pix",
  pix_parcelado: "pix",
  getnet_parcelado: "getnet",
  transferencia: "transferencia",
  boleto: "boleto",
  cartao: "cartao",
  dinheiro: "dinheiro",
  outro: "outro",
});

export const metodoDaForma = (forma) => METODO_DA_FORMA[forma] ?? null;

/**
 * Cronograma de N parcelas para um total. A ÚLTIMA parcela absorve os
 * centavos (Σ = total exato). Numeração continua quando já há parcelas
 * recebidas (ex.: 3 pagas de 12 → novas "4/12"…"12/12").
 */
export function gerarCronograma({
  total,
  quantidade,
  primeiroVencimento,
  metodo,
  numeracaoInicio = 1,
  numeracaoTotal,
  rotuloUnico,
}) {
  const totalC = paraCentavos(total);
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > MAX_PARCELAS) {
    throw new Error("quantidade de parcelas inválida");
  }
  if (totalC <= 0) throw new Error("total deve ser positivo");
  if (totalC < quantidade) throw new Error("total menor que 1 centavo por parcela");
  const base = Math.floor(totalC / quantidade);
  const ultimo = totalC - base * (quantidade - 1);
  const denominador = numeracaoTotal ?? numeracaoInicio - 1 + quantidade;
  return Array.from({ length: quantidade }, (_, i) => ({
    numero_parcela:
      quantidade === 1 && denominador === 1 && rotuloUnico
        ? rotuloUnico
        : `${numeracaoInicio + i}/${denominador}`,
    valor: deCentavos(i === quantidade - 1 ? ultimo : base),
    vencimento: somarMesesMesmoDia(primeiroVencimento, i),
    metodo,
  }));
}

/**
 * Parcelas em ABERTO a gerar para um grupo (entrada ou saldo) preservando as
 * recebidas: restante = total do grupo − Σ recebidas; quantidade restante =
 * total de parcelas desejado − recebidas (mín. 1 se ainda falta valor).
 */
export function planejarAbertas({
  totalGrupo,
  recebidas,
  quantidadeTotal,
  primeiroVencimento,
  metodo,
  rotuloUnico,
}) {
  const recebidoC = recebidas.reduce((s, p) => s + paraCentavos(p.valor), 0);
  const restanteC = paraCentavos(totalGrupo) - recebidoC;
  if (restanteC < 0) {
    return { restante: deCentavos(restanteC), parcelas: [], erro: "MENOR_QUE_RECEBIDO" };
  }
  if (restanteC === 0) return { restante: 0, parcelas: [], erro: null };
  const qtd = Math.max(1, quantidadeTotal - recebidas.length);
  return {
    restante: deCentavos(restanteC),
    parcelas: gerarCronograma({
      total: deCentavos(restanteC),
      quantidade: qtd,
      primeiroVencimento,
      metodo,
      numeracaoInicio: recebidas.length + 1,
      numeracaoTotal: recebidas.length + qtd,
      rotuloUnico,
    }),
    erro: null,
  };
}

/** valor_total = base + Σ itens + (sinal abatido ? 0 : entrada). Mesma regra da RPC. */
export function composicaoValorTotal({ valorBase, itens = [], entrada = 0, sinalAbatido = true }) {
  const totalC =
    paraCentavos(valorBase) +
    itens.reduce((s, i) => s + paraCentavos(i.valor), 0) +
    (sinalAbatido ? 0 : paraCentavos(entrada));
  return deCentavos(totalC);
}

const vivas = (parcelas) => parcelas.filter((p) => !p.deleted_at && p.status !== "cancelado");

/**
 * Valor do contrato SEM parcela que o cubra ("definir depois" ou entrada sem
 * cronograma). Diferença de até 1 centavo por parcela viva NÃO conta: o
 * criarContrato antigo arredondava cada parcela (6 × 3.583,33 = 25.999,98
 * num contrato de 26.000) e esses centavos nunca são um saldo a cobrar — sem
 * a tolerância o contrato legado ficava "condições pendentes" para sempre e
 * nunca chegava a "quitado". O "Quitar" ainda grava a diferença ao centavo.
 */
export function faltaSemCronograma(contrato, parcelas = []) {
  if (!contrato) return 0;
  const v = vivas(parcelas);
  const faltaC = paraCentavos(contrato.valor_total) - v.reduce((s, p) => s + paraCentavos(p.valor), 0);
  return faltaC > v.length ? deCentavos(faltaC) : 0;
}

/**
 * Estado DERIVADO do contrato (nada gravado):
 *   sem_contrato | aguardando_plano | cancelado | condicoes_pendentes | quitado | ativo
 * "cancelado" = há parcela cancelada (fluxo solicitarCancelamento) e nada em aberto.
 */
export function estadoContrato(contrato, parcelas = []) {
  if (!contrato) return "sem_contrato";
  if (contrato.plano === null || contrato.plano === undefined) return "aguardando_plano";
  const naoExcluidas = parcelas.filter((p) => !p.deleted_at);
  if (
    naoExcluidas.some((p) => p.status === "cancelado") &&
    !naoExcluidas.some((p) => p.status === "previsto" || p.status === "atrasado")
  ) {
    return "cancelado";
  }
  if (faltaSemCronograma(contrato, parcelas) > 0) return "condicoes_pendentes";
  const v = vivas(parcelas);
  if (v.length > 0 && v.every((p) => p.status === "recebido")) return "quitado";
  return "ativo";
}

/** Números do contrato para cards/resumos (hoje = YYYY-MM-DD local). */
export function resumoFinanceiro(contrato, parcelas = [], hoje) {
  const v = vivas(parcelas);
  const rec = v.filter((p) => p.status === "recebido");
  const abertas = v.filter((p) => p.status !== "recebido");
  const atrasadas = abertas.filter((p) => p.vencimento < hoje);
  const somaC = (lista) => lista.reduce((s, p) => s + paraCentavos(p.valor), 0);
  const totalC = contrato ? paraCentavos(contrato.valor_total) : 0;
  const recebidoC = somaC(rec);
  return {
    valorTotal: deCentavos(totalC),
    recebido: deCentavos(recebidoC),
    aReceber: deCentavos(somaC(abertas)),
    emAtraso: deCentavos(somaC(atrasadas)),
    qtdAtrasadas: atrasadas.length,
    pagas: rec.length,
    totalParcelas: v.length,
    sinalRecebido: deCentavos(somaC(rec.filter((p) => p.tipo === "entrada"))),
    semCronograma: faltaSemCronograma(contrato, parcelas),
    /** O que "Quitar" registra: total − recebido (absorve centavos legados para mais ou para menos). */
    aQuitar: deCentavos(Math.max(0, totalC - recebidoC)),
    pctRecebido: totalC > 0 ? Math.round((recebidoC / totalC) * 100) : null,
  };
}

/**
 * Margem por aluno (T18b): receita contratada − custos lançados (despesas do
 * contrato, exceto canceladas) − psicóloga ESTIMADA (só se incluída e ainda
 * não lançada como custo real, para não contar duas vezes).
 */
export function margemAluno({ valorTotal, custos = [], incluiPsicologa = false, custoPsicologa = 0 }) {
  const validos = custos.filter((c) => c.status !== "cancelado");
  const custosC = validos.reduce((s, c) => s + paraCentavos(c.valor), 0);
  const psicologaLancada = validos.some((c) => c.categoria === "psicologa");
  const psicologaC = incluiPsicologa && !psicologaLancada ? paraCentavos(custoPsicologa || 0) : 0;
  const receitaC = paraCentavos(valorTotal || 0);
  const margemC = receitaC - custosC - psicologaC;
  return {
    receita: deCentavos(receitaC),
    custosLancados: deCentavos(custosC),
    psicologaEstimada: deCentavos(psicologaC),
    margem: deCentavos(margemC),
    margemPct: receitaC > 0 ? Math.round((margemC / receitaC) * 100) : null,
  };
}
