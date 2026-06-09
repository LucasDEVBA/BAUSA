/**
 * Opções de domínio do Banco de Escolas.
 *
 * IMPORTANTE: os `value` aqui refletem EXATAMENTE os enums/CHECKs do banco
 * (migration 20260401000000_crm_enum_types.sql e 20260401001500_crm_escolas.sql).
 * Não usar rótulos visuais (ex.: "Division I", "Avancado" capitalizado) como value —
 * isso quebraria o INSERT com erro de enum.
 */

export interface SelectOption<T extends string = string> {
  readonly value: T;
  readonly label: string;
}

// tipo TEXT CHECK (tipo IN ('boarding','day','mista'))
export const TIPO_OPTIONS = [
  { value: "boarding", label: "Boarding (internato)" },
  { value: "day", label: "Day School" },
  { value: "mista", label: "Mista" },
] as const satisfies readonly SelectOption[];

// status TEXT CHECK (status IN ('ativa','inativa','em_analise'))
export const STATUS_OPTIONS = [
  { value: "ativa", label: "Ativa" },
  { value: "inativa", label: "Inativa" },
  { value: "em_analise", label: "Em análise" },
] as const satisfies readonly SelectOption[];

// nivel_ingles ENUM ('nenhum','basico','intermediario','avancado','fluente')
export const INGLES_OPTIONS = [
  { value: "nenhum", label: "Nenhum" },
  { value: "basico", label: "Básico" },
  { value: "intermediario", label: "Intermediário" },
  { value: "avancado", label: "Avançado" },
  { value: "fluente", label: "Fluente" },
] as const satisfies readonly SelectOption[];

// agressividade_bolsa ENUM ('alta','media','baixa','rara')
export const AGRESSIVIDADE_OPTIONS = [
  { value: "alta", label: "Alta" },
  { value: "media", label: "Média" },
  { value: "baixa", label: "Baixa" },
  { value: "rara", label: "Rara" },
] as const satisfies readonly SelectOption[];

// influencia_esporte ENUM ('decisiva','forte','moderada','baixa')
export const INFLUENCIA_OPTIONS = [
  { value: "decisiva", label: "Decisiva" },
  { value: "forte", label: "Forte" },
  { value: "moderada", label: "Moderada" },
  { value: "baixa", label: "Baixa" },
] as const satisfies readonly SelectOption[];

// temperatura_relacionamento TEXT CHECK (IN ('forte','bom','neutro','frio'))
export const TEMPERATURA_OPTIONS = [
  { value: "forte", label: "Forte" },
  { value: "bom", label: "Bom" },
  { value: "neutro", label: "Neutro" },
  { value: "frio", label: "Frio" },
] as const satisfies readonly SelectOption[];

// testes_exigidos TEXT[] — vocabulário livre, padronizado na UI
export const TESTE_OPTIONS = ["Duolingo", "TOEFL", "SAT", "PSAT", "SSAT"] as const;

// serie_maxima TEXT DEFAULT '12th'
export const SERIE_OPTIONS = [
  { value: "8th", label: "8th Grade" },
  { value: "9th", label: "9th Grade" },
  { value: "10th", label: "10th Grade" },
  { value: "11th", label: "11th Grade" },
  { value: "12th", label: "12th Grade" },
] as const satisfies readonly SelectOption[];

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

export type TipoEscola = (typeof TIPO_OPTIONS)[number]["value"];
export type StatusEscola = (typeof STATUS_OPTIONS)[number]["value"];
export type NivelIngles = (typeof INGLES_OPTIONS)[number]["value"];
export type AgressividadeBolsa = (typeof AGRESSIVIDADE_OPTIONS)[number]["value"];
export type InfluenciaEsporte = (typeof INFLUENCIA_OPTIONS)[number]["value"];
export type TemperaturaRelacionamento = (typeof TEMPERATURA_OPTIONS)[number]["value"];
