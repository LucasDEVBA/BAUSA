import { z } from "zod";

import {
  AGRESSIVIDADE_VALUES,
  INFLUENCIA_VALUES,
  INGLES_VALUES,
  PERFIL_VALUES,
  SERIE_VALUES,
  STATUS_VALUES,
  TEMPERATURA_VALUES,
  TIPO_VALUES,
  isEstadoUs,
  isValorDe,
} from "@/components/escolas/school-options";
import type { School } from "@/types/school";

import { cidadePendente } from "./apresentacao";
import {
  BUDGET_MAX_USD,
  CAMPOS_EDITAVEIS,
  EMAIL_RE,
  ehDataIso,
  ehUrlHttp,
  type CampoEditavel,
} from "./schema";

/**
 * Formulário de escola (criação e edição) — valores de input, conversão para
 * colunas e DIFF contra o valor atual. A validação de payload (cliente e
 * servidor) fica em ./schema.ts.
 */

const campoUrlForm = z
  .string()
  .trim()
  .max(2048, "Link longo demais.")
  .refine((v) => v === "" || ehUrlHttp(v), "Use o link completo, começando com https://.");

const campoDataForm = z.string().refine((v) => v === "" || ehDataIso(v), "Data inválida.");

/**
 * Valores do formulário (criação e edição): selects opcionais usam "" para
 * "Não informado"; números usam null (setValueAs). Regras que dependem do
 * valor ORIGINAL (cidade/estado placeholders, série/inglês legados) ficam em
 * `colunasDoForm`.
 */
export const escolaFormSchema = z.object({
  nome: z.string().trim().min(2, "Mínimo de 2 caracteres.").max(200, "Máximo de 200 caracteres."),
  tipo: z.enum(TIPO_VALUES, { error: "Selecione o tipo." }),
  perfil: z.union([z.enum(PERFIL_VALUES), z.literal("")]),
  status: z.enum(STATUS_VALUES, { error: "Selecione o status." }),
  website: campoUrlForm,
  cidade: z.string().trim().max(120, "Máximo de 120 caracteres."),
  estado_us: z.string(),
  link_inscricao: campoUrlForm,
  link_plano_saude: campoUrlForm,
  budget_minimo_usd: z
    .number({ error: "Informe um número." })
    .min(0, "Não pode ser negativo.")
    .max(BUDGET_MAX_USD, "Valor alto demais.")
    .nullable(),
  budget_forte_usd: z
    .number({ error: "Informe um número." })
    .min(0, "Não pode ser negativo.")
    .max(BUDGET_MAX_USD, "Valor alto demais.")
    .nullable(),
  agressividade_bolsa: z.union([z.enum(AGRESSIVIDADE_VALUES), z.literal("")]),
  ingles_minimo: z.union([z.enum(INGLES_VALUES), z.literal("")]),
  nota_minima_duolingo: z
    .number({ error: "Informe um número." })
    .int("Use um número inteiro.")
    .min(10, "Entre 10 e 160.")
    .max(160, "Entre 10 e 160.")
    .nullable(),
  gpa_minimo: z
    .number({ error: "Informe um número." })
    .min(0, "Entre 0 e 4.")
    .max(4, "Entre 0 e 4.")
    .nullable(),
  serie_maxima: z.string(),
  rolling_admission: z.boolean(),
  testes_exigidos: z.array(z.string()),
  esportes_oferecidos: z.string().max(300, "Máximo de 300 caracteres."),
  influencia_esporte: z.union([z.enum(INFLUENCIA_VALUES), z.literal("")]),
  aceita_excecao_elite: z.boolean(),
  deadline_fall: campoDataForm,
  deadline_spring: campoDataForm,
  admissions_officer_nome: z.string().trim().max(120, "Máximo de 120 caracteres."),
  admissions_officer_email: z
    .string()
    .trim()
    .max(254, "E-mail longo demais.")
    .refine((v) => v === "" || EMAIL_RE.test(v), "E-mail inválido."),
  admissions_officer_telefone: z.string().trim().max(40, "Máximo de 40 caracteres."),
  temperatura_relacionamento: z.enum(TEMPERATURA_VALUES, { error: "Selecione a temperatura." }),
  regra_pratica: z.string().max(1000, "Máximo de 1000 caracteres."),
  notas_internas: z.string().max(5000, "Máximo de 5000 caracteres."),
});
export type EscolaFormValues = z.infer<typeof escolaFormSchema>;

export const FORM_PADRAO_CRIACAO: EscolaFormValues = {
  nome: "",
  tipo: "boarding",
  perfil: "",
  status: "ativa",
  website: "",
  cidade: "",
  estado_us: "",
  link_inscricao: "",
  link_plano_saude: "",
  budget_minimo_usd: null,
  budget_forte_usd: null,
  agressividade_bolsa: "",
  // Mesmos defaults da coluna no banco: são insumo do calcular_match_score.
  ingles_minimo: "intermediario",
  nota_minima_duolingo: null,
  gpa_minimo: null,
  serie_maxima: "12th",
  rolling_admission: false,
  testes_exigidos: [],
  esportes_oferecidos: "",
  influencia_esporte: "",
  aceita_excecao_elite: false,
  deadline_fall: "",
  deadline_spring: "",
  admissions_officer_nome: "",
  admissions_officer_email: "",
  admissions_officer_telefone: "",
  temperatura_relacionamento: "neutro",
  regra_pratica: "",
  notas_internas: "",
};

/** Valores atuais da escola, crus, por campo editável (base do diff). */
export type ValoresEscola = Readonly<Record<CampoEditavel, unknown>>;

export function valoresDaEscola(e: School): ValoresEscola {
  return {
    nome: e.nome,
    tipo: e.tipo,
    perfil: e.perfil,
    status: e.status,
    website: e.website,
    cidade: e.cidade,
    estado_us: e.estado_us,
    link_inscricao: e.link_inscricao,
    link_plano_saude: e.link_plano_saude,
    budget_minimo_usd: e.budget_minimo_usd,
    budget_forte_usd: e.budget_forte_usd,
    agressividade_bolsa: e.agressividade_bolsa,
    ingles_minimo: e.ingles_minimo,
    nota_minima_duolingo: e.nota_minima_duolingo,
    gpa_minimo: e.gpa_minimo,
    serie_maxima: e.serie_maxima,
    rolling_admission: e.rolling_admission,
    testes_exigidos: e.testes_exigidos,
    esportes_oferecidos: e.esportes_oferecidos,
    influencia_esporte: e.influencia_esporte,
    aceita_excecao_elite: e.aceita_excecao_elite,
    deadline_fall: e.deadline_fall,
    deadline_spring: e.deadline_spring,
    admissions_officer_nome: e.admissions_officer_nome,
    admissions_officer_email: e.admissions_officer_email,
    admissions_officer_telefone: e.admissions_officer_telefone,
    temperatura_relacionamento: e.temperatura_relacionamento,
    regra_pratica: e.regra_pratica,
    notas_internas: e.notas_internas,
  };
}

/** Escola → valores iniciais do formulário de edição (null → ""). */
export function formDaEscola(e: School): EscolaFormValues {
  return {
    nome: e.nome,
    tipo: e.tipo,
    perfil: e.perfil ?? "",
    status: e.status,
    website: e.website ?? "",
    // Placeholders do import ("A confirmar" / "--") aparecem vazios no form.
    cidade: cidadePendente(e.cidade) ? "" : e.cidade,
    estado_us: isEstadoUs(e.estado_us) ? e.estado_us : "",
    link_inscricao: e.link_inscricao ?? "",
    link_plano_saude: e.link_plano_saude ?? "",
    budget_minimo_usd: e.budget_minimo_usd,
    budget_forte_usd: e.budget_forte_usd,
    agressividade_bolsa: e.agressividade_bolsa ?? "",
    ingles_minimo: e.ingles_minimo ?? "",
    nota_minima_duolingo: e.nota_minima_duolingo,
    gpa_minimo: e.gpa_minimo,
    serie_maxima: e.serie_maxima ?? "",
    rolling_admission: e.rolling_admission,
    testes_exigidos: [...e.testes_exigidos],
    esportes_oferecidos: e.esportes_oferecidos.join(", "),
    influencia_esporte: e.influencia_esporte ?? "",
    aceita_excecao_elite: e.aceita_excecao_elite,
    deadline_fall: e.deadline_fall ?? "",
    deadline_spring: e.deadline_spring ?? "",
    admissions_officer_nome: e.admissions_officer_nome ?? "",
    admissions_officer_email: e.admissions_officer_email ?? "",
    admissions_officer_telefone: e.admissions_officer_telefone ?? "",
    temperatura_relacionamento: e.temperatura_relacionamento ?? "neutro",
    regra_pratica: e.regra_pratica ?? "",
    notas_internas: e.notas_internas ?? "",
  };
}

/** "futebol,  Vôlei , futebol" → ["Futebol", "Vôlei"] (casa com atletas.esporte). */
export function normalizarEsportes(entrada: readonly string[] | string): string[] {
  const itens = typeof entrada === "string" ? entrada.split(",") : [...entrada];
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const bruto of itens) {
    const limpo = bruto.trim().replace(/\s+/g, " ");
    if (limpo.length < 2) continue;
    const normalizado = limpo.charAt(0).toLocaleUpperCase("pt-BR") + limpo.slice(1);
    const chave = normalizado.toLocaleLowerCase("pt-BR");
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    saida.push(normalizado);
  }
  return saida;
}

const vazioOuNull = (v: string): string | null => {
  const t = v.trim();
  return t === "" ? null : t;
};

export type ResultadoMontagem =
  | { ok: true; valores: Record<CampoEditavel, unknown> }
  | { ok: false; campo: keyof EscolaFormValues; mensagem: string };

/**
 * Form → valores de coluna. `original` = escola sendo editada (null na
 * criação). Campo vazio cujo original era placeholder/NULL fica INTOCADO
 * (permite salvar o resto da Gateway sem já saber a cidade).
 */
export function colunasDoForm(v: EscolaFormValues, original: ValoresEscola | null): ResultadoMontagem {
  const cidade = v.cidade.trim();
  const origCidade = typeof original?.cidade === "string" ? original.cidade : null;
  if (cidade === "" && !(origCidade !== null && cidadePendente(origCidade))) {
    return { ok: false, campo: "cidade", mensagem: "Informe a cidade." };
  }
  const origEstado = original?.estado_us;
  if (v.estado_us === "" && !(typeof origEstado === "string" && !isEstadoUs(origEstado))) {
    return { ok: false, campo: "estado_us", mensagem: "Selecione o estado." };
  }
  if (v.ingles_minimo === "" && (original === null || original.ingles_minimo != null)) {
    return { ok: false, campo: "ingles_minimo", mensagem: "Selecione o inglês mínimo." };
  }
  if (v.serie_maxima === "" && (original === null || original.serie_maxima != null)) {
    return { ok: false, campo: "serie_maxima", mensagem: "Selecione a série máxima." };
  }
  if (v.serie_maxima !== "" && !isValorDe(SERIE_VALUES, v.serie_maxima) && v.serie_maxima !== original?.serie_maxima) {
    return { ok: false, campo: "serie_maxima", mensagem: "Selecione uma série válida." };
  }
  if (
    v.budget_minimo_usd != null &&
    v.budget_forte_usd != null &&
    v.budget_forte_usd < v.budget_minimo_usd
  ) {
    return { ok: false, campo: "budget_forte_usd", mensagem: "Deve ser maior ou igual ao mínimo." };
  }

  return {
    ok: true,
    valores: {
      nome: v.nome.trim(),
      tipo: v.tipo,
      perfil: v.perfil === "" ? null : v.perfil,
      status: v.status,
      website: vazioOuNull(v.website),
      cidade: cidade === "" ? origCidade : cidade,
      estado_us: v.estado_us === "" ? origEstado : v.estado_us,
      link_inscricao: vazioOuNull(v.link_inscricao),
      link_plano_saude: vazioOuNull(v.link_plano_saude),
      budget_minimo_usd: v.budget_minimo_usd,
      budget_forte_usd: v.budget_forte_usd,
      agressividade_bolsa: v.agressividade_bolsa === "" ? null : v.agressividade_bolsa,
      ingles_minimo: v.ingles_minimo === "" ? null : v.ingles_minimo,
      nota_minima_duolingo: v.nota_minima_duolingo,
      gpa_minimo: v.gpa_minimo,
      serie_maxima: v.serie_maxima === "" ? null : v.serie_maxima,
      rolling_admission: v.rolling_admission,
      testes_exigidos: v.testes_exigidos,
      esportes_oferecidos: normalizarEsportes(v.esportes_oferecidos),
      influencia_esporte: v.influencia_esporte === "" ? null : v.influencia_esporte,
      aceita_excecao_elite: v.aceita_excecao_elite,
      deadline_fall: vazioOuNull(v.deadline_fall),
      deadline_spring: vazioOuNull(v.deadline_spring),
      admissions_officer_nome: vazioOuNull(v.admissions_officer_nome),
      admissions_officer_email: vazioOuNull(v.admissions_officer_email),
      admissions_officer_telefone: vazioOuNull(v.admissions_officer_telefone),
      temperatura_relacionamento: v.temperatura_relacionamento,
      regra_pratica: vazioOuNull(v.regra_pratica),
      notas_internas: vazioOuNull(v.notas_internas),
    },
  };
}

/** Texto comparado como o form grava: CRLF → LF e sem espaço nas pontas. */
const normalizarTexto = (v: string): string => v.replace(/\r\n?/g, "\n").trim();

function valoresIguais(a: unknown, b: unknown): boolean {
  // Sem isto, um espaço no fim (ou CRLF vindo de SQL) faria "Salvar sem
  // mexer" regravar o campo — achado na verificação com dados reais.
  if (typeof a === "string" && typeof b === "string") return normalizarTexto(a) === normalizarTexto(b);
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const ordenar = (lista: unknown[]) => lista.map(String).sort().join("\u0000");
    return ordenar(a) === ordenar(b);
  }
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < 1e-9;
  return (a ?? null) === (b ?? null);
}

/** Só os campos que MUDARAM — "Salvar" sem mexer gera patch vazio. */
export function diffEscola(
  original: ValoresEscola,
  novo: Readonly<Record<CampoEditavel, unknown>>,
): Partial<Record<CampoEditavel, unknown>> {
  const patch: Partial<Record<CampoEditavel, unknown>> = {};
  for (const campo of CAMPOS_EDITAVEIS) {
    if (!valoresIguais(original[campo], novo[campo])) patch[campo] = novo[campo];
  }
  return patch;
}
