"use server";

import { z } from "zod";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";

// ════════════════════════════════════════════════════════════════════════
// Mensagem direta (I4) — CEO envia WhatsApp/E-mail para UM lead a partir do
// detalhe do lead/deal. Segue o padrão do enviarWhatsAppManual (whatsapp.ts):
// env SEND_WHATSAPP_URL/SEND_MESSAGES_URL + header x-webhook-secret + registro
// do envio em `notificacoes` (tipo mensagem_direta) + log estruturado.
//
// Canais (caminhos custom já existentes nas CFs — nada novo no backend):
// • WhatsApp → send-whatsapp `{ record, messageType:'meeting_confirmed',
//   customMessage, phone, linkUrl?, linkTitle?, linkImage? }` (I2).
// • E-mail  → send-messages `{ customEmail: { to, subject, text, imageUrl?,
//   linkUrl?, linkTitle? } }` (H4/I2).
//
// Classificação Gemini NÃO bloqueia: é envio MANUAL do CEO (decisão humana),
// diferente das automações (invariante FRIO da engine). Por isso o `record`
// enviado à CF leva só athlete_name — sem qualification_classification, o
// skip de FRIO do send-whatsapp não é acionado.
// ════════════════════════════════════════════════════════════════════════

const MENSAGEM_MIN = 5;
const MENSAGEM_MAX = 2000;
const ASSUNTO_MAX = 150;
const LINK_TITULO_MAX = 120;
const CF_TIMEOUT_MS = 30_000;

const urlHttp = z
  .string()
  .trim()
  .max(2048, "URL longa demais.")
  .refine((v) => /^https?:\/\//i.test(v), "URL deve começar com http(s)://");

const schema = z
  .object({
    canal: z.enum(["whatsapp", "email"]),
    /** form_submissions.id — caminho do detalhe do lead (/leads). */
    leadId: z.string().uuid().optional(),
    /** deals.id — caminho do detalhe do deal (/pipeline). */
    dealId: z.string().uuid().optional(),
    mensagem: z
      .string()
      .trim()
      .min(MENSAGEM_MIN, `Mensagem muito curta (mín ${MENSAGEM_MIN}).`)
      .max(MENSAGEM_MAX, `Mensagem muito longa (máx ${MENSAGEM_MAX}).`),
    assunto: z.string().trim().max(ASSUNTO_MAX, `Assunto muito longo (máx ${ASSUNTO_MAX}).`).optional(),
    imagemUrl: urlHttp.optional(),
    linkUrl: urlHttp.optional(),
    linkTitulo: z.string().trim().max(LINK_TITULO_MAX).optional(),
  })
  .superRefine((val, ctx) => {
    if (!val.leadId && !val.dealId) {
      ctx.addIssue({ code: "custom", message: "Informe o lead ou o deal de destino." });
    }
    if (val.canal === "email" && !val.assunto?.trim()) {
      ctx.addIssue({ code: "custom", message: "Assunto é obrigatório no e-mail." });
    }
  });

export type EnviarMensagemDiretaInput = z.input<typeof schema>;

interface DestinatarioResolvido {
  nome: string;
  responsavelNome: string | null;
  telefone: string | null;
  email: string | null;
  classificacao: string | null;
  dealId: string | null;
}

interface FormSubmissionContato {
  athlete_name: string | null;
  guardian_name: string | null;
  guardian_whatsapp: string | null;
  athlete_whatsapp: string | null;
  guardian_email: string | null;
  email: string | null;
  qualification_classification: string | null;
}

/** Mascara contato para log (nunca logar telefone/e-mail completos). */
function mask(value: string | null): string {
  if (!value) return "—";
  return value.length <= 4 ? "****" : `…${value.slice(-4)}`;
}

/** Render dos placeholders com os nomes REAIS (mesmo split/join da engine).
 *  O compositor não usa placeholders, mas se o CEO digitar {atleta_nome}
 *  o texto sai correto — as CFs custom NÃO renderizam placeholders. */
function renderVars(texto: string, dest: DestinatarioResolvido): string {
  const vars: Record<string, string> = {
    "{atleta_nome}": dest.nome || "Atleta",
    "{responsavel_nome}": dest.responsavelNome || "Responsável",
  };
  let rendered = texto;
  for (const [placeholder, valor] of Object.entries(vars)) {
    rendered = rendered.split(placeholder).join(valor);
  }
  return rendered;
}

// Resolve contato SERVER-SIDE (não confiar no client): lead → form_submissions
// direto; deal → deals→atletas→form_submissions (mesmo join do /pipeline).
async function resolverDestinatario(
  supabase: Awaited<ReturnType<typeof createAuditedSupabaseClient>>,
  params: { leadId?: string; dealId?: string },
): Promise<{ dest: DestinatarioResolvido } | { error: string }> {
  if (params.dealId) {
    const { data, error } = await supabase
      .from("deals")
      .select(
        `id,
         atleta:atletas(
           nome_completo, whatsapp, email, classificacao_gemini,
           form_submission:form_submissions(
             athlete_name, guardian_name, guardian_whatsapp, athlete_whatsapp,
             guardian_email, email, qualification_classification
           )
         )`,
      )
      .eq("id", params.dealId)
      .is("deleted_at", null)
      .single();

    if (error || !data) return { error: "Deal não encontrado." };

    const atleta = (data as unknown as {
      atleta: {
        nome_completo: string | null;
        whatsapp: string | null;
        email: string | null;
        classificacao_gemini: string | null;
        form_submission: FormSubmissionContato | null;
      } | null;
    }).atleta;
    const fs = atleta?.form_submission ?? null;

    return {
      dest: {
        nome: atleta?.nome_completo ?? fs?.athlete_name ?? "Atleta",
        responsavelNome: fs?.guardian_name ?? null,
        telefone: fs?.guardian_whatsapp ?? atleta?.whatsapp ?? null,
        email: fs?.guardian_email ?? atleta?.email ?? fs?.email ?? null,
        classificacao: atleta?.classificacao_gemini ?? fs?.qualification_classification ?? null,
        dealId: params.dealId,
      },
    };
  }

  const { data, error } = await supabase
    .from("form_submissions")
    .select(
      "athlete_name, guardian_name, guardian_whatsapp, athlete_whatsapp, guardian_email, email, qualification_classification",
    )
    .eq("id", params.leadId!)
    .single();

  if (error || !data) return { error: "Lead não encontrado." };
  const fs = data as FormSubmissionContato;

  return {
    dest: {
      nome: fs.athlete_name ?? "Atleta",
      responsavelNome: fs.guardian_name,
      telefone: fs.guardian_whatsapp ?? fs.athlete_whatsapp ?? null,
      email: fs.guardian_email ?? fs.email ?? null,
      classificacao: fs.qualification_classification,
      dealId: null,
    },
  };
}

async function chamarCloudFunction(
  url: string,
  body: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": process.env.WEBHOOK_SECRET ?? "",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(CF_TIMEOUT_MS),
    });
    if (!response.ok) {
      const corpo = await response.text().catch(() => "");
      return {
        ok: false,
        error: `Erro HTTP ${response.status} no envio${corpo ? `: ${corpo.slice(0, 200)}` : "."}`,
      };
    }
    return { ok: true };
  } catch (err) {
    const timeout = err instanceof Error && err.name === "TimeoutError";
    return {
      ok: false,
      error: timeout
        ? `Tempo esgotado (${CF_TIMEOUT_MS / 1000}s) ao chamar o serviço de envio.`
        : "Falha de rede ao chamar o serviço de envio.",
    };
  }
}

export async function enviarMensagemDireta(
  input: EnviarMensagemDiretaInput,
): Promise<{ success: boolean; error?: string; detalhe?: string }> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas o CEO pode enviar mensagem direta." };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { canal, leadId, dealId, assunto, imagemUrl, linkUrl, linkTitulo } = parsed.data;

  // Sem UI falsa: envs ausentes retornam erro claro (pendência de config).
  const cfUrl = canal === "whatsapp" ? process.env.SEND_WHATSAPP_URL : process.env.SEND_MESSAGES_URL;
  if (!cfUrl) {
    return {
      success: false,
      error:
        canal === "whatsapp"
          ? "SEND_WHATSAPP_URL não configurada no ambiente do Engine."
          : "SEND_MESSAGES_URL não configurada no ambiente do Engine — e-mail direto indisponível (pendência de config).",
    };
  }

  const supabase = await createAuditedSupabaseClient();
  const resolvido = await resolverDestinatario(supabase, { leadId, dealId });
  if ("error" in resolvido) return { success: false, error: resolvido.error };
  const { dest } = resolvido;

  const mensagem = renderVars(parsed.data.mensagem, dest);

  let envio: { ok: true } | { ok: false; error: string };
  let destino: string;

  if (canal === "whatsapp") {
    if (!dest.telefone) return { success: false, error: "Lead sem telefone cadastrado." };
    destino = dest.telefone;
    envio = await chamarCloudFunction(cfUrl, {
      // Só athlete_name no record: sem qualification_classification o filtro
      // FRIO da CF não é acionado — envio manual do CEO nunca é bloqueado.
      record: { athlete_name: dest.nome },
      messageType: "meeting_confirmed",
      customMessage: mensagem,
      phone: dest.telefone,
      // Contrato I2: imagem só acompanha o card do link (linkImage).
      ...(linkUrl
        ? { linkUrl, linkTitle: linkTitulo || undefined, linkImage: imagemUrl || undefined }
        : {}),
    });
  } else {
    if (!dest.email) return { success: false, error: "Lead sem e-mail cadastrado." };
    destino = dest.email;
    envio = await chamarCloudFunction(cfUrl, {
      customEmail: {
        to: dest.email,
        subject: renderVars(assunto!.trim(), dest),
        text: mensagem,
        ...(imagemUrl ? { imageUrl: imagemUrl } : {}),
        ...(linkUrl ? { linkUrl, linkTitle: linkTitulo || undefined } : {}),
      },
    });
  }

  console.log({
    level: envio.ok ? "info" : "error",
    action: "mensagem_direta",
    canal,
    leadId: leadId ?? null,
    dealId: dealId ?? null,
    destino: mask(destino),
    comLink: Boolean(linkUrl),
    comImagem: Boolean(imagemUrl),
    sucesso: envio.ok,
    ...(envio.ok ? {} : { erro: envio.error }),
  });

  if (!envio.ok) return { success: false, error: envio.error };

  // Registro do envio — mesmo padrão do enviarWhatsAppManual (whatsapp.ts):
  // insert em `notificacoes` (trilha visível no Engine). Falha aqui NÃO
  // derruba o resultado (a mensagem JÁ foi enviada) — vira detalhe.
  let detalhe = `Enviado para ${dest.nome}.`;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error: regErro } = await supabase.from("notificacoes").insert({
        destinatario_id: user.id,
        titulo: canal === "whatsapp" ? "WhatsApp direto enviado" : "E-mail direto enviado",
        mensagem: `Mensagem direta (${canal}) para ${dest.nome}${linkUrl ? " com link" : ""}.`,
        tipo: "mensagem_direta",
        severidade: "baixa",
        deal_id: dest.dealId,
      });
      if (regErro) detalhe = `Enviado, mas o registro em notificações falhou: ${regErro.message}`;
    }
  } catch {
    detalhe = "Enviado, mas o registro em notificações falhou.";
  }

  return { success: true, detalhe };
}
