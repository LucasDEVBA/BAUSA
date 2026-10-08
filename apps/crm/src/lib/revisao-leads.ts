// ════════════════════════════════════════════════════════════════════════
// Revisão de leads + localização de cadastros (T7/T13 — vídeos do CEO 28/09)
//
// Módulo COMUM (client + server): só constantes, tipos e funções puras.
// NUNCA importar supabase/next aqui — é usado por componentes "use client"
// e por arquivos "use server" (que não podem exportar constantes).
//
// As funções marcadas "guard:corpo-js" têm o corpo escrito SEM sintaxe
// TypeScript: tests/visibilidade-leads-invariants.test.js extrai e executa
// esse corpo com new Function (padrão de tests/telefone-matching.test.js),
// testando o COMPORTAMENTO real, não uma cópia. Tipos só na assinatura.
// ════════════════════════════════════════════════════════════════════════

/** Janela da coluna Frios: só FRIOs recentes entram na revisão. */
export const FRIOS_REVISAO_DIAS = 90;
/** Janela da coluna Incompletos (mesma regra dos Frios). */
export const INCOMPLETOS_REVISAO_DIAS = 90;
/** Página das colunas Frios/Incompletos ("Mostrar mais" carrega a próxima). */
export const REVISAO_PAGINA = 100;
/** Página da coluna Aguardando aprovação (fila ativa: quase sempre cabe inteira). */
export const PENDENTES_PAGINA = 200;
/** Acima disto a lista da coluna é virtualizada (@tanstack/react-virtual). */
export const VIRTUALIZAR_ACIMA = 100;
/** Busca no servidor (faixa "Fora do pipeline"): mínimo de caracteres úteis. */
export const BUSCA_PIPELINE_MIN = 3;
/** Teto de resultados da busca no servidor (a faixa mostra "N de total"). */
export const BUSCA_PIPELINE_LIMITE = 20;
/** Debounce da busca no servidor. */
export const BUSCA_DEBOUNCE_MS = 300;

/** Página de uma coluna de revisão devolvida pelas server actions. */
export type ResultadoPaginaRevisao<T> =
  | { success: true; itens: T[]; total: number }
  | { success: false; error: string };

/** Estado inicial de uma coluna de revisão (Server Component → board). */
export interface PaginaRevisao<T> {
  itens: T[];
  total: number;
  /** Falha ao carregar: a coluna avisa em vez de sumir calada. */
  erro: string | null;
}

export function paginaRevisaoDe<T>(r: ResultadoPaginaRevisao<T>): PaginaRevisao<T> {
  return r.success ? { itens: r.itens, total: r.total, erro: null } : { itens: [], total: 0, erro: r.error };
}

/** Página do dossiê dos modais de revisão (detalhe pesado → página menor). */
export const DETALHE_REVISAO_PAGINA = 50;

/** Teto de UMA requisição das colunas (= max_rows do PostgREST). */
export const LIMITE_MAXIMO_PAGINA = 1000;
/** Offset máximo aceito das server actions (defesa contra entrada absurda). */
export const OFFSET_MAXIMO = 100_000;

/**
 * offset/limite vindos do CLIENT ("use server" = endpoint público): inteiros,
 * dentro dos limites; qualquer outra coisa (NaN, string, null) cai no padrão.
 */
export function paginacaoSegura(
  opts: { offset?: unknown; limite?: unknown } | null | undefined,
  limitePadrao: number,
): { offset: number; limite: number } {
  const inteiro = (v: unknown, min: number, max: number, padrao: number): number =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.trunc(v))) : padrao;
  return {
    offset: inteiro(opts?.offset, 0, OFFSET_MAXIMO, 0),
    limite: inteiro(opts?.limite, 1, LIMITE_MAXIMO_PAGINA, limitePadrao),
  };
}

export type TipoLocalCadastro =
  | "board_deal"
  | "coluna_aprovacao"
  | "coluna_frios"
  | "coluna_incompletos"
  | "fora_perdido_timing"
  | "fora_kanban_cancelamento"
  | "fora_deal_suspenso"
  | "fora_pendente_classe"
  | "fora_reprovado"
  | "fora_invalido"
  | "fora_janela"
  | "fora_aprovado_sem_deal"
  | "fora_sem_classificacao"
  | "fora_sem_decisao";

/** Fatos de um cadastro (linha de public.vw_cadastros_situacao). */
export interface FatosCadastro {
  qualification_classification: string | null;
  aprovacao_status: string | null;
  submitted_at: string;
  deal_id: string | null;
  deal_etapa: string | null;
  deal_motivo_perda: string | null;
}

export interface LocalCadastro {
  tipo: TipoLocalCadastro;
  /** true = o board TEM lugar para ele (pode só não estar carregado/filtrado). */
  noBoard: boolean;
}

/**
 * ONDE o cadastro aparece no /pipeline — espelho EXATO das regras do board:
 *  - deals: page.tsx suspende deal de lead 'pendente' (exceto concluido/
 *    perdido) e esconde perdido com motivo 'timing'; o Kanban não tem coluna
 *    para cancelamento_solicitado (só a visão Tabela mostra) e projeto_futuro
 *    vive na seção "Leads Futuros" abaixo do board;
 *  - Aguardando aprovação: pendente + QUENTE/MORNO (listarLeadsPendentesCards);
 *  - Frios/Incompletos: classe + aprovacao_status NULL + janela + sem deal.
 * Mudou uma regra do board? Mude aqui e no guard no MESMO PR.
 */
export function localizarCadastroCore(
  f: FatosCadastro,
  agoraMs: number,
  janelaFriosDias: number,
  janelaIncompletosDias: number,
): LocalCadastro {
  // guard:corpo-js-inicio
  const classe = f.qualification_classification;
  const qualificada = classe === "QUENTE" || classe === "MORNO";
  const idadeMs = agoraMs - Date.parse(f.submitted_at);
  // A coluna Aguardando aprovação lista TODO pendente QUENTE/MORNO, com ou
  // sem deal (listarLeadsPendentesCards não olha deal) — vem antes de tudo.
  if (f.aprovacao_status === "pendente" && qualificada) {
    return { tipo: "coluna_aprovacao", noBoard: true };
  }
  if (f.deal_id) {
    if (f.deal_etapa === "perdido" && f.deal_motivo_perda === "timing") {
      return { tipo: "fora_perdido_timing", noBoard: false };
    }
    if (f.deal_etapa === "concluido" || f.deal_etapa === "perdido") {
      return { tipo: "board_deal", noBoard: true };
    }
    if (f.aprovacao_status === "pendente") return { tipo: "fora_deal_suspenso", noBoard: false };
    if (f.deal_etapa === "cancelamento_solicitado") {
      return { tipo: "fora_kanban_cancelamento", noBoard: false };
    }
    return { tipo: "board_deal", noBoard: true };
  }
  if (f.aprovacao_status === "pendente") return { tipo: "fora_pendente_classe", noBoard: false };
  if (f.aprovacao_status === "reprovado") return { tipo: "fora_reprovado", noBoard: false };
  if (classe === "INVALIDO") return { tipo: "fora_invalido", noBoard: false };
  if (f.aprovacao_status === null && classe === "FRIO") {
    return idadeMs <= janelaFriosDias * 86400000
      ? { tipo: "coluna_frios", noBoard: true }
      : { tipo: "fora_janela", noBoard: false };
  }
  if (f.aprovacao_status === null && classe === "INCOMPLETO") {
    return idadeMs <= janelaIncompletosDias * 86400000
      ? { tipo: "coluna_incompletos", noBoard: true }
      : { tipo: "fora_janela", noBoard: false };
  }
  if (f.aprovacao_status === "aprovado") return { tipo: "fora_aprovado_sem_deal", noBoard: false };
  if (classe === null) return { tipo: "fora_sem_classificacao", noBoard: false };
  return { tipo: "fora_sem_decisao", noBoard: false };
  // guard:corpo-js-fim
}

/**
 * Minúsculas + sem acento + espaços colapsados. Par do SQL
 * public.f_normalizar_busca (lower(unaccent(...))) — os dois lados da busca
 * precisam normalizar IGUAL, senão "João" não acha "Joao".
 */
export function normalizarTermoBusca(texto: string): string {
  // guard:corpo-js-inicio
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  // guard:corpo-js-fim
}

/**
 * Filtro PostgREST (.or) da busca em vw_cadastros_situacao.
 * - Tokens em AND ("clara bezerra" acha "Clara Rodrigues Bezerra").
 * - Caractere fora de [a-z0-9@._-] vira SEPARADOR, não some: "D'Ávila" →
 *   "d" + "avila" (acha "d'avila"); "joao+teste@x.com" → "joao" + "teste@x.com".
 *   Vírgula, parênteses, aspas, asterisco e % NUNCA chegam à sintaxe do .or().
 * - Termo com cara de telefone (só dígitos/espaço/()+-.) busca SÓ nos
 *   telefones; num termo misto, só o token PURAMENTE numérico (≥4) também
 *   casa telefone — dígitos de um e-mail ("ana2008@…") não viram busca de
 *   telefone (senão 20 telefones com "2008" empurrariam o e-mail certo para
 *   fora do teto de resultados).
 * - Valores entre aspas duplas: "." e ":" são reservados no .or() do PostgREST.
 * Devolve null quando não há o mínimo de caracteres úteis.
 */
export function montarFiltroBusca(termo: string, minimo: number): string | null {
  // guard:corpo-js-inicio
  const norm = termo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const tokens = norm
    .replace(/[^a-z0-9@._-]+/g, " ")
    .split(" ")
    .filter((t) => t.length > 0)
    .slice(0, 5);
  const digitos = termo.replace(/\D/g, "");
  if (tokens.join("").length < minimo && digitos.length < 4) return null;
  // Termo com cara de telefone ("(71) 9914-6156") busca SÓ nos telefones.
  if (/^[\d\s()+.-]+$/.test(termo.trim())) {
    return digitos.length >= 4 ? 'busca_telefone.like."*' + digitos + '*"' : null;
  }
  const condicoes = tokens.map((t) =>
    /^\d{4,}$/.test(t)
      ? 'or(busca_texto.like."*' + t + '*",busca_telefone.like."*' + t + '*")'
      : 'busca_texto.like."*' + t + '*"',
  );
  if (condicoes.length === 0) return null;
  return condicoes.length === 1 ? condicoes[0] : "and(" + condicoes.join(",") + ")";
  // guard:corpo-js-fim
}

/**
 * Ordem de exibição das colunas de revisão: reunião detectada no topo
 * (T13), depois data — Frios/Incompletos mais recente primeiro; Aguardando
 * aprovação mais antigo primeiro (fila). Espelha o ORDER BY do servidor.
 */
export function compararRevisao(
  a: { meeting_scheduled: boolean | null; submitted_at: string; id: string },
  b: { meeting_scheduled: boolean | null; submitted_at: string; id: string },
  maisRecentePrimeiro: boolean,
): number {
  // guard:corpo-js-inicio
  const ra = a.meeting_scheduled === true ? 0 : 1;
  const rb = b.meeting_scheduled === true ? 0 : 1;
  if (ra !== rb) return ra - rb;
  const sentido = maisRecentePrimeiro ? 1 : -1;
  if (a.submitted_at !== b.submitted_at) return (a.submitted_at < b.submitted_at ? 1 : -1) * sentido;
  return (a.id < b.id ? 1 : a.id > b.id ? -1 : 0) * sentido;
  // guard:corpo-js-fim
}
