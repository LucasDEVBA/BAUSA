import type { createServerSupabaseClient } from "@/lib/supabase-server";

// ════════════════════════════════════════════════════════════════════════
// E-mails (/emails) — camada de dados. SOMENTE leitura de emails_mensagens
// (a escrita é do compositor via admin client e das CFs de sync/webhook).
// Client Supabase INJETADO (padrão fluxos-queries): a page cria o client de
// sessão e passa — RLS (SELECT nível CEO) continua valendo.
//
// Gotchas herdados do projeto:
// - PostgREST devolve `error` sem lançar — SEMPRE checar `res.error`.
// - form_submissions NÃO tem created_at (é submitted_at) e tem soft delete.
// - Métricas de entrega/abertura/clique só existem para envios via Resend
//   (webhook email-events casa por resend_email_id) — o denominador das
//   taxas é "enviados via resend", nunca o total.
// ════════════════════════════════════════════════════════════════════════

type SupabaseServer = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type EmailDirecao = "enviado" | "recebido";

/** Caixa histórica/padrão — fallback quando a config `emails_contas` falha. */
export const CAIXA_EMAIL_PADRAO = "contato@bolsaatletausa.com";

export interface EmailsContasConfig {
  /** Lista MANUAL (config emails_contas) — whitelist do "De:" do compositor. */
  contas: string[];
  /** TODAS as caixas visíveis: manuais ∪ sincronizadas (descoberta automática). */
  caixas: string[];
  /** Conta usada como "De:" por padrão no compositor. */
  padraoEnvio: string;
}

export interface EmailRoteamentoRegra {
  /** Endereço que RECEBE (alias do Workspace), ex.: vendas@bolsaatletausa.com. */
  alias: string;
  /** Caixa sincronizada onde o e-mail aparece no Engine. */
  caixa: string;
}

/** Registro de anexo na linha do enviado ({nome, bytes}) — o arquivo vai pelo provider. */
export interface EmailAnexoRegistro {
  nome: string;
  bytes: number;
}

export interface EmailMensagem {
  id: string;
  direcao: EmailDirecao;
  origem: string;
  deEmail: string;
  paraEmail: string;
  assunto: string;
  corpoText: string | null;
  snippet: string | null;
  formSubmissionId: string | null;
  provider: string | null;
  gmailThreadId: string | null;
  entregueAt: string | null;
  abertoAt: string | null;
  clicadoAt: string | null;
  bounceAt: string | null;
  reclamadoAt: string | null;
  falhaMotivo: string | null;
  mensagemEm: string;
  /** Caixa do Engine a que a mensagem pertence (multi-conta; backfill = contato@). */
  caixaEmail: string | null;
  /** Anexos registrados no envio (recebidos do Gmail não têm registro). */
  anexos: EmailAnexoRegistro[] | null;
  /** Nome do atleta vinculado (enriquecido via form_submissions). */
  leadNome: string | null;
}

export interface EmailSerieDia {
  /** YYYY-MM-DD (UTC). */
  dia: string;
  enviados: number;
  abertos: number;
}

export interface EmailTopLead {
  formSubmissionId: string;
  leadNome: string;
  enviados: number;
  aberturas: number;
  cliques: number;
  respostas: number;
  interacoes: number;
}

export interface EmailMetricas {
  dias: number;
  enviados: number;
  /** Enviados via Resend — denominador das taxas (métricas só chegam p/ resend). */
  enviadosResend: number;
  entregues: number;
  abertos: number;
  clicados: number;
  bounces: number;
  reclamados: number;
  /** Taxas 0–1 sobre enviadosResend; null quando não há denominador. */
  taxaEntrega: number | null;
  taxaAbertura: number | null;
  taxaClique: number | null;
  serie: EmailSerieDia[];
  topLeads: EmailTopLead[];
}

interface EmailRow {
  id: string;
  direcao: string;
  origem: string | null;
  de_email: string;
  para_email: string;
  assunto: string | null;
  corpo_text: string | null;
  snippet: string | null;
  form_submission_id: string | null;
  provider: string | null;
  gmail_thread_id: string | null;
  entregue_at: string | null;
  aberto_at: string | null;
  clicado_at: string | null;
  bounce_at: string | null;
  reclamado_at: string | null;
  falha_motivo: string | null;
  mensagem_em: string;
  caixa_email: string | null;
  anexos: unknown;
}

const EMAIL_COLS =
  "id, direcao, origem, de_email, para_email, assunto, corpo_text, snippet, " +
  "form_submission_id, provider, gmail_thread_id, entregue_at, aberto_at, " +
  "clicado_at, bounce_at, reclamado_at, falha_motivo, mensagem_em, caixa_email, anexos";

/** Parse defensivo do jsonb `anexos` — forma inesperada nunca derruba a lista. */
function parseAnexos(valor: unknown): EmailAnexoRegistro[] | null {
  if (!Array.isArray(valor)) return null;
  const anexos: EmailAnexoRegistro[] = [];
  for (const item of valor) {
    if (typeof item !== "object" || item === null) continue;
    const { nome, bytes } = item as { nome?: unknown; bytes?: unknown };
    if (typeof nome !== "string" || nome.trim().length === 0) continue;
    anexos.push({
      nome: nome.trim(),
      bytes: typeof bytes === "number" && Number.isFinite(bytes) ? bytes : 0,
    });
  }
  return anexos.length > 0 ? anexos : null;
}

function mapRow(row: EmailRow, nomes: Map<string, string>): EmailMensagem {
  return {
    id: row.id,
    direcao: row.direcao === "recebido" ? "recebido" : "enviado",
    origem: row.origem ?? "compositor",
    deEmail: row.de_email,
    paraEmail: row.para_email,
    assunto: row.assunto ?? "",
    corpoText: row.corpo_text,
    snippet: row.snippet,
    formSubmissionId: row.form_submission_id,
    provider: row.provider,
    gmailThreadId: row.gmail_thread_id,
    entregueAt: row.entregue_at,
    abertoAt: row.aberto_at,
    clicadoAt: row.clicado_at,
    bounceAt: row.bounce_at,
    reclamadoAt: row.reclamado_at,
    falhaMotivo: row.falha_motivo,
    mensagemEm: row.mensagem_em,
    caixaEmail: row.caixa_email,
    anexos: parseAnexos(row.anexos),
    leadNome: row.form_submission_id
      ? (nomes.get(row.form_submission_id) ?? null)
      : null,
  };
}

/** Batch: nomes dos leads vinculados (1 query p/ todos os ids — sem N+1). */
async function fetchNomesLeads(
  supabase: SupabaseServer,
  ids: string[],
): Promise<Map<string, string>> {
  const nomes = new Map<string, string>();
  const unicos = Array.from(new Set(ids));
  if (unicos.length === 0) return nomes;

  const { data, error } = await supabase
    .from("form_submissions")
    .select("id, athlete_name")
    .in("id", unicos);

  if (error) {
    // Enriquecimento é best-effort: a lista de e-mails vale mais que o nome.
    console.error({ level: "error", action: "emails_nomes_leads", error: error.message });
    return nomes;
  }
  for (const row of (data ?? []) as Array<{ id: string; athlete_name: string | null }>) {
    if (row.athlete_name) nomes.set(row.id, row.athlete_name);
  }
  return nomes;
}

/** true se o valor parece um e-mail do domínio da BAUSA. */
function isEmailBausa(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@bolsaatletausa\.com$/i.test(value.trim());
}

/**
 * Config `emails_contas` (contas sincronizadas + padrão de envio).
 * Fail-open: config ausente/quebrada → só a caixa histórica (contato@) —
 * uma config ruim nunca derruba a tela nem o envio pela conta padrão.
 */
export async function fetchEmailsContasConfig(
  supabase: SupabaseServer,
): Promise<EmailsContasConfig> {
  const fallback: EmailsContasConfig = {
    contas: [CAIXA_EMAIL_PADRAO],
    caixas: [CAIXA_EMAIL_PADRAO],
    padraoEnvio: CAIXA_EMAIL_PADRAO,
  };
  try {
    // Duas fontes numa consulta: emails_contas (lista MANUAL — whitelist de
    // envio) e email_inbox_state (o sync grava ali TODA caixa sincronizada,
    // inclusive as descobertas via Directory). A visualização (`caixas`)
    // é a união — caixa descoberta aparece na tela sem depender da config.
    const { data, error } = await supabase
      .from("configuracoes_sistema")
      .select("chave, valor")
      .in("chave", ["emails_contas", "email_inbox_state"]);

    if (error) {
      console.error({ level: "error", action: "emails_contas_config", error: error.message });
      return fallback;
    }

    let contas: string[] = [];
    let padraoRaw: string | null = null;
    const sincronizadas: string[] = [];
    for (const row of data ?? []) {
      const valor = row.valor as Record<string, unknown> | null;
      if (row.chave === "emails_contas") {
        const lista = valor?.contas;
        contas = Array.isArray(lista)
          ? lista.filter(isEmailBausa).map((c) => c.trim().toLowerCase())
          : [];
        padraoRaw = isEmailBausa(valor?.padrao_envio)
          ? valor.padrao_envio.trim().toLowerCase()
          : null;
      }
      if (row.chave === "email_inbox_state") {
        const porConta = valor?.contas;
        if (porConta && typeof porConta === "object") {
          for (const caixa of Object.keys(porConta)) {
            if (isEmailBausa(caixa)) sincronizadas.push(caixa.trim().toLowerCase());
          }
        }
      }
    }
    if (contas.length === 0) return fallback;

    const caixas = [...new Set([...contas, ...sincronizadas.sort()])];
    return {
      contas,
      caixas,
      padraoEnvio: padraoRaw && contas.includes(padraoRaw) ? padraoRaw : contas[0],
    };
  } catch (err) {
    console.error({
      level: "error",
      action: "emails_contas_config",
      error: err instanceof Error ? err.message : String(err),
    });
    return fallback;
  }
}

/**
 * Regras de roteamento alias→caixa (chave `emails_roteamento`).
 * Fail-open: erro/config quebrada → lista vazia (o sync usa o default).
 */
export async function fetchEmailsRoteamento(
  supabase: SupabaseServer,
): Promise<EmailRoteamentoRegra[]> {
  try {
    const { data, error } = await supabase
      .from("configuracoes_sistema")
      .select("valor")
      .eq("chave", "emails_roteamento")
      .maybeSingle();

    if (error) {
      console.error({ level: "error", action: "emails_roteamento_fetch", error: error.message });
      return [];
    }

    const valor = data?.valor as { regras?: unknown } | null;
    if (!Array.isArray(valor?.regras)) return [];
    return valor.regras
      .filter(
        (r): r is { alias: string; caixa: string } =>
          typeof r === "object" && r !== null &&
          isEmailBausa((r as { alias?: unknown }).alias) &&
          isEmailBausa((r as { caixa?: unknown }).caixa),
      )
      .map((r) => ({
        alias: r.alias.trim().toLowerCase(),
        caixa: r.caixa.trim().toLowerCase(),
      }));
  } catch (err) {
    console.error({
      level: "error",
      action: "emails_roteamento_fetch",
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

// ── Assinaturas ricas (v2: LISTA por conta) ──────────────────────────────

/** Uma assinatura rica de e-mail — HTML sanitizado no SALVAR (server action). */
export interface EmailAssinatura {
  id: string;
  /** Nome de exibição no seletor do compositor (ex.: "Padrão", "Institucional"). */
  nome: string;
  /** HTML da assinatura (negrito/cor/sublinhado/imagem) — já sanitizado. */
  html: string;
  /** Assinatura pré-selecionada quando a conta é escolhida no "De:". */
  padrao: boolean;
}

/** Escapa texto puro p/ HTML (conversão do formato legado de assinatura). */
function textoParaHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

/** Parse defensivo de UMA entrada da lista de assinaturas. */
function parseAssinatura(item: unknown): EmailAssinatura | null {
  if (typeof item !== "object" || item === null) return null;
  const { id, nome, html, padrao } = item as {
    id?: unknown;
    nome?: unknown;
    html?: unknown;
    padrao?: unknown;
  };
  if (typeof id !== "string" || id.trim().length === 0) return null;
  if (typeof html !== "string" || html.trim().length === 0) return null;
  return {
    id: id.trim(),
    nome: typeof nome === "string" && nome.trim().length > 0 ? nome.trim() : "Assinatura",
    html,
    padrao: padrao === true,
  };
}

/**
 * Assinaturas por conta (chave `emails_assinaturas`):
 * v2 = `{ conta: [{id, nome, html, padrao}] }`. O formato legado (v1,
 * `{ conta: "texto" }`) é convertido na leitura — texto vira HTML escapado
 * com `<br>` e entra como assinatura única padrão. Fail-open: erro/forma
 * inesperada → `{}` — config quebrada nunca derruba a tela nem o envio.
 */
export async function fetchEmailsAssinaturas(
  supabase: SupabaseServer,
): Promise<Record<string, EmailAssinatura[]>> {
  try {
    const { data, error } = await supabase
      .from("configuracoes_sistema")
      .select("valor")
      .eq("chave", "emails_assinaturas")
      .maybeSingle();

    if (error) {
      console.error({ level: "error", action: "emails_assinaturas_fetch", error: error.message });
      return {};
    }

    const valor = data?.valor;
    if (!valor || typeof valor !== "object" || Array.isArray(valor)) return {};

    const assinaturas: Record<string, EmailAssinatura[]> = {};
    for (const [contaRaw, entrada] of Object.entries(valor as Record<string, unknown>)) {
      if (!isEmailBausa(contaRaw)) continue;
      const conta = contaRaw.trim().toLowerCase();

      // Legado (v1): string de texto puro → assinatura única padrão.
      if (typeof entrada === "string" && entrada.trim().length > 0) {
        assinaturas[conta] = [
          { id: "legado", nome: "Assinatura", html: textoParaHtml(entrada), padrao: true },
        ];
        continue;
      }

      if (!Array.isArray(entrada)) continue;
      const lista = entrada
        .map(parseAssinatura)
        .filter((a): a is EmailAssinatura => a !== null);
      if (lista.length === 0) continue;
      // Invariante de leitura: exatamente UMA padrão (a primeira marcada vence).
      const idxPadrao = lista.findIndex((a) => a.padrao);
      assinaturas[conta] = lista.map((a, i) => ({
        ...a,
        padrao: i === (idxPadrao === -1 ? 0 : idxPadrao),
      }));
    }
    return assinaturas;
  } catch (err) {
    console.error({
      level: "error",
      action: "emails_assinaturas_fetch",
      error: err instanceof Error ? err.message : String(err),
    });
    return {};
  }
}

// ── Permissões da Head (chave `emails_permissoes`) ───────────────────────

export interface EmailsPermissoes {
  /** Caixas que a Head pode VER (recebidos/enviados/métricas). */
  caixas: string[];
  /** Contas pelas quais a Head pode ENVIAR (De: do compositor). */
  envio: string[];
}

/**
 * Acessos da Head ao /emails (o CEO define na aba Acessos). FAIL-CLOSED:
 * erro de leitura/forma inesperada = NENHUM acesso — uma config quebrada
 * jamais pode abrir caixa que o CEO não liberou (oposto do fail-open das
 * demais configs deste módulo, que só afetam a experiência do próprio CEO).
 */
export async function fetchEmailsPermissoesHead(
  supabase: SupabaseServer,
): Promise<EmailsPermissoes> {
  const nenhum: EmailsPermissoes = { caixas: [], envio: [] };
  try {
    const { data, error } = await supabase
      .from("configuracoes_sistema")
      .select("valor")
      .eq("chave", "emails_permissoes")
      .maybeSingle();

    if (error) {
      console.error({ level: "error", action: "emails_permissoes_fetch", error: error.message });
      return nenhum;
    }

    const head = (data?.valor as { head_sucesso?: unknown } | null)?.head_sucesso;
    if (!head || typeof head !== "object" || Array.isArray(head)) return nenhum;
    const { caixas, envio } = head as { caixas?: unknown; envio?: unknown };
    return {
      caixas: Array.isArray(caixas)
        ? caixas.filter(isEmailBausa).map((c) => c.trim().toLowerCase())
        : [],
      envio: Array.isArray(envio)
        ? envio.filter(isEmailBausa).map((c) => c.trim().toLowerCase())
        : [],
    };
  } catch (err) {
    console.error({
      level: "error",
      action: "emails_permissoes_fetch",
      error: err instanceof Error ? err.message : String(err),
    });
    return nenhum;
  }
}

// ── Paginação por cursor (keyset) ────────────────────────────────────────
// A tabela guarda o histórico COMPLETO das caixas (dezenas de milhares de
// linhas) — nunca carregar tudo. Ordem estável: mensagem_em desc, id desc;
// o cursor aponta o último item da página anterior e o filtro composto
// (lt OU eq+id.lt) não pula nem duplica itens em timestamps empatados.

export const EMAILS_PAGINA_PADRAO = 50;
const EMAILS_PAGINA_MAX = 100;

/** Mínimo de caracteres p/ a busca server-side valer (abaixo = lista normal). */
export const BUSCA_EMAILS_MIN_CHARS = 2;

export interface EmailsCursor {
  /** mensagem_em (ISO, como veio do PostgREST) do último item carregado. */
  mensagemEm: string;
  /** id do último item — desempate p/ timestamps iguais. */
  id: string;
}

export interface EmailsPagina {
  itens: EmailMensagem[];
  /** Cursor da próxima página; null = acabou. */
  proximoCursor: EmailsCursor | null;
}

export interface FetchEmailsParams {
  direcao?: EmailDirecao;
  caixa?: string;
  cursor?: EmailsCursor;
  /** Tamanho da página (default 50, teto 100). */
  limite?: number;
  /** Busca server-side (assunto/de/para/snippet) — ignorada com <2 chars. */
  busca?: string;
  /**
   * Recorte da Head: SÓ estas caixas entram no resultado (emails_permissoes).
   * Lista vazia = nada (fail-closed). CEO não passa (vê tudo).
   */
  caixasPermitidas?: string[];
}

/**
 * Sanitiza o termo p/ dentro do `or(...ilike...)`: curingas do LIKE (\ % _)
 * são escapados (padrão escapeLike do buscarLeadsEmail); `,` `(` `)` `"` são
 * ESTRUTURAIS na gramática do or() do PostgREST (não há escape no nível do
 * parser) — viram espaço.
 */
function sanitizeTermoBusca(termo: string): string {
  return termo
    .replace(/[,()"]/g, " ")
    .replace(/[\\%_]/g, (c) => `\\${c}`)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Página de e-mails (por direção/caixa, mais recentes primeiro) com nome do
 * lead. Busca `limite + 1` linhas p/ saber se há próxima página sem roundtrip
 * extra. Valores do cursor DEVEM ser validados pelo caller (Zod na server
 * action) — é o que os mantém seguros dentro do or() do PostgREST.
 */
export async function fetchEmails(
  supabase: SupabaseServer,
  params: FetchEmailsParams = {},
): Promise<EmailsPagina> {
  const { direcao, caixa, cursor, busca, caixasPermitidas } = params;
  const limite = Math.min(Math.max(params.limite ?? EMAILS_PAGINA_PADRAO, 1), EMAILS_PAGINA_MAX);

  // Fail-closed: recorte da Head sem caixa liberada = resultado vazio.
  if (caixasPermitidas && caixasPermitidas.length === 0) {
    return { itens: [], proximoCursor: null };
  }

  let query = supabase
    .from("emails_mensagens")
    .select(EMAIL_COLS)
    .is("deleted_at", null)
    .order("mensagem_em", { ascending: false })
    .order("id", { ascending: false })
    .limit(limite + 1);
  if (direcao) query = query.eq("direcao", direcao);
  if (caixa) query = query.eq("caixa_email", caixa);
  else if (caixasPermitidas) query = query.in("caixa_email", caixasPermitidas);
  if (cursor) {
    // Keyset estável — estritamente "depois" do último item já carregado.
    query = query.or(
      `mensagem_em.lt.${cursor.mensagemEm},and(mensagem_em.eq.${cursor.mensagemEm},id.lt.${cursor.id})`,
    );
  }

  const buscaTrim = busca?.trim() ?? "";
  if (buscaTrim.length >= BUSCA_EMAILS_MIN_CHARS) {
    const termo = sanitizeTermoBusca(buscaTrim);
    if (termo) {
      const like = `%${termo}%`;
      // .or() adicional é ANDado com o do cursor (params separados no PostgREST).
      query = query.or(
        `assunto.ilike.${like},de_email.ilike.${like},para_email.ilike.${like},snippet.ilike.${like}`,
      );
    }
  }

  const { data, error } = await query;
  if (error) {
    console.error({ level: "error", action: "emails_fetch", direcao, error: error.message });
    return { itens: [], proximoCursor: null };
  }

  const rows = (data ?? []) as unknown as EmailRow[];
  const temMais = rows.length > limite;
  const pagina = temMais ? rows.slice(0, limite) : rows;

  const nomes = await fetchNomesLeads(
    supabase,
    pagina.map((r) => r.form_submission_id).filter((v): v is string => Boolean(v)),
  );
  const ultimo = pagina[pagina.length - 1];
  return {
    itens: pagina.map((r) => mapRow(r, nomes)),
    proximoCursor:
      temMais && ultimo ? { mensagemEm: ultimo.mensagem_em, id: ultimo.id } : null,
  };
}

export interface EmailsContagens {
  recebidos: number;
  enviados: number;
}

/**
 * Contagem exata por direção (respeitando o filtro de caixa) — `head: true`
 * não transfere linha nenhuma, só o count. Alimenta os contadores do rail
 * (número real da caixa, não "carregados"). Fail-open: erro → 0.
 */
export async function fetchEmailsContagens(
  supabase: SupabaseServer,
  caixa?: string,
  caixasPermitidas?: string[],
): Promise<EmailsContagens> {
  if (caixasPermitidas && caixasPermitidas.length === 0) {
    return { recebidos: 0, enviados: 0 };
  }
  const contar = async (direcao: EmailDirecao): Promise<number> => {
    let query = supabase
      .from("emails_mensagens")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("direcao", direcao);
    if (caixa) query = query.eq("caixa_email", caixa);
    else if (caixasPermitidas) query = query.in("caixa_email", caixasPermitidas);

    const { count, error } = await query;
    if (error) {
      console.error({
        level: "error",
        action: "emails_contagem",
        direcao,
        error: error.message,
      });
      return 0;
    }
    return count ?? 0;
  };

  const [recebidos, enviados] = await Promise.all([contar("recebido"), contar("enviado")]);
  return { recebidos, enviados };
}

/** Conversa completa de um thread do Gmail (ordem cronológica). */
export async function fetchThread(
  supabase: SupabaseServer,
  gmailThreadId: string,
  caixasPermitidas?: string[],
): Promise<EmailMensagem[]> {
  if (caixasPermitidas && caixasPermitidas.length === 0) return [];

  let query = supabase
    .from("emails_mensagens")
    .select(EMAIL_COLS)
    .eq("gmail_thread_id", gmailThreadId)
    .is("deleted_at", null)
    .order("mensagem_em", { ascending: true });
  if (caixasPermitidas) query = query.in("caixa_email", caixasPermitidas);
  const { data, error } = await query;

  if (error) {
    console.error({ level: "error", action: "emails_fetch_thread", error: error.message });
    return [];
  }

  const rows = (data ?? []) as unknown as EmailRow[];
  const nomes = await fetchNomesLeads(
    supabase,
    rows.map((r) => r.form_submission_id).filter((v): v is string => Boolean(v)),
  );
  return rows.map((r) => mapRow(r, nomes));
}

/**
 * E-mails de UM lead (aba E-mails do detalhe), mais recentes primeiro.
 * Sem enriquecimento de nome — o chamador já conhece o lead.
 */
export async function fetchEmailsLead(
  supabase: SupabaseServer,
  formSubmissionId: string,
  limite = 50,
): Promise<EmailMensagem[]> {
  const { data, error } = await supabase
    .from("emails_mensagens")
    .select(EMAIL_COLS)
    .eq("form_submission_id", formSubmissionId)
    .is("deleted_at", null)
    .order("mensagem_em", { ascending: false })
    .limit(limite);

  if (error) {
    console.error({ level: "error", action: "emails_fetch_lead", error: error.message });
    return [];
  }
  const vazio = new Map<string, string>();
  return ((data ?? []) as unknown as EmailRow[]).map((r) => mapRow(r, vazio));
}

/** YYYY-MM-DD em UTC (mesma janela UTC das demais queries do Engine). */
function diaUTC(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Métricas do módulo — TUDO derivado de emails_mensagens (nada inventado):
 * enviados no período, taxas sobre envios via Resend (único provider com
 * eventos de webhook), série diária por dia de ENVIO (abertura atribuída ao
 * dia do envio) e top leads por interação (aberturas+cliques+respostas).
 */
export async function fetchEmailMetricas(
  supabase: SupabaseServer,
  dias = 30,
  caixa?: string,
  caixasPermitidas?: string[],
): Promise<EmailMetricas> {
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();

  // Fail-closed (recorte da Head sem caixa liberada) — métricas zeradas.
  if (caixasPermitidas && caixasPermitidas.length === 0) {
    const serieVazia: EmailSerieDia[] = [];
    for (let i = dias - 1; i >= 0; i--) {
      serieVazia.push({
        dia: new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10),
        enviados: 0,
        abertos: 0,
      });
    }
    return {
      dias,
      enviados: 0,
      enviadosResend: 0,
      entregues: 0,
      abertos: 0,
      clicados: 0,
      bounces: 0,
      reclamados: 0,
      taxaEntrega: null,
      taxaAbertura: null,
      taxaClique: null,
      serie: serieVazia,
      topLeads: [],
    };
  }

  let enviadosQuery = supabase
    .from("emails_mensagens")
    .select(
      "id, form_submission_id, provider, entregue_at, aberto_at, clicado_at, bounce_at, reclamado_at, mensagem_em",
    )
    .eq("direcao", "enviado")
    .is("deleted_at", null)
    .gte("mensagem_em", desde)
    .order("mensagem_em", { ascending: true });
  if (caixa) enviadosQuery = enviadosQuery.eq("caixa_email", caixa);
  else if (caixasPermitidas) enviadosQuery = enviadosQuery.in("caixa_email", caixasPermitidas);

  // Respostas recebidas de leads no período (entram no "top por interação").
  let recebidosQuery = supabase
    .from("emails_mensagens")
    .select("id, form_submission_id, mensagem_em")
    .eq("direcao", "recebido")
    .is("deleted_at", null)
    .gte("mensagem_em", desde)
    .not("form_submission_id", "is", null);
  if (caixa) recebidosQuery = recebidosQuery.eq("caixa_email", caixa);
  else if (caixasPermitidas) recebidosQuery = recebidosQuery.in("caixa_email", caixasPermitidas);

  const [enviadosRes, recebidosRes] = await Promise.all([enviadosQuery, recebidosQuery]);

  if (enviadosRes.error) {
    console.error({
      level: "error",
      action: "emails_metricas",
      error: enviadosRes.error.message,
    });
  }
  if (recebidosRes.error) {
    console.error({
      level: "error",
      action: "emails_metricas_recebidos",
      error: recebidosRes.error.message,
    });
  }

  const enviados = (enviadosRes.data ?? []) as Array<{
    id: string;
    form_submission_id: string | null;
    provider: string | null;
    entregue_at: string | null;
    aberto_at: string | null;
    clicado_at: string | null;
    bounce_at: string | null;
    reclamado_at: string | null;
    mensagem_em: string;
  }>;
  const recebidos = (recebidosRes.data ?? []) as Array<{
    id: string;
    form_submission_id: string | null;
    mensagem_em: string;
  }>;

  const resend = enviados.filter((e) => e.provider === "resend");
  const entregues = resend.filter((e) => e.entregue_at).length;
  const abertos = resend.filter((e) => e.aberto_at).length;
  const clicados = resend.filter((e) => e.clicado_at).length;
  const bounces = resend.filter((e) => e.bounce_at).length;
  const reclamados = resend.filter((e) => e.reclamado_at).length;
  const denom = resend.length;
  const taxa = (n: number): number | null => (denom > 0 ? n / denom : null);

  // Série diária contínua (dias sem envio aparecem zerados — gráfico honesto).
  const porDia = new Map<string, { enviados: number; abertos: number }>();
  for (let i = dias - 1; i >= 0; i--) {
    porDia.set(diaUTC(new Date(Date.now() - i * 86_400_000).toISOString()), {
      enviados: 0,
      abertos: 0,
    });
  }
  for (const e of enviados) {
    const bucket = porDia.get(diaUTC(e.mensagem_em));
    if (!bucket) continue;
    bucket.enviados += 1;
    if (e.aberto_at) bucket.abertos += 1;
  }
  const serie: EmailSerieDia[] = Array.from(porDia.entries()).map(([dia, v]) => ({
    dia,
    ...v,
  }));

  // Top leads por interação: aberturas + cliques (dos envios) + respostas.
  const porLead = new Map<
    string,
    { enviados: number; aberturas: number; cliques: number; respostas: number }
  >();
  const bucketLead = (id: string) => {
    let b = porLead.get(id);
    if (!b) {
      b = { enviados: 0, aberturas: 0, cliques: 0, respostas: 0 };
      porLead.set(id, b);
    }
    return b;
  };
  for (const e of enviados) {
    if (!e.form_submission_id) continue;
    const b = bucketLead(e.form_submission_id);
    b.enviados += 1;
    if (e.aberto_at) b.aberturas += 1;
    if (e.clicado_at) b.cliques += 1;
  }
  for (const r of recebidos) {
    if (r.form_submission_id) bucketLead(r.form_submission_id).respostas += 1;
  }

  const nomes = await fetchNomesLeads(supabase, Array.from(porLead.keys()));
  const topLeads: EmailTopLead[] = Array.from(porLead.entries())
    .map(([formSubmissionId, v]) => ({
      formSubmissionId,
      leadNome: nomes.get(formSubmissionId) ?? "Lead",
      ...v,
      interacoes: v.aberturas + v.cliques + v.respostas,
    }))
    .filter((l) => l.interacoes > 0)
    .sort((a, b) => b.interacoes - a.interacoes)
    .slice(0, 5);

  return {
    dias,
    enviados: enviados.length,
    enviadosResend: denom,
    entregues,
    abertos,
    clicados,
    bounces,
    reclamados,
    taxaEntrega: taxa(entregues),
    taxaAbertura: taxa(abertos),
    taxaClique: taxa(clicados),
    serie,
    topLeads,
  };
}
