"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";
import { ETAPA_LABELS } from "@/types/crm";

// ─── Schemas (espelham src/types/automacao.ts) ──────────────────────────────

const condicaoSchema = z.object({
  campo: z.string().min(1, "Campo da condição é obrigatório"),
  operador: z.enum(["eq", "neq", "in", "gt", "gte", "lt", "lte"]),
  valor: z.union([z.string().min(1), z.number(), z.array(z.string().min(1)).min(1)]),
});

// Placeholders das ações custom (enviar_whatsapp_custom e enviar_email_custom)
// — espelham o render da engine (automation-engine): só {atleta_nome} e
// {responsavel_nome}. Typo ({foo}) chegaria LITERAL na mensagem do
// responsável — rejeitar na entrada.
const CUSTOM_PLACEHOLDERS = new Set(["atleta_nome", "responsavel_nome"]);
const CUSTOM_MENSAGEM_MIN = 10;
const CUSTOM_MENSAGEM_MAX = 1000;
// E-mail custom: assunto 3-150 e mensagem 10-2000 (e-mail comporta texto
// mais longo que o WhatsApp; limites espelhados em builder-shared.ts).
const EMAIL_ASSUNTO_MIN = 3;
const EMAIL_ASSUNTO_MAX = 150;
const EMAIL_MENSAGEM_MIN = 10;
const EMAIL_MENSAGEM_MAX = 2000;
// Link/mídia das ações custom (I2): título do card/botão 3-80 (espelhado em
// builder-shared.ts). URLs sempre http(s) — o WhatsApp/e-mail precisam de
// URL pública resolvível (e https evita scheme injection tipo javascript:).
const LINK_TITULO_MIN = 3;
const LINK_TITULO_MAX = 80;

const urlHttpSchema = z
  .string()
  .url("URL inválida")
  .max(500, "URL muito longa (máximo 500 caracteres)")
  .refine((u) => /^https?:\/\//i.test(u), "A URL deve começar com http:// ou https://");

const linkTituloSchema = z
  .string()
  .min(LINK_TITULO_MIN, `Título do link muito curto (mínimo ${LINK_TITULO_MIN} caracteres)`)
  .max(LINK_TITULO_MAX, `Título do link muito longo (máximo ${LINK_TITULO_MAX} caracteres)`);

// Rejeita variáveis fora do catálogo (padrão existente: regex [a-zA-Z0-9_]
// captura variantes maiúsculas/typos e falha cedo).
const semPlaceholderDesconhecido = (texto: string, ctx: z.RefinementCtx) => {
  const tokens = texto.match(/\{[a-zA-Z0-9_]+\}/g) ?? [];
  for (const token of tokens) {
    if (!CUSTOM_PLACEHOLDERS.has(token.slice(1, -1))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          `Variável desconhecida ${token} — válidas: ` +
          `${[...CUSTOM_PLACEHOLDERS].map((p) => `{${p}}`).join(", ")}`,
      });
    }
  }
};

const acaoSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("criar_tarefa"),
    parametros: z.object({
      titulo: z.string().min(3, "Título da tarefa muito curto"),
      descricao: z.string().optional(),
      prioridade: z.enum(["critica", "alta", "media", "baixa"]),
      prazo_dias: z.number().int().min(0).max(365),
      responsavel_id: z.string().uuid("Responsável inválido"),
    }),
  }),
  z.object({
    tipo: z.literal("criar_notificacao"),
    parametros: z.object({
      titulo: z.string().min(3, "Título da notificação muito curto"),
      mensagem: z.string().min(3, "Mensagem muito curta"),
      severidade: z.enum(["critica", "alta", "media", "baixa"]),
      destinatario: z.enum(["ceo", "head_sucesso", "responsavel"]),
    }),
  }),
  z.object({
    tipo: z.literal("enviar_whatsapp"),
    parametros: z.object({
      template: z.enum([
        "initial",
        "followup_1",
        "followup_2",
        "early_potential",
        "late_timing",
        "scheduled_return",
      ]),
    }),
  }),
  z.object({
    tipo: z.literal("enviar_whatsapp_custom"),
    parametros: z
      .object({
        // A engine reaplica a classe (só QUENTE/MORNO — FRIO nunca recebe) e
        // envia ao responsável (guardian_whatsapp) via caminho custom da CF.
        mensagem: z
          .string()
          .min(CUSTOM_MENSAGEM_MIN, `Mensagem muito curta (mínimo ${CUSTOM_MENSAGEM_MIN} caracteres)`)
          .max(CUSTOM_MENSAGEM_MAX, `Mensagem muito longa (máximo ${CUSTOM_MENSAGEM_MAX} caracteres)`)
          .superRefine(semPlaceholderDesconhecido),
        destinatario: z.literal("responsavel"),
        // Link/mídia opcionais (I2): com link_url o envio sai via /send-link
        // (card clicável). imagem_url é a imagem do PREVIEW do card — sem
        // link não há card, logo exige link_url (refine abaixo).
        link_url: urlHttpSchema.optional(),
        link_titulo: linkTituloSchema.optional(),
        imagem_url: urlHttpSchema.optional(),
      })
      .superRefine((p, ctx) => {
        if (!p.link_url && (p.imagem_url || p.link_titulo)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Imagem/título do card exigem a URL do link — sem link o WhatsApp sai como texto simples",
          });
        }
      }),
  }),
  z.object({
    tipo: z.literal("enviar_email_custom"),
    parametros: z
      .object({
        // A engine reaplica a classe (só QUENTE/MORNO — FRIO nunca recebe) e
        // envia ao e-mail do lead via caminho customEmail da CF send-messages.
        // Placeholders valem no assunto E na mensagem (a engine renderiza ambos).
        assunto: z
          .string()
          .min(EMAIL_ASSUNTO_MIN, `Assunto muito curto (mínimo ${EMAIL_ASSUNTO_MIN} caracteres)`)
          .max(EMAIL_ASSUNTO_MAX, `Assunto muito longo (máximo ${EMAIL_ASSUNTO_MAX} caracteres)`)
          .superRefine(semPlaceholderDesconhecido),
        mensagem: z
          .string()
          .min(EMAIL_MENSAGEM_MIN, `Mensagem muito curta (mínimo ${EMAIL_MENSAGEM_MIN} caracteres)`)
          .max(EMAIL_MENSAGEM_MAX, `Mensagem muito longa (máximo ${EMAIL_MENSAGEM_MAX} caracteres)`)
          .superRefine(semPlaceholderDesconhecido),
        destinatario: z.literal("responsavel"),
        // Link/mídia opcionais (I2): imagem embutida no topo do corpo;
        // link vira botão/CTA (rótulo = link_titulo, default "Saiba mais").
        // Imagem standalone é válida no e-mail; título de botão sem link não.
        link_url: urlHttpSchema.optional(),
        link_titulo: linkTituloSchema.optional(),
        imagem_url: urlHttpSchema.optional(),
      })
      .superRefine((p, ctx) => {
        if (!p.link_url && p.link_titulo) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Texto do botão exige a URL do link — sem link não há botão no e-mail",
          });
        }
      }),
  }),
  z.object({
    tipo: z.literal("mover_deal"),
    parametros: z.object({
      etapa_destino: z.string().min(1, "Etapa de destino é obrigatória"),
      // Regra inviolável nº 2: mover deal exige próxima ação definida
      next_action: z.string().min(3, "Próxima ação é obrigatória ao mover deal"),
      proxima_acao_dias: z.number().int().min(0).max(90),
    }),
  }),
]);

const automacaoSchema = z
  .object({
    nome: z.string().min(3, "Nome muito curto").max(120),
    descricao: z.string().max(500).optional(),
    gatilho: z.enum([
      "lead_qualificado",
      "deal_etapa_mudou",
      "reuniao_marcada",
      "temperatura_vermelha",
      "deal_parado_etapa",
      "parcela_vencendo",
      "parcela_atrasada",
      "familia_sem_contato",
      "tarefa_vencida",
      "agendamento",
    ]),
    gatilho_config: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
    condicoes: z.array(condicaoSchema).max(10).default([]),
    acoes: z.array(acaoSchema).min(1, "Adicione pelo menos uma ação").max(5),
  })
  // Gatilho deal_etapa_mudou: etapa_para é OPCIONAL (ausente = qualquer
  // transição), mas quando presente precisa ser uma etapa válida do pipeline
  // — typo silencioso faria a engine ignorar TODOS os runs da automação.
  .superRefine((v, ctx) => {
    if (v.gatilho !== "deal_etapa_mudou") return;
    const etapaPara = v.gatilho_config.etapa_para;
    if (etapaPara === undefined) return;
    if (typeof etapaPara !== "string" || !(etapaPara in ETAPA_LABELS)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Etapa de destino inválida — escolha uma etapa do pipeline ou deixe vazio",
      });
    }
  })
  // Gatilho agendamento: valida a config recorrente (frequencia/hora/dia) —
  // a engine só dispara quando a hora BRT bate, então config inválida = nunca.
  .superRefine((v, ctx) => {
    if (v.gatilho !== "agendamento") return;
    const cfg = v.gatilho_config;
    const frequencia = cfg.frequencia;
    if (frequencia !== "diaria" && frequencia !== "semanal" && frequencia !== "mensal") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Frequência do agendamento deve ser diária, semanal ou mensal",
      });
      return;
    }
    const hora = cfg.hora;
    if (typeof hora !== "number" || !Number.isInteger(hora) || hora < 0 || hora > 23) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Hora do agendamento deve ser um inteiro entre 0 e 23",
      });
    }
    if (frequencia === "semanal") {
      const diaSemana = cfg.dia_semana;
      if (
        typeof diaSemana !== "number" ||
        !Number.isInteger(diaSemana) ||
        diaSemana < 0 ||
        diaSemana > 6
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Dia da semana deve ser um inteiro entre 0 (domingo) e 6 (sábado)",
        });
      }
    }
    if (frequencia === "mensal") {
      const diaMes = cfg.dia_mes;
      if (typeof diaMes !== "number" || !Number.isInteger(diaMes) || diaMes < 1 || diaMes > 28) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Dia do mês deve ser um inteiro entre 1 e 28",
        });
      }
    }
  });

export type AutomacaoInput = z.input<typeof automacaoSchema>;

interface ActionResult {
  success: boolean;
  error?: string;
  id?: string;
}

async function requireCeo(): Promise<string | null> {
  const papel = await getUserPapel();
  return papel === "ceo" ? null : "Apenas o CEO pode gerenciar automações.";
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function criarAutomacao(input: AutomacaoInput): Promise<ActionResult> {
  const denied = await requireCeo();
  if (denied) return { success: false, error: denied };

  const parsed = automacaoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    const { data, error } = await supabase
      .from("automacoes")
      .insert({
        nome: parsed.data.nome,
        descricao: parsed.data.descricao ?? null,
        gatilho: parsed.data.gatilho,
        gatilho_config: parsed.data.gatilho_config,
        condicoes: parsed.data.condicoes,
        acoes: parsed.data.acoes,
        ativo: false, // nasce pausada — ativar é gesto explícito
      })
      .select("id")
      .single();

    if (error) return { success: false, error: error.message };
    revalidatePath("/automacoes");
    return { success: true, id: data.id };
  } catch (err) {
    console.error({ level: "error", action: "criar_automacao", error: String(err) });
    return { success: false, error: "Erro inesperado ao criar automação." };
  }
}

export async function atualizarAutomacao(
  id: string,
  input: AutomacaoInput,
): Promise<ActionResult> {
  const denied = await requireCeo();
  if (denied) return { success: false, error: denied };
  if (!z.string().uuid().safeParse(id).success) {
    return { success: false, error: "ID inválido" };
  }

  const parsed = automacaoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    const { data, error } = await supabase
      .from("automacoes")
      .update({
        nome: parsed.data.nome,
        descricao: parsed.data.descricao ?? null,
        gatilho: parsed.data.gatilho,
        gatilho_config: parsed.data.gatilho_config,
        condicoes: parsed.data.condicoes,
        acoes: parsed.data.acoes,
      })
      .eq("id", id)
      .is("deleted_at", null)
      // Âncoras de sistema (Fase 2b) não são editáveis pelo builder
      .neq("gatilho", "sistema")
      .select("id");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: "Automação não encontrada (ou é uma automação do sistema)." };
    }
    revalidatePath("/automacoes");
    return { success: true, id };
  } catch (err) {
    console.error({ level: "error", action: "atualizar_automacao", id, error: String(err) });
    return { success: false, error: "Erro inesperado ao atualizar automação." };
  }
}

export async function alternarAtivoAutomacao(id: string, ativo: boolean): Promise<ActionResult> {
  const denied = await requireCeo();
  if (denied) return { success: false, error: denied };
  if (!z.string().uuid().safeParse(id).success) {
    return { success: false, error: "ID inválido" };
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    const { data, error } = await supabase
      .from("automacoes")
      .update({ ativo })
      .eq("id", id)
      .is("deleted_at", null)
      // Âncoras de sistema (Fase 2b): nunca ativas — a engine não pode vê-las
      .neq("gatilho", "sistema")
      .select("id");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: "Automação não encontrada (ou é uma automação do sistema)." };
    }
    revalidatePath("/automacoes");
    return { success: true, id };
  } catch (err) {
    console.error({ level: "error", action: "alternar_automacao", id, error: String(err) });
    return { success: false, error: "Erro inesperado ao alterar status." };
  }
}

// Intervalos das automações NATIVAS (schedulers de WhatsApp). As CFs leem esta
// chave com clamp 1h-720h próprio (guard de CI) — o Zod espelha o mesmo range.
const intervalosSchema = z
  .object({
    whatsapp_inicial_horas: z.number().int().min(1).max(720),
    whatsapp_timing_alt_horas: z.number().int().min(1).max(720),
    followup_1_horas: z.number().int().min(1).max(720),
    followup_2_horas: z.number().int().min(1).max(720),
  })
  // Ambos os cutoffs medem de whatsapp_sent_at — FU2 <= FU1 colapsaria o
  // espaçamento (lead receberia FU1 e FU2 em ticks consecutivos).
  .refine((v) => v.followup_2_horas > v.followup_1_horas, {
    message: "Follow-up 2 deve ter intervalo maior que o Follow-up 1",
  });

export type SchedulerIntervalos = z.infer<typeof intervalosSchema>;

/** Atualiza os intervalos das automações do sistema (configuracoes_sistema.
 *  scheduler_intervalos). Efeito no próximo tick dos schedulers (1x/hora). */
export async function atualizarIntervalosScheduler(
  input: SchedulerIntervalos,
): Promise<ActionResult> {
  const denied = await requireCeo();
  if (denied) return { success: false, error: denied };

  const parsed = intervalosSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Intervalos inválidos (1-720h)" };
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    const { data, error } = await supabase
      .from("configuracoes_sistema")
      .update({ valor: parsed.data })
      .eq("chave", "scheduler_intervalos")
      .select("chave");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: "Config scheduler_intervalos não encontrada (migration pendente?)" };
    }
    revalidatePath("/automacoes");
    return { success: true };
  } catch (err) {
    console.error({ level: "error", action: "atualizar_intervalos_scheduler", error: String(err) });
    return { success: false, error: "Erro inesperado ao salvar intervalos." };
  }
}

// Textos das mensagens automáticas de WhatsApp (configuracoes_sistema.
// scheduler_mensagens). A CF send-whatsapp usa estes textos quando existem;
// os builders hardcoded dela são o fallback permanente (guard de CI
// tests/send-whatsapp-mensagens.test.js) — texto vazio jamais é enviado.
const MENSAGEM_MIN = 10;
const MENSAGEM_MAX = 2000;

const mensagemTextoSchema = z
  .string()
  .min(MENSAGEM_MIN, `Texto muito curto (mínimo ${MENSAGEM_MIN} caracteres)`)
  .max(MENSAGEM_MAX, `Texto muito longo (máximo ${MENSAGEM_MAX} caracteres)`);

const mensagemParSchema = z.object({
  atleta: mensagemTextoSchema,
  responsavel: mensagemTextoSchema,
});

// meeting_confirmed (calendar-webhook) tem shape { lead, ceo } — DIFERENTE
// dos demais templates { atleta, responsavel }: lead = confirmação enviada
// à família; ceo = notificação interna ao CEO.
const mensagemParReuniaoSchema = z.object({
  lead: mensagemTextoSchema,
  ceo: mensagemTextoSchema,
});

// Guarda de placeholders: typo ({foo}) chegaria LITERAL na mensagem do lead,
// e remover {agenda_url} do texto do responsável quebraria o link de
// agendamento (a conversão do funil) em silêncio.
const PLACEHOLDERS_PADRAO = new Set([
  "atleta_nome",
  "responsavel_nome",
  "agenda_url",
  "proximo_ano",
]);
// meeting_confirmed (calendar-webhook, buildMeetingVars): variáveis próprias.
// {meet_link} é opcional nos textos — o link do Meet SEMPRE vai anexado como
// preview do WhatsApp (sendLinkMessage), independente do texto.
const PLACEHOLDERS_MEETING = new Set([
  "atleta_nome",
  "responsavel_nome",
  "telefone",
  "email",
  "meet_link",
  "data_reuniao",
  "hora_reuniao",
]);
const TEMPLATES_COM_AGENDA = ["initial", "followup_1", "followup_2", "scheduled_return"];

const mensagensSchema = z
  .object({
    initial: mensagemParSchema,
    followup_1: mensagemParSchema,
    followup_2: mensagemParSchema,
    early_potential: mensagemParSchema,
    late_timing: mensagemParSchema,
    scheduled_return: mensagemParSchema,
    // Opcional: ambientes sem a migration meeting_confirmed continuam
    // salvando os demais templates (o calendar-webhook tem fallback próprio).
    meeting_confirmed: mensagemParReuniaoSchema.optional(),
  })
  .superRefine((valor, ctx) => {
    for (const [template, par] of Object.entries(valor)) {
      if (!par) continue; // meeting_confirmed ausente (migration pendente)
      const validos =
        template === "meeting_confirmed" ? PLACEHOLDERS_MEETING : PLACEHOLDERS_PADRAO;
      for (const [destinatario, texto] of Object.entries(par)) {
        const tokens = texto.match(/\{[a-zA-Z0-9_]+\}/g) ?? [];
        for (const token of tokens) {
          if (!validos.has(token.slice(1, -1))) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message:
                `Variável desconhecida ${token} em ${template} (${destinatario}) — ` +
                `válidas: ${[...validos].map((p) => `{${p}}`).join(", ")}`,
            });
          }
        }
      }
      if (
        TEMPLATES_COM_AGENDA.includes(template) &&
        "responsavel" in par &&
        !par.responsavel.includes("{agenda_url}")
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `O texto do responsável em ${template} precisa conter {agenda_url} — é o link de agendamento da reunião`,
        });
      }
    }
  });

export type SchedulerMensagens = z.infer<typeof mensagensSchema>;

/** Atualiza os textos das mensagens automáticas (os 12 pares atleta/
 *  responsável obrigatórios + meeting_confirmed {lead, ceo} opcional — o
 *  objeto inteiro é reescrito). Vale a partir do próximo envio das CFs. */
export async function atualizarMensagensScheduler(
  input: SchedulerMensagens,
): Promise<ActionResult> {
  const denied = await requireCeo();
  if (denied) return { success: false, error: denied };

  const parsed = mensagensSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Textos inválidos (10-2000 caracteres)",
    };
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    const { data, error } = await supabase
      .from("configuracoes_sistema")
      .update({ valor: parsed.data })
      .eq("chave", "scheduler_mensagens")
      .select("chave");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: "Config scheduler_mensagens não encontrada (migration pendente?)" };
    }
    revalidatePath("/automacoes");
    return { success: true };
  } catch (err) {
    console.error({ level: "error", action: "atualizar_mensagens_scheduler", error: String(err) });
    return { success: false, error: "Erro inesperado ao salvar mensagens." };
  }
}

// ─── Config das automações de SISTEMA (Fase 2a — toggles/e-mail/prompt) ─────
// As CFs leem estas chaves com FAIL-OPEN (campo ausente = comportamento
// histórico); as actions gravam o objeto COMPLETO (padrão das demais).

/** Slugs dos toggles — espelham os gates `ativas.<slug> === false` das CFs
 *  (guard de CI tests/sistema-automacoes-ativas.test.js). `catchall(boolean)`
 *  em vez de `.strict()`: um slug futuro gravado por outra versão não pode
 *  quebrar TODO save de toggle (forward-compat; as CFs são fail-open). */
const ativasSchema = z
  .object({
    whatsapp_inicial: z.boolean().optional(),
    whatsapp_timing_alt: z.boolean().optional(),
    followup_1: z.boolean().optional(),
    followup_2: z.boolean().optional(),
    scheduled_return: z.boolean().optional(),
    qualificacao: z.boolean().optional(),
    email_confirmacao: z.boolean().optional(),
    email_interno: z.boolean().optional(),
    confirmacao_reuniao: z.boolean().optional(),
  })
  .catchall(z.boolean());

export type SistemaAtivas = z.infer<typeof ativasSchema>;

/** Liga/desliga automações de sistema (configuracoes_sistema.
 *  sistema_automacoes_ativas). Campo ausente = ATIVA (fail-open nas CFs);
 *  efeito no próximo tick/envio. */
export async function atualizarAtivasSistema(input: SistemaAtivas): Promise<ActionResult> {
  const denied = await requireCeo();
  if (denied) return { success: false, error: denied };

  const parsed = ativasSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Toggles inválidos" };
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    const { data, error } = await supabase
      .from("configuracoes_sistema")
      .update({ valor: parsed.data })
      .eq("chave", "sistema_automacoes_ativas")
      .select("chave");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: "Config sistema_automacoes_ativas não encontrada (migration pendente?)" };
    }
    revalidatePath("/automacoes");
    return { success: true };
  } catch (err) {
    console.error({ level: "error", action: "atualizar_ativas_sistema", error: String(err) });
    return { success: false, error: "Erro inesperado ao salvar toggles." };
  }
}

const emailConfigSchema = z.object({
  /** Vazio/ausente → a CF usa a env INTERNAL_EMAIL (fallback). */
  destino_interno: z.string().trim().email("E-mail de destino inválido").max(200).optional(),
});

export type SistemaEmailConfig = z.infer<typeof emailConfigSchema>;

/** Atualiza o destino do e-mail interno de novo lead (configuracoes_sistema.
 *  email_config). String vazia remove o override (volta ao fallback da env). */
export async function atualizarEmailConfig(input: {
  destino_interno?: string;
}): Promise<ActionResult> {
  const denied = await requireCeo();
  if (denied) return { success: false, error: denied };

  // '' = limpar override → grava {} (a CF cai no fallback env INTERNAL_EMAIL)
  const normalizado: SistemaEmailConfig = {};
  if (typeof input.destino_interno === "string" && input.destino_interno.trim()) {
    normalizado.destino_interno = input.destino_interno.trim();
  }
  const parsed = emailConfigSchema.safeParse(normalizado);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "E-mail inválido" };
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    const { data, error } = await supabase
      .from("configuracoes_sistema")
      .update({ valor: parsed.data })
      .eq("chave", "email_config")
      .select("chave");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: "Config email_config não encontrada (migration pendente?)" };
    }
    revalidatePath("/automacoes");
    return { success: true };
  } catch (err) {
    console.error({ level: "error", action: "atualizar_email_config", error: String(err) });
    return { success: false, error: "Erro inesperado ao salvar e-mail." };
  }
}

// Seções editáveis do prompt Gemini de qualificação. Seção ausente/vazia →
// a CF usa o default do código (fail-open). Limite folgado por seção; o
// contrato de saída JSON permanece fixo na CF (não é editável).
const PROMPT_SECAO_MAX = 4000;
// Único placeholder válido nas seções (substituído pela CF na montagem).
const PROMPT_PLACEHOLDER_VALIDO = "{criterio_endereco}";
const promptCfgSchema = z
  .object({
    persona: z.string().trim().max(PROMPT_SECAO_MAX).optional(),
    criterio_quente: z.string().trim().max(PROMPT_SECAO_MAX).optional(),
    criterio_morno: z.string().trim().max(PROMPT_SECAO_MAX).optional(),
    morno_endereco_br: z.string().trim().max(PROMPT_SECAO_MAX).optional(),
    morno_endereco_internacional: z.string().trim().max(PROMPT_SECAO_MAX).optional(),
    criterio_frio: z.string().trim().max(PROMPT_SECAO_MAX).optional(),
    regra_renda_variavel: z.string().trim().max(PROMPT_SECAO_MAX).optional(),
    regras_importantes: z.string().trim().max(PROMPT_SECAO_MAX).optional(),
  })
  // Seções futuras gravadas por outra versão não quebram o save (forward-compat)
  .catchall(z.string().trim().max(PROMPT_SECAO_MAX))
  // Invariantes que a CF depende (mesma classe de guard do scheduler_mensagens:
  // "remover {agenda_url} quebraria em silêncio"):
  .superRefine((val, ctx) => {
    // 1) criterio_morno customizado DEVE manter o placeholder — sem ele o
    //    critério de endereço some de TODA qualificação (MORNO vira FRIO).
    if (val.criterio_morno && !val.criterio_morno.includes(PROMPT_PLACEHOLDER_VALIDO)) {
      ctx.addIssue({
        code: "custom",
        message: `O critério MORNO deve conter ${PROMPT_PLACEHOLDER_VALIDO} (substituído pela variante BR/internacional).`,
      });
    }
    // 2) Placeholder desconhecido chegaria LITERAL no prompt (typo silencioso).
    for (const [chave, texto] of Object.entries(val)) {
      if (typeof texto !== "string") continue;
      for (const m of texto.matchAll(/\{[a-z_]+\}/g)) {
        if (m[0] !== PROMPT_PLACEHOLDER_VALIDO) {
          ctx.addIssue({
            code: "custom",
            message: `Placeholder desconhecido ${m[0]} em "${chave}" — só ${PROMPT_PLACEHOLDER_VALIDO} é substituído.`,
          });
        }
      }
    }
    // 3) Âncoras de classe: o parser da CF espera QUENTE/MORNO/FRIO — critério
    //    sem o próprio rótulo desorienta o Gemini (classe fora do contrato).
    const ancoras: [keyof typeof val, string][] = [
      ["criterio_quente", "QUENTE"],
      ["criterio_morno", "MORNO"],
      ["criterio_frio", "FRIO"],
    ];
    for (const [chave, rotulo] of ancoras) {
      const texto = val[chave];
      if (typeof texto === "string" && texto && !texto.includes(rotulo)) {
        ctx.addIssue({
          code: "custom",
          message: `O critério deve conter o rótulo ${rotulo} (contrato de saída da qualificação).`,
        });
      }
    }
  });

export type QualificacaoPromptInput = Partial<
  Record<
    | "persona"
    | "criterio_quente"
    | "criterio_morno"
    | "morno_endereco_br"
    | "morno_endereco_internacional"
    | "criterio_frio"
    | "regra_renda_variavel"
    | "regras_importantes",
    string
  >
>;

/** Atualiza as seções editáveis do prompt de qualificação (configuracoes_
 *  sistema.qualificacao_prompt). Só OVERRIDES são gravados — seção vazia é
 *  omitida (a CF continua no default do código, que é a fonte da verdade e
 *  evolui sem "congelar" texto antigo). */
export async function atualizarQualificacaoPrompt(
  input: QualificacaoPromptInput,
): Promise<ActionResult> {
  const denied = await requireCeo();
  if (denied) return { success: false, error: denied };

  // Remove campos vazios (voltam ao default do código)
  const semVazios: Record<string, string> = {};
  for (const [k, v] of Object.entries(input)) {
    if (typeof v === "string" && v.trim()) semVazios[k] = v;
  }
  const parsed = promptCfgSchema.safeParse(semVazios);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? `Seções inválidas (máx ${PROMPT_SECAO_MAX} caracteres)`,
    };
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    const { data, error } = await supabase
      .from("configuracoes_sistema")
      .update({ valor: parsed.data })
      .eq("chave", "qualificacao_prompt")
      .select("chave");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: "Config qualificacao_prompt não encontrada (migration pendente?)" };
    }
    revalidatePath("/automacoes");
    return { success: true };
  } catch (err) {
    console.error({ level: "error", action: "atualizar_qualificacao_prompt", error: String(err) });
    return { success: false, error: "Erro inesperado ao salvar o prompt." };
  }
}

/** Reenfileira um run que terminou em erro (replay manual do CEO).
 *  Zera tentativas e volta a 'pendente' — a engine reprocessa no próximo tick.
 *  Idempotência de envio é garantida pela engine (CAS nas colunas *_sent_at). */
export async function reprocessarRun(runId: string): Promise<ActionResult> {
  const denied = await requireCeo();
  if (denied) return { success: false, error: denied };
  if (!z.string().uuid().safeParse(runId).success) {
    return { success: false, error: "ID inválido" };
  }

  try {
    const supabase = await createAuditedSupabaseClient();

    // Runs de automações de SISTEMA (âncoras gatilho='sistema', registrados
    // pelas Cloud Functions) nascem em estado TERMINAL e não têm ações que a
    // engine saiba executar — reenfileirar criaria um run zumbi. Bloquear.
    const { data: runInfo, error: runInfoError } = await supabase
      .from("automacao_runs")
      .select("id, automacoes(gatilho)")
      .eq("id", runId)
      .maybeSingle();

    if (runInfoError) return { success: false, error: runInfoError.message };
    if (!runInfo) return { success: false, error: "Execução não encontrada." };
    const automacaoDoRun = runInfo.automacoes as { gatilho?: string } | null;
    if (automacaoDoRun?.gatilho === "sistema") {
      return {
        success: false,
        error: "Execuções de automações do sistema não são reprocessáveis por aqui.",
      };
    }

    const { data, error } = await supabase
      .from("automacao_runs")
      .update({ status: "pendente", tentativas: 0, proxima_tentativa_at: null })
      .eq("id", runId)
      .eq("status", "erro")
      .select("id");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: "Run não está em erro (talvez já reprocessado)." };
    }
    revalidatePath("/automacoes");
    return { success: true, id: runId };
  } catch (err) {
    console.error({ level: "error", action: "reprocessar_run", runId, error: String(err) });
    return { success: false, error: "Erro inesperado ao reprocessar." };
  }
}

export async function excluirAutomacao(id: string): Promise<ActionResult> {
  const denied = await requireCeo();
  if (denied) return { success: false, error: denied };
  if (!z.string().uuid().safeParse(id).success) {
    return { success: false, error: "ID inválido" };
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    // Soft delete + pausa (engine ignora automações deletadas/pausadas)
    const { data, error } = await supabase
      .from("automacoes")
      .update({ deleted_at: new Date().toISOString(), ativo: false })
      .eq("id", id)
      .is("deleted_at", null)
      // Âncoras de sistema (Fase 2b): não excluíveis (as CFs as referenciam)
      .neq("gatilho", "sistema")
      .select("id");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: "Automação não encontrada (ou é uma automação do sistema)." };
    }
    revalidatePath("/automacoes");
    return { success: true, id };
  } catch (err) {
    console.error({ level: "error", action: "excluir_automacao", id, error: String(err) });
    return { success: false, error: "Erro inesperado ao excluir automação." };
  }
}
