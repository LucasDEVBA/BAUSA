import { z } from "zod";

// ════════════════════════════════════════════════════════════════════════
// Filtros da tela /leads (T8 — paginação no servidor).
// Estado vive na URL (?q=&classe=&pagina=&porPagina=&ordem=&dir=&atleta=):
// link compartilhável, voltar do navegador funciona e o Server Component
// é a única fonte dos dados. Módulo comum (client + server), sem imports
// de servidor.
// ════════════════════════════════════════════════════════════════════════

export const CLASSES_FILTRO_LEADS = ["ALL", "QUENTE", "MORNO", "FRIO", "INVALIDO", "INCOMPLETO"] as const;
export type ClasseFiltroLeads = (typeof CLASSES_FILTRO_LEADS)[number];

/** Ids das colunas ordenáveis da tabela (= ColumnDef.id/accessorKey). */
export const ORDENS_LEADS = [
  "submitted_at",
  "athlete_name",
  "qualification_classification",
  "prioridade",
  "investment_range",
  "position",
  "location",
  "comunicacao",
  "pipeline",
  "origem",
] as const;
export type OrdemLeads = (typeof ORDENS_LEADS)[number];

export const POR_PAGINA_LEADS = [10, 25, 50, 100] as const;
export const POR_PAGINA_LEADS_PADRAO = 10;
/** Busca de /leads aplica a partir de 2 caracteres úteis (nomes curtos: "Li"). */
export const BUSCA_LEADS_MIN = 2;
export const BUSCA_LEADS_MAX = 80;

export interface FiltrosLeads {
  q: string;
  classe: ClasseFiltroLeads;
  pagina: number;
  porPagina: number;
  ordem: OrdemLeads;
  dir: "asc" | "desc";
  /** Deep-link das Execuções/Agenda: abre o dossiê desse atleta. */
  atleta: string | null;
}

export const FILTROS_LEADS_PADRAO: FiltrosLeads = {
  q: "",
  classe: "ALL",
  pagina: 1,
  porPagina: POR_PAGINA_LEADS_PADRAO,
  ordem: "submitted_at",
  dir: "desc",
  atleta: null,
};

const primeiro = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);

// .catch() = parâmetro inválido cai no padrão (URL editada à mão nunca quebra a tela)
const filtrosSchema = z.object({
  q: z.preprocess(primeiro, z.string().trim().max(BUSCA_LEADS_MAX)).catch(""),
  classe: z.preprocess(primeiro, z.enum(CLASSES_FILTRO_LEADS)).catch("ALL"),
  pagina: z.preprocess(primeiro, z.coerce.number().int().min(1).max(100_000)).catch(1),
  porPagina: z
    .preprocess(primeiro, z.coerce.number().int())
    .refine((n) => (POR_PAGINA_LEADS as readonly number[]).includes(n))
    .catch(POR_PAGINA_LEADS_PADRAO),
  ordem: z.preprocess(primeiro, z.enum(ORDENS_LEADS)).catch("submitted_at"),
  dir: z.preprocess(primeiro, z.enum(["asc", "desc"])).catch("desc"),
  atleta: z.preprocess(primeiro, z.uuid()).nullable().catch(null),
});

export function parseFiltrosLeads(params: Record<string, string | string[] | undefined>): FiltrosLeads {
  const r = filtrosSchema.safeParse(params);
  return r.success ? { ...r.data, atleta: r.data.atleta ?? null } : FILTROS_LEADS_PADRAO;
}

/** Query string de /leads a partir dos filtros (só o que difere do padrão). */
export function urlFiltrosLeads(f: FiltrosLeads): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.classe !== "ALL") p.set("classe", f.classe);
  if (f.pagina !== 1) p.set("pagina", String(f.pagina));
  if (f.porPagina !== POR_PAGINA_LEADS_PADRAO) p.set("porPagina", String(f.porPagina));
  if (f.ordem !== "submitted_at" || f.dir !== "desc") {
    p.set("ordem", f.ordem);
    p.set("dir", f.dir);
  }
  const qs = p.toString();
  return qs ? `/leads?${qs}` : "/leads";
}
