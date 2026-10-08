// ════════════════════════════════════════════════════════════════════════
// Leitura completa acima do max_rows do PostgREST (T8 — "não tá todos aqui").
//
// O PostgREST deste projeto devolve no MÁXIMO 1000 linhas por requisição
// (max_rows=1000, conferido em 08/10). Uma consulta sem paginação corta EM
// SILÊNCIO — sem erro, sem aviso. Toda leitura que precisa de "todas as
// linhas" (export, agregados, ordenação em memória) passa por aqui.
// Módulo comum (sem imports de servidor): recebe a fábrica da consulta.
// ════════════════════════════════════════════════════════════════════════

/** max_rows do PostgREST do projeto (Supabase → API settings). */
export const POSTGREST_MAX_ROWS = 1000;
/** Teto defensivo: nada de ler 1 milhão de linhas por engano. */
export const TETO_PADRAO_LINHAS = 20_000;

export interface ErroPostgrest {
  message: string;
  code?: string;
}

interface RespostaPagina<T> {
  data: T[] | null;
  error: ErroPostgrest | null;
}

export interface ResultadoTodasPaginas<T> {
  /** Com `error`, SEMPRE vazio: parcial calado é o "não tá todos aqui" de novo. */
  data: T[];
  error: ErroPostgrest | null;
  /** true = parou no teto: há mais linhas no banco do que as devolvidas. */
  truncado: boolean;
}

/**
 * Lê todas as linhas paginando em blocos de max_rows.
 * A fábrica DEVE aplicar ORDER BY determinístico (ex.: submitted_at + id):
 * sem ordem estável o PostgREST pode repetir/pular linhas entre blocos.
 * NÃO usar count:'exact' na fábrica (offset além do fim vira 416/PGRST103).
 */
export async function buscarTodasAsPaginas<T>(
  montarPagina: (de: number, ate: number) => PromiseLike<RespostaPagina<T>>,
  opcoes: { tamanho?: number; teto?: number } = {},
): Promise<ResultadoTodasPaginas<T>> {
  const tamanho = Math.min(opcoes.tamanho ?? POSTGREST_MAX_ROWS, POSTGREST_MAX_ROWS);
  const teto = opcoes.teto ?? TETO_PADRAO_LINHAS;
  const linhas: T[] = [];
  for (let de = 0; de < teto; de += tamanho) {
    const ate = Math.min(de + tamanho, teto) - 1;
    const { data, error } = await montarPagina(de, ate);
    if (error) {
      // Falha num bloco do meio NÃO devolve os blocos já lidos: quem ignora o
      // erro mostraria um subconjunto com cara de base inteira (CAC inflado,
      // gráfico sem os mais antigos). Sem a mensagem no log: um .or() de busca
      // malformado ecoa o termo (e-mail/telefone).
      console.error({ level: "error", action: "buscar_todas_as_paginas", de, code: error.code ?? null });
      return { data: [], error, truncado: false };
    }
    const pagina = data ?? [];
    linhas.push(...pagina);
    if (pagina.length < ate - de + 1) return { data: linhas, error: null, truncado: false };
  }
  return { data: linhas, error: null, truncado: true };
}
