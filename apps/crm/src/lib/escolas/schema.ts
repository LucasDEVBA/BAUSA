import { z } from "zod";

import {
  AGRESSIVIDADE_VALUES,
  INFLUENCIA_VALUES,
  INGLES_VALUES,
  PERFIL_VALUES,
  SERIE_VALUES,
  STATUS_VALUES,
  TEMPERATURA_VALUES,
  TIPO_CONTATO_VALUES,
  TIPO_VALUES,
  RESULTADO_ESTRATEGIA_VALUES,
  isEstadoUs,
} from "@/components/escolas/school-options";

/**
 * Validação do Banco de Escolas — usada no CLIENTE (feedback imediato) e no
 * SERVIDOR (fonte de verdade). Lista branca de campos = chaves de
 * `ESCOLA_COLUNAS_SHAPE`; qualquer outra chave é recusada (mass assignment).
 * Enums = valores reais do banco (school-options.ts).
 */

export const CAMPOS_EDITAVEIS = [
  "nome",
  "tipo",
  "perfil",
  "status",
  "website",
  "cidade",
  "estado_us",
  "link_inscricao",
  "link_plano_saude",
  "budget_minimo_usd",
  "budget_forte_usd",
  "agressividade_bolsa",
  "ingles_minimo",
  "nota_minima_duolingo",
  "gpa_minimo",
  "serie_maxima",
  "rolling_admission",
  "testes_exigidos",
  "esportes_oferecidos",
  "influencia_esporte",
  "aceita_excecao_elite",
  "deadline_fall",
  "deadline_spring",
  "admissions_officer_nome",
  "admissions_officer_email",
  "admissions_officer_telefone",
  "temperatura_relacionamento",
  "regra_pratica",
  "notas_internas",
] as const;
export type CampoEditavel = (typeof CAMPOS_EDITAVEIS)[number];

export const CAMPO_LABEL: Readonly<Record<CampoEditavel, string>> = {
  nome: "Nome",
  tipo: "Tipo",
  perfil: "Perfil",
  status: "Status",
  website: "Site oficial",
  cidade: "Cidade",
  estado_us: "Estado",
  link_inscricao: "Link de inscrição",
  link_plano_saude: "Link do plano de saúde",
  budget_minimo_usd: "Budget mínimo",
  budget_forte_usd: "Budget forte",
  agressividade_bolsa: "Agressividade de bolsa",
  ingles_minimo: "Inglês mínimo",
  nota_minima_duolingo: "Duolingo mínimo",
  gpa_minimo: "GPA mínimo",
  serie_maxima: "Série máxima",
  rolling_admission: "Rolling admission",
  testes_exigidos: "Testes exigidos",
  esportes_oferecidos: "Esportes oferecidos",
  influencia_esporte: "Influência do esporte",
  aceita_excecao_elite: "Exceção para atleta de elite",
  deadline_fall: "Deadline Fall",
  deadline_spring: "Deadline Spring",
  admissions_officer_nome: "Nome do officer",
  admissions_officer_email: "E-mail do officer",
  admissions_officer_telefone: "Telefone do officer",
  temperatura_relacionamento: "Temperatura do relacionamento",
  regra_pratica: "Regra BAUSA",
  notas_internas: "Notas internas",
};

// ─── Validadores de campo ────────────────────────────────────────────────

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const DATA_ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
export const BUDGET_MAX_USD = 10_000_000;

export function ehUrlHttp(valor: string): boolean {
  if (!/^https?:\/\//i.test(valor)) return false;
  try {
    new URL(valor);
    return true;
  } catch {
    return false;
  }
}

export function ehDataIso(valor: string): boolean {
  const m = DATA_ISO_RE.exec(valor);
  if (!m) return false;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

/** "" / "   " → null antes de validar (input vazio = não informado). */
const vazioParaNull = (v: unknown): unknown =>
  typeof v === "string" && v.trim() === "" ? null : v;

function textoOpcional(max: number, rotulo: string) {
  return z.preprocess(
    vazioParaNull,
    z
      .string({ error: `${rotulo}: texto inválido.` })
      .trim()
      .max(max, `${rotulo}: máximo de ${max} caracteres.`)
      .nullable(),
  );
}

function urlOpcional(rotulo: string) {
  return z.preprocess(
    vazioParaNull,
    z
      .string({ error: `${rotulo}: link inválido.` })
      .trim()
      .max(2048, `${rotulo}: link longo demais.`)
      .refine(ehUrlHttp, `${rotulo}: use o link completo, começando com https://.`)
      .nullable(),
  );
}

function dataOpcional(rotulo: string) {
  return z.preprocess(
    vazioParaNull,
    z
      .string({ error: `${rotulo}: data inválida.` })
      .refine(ehDataIso, `${rotulo}: data inválida.`)
      .nullable(),
  );
}

function enumOpcional<T extends string>(valores: readonly [T, ...T[]], rotulo: string) {
  return z.preprocess(vazioParaNull, z.enum(valores, { error: `${rotulo}: opção inválida.` }).nullable());
}

function numeroOpcional(rotulo: string, min: number, max: number) {
  return z
    .number({ error: `${rotulo}: informe um número.` })
    .min(min, `${rotulo}: mínimo ${min}.`)
    .max(max, `${rotulo}: máximo ${max}.`)
    .nullable();
}

// ─── Schema do payload (o que vai para public.escolas) ──────────────────

export const ESCOLA_COLUNAS_SHAPE = {
  nome: z
    .string({ error: "Nome: informe o nome da escola." })
    .trim()
    .min(2, "Nome: mínimo de 2 caracteres.")
    .max(200, "Nome: máximo de 200 caracteres."),
  tipo: z.enum(TIPO_VALUES, { error: "Tipo: escolha Boarding, Day school ou Boarding + Day." }),
  perfil: enumOpcional(PERFIL_VALUES, "Perfil"),
  status: z.enum(STATUS_VALUES, { error: "Status: opção inválida." }),
  website: urlOpcional("Site oficial"),
  cidade: z
    .string({ error: "Cidade: informe a cidade." })
    .trim()
    .min(2, "Cidade: informe a cidade.")
    .max(120, "Cidade: máximo de 120 caracteres."),
  estado_us: z
    .string({ error: "Estado: selecione o estado." })
    .refine(isEstadoUs, "Estado: selecione um estado americano válido."),
  link_inscricao: urlOpcional("Link de inscrição"),
  link_plano_saude: urlOpcional("Link do plano de saúde"),
  budget_minimo_usd: numeroOpcional("Budget mínimo", 0, BUDGET_MAX_USD),
  budget_forte_usd: numeroOpcional("Budget forte", 0, BUDGET_MAX_USD),
  agressividade_bolsa: enumOpcional(AGRESSIVIDADE_VALUES, "Agressividade de bolsa"),
  // Sem "não informado": NULL aqui muda o Match (vira exigência 'nenhum').
  ingles_minimo: z.enum(INGLES_VALUES, { error: "Inglês mínimo: opção inválida." }),
  nota_minima_duolingo: z
    .number({ error: "Duolingo mínimo: informe um número." })
    .int("Duolingo mínimo: use um número inteiro.")
    .min(10, "Duolingo mínimo: entre 10 e 160.")
    .max(160, "Duolingo mínimo: entre 10 e 160.")
    .nullable(),
  gpa_minimo: numeroOpcional("GPA mínimo", 0, 4),
  // Sem NULL: serie_ordem(NULL) = 9th e eliminaria do Match quem está acima.
  serie_maxima: z.enum(SERIE_VALUES, { error: "Série máxima: opção inválida." }),
  rolling_admission: z.boolean({ error: "Rolling admission: valor inválido." }),
  testes_exigidos: z
    .array(z.string().trim().min(2, "Testes: valor inválido.").max(30, "Testes: valor inválido."))
    .max(10, "Testes: no máximo 10."),
  esportes_oferecidos: z
    .array(z.string().trim().min(2, "Esportes: valor inválido.").max(40, "Esportes: valor inválido."))
    .max(20, "Esportes: no máximo 20."),
  influencia_esporte: enumOpcional(INFLUENCIA_VALUES, "Influência do esporte"),
  aceita_excecao_elite: z.boolean({ error: "Exceção para elite: valor inválido." }),
  deadline_fall: dataOpcional("Deadline Fall"),
  deadline_spring: dataOpcional("Deadline Spring"),
  admissions_officer_nome: textoOpcional(120, "Nome do officer"),
  admissions_officer_email: z.preprocess(
    vazioParaNull,
    z
      .string({ error: "E-mail do officer: e-mail inválido." })
      .trim()
      .max(254, "E-mail do officer: longo demais.")
      .regex(EMAIL_RE, "E-mail do officer: e-mail inválido.")
      .nullable(),
  ),
  admissions_officer_telefone: textoOpcional(40, "Telefone do officer"),
  temperatura_relacionamento: z.enum(TEMPERATURA_VALUES, {
    error: "Temperatura do relacionamento: opção inválida.",
  }),
  regra_pratica: textoOpcional(1000, "Regra BAUSA"),
  notas_internas: textoOpcional(5000, "Notas internas"),
} satisfies Record<CampoEditavel, z.ZodType>;

/** UPDATE: só campos da lista branca, todos opcionais, chave estranha = erro. */
export const escolaAtualizarSchema = z.strictObject(ESCOLA_COLUNAS_SHAPE).partial();
export type EscolaPatch = z.output<typeof escolaAtualizarSchema>;

/** INSERT: mesmos campos; nome/tipo/cidade/estado obrigatórios. */
export const escolaCriarSchema = z
  .strictObject(ESCOLA_COLUNAS_SHAPE)
  .partial()
  .required({ nome: true, tipo: true, cidade: true, estado_us: true });
export type EscolaNova = z.output<typeof escolaCriarSchema>;

export const contatoEscolaSchema = z.strictObject({
  data: z
    .string({ error: "Data: informe a data do contato." })
    .refine(ehDataIso, "Data: data inválida."),
  tipo: z.enum(TIPO_CONTATO_VALUES, { error: "Tipo: selecione o tipo de contato." }),
  resumo: z
    .string({ error: "Resumo: descreva o contato." })
    .trim()
    .min(3, "Resumo: descreva o contato (mínimo de 3 caracteres).")
    .max(2000, "Resumo: máximo de 2000 caracteres."),
});
export type ContatoEscolaInput = z.output<typeof contatoEscolaSchema>;

export const resultadoEstrategiaSchema = z
  .strictObject({
    resultado: z.enum(RESULTADO_ESTRATEGIA_VALUES, { error: "Resultado: opção inválida." }),
    bolsa_obtida_pct: numeroOpcional("Bolsa obtida (%)", 0, 100),
    bolsa_obtida_valor: numeroOpcional("Bolsa obtida (USD)", 0, BUDGET_MAX_USD),
    data_aplicacao: dataOpcional("Data de aplicação"),
    data_resposta: dataOpcional("Data de resposta"),
  })
  .partial();
export type ResultadoEstrategiaInput = z.output<typeof resultadoEstrategiaSchema>;

/** Primeira issue → mensagem em PT para o toast (nunca o erro cru do Postgres). */
export function mensagemValidacao(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Dados inválidos.";
  if (issue.code === "unrecognized_keys") {
    return `Campo não permitido: ${issue.keys.join(", ")}.`;
  }
  const chave = issue.path[0];
  if (issue.code === "invalid_type" && issue.expected === "nonoptional" && typeof chave === "string") {
    const rotulo = (CAMPO_LABEL as Readonly<Record<string, string>>)[chave] ?? chave;
    return `${rotulo}: campo obrigatório.`;
  }
  return issue.message;
}
