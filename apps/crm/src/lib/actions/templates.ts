"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";

export type TemplateCanal = "whatsapp" | "email" | "ambos";
export type TemplateCategoria =
  | "onboarding"
  | "checkin"
  | "pre_embarque"
  | "pos_embarque"
  | "documento"
  | "crise"
  | "celebracao"
  | "follow_up"
  | "outro";

export interface MensagemTemplate {
  id: string;
  nome: string;
  categoria: TemplateCategoria;
  canal: TemplateCanal;
  assunto: string | null;
  corpo: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

async function requireWritePapel() {
  const papel = await getUserPapel();
  if (!papel || !["ceo", "head_sucesso"].includes(papel)) return null;
  return papel;
}

export async function listarTemplates(filtros?: {
  canal?: TemplateCanal;
  categoria?: TemplateCategoria;
}): Promise<MensagemTemplate[]> {
  const supabase = await createAuditedSupabaseClient();
  let q = supabase
    .from("mensagem_templates")
    .select("*")
    .is("deleted_at", null)
    .eq("ativo", true)
    .order("categoria", { ascending: true })
    .order("nome", { ascending: true });

  if (filtros?.canal) {
    if (filtros.canal === "whatsapp") {
      q = q.in("canal", ["whatsapp", "ambos"]);
    } else if (filtros.canal === "email") {
      q = q.in("canal", ["email", "ambos"]);
    }
  }
  if (filtros?.categoria) q = q.eq("categoria", filtros.categoria);

  const { data } = await q;
  return (data ?? []) as MensagemTemplate[];
}

export async function criarTemplate(dados: {
  nome: string;
  categoria: TemplateCategoria;
  canal: TemplateCanal;
  assunto?: string | null;
  corpo: string;
}): Promise<{ success: boolean; error?: string; id?: string }> {
  const papel = await requireWritePapel();
  if (!papel) return { success: false, error: "Sem permissão." };
  if (!dados.nome.trim() || !dados.corpo.trim()) {
    return { success: false, error: "Nome e corpo são obrigatórios." };
  }

  const supabase = await createAuditedSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("mensagem_templates")
    .insert({
      nome: dados.nome.trim(),
      categoria: dados.categoria,
      canal: dados.canal,
      assunto: dados.assunto ?? null,
      corpo: dados.corpo,
      created_by: user?.id,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath("/familias-crm");
  revalidatePath("/familias-pipeline");
  return { success: true, id: data.id };
}

export async function atualizarTemplate(
  id: string,
  dados: Partial<{
    nome: string;
    categoria: TemplateCategoria;
    canal: TemplateCanal;
    assunto: string | null;
    corpo: string;
    ativo: boolean;
  }>,
) {
  const papel = await requireWritePapel();
  if (!papel) return { success: false, error: "Sem permissão." };

  const supabase = await createAuditedSupabaseClient();
  const { error } = await supabase
    .from("mensagem_templates")
    .update(dados)
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/familias-crm");
  return { success: true };
}

export async function arquivarTemplate(id: string) {
  const papel = await requireWritePapel();
  if (!papel) return { success: false, error: "Sem permissão." };

  const supabase = await createAuditedSupabaseClient();
  const { error } = await supabase
    .from("mensagem_templates")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/familias-crm");
  return { success: true };
}

// ════════════════════════════════════════════════════════════════════════
// Envio direto de template via Z-API (CF send-whatsapp) — head + ceo.
// Mesmo caminho custom do Engine usado em mensagem-direta.ts / whatsapp.ts:
// payload { record:{athlete_name}, messageType:'meeting_confirmed',
// customMessage, phone } + header x-webhook-secret + timeout. O `record` leva
// só athlete_name (sem classificação) — envio MANUAL nunca é bloqueado pelo
// skip de FRIO da CF. Após o envio, registra o contato na timeline
// (contatos_experiencia) e atualiza data_ultimo_contato — mesmo padrão do
// registrarContato (experiencia.ts).
// ════════════════════════════════════════════════════════════════════════

const CF_TIMEOUT_MS = 30_000;
const TEXTO_MIN = 5;
const TEXTO_MAX = 2000;
const RESUMO_MAX = 180;
const WHATSAPP_DIGITOS_MIN = 8;

/** Mascara telefone para log (nunca logar o número completo). */
function maskTelefone(value: string | null): string {
  if (!value) return "—";
  return value.length <= 4 ? "****" : `…${value.slice(-4)}`;
}

function soDigitos(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

interface ExperienciaContato {
  id: string;
  atleta: {
    id: string;
    nome_completo: string | null;
    whatsapp: string | null;
    responsavel: { id: string; nome: string | null; whatsapp: string | null } | null;
  } | null;
}

const EXPERIENCIA_CONTATO_SELECT =
  "id, atleta:atletas(id, nome_completo, whatsapp, responsavel:responsaveis(id, nome, whatsapp))";

/** Prioridade de destino: WhatsApp do responsável → do atleta (fallback). */
function telefoneDaExperiencia(exp: ExperienciaContato): string | null {
  const telefone = exp.atleta?.responsavel?.whatsapp ?? exp.atleta?.whatsapp ?? null;
  if (!telefone || soDigitos(telefone).length < WHATSAPP_DIGITOS_MIN) return null;
  return telefone;
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
    // A CF responde 200 mesmo quando o Z-API falha na ENTREGA — o resultado
    // real vem em results[].success (mesma checagem de mensagem-direta.ts).
    const corpo = (await response.json().catch(() => null)) as
      | { results?: Array<{ success?: boolean; error?: string }> }
      | null;
    const falho = Array.isArray(corpo?.results)
      ? corpo.results.find((r) => r?.success === false)
      : undefined;
    if (falho) {
      return {
        ok: false,
        error: falho.error
          ? `Falha na entrega: ${String(falho.error).slice(0, 200)}`
          : "O serviço de envio reportou falha na entrega.",
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

export interface DestinoTemplate {
  experienciaId: string;
  atletaNome: string;
  telefoneDestino: string;
}

const resolverDestinoSchema = z
  .object({
    experienciaId: z.string().uuid().nullish(),
    telefone: z
      .string()
      .trim()
      .max(30)
      .regex(/^[+\d()\-\s.]*$/, "Telefone inválido.")
      .nullish(),
    atletaNome: z.string().trim().max(160).nullish(),
  })
  .refine((v) => Boolean(v.experienciaId || v.telefone?.trim()), {
    message: "Informe a experiência ou um telefone.",
  });

/** Busca ids por WhatsApp: match exato primeiro (o valor exibido na UI veio
 *  verbatim do banco), depois pelos últimos 10 dígitos — sempre via filtros
 *  parametrizados (.eq/.like), nunca string de .or() com input do client. */
async function buscarIdsPorWhatsApp(
  supabase: Awaited<ReturnType<typeof createAuditedSupabaseClient>>,
  tabela: "responsaveis" | "atletas",
  telefoneRaw: string,
  tail: string,
): Promise<string[]> {
  const { data: exatos } = await supabase
    .from(tabela)
    .select("id")
    .eq("whatsapp", telefoneRaw)
    .is("deleted_at", null)
    .limit(5);
  if (exatos && exatos.length > 0) return exatos.map((r) => r.id);

  const { data: porTail } = await supabase
    .from(tabela)
    .select("id")
    .like("whatsapp", `%${tail}`)
    .is("deleted_at", null)
    .limit(5);
  return (porTail ?? []).map((r) => r.id);
}

/**
 * Resolve a família (crm_experiencia) e o número de destino do envio direto.
 * Preferência: experienciaId explícito; fallback: telefone exibido na UI
 * (que veio verbatim do banco) casado com responsaveis/atletas — com
 * desempate pelo nome do atleta quando fornecido.
 */
export async function resolverDestinoTemplate(input: {
  experienciaId?: string | null;
  telefone?: string | null;
  atletaNome?: string | null;
}): Promise<{ success: true; destino: DestinoTemplate } | { success: false; error: string }> {
  const papel = await requireWritePapel();
  if (!papel) return { success: false, error: "Sem permissão." };

  const parsed = resolverDestinoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createAuditedSupabaseClient();

  const montarDestino = (exp: ExperienciaContato): { success: true; destino: DestinoTemplate } | { success: false; error: string } => {
    const telefoneDestino = telefoneDaExperiencia(exp);
    if (!telefoneDestino) {
      return { success: false, error: "Família sem WhatsApp cadastrado." };
    }
    return {
      success: true,
      destino: {
        experienciaId: exp.id,
        atletaNome: exp.atleta?.nome_completo ?? "Atleta",
        telefoneDestino,
      },
    };
  };

  if (parsed.data.experienciaId) {
    const { data, error } = await supabase
      .from("crm_experiencia")
      .select(EXPERIENCIA_CONTATO_SELECT)
      .eq("id", parsed.data.experienciaId)
      .is("deleted_at", null)
      .single();
    if (error || !data) return { success: false, error: "Família não encontrada." };
    return montarDestino(data as unknown as ExperienciaContato);
  }

  // Fallback por telefone: match exato (valor veio do próprio banco) e, se
  // necessário, pelos últimos 10 dígitos (mesma heurística do calendar-webhook).
  const telefoneRaw = parsed.data.telefone!.trim();
  const tail = soDigitos(telefoneRaw).slice(-10);
  if (tail.length < WHATSAPP_DIGITOS_MIN) {
    return { success: false, error: "Telefone inválido." };
  }

  const atletaIds = new Set<string>();

  const responsavelIds = await buscarIdsPorWhatsApp(supabase, "responsaveis", telefoneRaw, tail);
  if (responsavelIds.length > 0) {
    const { data: atletasDoResp } = await supabase
      .from("atletas")
      .select("id")
      .in("responsavel_id", responsavelIds)
      .is("deleted_at", null)
      .limit(10);
    for (const a of atletasDoResp ?? []) atletaIds.add(a.id);
  }

  const atletasDiretos = await buscarIdsPorWhatsApp(supabase, "atletas", telefoneRaw, tail);
  for (const id of atletasDiretos) atletaIds.add(id);

  if (atletaIds.size === 0) {
    return { success: false, error: "Família não encontrada para este contato." };
  }

  const { data: experiencias } = await supabase
    .from("crm_experiencia")
    .select(EXPERIENCIA_CONTATO_SELECT)
    .in("atleta_id", Array.from(atletaIds))
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(5);

  const candidatas = (experiencias ?? []) as unknown as ExperienciaContato[];
  if (candidatas.length === 0) {
    return { success: false, error: "Família não encontrada para este contato." };
  }

  const nomeHint = parsed.data.atletaNome?.trim().toLowerCase();
  const escolhida =
    (nomeHint
      ? candidatas.find((c) => c.atleta?.nome_completo?.trim().toLowerCase() === nomeHint)
      : undefined) ?? candidatas[0];

  return montarDestino(escolhida);
}

const enviarTemplateSchema = z.object({
  experienciaId: z.string().uuid("Família inválida."),
  templateId: z.string().uuid("Template inválido."),
  textoFinal: z
    .string()
    .trim()
    .min(TEXTO_MIN, `Mensagem muito curta (mín ${TEXTO_MIN}).`)
    .max(TEXTO_MAX, `Mensagem muito longa (máx ${TEXTO_MAX}).`),
});

/**
 * Envia o texto final de um template direto pelo WhatsApp (CF send-whatsapp /
 * Z-API) e registra o contato na timeline da família. Head + CEO.
 */
export async function enviarTemplateWhatsApp(
  experienciaId: string,
  templateId: string,
  textoFinal: string,
): Promise<{ success: boolean; error?: string; detalhe?: string }> {
  const papel = await requireWritePapel();
  if (!papel) return { success: false, error: "Sem permissão." };

  const parsed = enviarTemplateSchema.safeParse({ experienciaId, templateId, textoFinal });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const cfUrl = process.env.SEND_WHATSAPP_URL;
  if (!cfUrl) {
    return { success: false, error: "SEND_WHATSAPP_URL não configurada no ambiente do Engine." };
  }

  const supabase = await createAuditedSupabaseClient();

  const { data: template, error: templateError } = await supabase
    .from("mensagem_templates")
    .select("id, nome, canal")
    .eq("id", parsed.data.templateId)
    .eq("ativo", true)
    .is("deleted_at", null)
    .single();
  if (templateError || !template) return { success: false, error: "Template não encontrado." };
  if (template.canal === "email") {
    return { success: false, error: "Este template é de e-mail — use o canal de e-mail." };
  }

  const { data: exp, error: expError } = await supabase
    .from("crm_experiencia")
    .select(EXPERIENCIA_CONTATO_SELECT)
    .eq("id", parsed.data.experienciaId)
    .is("deleted_at", null)
    .single();
  if (expError || !exp) return { success: false, error: "Família não encontrada." };

  const experiencia = exp as unknown as ExperienciaContato;
  const telefone = telefoneDaExperiencia(experiencia);
  if (!telefone) return { success: false, error: "Família sem WhatsApp cadastrado." };

  const atletaNome = experiencia.atleta?.nome_completo ?? "Atleta";

  const envio = await chamarCloudFunction(cfUrl, {
    // Só athlete_name no record: sem qualification_classification o filtro
    // FRIO da CF não é acionado — envio manual head/CEO nunca é bloqueado.
    record: { athlete_name: atletaNome },
    messageType: "meeting_confirmed",
    customMessage: parsed.data.textoFinal,
    phone: telefone,
  });

  console.log({
    level: envio.ok ? "info" : "error",
    action: "enviar_template_whatsapp",
    experienciaId: parsed.data.experienciaId,
    templateId: parsed.data.templateId,
    destino: maskTelefone(telefone),
    sucesso: envio.ok,
    ...(envio.ok ? {} : { erro: envio.error }),
  });

  if (!envio.ok) return { success: false, error: envio.error };

  // Registro pós-envio (timeline + último contato) — falha aqui NÃO derruba o
  // resultado: a mensagem JÁ foi enviada (mesmo padrão de mensagem-direta.ts).
  let detalhe = `Enviado para a família de ${atletaNome}.`;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const texto = parsed.data.textoFinal;
    const resumo = `${texto.slice(0, RESUMO_MAX)}${texto.length > RESUMO_MAX ? "…" : ""} [template ${template.nome}]`;

    const { error: contatoError } = await supabase.from("contatos_experiencia").insert({
      experiencia_id: parsed.data.experienciaId,
      tipo: "whatsapp",
      resumo,
      registrado_por: user?.id,
      created_by: user?.id,
    });

    const { error: updateError } = await supabase
      .from("crm_experiencia")
      .update({
        data_ultimo_contato: new Date().toISOString(),
        tipo_ultimo_contato: "whatsapp",
      })
      .eq("id", parsed.data.experienciaId);

    if (contatoError || updateError) {
      detalhe = `Enviado, mas o registro na timeline falhou: ${(contatoError ?? updateError)?.message}`;
    }
  } catch {
    detalhe = "Enviado, mas o registro na timeline falhou.";
  }

  revalidatePath("/familias-crm");
  revalidatePath("/familias-pipeline");
  return { success: true, detalhe };
}

// renderTemplate (função pura) movido para /lib/template-render.ts
// — arquivos com "use server" só podem exportar async functions.
