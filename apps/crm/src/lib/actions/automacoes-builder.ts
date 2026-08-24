"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";
import { QUALIFICACAO_V2_PROMPT_MAX } from "@/lib/automacoes/qualificacao-v2-defaults";
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
        "reactivation",
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
  z.object({
    tipo: z.literal("ia_prompt"),
    parametros: z.object({
      // SEGURANÇA POR DESIGN: o texto gerado pela IA NUNCA sai por canal
      // externo — vira notificação in-app ou tarefa interna (o CEO revisa e
      // envia). A engine impõe teto de execuções de IA por tick e, sem
      // GEMINI_API_KEY, marca o run com erro claro (guard de CI).
      // Agent CUSTOM (capacidade `automacao`): quando presente, a engine usa
      // o prompt do agent; o prompt inline continua OBRIGATÓRIO e é o
      // fallback garantido (agent inativo/deletado nunca quebra o run).
      agent_id: z.string().uuid().optional(),
      prompt: z
        .string()
        .min(10, "Prompt muito curto (mínimo 10 caracteres)")
        .max(4000, "Prompt muito longo (máximo 4000 caracteres)")
        .superRefine(semPlaceholderDesconhecido),
      resultado: z.enum(["notificacao", "tarefa"]),
      destinatario: z.enum(["ceo", "head_sucesso"]),
      titulo: z
        .string()
        .min(3, "Título muito curto (mínimo 3 caracteres)")
        .max(120, "Título muito longo (máximo 120 caracteres)")
        .superRefine(semPlaceholderDesconhecido),
    }),
  }),
]);

// Passo de CONDIÇÃO POR IA (ia_condicao): prompt DECISÓRIO (a IA responde
// SIM/NÃO). Mesma whitelist de placeholders das demais ações de IA. A IA aqui
// NUNCA envia nada externo — só decide se o fluxo prossegue (fail-closed na
// engine). Limites menores que o ia_prompt (é um gate, não um texto longo).
const IA_CONDICAO_PROMPT_MIN = 10;
const IA_CONDICAO_PROMPT_MAX = 2000;
const IA_CONDICAO_ROTULO_MAX = 80;
// Teto de passos no fluxo (protege o timeout da engine — espelhado no PASSOS_MAX
// da CF) e de passos de IA por automação (cada chamada de IA custa deadline +
// conta no teto IA_MAX_PER_TICK da engine). Sem `export`: arquivo "use server"
// só exporta funções async (o builder-shared tem as próprias cópias p/ a UI).
const PASSOS_MAX = 12;
const PASSOS_IA_MAX = 4;

const passoSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("condicao"), condicao: condicaoSchema }),
  z.object({
    tipo: z.literal("ia_condicao"),
    // Agent CUSTOM (capacidade `automacao`): quando presente, a engine usa o
    // prompt do agent; o prompt inline continua OBRIGATÓRIO e é o fallback
    // garantido (agent inativo/deletado nunca quebra o gate).
    agent_id: z.string().uuid().optional(),
    prompt: z
      .string()
      .min(IA_CONDICAO_PROMPT_MIN, `Prompt da IA muito curto (mínimo ${IA_CONDICAO_PROMPT_MIN} caracteres)`)
      .max(IA_CONDICAO_PROMPT_MAX, `Prompt da IA muito longo (máximo ${IA_CONDICAO_PROMPT_MAX} caracteres)`)
      .superRefine(semPlaceholderDesconhecido),
    rotulo: z.string().max(IA_CONDICAO_ROTULO_MAX, "Rótulo muito longo").optional(),
  }),
  z.object({ tipo: z.literal("acao"), acao: acaoSchema }),
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
      "nps_registrado",
      "crise_registrada",
      "onboarding_etapa_atrasada",
      "indicacao_convertida",
    ]),
    gatilho_config: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
    condicoes: z.array(condicaoSchema).max(10).default([]),
    // acoes deixa de ser obrigatório no schema: o fluxo por passos leva a ação
    // dentro de `passos`. O superRefine abaixo exige ação em UM dos dois modos.
    acoes: z.array(acaoSchema).max(5).default([]),
    passos: z.array(passoSchema).max(PASSOS_MAX, `Máximo de ${PASSOS_MAX} passos`).default([]),
  })
  // Modo por PASSOS vs LEGADO: exatamente um deles precisa ter ação.
  //  - passos não-vazio  → precisa de ≥1 passo de ação; teto de passos de IA.
  //  - passos vazio       → precisa de ≥1 ação (regra histórica do modo simples).
  .superRefine((v, ctx) => {
    if (v.passos.length > 0) {
      if (!v.passos.some((p) => p.tipo === "acao")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "O fluxo por passos precisa de pelo menos uma ação.",
        });
      }
      const iaPassos = v.passos.filter(
        (p) => p.tipo === "ia_condicao" || (p.tipo === "acao" && p.acao.tipo === "ia_prompt"),
      ).length;
      if (iaPassos > PASSOS_IA_MAX) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Máximo de ${PASSOS_IA_MAX} passos de IA por automação (custo e tempo da engine).`,
        });
      }
    } else if (v.acoes.length < 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Adicione pelo menos uma ação" });
    }
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
        // Mutuamente exclusivo: com passos, o modelo legado zera (a engine
        // roda por passos e ignoraria condicoes/acoes — não guardar lixo).
        ...camposModelo(parsed.data),
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

/** Grava exatamente UM modelo: com passos, o legado (condicoes/acoes) é zerado;
 *  sem passos, passos fica []. Fonte única da regra de exclusividade. */
function camposModelo(data: { condicoes: unknown[]; acoes: unknown[]; passos: unknown[] }) {
  const temPassos = data.passos.length > 0;
  return {
    condicoes: temPassos ? [] : data.condicoes,
    acoes: temPassos ? [] : data.acoes,
    passos: temPassos ? data.passos : [],
  };
}

/** Clona uma automação existente — a cópia nasce PAUSADA com nome "(cópia)".
 *  Âncoras de sistema (gatilho='sistema') não são cloneáveis. */
export async function duplicarAutomacao(id: string): Promise<ActionResult> {
  const denied = await requireCeo();
  if (denied) return { success: false, error: denied };
  if (!z.string().uuid().safeParse(id).success) {
    return { success: false, error: "ID inválido" };
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    const { data: origem, error: origemError } = await supabase
      .from("automacoes")
      .select("nome, descricao, gatilho, gatilho_config, condicoes, acoes, passos")
      .eq("id", id)
      .is("deleted_at", null)
      .neq("gatilho", "sistema")
      .maybeSingle();

    if (origemError) return { success: false, error: origemError.message };
    if (!origem) {
      return { success: false, error: "Automação não encontrada (ou é uma automação do sistema)." };
    }

    // Sufixo antes do corte: o nome final respeita o max 120 do schema
    const nome = `${origem.nome} (cópia)`.slice(0, 120);
    const { data, error } = await supabase
      .from("automacoes")
      .insert({
        nome,
        descricao: origem.descricao,
        gatilho: origem.gatilho,
        gatilho_config: origem.gatilho_config,
        condicoes: origem.condicoes,
        acoes: origem.acoes,
        passos: origem.passos ?? [],
        ativo: false, // cópia nasce pausada — ativar é gesto explícito
      })
      .select("id")
      .single();

    if (error) return { success: false, error: error.message };
    revalidatePath("/automacoes");
    return { success: true, id: data.id };
  } catch (err) {
    console.error({ level: "error", action: "duplicar_automacao", id, error: String(err) });
    return { success: false, error: "Erro inesperado ao duplicar automação." };
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
        ...camposModelo(parsed.data),
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
const TEMPLATES_COM_AGENDA = ["initial", "followup_1", "followup_2", "scheduled_return", "reactivation"];

const mensagensSchema = z
  .object({
    initial: mensagemParSchema,
    followup_1: mensagemParSchema,
    followup_2: mensagemParSchema,
    early_potential: mensagemParSchema,
    late_timing: mensagemParSchema,
    scheduled_return: mensagemParSchema,
    // Opcional (2026-08-24): template de REATIVAÇÃO — configs antigas sem a
    // chave continuam salvando (a CF tem o builder hardcoded como fallback).
    reactivation: mensagemParSchema.optional(),
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
    aprovacao_manual: z.boolean().optional(),
    email_confirmacao: z.boolean().optional(),
    email_interno: z.boolean().optional(),
    confirmacao_reuniao: z.boolean().optional(),
    nps_automatico: z.boolean().optional(),
    alerta_inatividade: z.boolean().optional(),
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

// Texto do WhatsApp da pesquisa NPS aos 6 meses (CF experiencia-scheduler).
// Vazio/ausente → default do código (NPS_MENSAGEM_DEFAULT). Placeholders
// suportados pela CF: {{responsavel}} e {{atleta}} — desconhecido chegaria
// LITERAL na mensagem (mesma classe de guard do scheduler_mensagens).
const NPS_PLACEHOLDERS_VALIDOS = ["{{responsavel}}", "{{atleta}}"];
const npsMensagemSchema = z.object({
  texto: z
    .string()
    .trim()
    .min(10, "Texto do NPS muito curto (mín. 10 caracteres)")
    .max(2000, "Texto do NPS muito longo (máx. 2000 caracteres)")
    .superRefine((texto, ctx) => {
      for (const m of texto.matchAll(/\{\{[a-z_]+\}\}/g)) {
        if (!NPS_PLACEHOLDERS_VALIDOS.includes(m[0])) {
          ctx.addIssue({
            code: "custom",
            message: `Placeholder desconhecido ${m[0]} — só ${NPS_PLACEHOLDERS_VALIDOS.join(" e ")} são substituídos.`,
          });
        }
      }
    })
    .optional(),
});

export type NpsMensagemCfg = z.infer<typeof npsMensagemSchema>;

/** Atualiza o texto da pesquisa NPS (configuracoes_sistema.nps_mensagem).
 *  String vazia remove o override (a CF volta ao default do código). */
export async function atualizarNpsMensagem(input: { texto?: string }): Promise<ActionResult> {
  const denied = await requireCeo();
  if (denied) return { success: false, error: denied };

  // '' = limpar override → grava {} (a CF cai no NPS_MENSAGEM_DEFAULT)
  const normalizado: NpsMensagemCfg = {};
  if (typeof input.texto === "string" && input.texto.trim()) {
    normalizado.texto = input.texto.trim();
  }
  const parsed = npsMensagemSchema.safeParse(normalizado);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Texto do NPS inválido" };
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    const { data, error } = await supabase
      .from("configuracoes_sistema")
      .update({ valor: parsed.data })
      .eq("chave", "nps_mensagem")
      .select("chave");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: "Config nps_mensagem não encontrada (migration pendente?)" };
    }
    revalidatePath("/automacoes");
    return { success: true };
  } catch (err) {
    console.error({ level: "error", action: "atualizar_nps_mensagem", error: String(err) });
    return { success: false, error: "Erro inesperado ao salvar o texto do NPS." };
  }
}

// Classificador v2 (chave qualificacao_v2): as variáveis de NEGÓCIO vivem na
// config — afrouxar/apertar o funil sem tocar em código. O prompt em si é
// versionado na CF (PROMPT_V2_VERSION); `system_prompt` não-vazio sobrescreve
// o texto inteiro (uso avançado — os {{PLACEHOLDERS}} seguem substituídos).
// Substitui o editor de seções do v1 (config qualificacao_prompt, MORTA —
// a CF não a lê mais).
const qualificacaoV2Schema = z
  .object({
    cotacao_usd: z
      .number({ message: "Cotação USD inválida" })
      .positive("Cotação USD deve ser maior que zero"),
    renda_minima_mensal: z
      .number({ message: "Renda de referência inválida" })
      .positive("Renda de referência deve ser maior que zero"),
    corte_ibge: z
      .number({ message: "Corte IBGE inválido" })
      .positive("Corte IBGE deve ser maior que zero")
      .nullable(),
    corte_quente: z.number().int().min(1).max(100),
    corte_frio: z.number().int().min(1).max(100),
    system_prompt: z
      .string()
      .trim()
      .max(QUALIFICACAO_V2_PROMPT_MAX, `System prompt: máx ${QUALIFICACAO_V2_PROMPT_MAX} caracteres`),
  })
  .superRefine((val, ctx) => {
    // Faixas do score: 1 ≤ frio < quente ≤ 100 — invertê-las zeraria QUENTE.
    if (val.corte_frio >= val.corte_quente) {
      ctx.addIssue({
        code: "custom",
        message: "Corte FRIO deve ser menor que o corte QUENTE (1 ≤ frio < quente ≤ 100).",
      });
    }
  });

export type QualificacaoV2Input = z.input<typeof qualificacaoV2Schema>;

/** Atualiza as variáveis do Classificador v2 (configuracoes_sistema.
 *  qualificacao_v2). O objeto é reescrito por completo — `system_prompt`
 *  vazio volta ao prompt versionado no código da CF (fonte da verdade). */
export async function atualizarQualificacaoV2(
  input: QualificacaoV2Input,
): Promise<ActionResult> {
  const denied = await requireCeo();
  if (denied) return { success: false, error: denied };

  const parsed = qualificacaoV2Schema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Configuração do classificador inválida",
    };
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    const { data, error } = await supabase
      .from("configuracoes_sistema")
      .update({ valor: parsed.data })
      .eq("chave", "qualificacao_v2")
      .select("chave");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: "Config qualificacao_v2 não encontrada (migration pendente?)" };
    }
    revalidatePath("/automacoes");
    return { success: true };
  } catch (err) {
    console.error({ level: "error", action: "atualizar_qualificacao_v2", error: String(err) });
    return { success: false, error: "Erro inesperado ao salvar a configuração do classificador." };
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
