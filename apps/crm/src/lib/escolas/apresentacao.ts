import type { BadgeTone } from "@/components/ui";
import {
  STATUS_LABEL,
  TIPO_LABEL,
  US_STATES,
  isEstadoUs,
  isValorDe,
  TIPO_VALUES,
  type StatusEscola,
} from "@/components/escolas/school-options";

/**
 * Apresentação do Banco de Escolas. Regra da casa (T22): dado ausente aparece
 * como "Não informado"/"—", NUNCA como 0 nem como valor padrão inventado.
 */

export const NAO_INFORMADO = "Não informado";

/** Placeholders gravados pelo import do Trello (20/08) em colunas NOT NULL. */
const CIDADE_PLACEHOLDERS: ReadonlySet<string> = new Set(["", "a confirmar"]);

export const STATUS_ESCOLA_TOM: Readonly<Record<StatusEscola, BadgeTone>> = {
  ativa: "green",
  em_analise: "orange",
  inativa: "red",
};

/**
 * Rótulo de um valor de domínio. Valor desconhecido aparece CRU (nunca
 * inventamos um rótulo); null/vazio vira `vazio`.
 */
export function rotulo<T extends string>(
  rotulos: Readonly<Record<T, string>>,
  valor: string | null | undefined,
  vazio: string = NAO_INFORMADO,
): string {
  if (valor == null || valor === "") return vazio;
  return (rotulos as Readonly<Record<string, string>>)[valor] ?? valor;
}

/** Rótulo do tipo de escola para telas que recebem o código cru (Match, Ganho). */
export function rotuloTipoEscola(tipo: string | null | undefined): string | null {
  if (!tipo) return null;
  return isValorDe(TIPO_VALUES, tipo) ? TIPO_LABEL[tipo] : tipo;
}

export function rotuloStatusEscola(status: StatusEscola): string {
  return STATUS_LABEL[status];
}

export function cidadePendente(cidade: string | null | undefined): boolean {
  return CIDADE_PLACEHOLDERS.has((cidade ?? "").trim().toLowerCase());
}

export function localizacaoPendente(cidade: string, estadoUs: string): boolean {
  return cidadePendente(cidade) || !isEstadoUs(estadoUs);
}

/** "Bradenton, FL" — ou null quando cidade/estado ainda são placeholders. */
export function formatarLocalizacao(cidade: string, estadoUs: string): string | null {
  if (localizacaoPendente(cidade, estadoUs)) return null;
  return `${cidade.trim()}, ${estadoUs}`;
}

export function rotuloEstadoUs(estadoUs: string): string {
  if (!isEstadoUs(estadoUs)) return "A confirmar";
  return US_STATES.find((s) => s.value === estadoUs)?.label ?? estadoUs;
}

/**
 * Sigla curta para telas que recebem o código cru (Match, Ganho): o "--" do
 * import do Trello não pode aparecer como se fosse um estado.
 */
export function siglaEstadoUs(estadoUs: string | null | undefined): string | null {
  if (!estadoUs || estadoUs.trim() === "") return null;
  return isEstadoUs(estadoUs) ? estadoUs : "UF a confirmar";
}

const USD = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/** "US$ 45.000" — ou "—" quando não informado (null ≠ 0). */
export function formatarUsd(valor: number | null): string {
  return valor == null ? "—" : USD.format(valor);
}

/** Budget mín./forte em uma linha; ambos nulos → "Não informado". */
export function formatarFaixaBudget(minimo: number | null, forte: number | null): string {
  if (minimo == null && forte == null) return NAO_INFORMADO;
  return `mín. ${formatarUsd(minimo)} · forte ${formatarUsd(forte)}`;
}

const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * Data de coluna DATE ('YYYY-MM-DD') em pt-BR SEM passar por UTC —
 * `new Date('2026-11-01')` é meia-noite UTC e vira 31/10 em Brasília.
 */
export function formatarDataCurta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = DATA_ISO.exec(iso);
  if (!m) return "—";
  const data = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return data.toLocaleDateString("pt-BR");
}

const FUSO_OPERACAO = "America/Sao_Paulo";
const DIA_ISO_BRASILIA = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_OPERACAO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * 'YYYY-MM-DD' de hoje em Brasília. Fuso EXPLÍCITO: o SSR roda em UTC e o
 * navegador em BRT — com fuso implícito o "há N dias" divergia entre 21h e
 * 24h (mismatch de hidratação) e o servidor não conseguia barrar data futura.
 */
export function hojeIsoBrasilia(agoraMs: number): string {
  return DIA_ISO_BRASILIA.format(agoraMs);
}

/** Dias inteiros entre uma data DATE e "hoje em Brasília" (agoraMs vem do servidor). */
export function diasDesde(iso: string | null | undefined, agoraMs: number): number | null {
  if (!iso) return null;
  const m = DATA_ISO.exec(iso);
  const h = DATA_ISO.exec(hojeIsoBrasilia(agoraMs));
  if (!m || !h) return null;
  const inicio = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const hoje = Date.UTC(Number(h[1]), Number(h[2]) - 1, Number(h[3]));
  const dias = Math.round((hoje - inicio) / 86_400_000);
  return Number.isFinite(dias) ? Math.max(0, dias) : null;
}

/**
 * href externo seguro: só http(s). Defesa em profundidade contra
 * `javascript:` em link gravado antes da validação existir.
 */
export function hrefExterno(url: string | null | undefined): string | null {
  if (!url) return null;
  const limpo = url.trim();
  if (!/^https?:\/\//i.test(limpo)) return null;
  try {
    return new URL(limpo).toString();
  } catch {
    return null;
  }
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function hrefEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const limpo = email.trim();
  return EMAIL_RE.test(limpo) ? `mailto:${limpo}` : null;
}

/** "%" com 1 casa só quando houver fração (40% / 37,5%). */
export function formatarPercentual(valor: number | null): string {
  if (valor == null) return "—";
  const arredondado = Math.round(valor * 10) / 10;
  return `${arredondado.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}
