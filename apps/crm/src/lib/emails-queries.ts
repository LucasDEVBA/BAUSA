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
}

const EMAIL_COLS =
  "id, direcao, origem, de_email, para_email, assunto, corpo_text, snippet, " +
  "form_submission_id, provider, gmail_thread_id, entregue_at, aberto_at, " +
  "clicado_at, bounce_at, reclamado_at, falha_motivo, mensagem_em";

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

/** Lista de e-mails (por direção, mais recentes primeiro), com nome do lead. */
export async function fetchEmails(
  supabase: SupabaseServer,
  direcao?: EmailDirecao,
  limite = 100,
): Promise<EmailMensagem[]> {
  let query = supabase
    .from("emails_mensagens")
    .select(EMAIL_COLS)
    .is("deleted_at", null)
    .order("mensagem_em", { ascending: false })
    .limit(limite);
  if (direcao) query = query.eq("direcao", direcao);

  const { data, error } = await query;
  if (error) {
    console.error({ level: "error", action: "emails_fetch", direcao, error: error.message });
    return [];
  }

  const rows = (data ?? []) as unknown as EmailRow[];
  const nomes = await fetchNomesLeads(
    supabase,
    rows.map((r) => r.form_submission_id).filter((v): v is string => Boolean(v)),
  );
  return rows.map((r) => mapRow(r, nomes));
}

/** Conversa completa de um thread do Gmail (ordem cronológica). */
export async function fetchThread(
  supabase: SupabaseServer,
  gmailThreadId: string,
): Promise<EmailMensagem[]> {
  const { data, error } = await supabase
    .from("emails_mensagens")
    .select(EMAIL_COLS)
    .eq("gmail_thread_id", gmailThreadId)
    .is("deleted_at", null)
    .order("mensagem_em", { ascending: true });

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
): Promise<EmailMetricas> {
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();

  const [enviadosRes, recebidosRes] = await Promise.all([
    supabase
      .from("emails_mensagens")
      .select(
        "id, form_submission_id, provider, entregue_at, aberto_at, clicado_at, bounce_at, reclamado_at, mensagem_em",
      )
      .eq("direcao", "enviado")
      .is("deleted_at", null)
      .gte("mensagem_em", desde)
      .order("mensagem_em", { ascending: true }),
    // Respostas recebidas de leads no período (entram no "top por interação").
    supabase
      .from("emails_mensagens")
      .select("id, form_submission_id, mensagem_em")
      .eq("direcao", "recebido")
      .is("deleted_at", null)
      .gte("mensagem_em", desde)
      .not("form_submission_id", "is", null),
  ]);

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
