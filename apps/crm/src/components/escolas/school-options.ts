/**
 * Opções de domínio do Banco de Escolas — FONTE ÚNICA de valores e rótulos.
 *
 * IMPORTANTE: os valores (`*_VALUES`) refletem EXATAMENTE os enums/CHECKs do
 * banco (migrations 20260401000000_crm_enum_types.sql,
 * 20260401001500_crm_escolas.sql e 20261008170000_escolas_perfil_historico.sql).
 * Rótulo visual nunca vira valor: gravar um rótulo quebra o UPDATE com 22P02
 * (enum) ou 23514 (CHECK). O guard tests/escolas-vocabulario-invariants.test.js
 * confere estes valores contra as migrations.
 *
 * As escolas cadastradas são HIGH SCHOOLS: não existe vocabulário de
 * universidade (divisões da liga universitária) neste módulo.
 */

export interface SelectOption<T extends string = string> {
  readonly value: T;
  readonly label: string;
}

function opcoes<T extends string>(
  valores: readonly T[],
  rotulos: Readonly<Record<T, string>>,
): readonly SelectOption<T>[] {
  return valores.map((value) => ({ value, label: rotulos[value] }));
}

// tipo TEXT NOT NULL CHECK (tipo IN ('boarding','day','mista'))
export const TIPO_VALUES = ["boarding", "day", "mista"] as const;
export type TipoEscola = (typeof TIPO_VALUES)[number];
export const TIPO_LABEL: Readonly<Record<TipoEscola, string>> = {
  boarding: "Boarding (internato)",
  day: "Day school",
  mista: "Boarding + Day",
};
export const TIPO_OPTIONS = opcoes(TIPO_VALUES, TIPO_LABEL);

// perfil TEXT NULL CHECK (perfil IN (...)) — preenchido por pessoa, nunca por IA
export const PERFIL_VALUES = [
  "academia_esportiva",
  "prep_tradicional",
  "religiosa",
  "boarding_internacional",
  "outro",
] as const;
export type PerfilEscola = (typeof PERFIL_VALUES)[number];
export const PERFIL_LABEL: Readonly<Record<PerfilEscola, string>> = {
  academia_esportiva: "Academia esportiva",
  prep_tradicional: "Prep school tradicional",
  religiosa: "Religiosa",
  boarding_internacional: "Boarding internacional",
  outro: "Outro",
};
export const PERFIL_OPTIONS = opcoes(PERFIL_VALUES, PERFIL_LABEL);

// status TEXT NOT NULL CHECK (status IN ('ativa','inativa','em_analise'))
export const STATUS_VALUES = ["ativa", "em_analise", "inativa"] as const;
export type StatusEscola = (typeof STATUS_VALUES)[number];
export const STATUS_LABEL: Readonly<Record<StatusEscola, string>> = {
  ativa: "Ativa",
  em_analise: "Em análise",
  inativa: "Inativa",
};
export const STATUS_OPTIONS = opcoes(STATUS_VALUES, STATUS_LABEL);

// ingles_minimo nivel_ingles ENUM ('nenhum','basico','intermediario','avancado','fluente')
export const INGLES_VALUES = ["nenhum", "basico", "intermediario", "avancado", "fluente"] as const;
export type NivelIngles = (typeof INGLES_VALUES)[number];
export const INGLES_LABEL: Readonly<Record<NivelIngles, string>> = {
  nenhum: "Nenhum",
  basico: "Básico",
  intermediario: "Intermediário",
  avancado: "Avançado",
  fluente: "Fluente",
};
export const INGLES_OPTIONS = opcoes(INGLES_VALUES, INGLES_LABEL);

// agressividade_bolsa ENUM ('alta','media','baixa','rara') — NULL = não informado
export const AGRESSIVIDADE_VALUES = ["alta", "media", "baixa", "rara"] as const;
export type AgressividadeBolsa = (typeof AGRESSIVIDADE_VALUES)[number];
export const AGRESSIVIDADE_LABEL: Readonly<Record<AgressividadeBolsa, string>> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
  rara: "Rara",
};
export const AGRESSIVIDADE_OPTIONS = opcoes(AGRESSIVIDADE_VALUES, AGRESSIVIDADE_LABEL);

// influencia_esporte ENUM ('decisiva','forte','moderada','baixa')
export const INFLUENCIA_VALUES = ["decisiva", "forte", "moderada", "baixa"] as const;
export type InfluenciaEsporte = (typeof INFLUENCIA_VALUES)[number];
export const INFLUENCIA_LABEL: Readonly<Record<InfluenciaEsporte, string>> = {
  decisiva: "Decisiva",
  forte: "Forte",
  moderada: "Moderada",
  baixa: "Baixa",
};
export const INFLUENCIA_OPTIONS = opcoes(INFLUENCIA_VALUES, INFLUENCIA_LABEL);

// temperatura_relacionamento TEXT CHECK (IN ('forte','bom','neutro','frio'))
export const TEMPERATURA_VALUES = ["forte", "bom", "neutro", "frio"] as const;
export type TemperaturaRelacionamento = (typeof TEMPERATURA_VALUES)[number];
export const TEMPERATURA_LABEL: Readonly<Record<TemperaturaRelacionamento, string>> = {
  forte: "Forte",
  bom: "Bom",
  neutro: "Neutro",
  frio: "Frio",
};
export const TEMPERATURA_OPTIONS = opcoes(TEMPERATURA_VALUES, TEMPERATURA_LABEL);

// testes_exigidos TEXT[] — vocabulário livre no banco, padronizado na UI
export const TESTE_VALUES = ["Duolingo", "TOEFL", "SAT", "PSAT", "SSAT"] as const;
export type TesteExigido = (typeof TESTE_VALUES)[number];

// serie_maxima TEXT DEFAULT '12th' — os valores precisam casar com
// public.serie_ordem(): '9th'..'12th' e 'pg_year' (post-graduate). Fora disso
// a função cai no ELSE (= 9th). 'pg_year' libera atletas PG no Match.
export const SERIE_VALUES = ["8th", "9th", "10th", "11th", "12th", "pg_year"] as const;
export type SerieMaxima = (typeof SERIE_VALUES)[number];
export const SERIE_LABEL: Readonly<Record<SerieMaxima, string>> = {
  "8th": "8th Grade",
  "9th": "9th Grade",
  "10th": "10th Grade",
  "11th": "11th Grade",
  "12th": "12th Grade",
  pg_year: "PG (post-graduate)",
};
export const SERIE_OPTIONS = opcoes(SERIE_VALUES, SERIE_LABEL);

// historico_contatos_escola.tipo TEXT NOT NULL — vocabulário da UI
export const TIPO_CONTATO_VALUES = [
  "email",
  "ligacao",
  "videochamada",
  "reuniao",
  "mensagem",
  "outro",
] as const;
export type TipoContato = (typeof TIPO_CONTATO_VALUES)[number];
export const TIPO_CONTATO_LABEL: Readonly<Record<TipoContato, string>> = {
  email: "E-mail",
  ligacao: "Ligação",
  videochamada: "Videochamada",
  reuniao: "Reunião presencial",
  mensagem: "Mensagem",
  outro: "Outro",
};
export const TIPO_CONTATO_OPTIONS = opcoes(TIPO_CONTATO_VALUES, TIPO_CONTATO_LABEL);

// estrategia_escolas.resultado CHECK (IN ('aceito','recusado','waitlist','pendente','nao_aplicado'))
export const RESULTADO_ESTRATEGIA_VALUES = [
  "nao_aplicado",
  "pendente",
  "aceito",
  "recusado",
  "waitlist",
] as const;
export type ResultadoEstrategia = (typeof RESULTADO_ESTRATEGIA_VALUES)[number];
export const RESULTADO_ESTRATEGIA_LABEL: Readonly<Record<ResultadoEstrategia, string>> = {
  nao_aplicado: "Não aplicado",
  pendente: "Aplicado — aguardando resposta",
  aceito: "Aceito",
  recusado: "Recusado",
  waitlist: "Lista de espera",
};
export const RESULTADO_ESTRATEGIA_OPTIONS = opcoes(
  RESULTADO_ESTRATEGIA_VALUES,
  RESULTADO_ESTRATEGIA_LABEL,
);

// estado_us TEXT NOT NULL — sigla oficial (50 estados + DC)
export const US_STATES = [
  { value: "AL", label: "AL — Alabama" },
  { value: "AK", label: "AK — Alaska" },
  { value: "AZ", label: "AZ — Arizona" },
  { value: "AR", label: "AR — Arkansas" },
  { value: "CA", label: "CA — California" },
  { value: "CO", label: "CO — Colorado" },
  { value: "CT", label: "CT — Connecticut" },
  { value: "DE", label: "DE — Delaware" },
  { value: "DC", label: "DC — District of Columbia" },
  { value: "FL", label: "FL — Florida" },
  { value: "GA", label: "GA — Georgia" },
  { value: "HI", label: "HI — Hawaii" },
  { value: "ID", label: "ID — Idaho" },
  { value: "IL", label: "IL — Illinois" },
  { value: "IN", label: "IN — Indiana" },
  { value: "IA", label: "IA — Iowa" },
  { value: "KS", label: "KS — Kansas" },
  { value: "KY", label: "KY — Kentucky" },
  { value: "LA", label: "LA — Louisiana" },
  { value: "ME", label: "ME — Maine" },
  { value: "MD", label: "MD — Maryland" },
  { value: "MA", label: "MA — Massachusetts" },
  { value: "MI", label: "MI — Michigan" },
  { value: "MN", label: "MN — Minnesota" },
  { value: "MS", label: "MS — Mississippi" },
  { value: "MO", label: "MO — Missouri" },
  { value: "MT", label: "MT — Montana" },
  { value: "NE", label: "NE — Nebraska" },
  { value: "NV", label: "NV — Nevada" },
  { value: "NH", label: "NH — New Hampshire" },
  { value: "NJ", label: "NJ — New Jersey" },
  { value: "NM", label: "NM — New Mexico" },
  { value: "NY", label: "NY — New York" },
  { value: "NC", label: "NC — North Carolina" },
  { value: "ND", label: "ND — North Dakota" },
  { value: "OH", label: "OH — Ohio" },
  { value: "OK", label: "OK — Oklahoma" },
  { value: "OR", label: "OR — Oregon" },
  { value: "PA", label: "PA — Pennsylvania" },
  { value: "RI", label: "RI — Rhode Island" },
  { value: "SC", label: "SC — South Carolina" },
  { value: "SD", label: "SD — South Dakota" },
  { value: "TN", label: "TN — Tennessee" },
  { value: "TX", label: "TX — Texas" },
  { value: "UT", label: "UT — Utah" },
  { value: "VT", label: "VT — Vermont" },
  { value: "VA", label: "VA — Virginia" },
  { value: "WA", label: "WA — Washington" },
  { value: "WV", label: "WV — West Virginia" },
  { value: "WI", label: "WI — Wisconsin" },
  { value: "WY", label: "WY — Wyoming" },
] as const satisfies readonly SelectOption[];

export type EstadoUs = (typeof US_STATES)[number]["value"];
const US_STATE_SET: ReadonlySet<string> = new Set(US_STATES.map((s) => s.value));

export function isEstadoUs(valor: unknown): valor is EstadoUs {
  return typeof valor === "string" && US_STATE_SET.has(valor);
}

/** Type guard genérico para os `*_VALUES` acima (dado vindo do banco é `unknown`). */
export function isValorDe<T extends string>(
  valores: readonly T[],
  valor: unknown,
): valor is T {
  return typeof valor === "string" && (valores as readonly string[]).includes(valor);
}
