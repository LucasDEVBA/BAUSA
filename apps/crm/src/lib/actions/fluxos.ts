"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";

// ════════════════════════════════════════════════════════════════════════
// Fluxos — CRUD do motor de conversa (CEO-only, auditado).
//
// Invariantes que a validação garante (e o guard de CI trava):
//  • Fluxo NASCE PAUSADO — ligar é gesto explícito (mesma regra das automações).
//  • Bloco de IA SEMPRE tem prompt inline: o `agentId` é opcional e o inline é
//    o fallback garantido — agent apagado/inativo nunca quebra o fluxo.
//  • Canal indisponível (instagram sem App Review) pode ser montado, mas NÃO
//    pode ser ativado — evita a ilusão de "está no ar" sem estar.
// ════════════════════════════════════════════════════════════════════════

const TEXTO_MAX = 1200;
const IA_PROMPT_MIN = 10;
const IA_PROMPT_MAX = 4000;
const OPCOES_MAX = 3; // limite de quick replies do Instagram/WhatsApp
const DELAY_MAX_MIN = 60 * 24 * 7; // 7 dias

const CANAIS = ["whatsapp", "instagram"] as const;
const GATILHOS = [
  "comentario_post",
  "comentario_reels",
  "novo_seguidor",
  "resposta_story",
  "mencao_story",
  "dm_palavra_chave",
  "dm_primeira_msg",
  "link_ref",
  "mensagem_palavra_chave",
  "manual",
  "agendado",
] as const;
const BLOCO_TIPOS = [
  "mensagem",
  "pergunta",
  "botoes",
  "condicao",
  "ia_resposta",
  "ia_condicao",
  "delay",
  "tag",
  "captura",
  "handoff",
  "acao_crm",
  "fim",
] as const;

/** Canais que realmente conseguem ENVIAR hoje (espelha CANAL_CATALOG). */
const CANAIS_DISPONIVEIS = new Set<string>(["whatsapp"]);

const gatilhoConfigSchema = z.object({
  palavras: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  match: z.enum(["contem", "exato", "comeca_com"]).optional(),
  postAlvo: z.string().max(300).optional(),
  ref: z.string().max(60).optional(),
  hora: z.number().int().min(0).max(23).optional(),
  tag: z.string().max(60).optional(),
  responderComentario: z.boolean().optional(),
  textoComentario: z.string().max(300).optional(),
});

const fluxoSchema = z.object({
  nome: z.string().trim().min(3, "Nome muito curto").max(160),
  descricao: z.string().trim().max(600).optional().nullable(),
  canal: z.enum(CANAIS),
  gatilho: z.enum(GATILHOS),
  gatilhoConfig: gatilhoConfigSchema.default({}),
  limiteHora: z.number().int().min(1).max(1000).default(60),
  reentradaHoras: z.number().int().min(0).max(8760).default(0),
});

export type FluxoInput = z.input<typeof fluxoSchema>;

const conteudoSchema = z
  .object({
    texto: z.string().max(TEXTO_MAX).optional(),
    mediaUrl: z.string().url().max(500).optional(),
    variavel: z.string().regex(/^[a-z0-9_]{2,40}$/i, "Variável: use letras, números e _").optional(),
    campo: z.enum(["nome", "email", "telefone", "instagram", "livre"]).optional(),
    criarLead: z.boolean().optional(),
    opcoes: z.array(z.string().trim().min(1).max(24)).max(OPCOES_MAX).optional(),
    campoComparado: z.string().max(60).optional(),
    agentId: z.string().uuid().optional(),
    prompt: z.string().trim().min(IA_PROMPT_MIN).max(IA_PROMPT_MAX).optional(),
    fallback: z.string().trim().max(TEXTO_MAX).optional(),
    rotulos: z.array(z.string().trim().min(1).max(40)).max(6).optional(),
    minutos: z.number().int().min(1).max(DELAY_MAX_MIN).optional(),
    adicionar: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
    remover: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
    destinatario: z.string().max(120).optional(),
    acao: z.enum(["criar_tarefa", "criar_notificacao", "mover_deal"]).optional(),
    etapa: z.string().max(60).optional(),
    titulo: z.string().max(160).optional(),
  })
  .strict();

const blocoSchema = z
  .object({
    id: z.string().uuid().optional(),
    tipo: z.enum(BLOCO_TIPOS),
    conteudo: conteudoSchema.default({}),
    proximoId: z.string().uuid().nullable().default(null),
    ramos: z
      .array(z.object({ valor: z.string().trim().min(1).max(60), blocoId: z.string().uuid().nullable() }))
      .max(6)
      .default([]),
    ordem: z.number().int().min(0).max(999).default(0),
  })
  .superRefine((b, ctx) => {
    const erro = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });

    // IA sem prompt inline = fluxo que quebra quando o agent some. Invariante.
    if ((b.tipo === "ia_resposta" || b.tipo === "ia_condicao") && !b.conteudo.prompt) {
      erro("Bloco de IA exige prompt escrito (ele é o fallback quando o agent falha).");
    }
    if (b.tipo === "ia_condicao" && (b.conteudo.rotulos?.length ?? 0) < 2) {
      erro("Classificação por IA precisa de pelo menos 2 rótulos.");
    }
    if (b.tipo === "botoes" && (b.conteudo.opcoes?.length ?? 0) < 2) {
      erro("Pergunta com opções precisa de pelo menos 2 opções.");
    }
    if ((b.tipo === "mensagem" || b.tipo === "pergunta" || b.tipo === "botoes") && !b.conteudo.texto?.trim()) {
      erro("Este bloco precisa de um texto para enviar.");
    }
    if (b.tipo === "captura" && !b.conteudo.campo) {
      erro("Escolha qual campo a captura preenche (e-mail, telefone…).");
    }
    if ((b.tipo === "pergunta" || b.tipo === "captura") && !b.conteudo.variavel) {
      erro("Defina o nome da variável onde a resposta será guardada.");
    }
    if (b.tipo === "delay" && !b.conteudo.minutos) {
      erro("Defina quantos minutos a espera dura.");
    }
  });

export type BlocoInput = z.input<typeof blocoSchema>;

interface ActionResult {
  success: boolean;
  error?: string;
  id?: string;
}

async function requireCeo(): Promise<string | null> {
  const papel = await getUserPapel();
  return papel === "ceo" ? null : "Apenas o CEO pode gerenciar fluxos.";
}

function revalidarFluxos(id?: string) {
  revalidatePath("/fluxos");
  revalidatePath("/fluxos/metricas");
  revalidatePath("/fluxos/contatos");
  if (id) revalidatePath(`/fluxos/${id}`, "page");
}

// ─── Fluxo ───────────────────────────────────────────────────────────────

export async function criarFluxo(input: FluxoInput): Promise<ActionResult> {
  const denied = await requireCeo();
  if (denied) return { success: false, error: denied };

  const parsed = fluxoSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

  try {
    const supabase = await createAuditedSupabaseClient();
    const { data, error } = await supabase
      .from("fluxos")
      .insert({
        nome: parsed.data.nome,
        descricao: parsed.data.descricao ?? null,
        canal: parsed.data.canal,
        gatilho: parsed.data.gatilho,
        gatilho_config: parsed.data.gatilhoConfig,
        limite_hora: parsed.data.limiteHora,
        reentrada_horas: parsed.data.reentradaHoras,
        ativo: false, // nasce pausado
      })
      .select("id")
      .single();
    if (error) return { success: false, error: error.message };
    revalidarFluxos();
    return { success: true, id: data.id };
  } catch (err) {
    console.error({ level: "error", action: "criar_fluxo", error: String(err) });
    return { success: false, error: "Erro inesperado ao criar o fluxo." };
  }
}

export async function atualizarFluxo(id: string, input: FluxoInput): Promise<ActionResult> {
  const denied = await requireCeo();
  if (denied) return { success: false, error: denied };
  const parsed = fluxoSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

  try {
    const supabase = await createAuditedSupabaseClient();
    const { error } = await supabase
      .from("fluxos")
      .update({
        nome: parsed.data.nome,
        descricao: parsed.data.descricao ?? null,
        canal: parsed.data.canal,
        gatilho: parsed.data.gatilho,
        gatilho_config: parsed.data.gatilhoConfig,
        limite_hora: parsed.data.limiteHora,
        reentrada_horas: parsed.data.reentradaHoras,
      })
      .eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidarFluxos(id);
    return { success: true, id };
  } catch (err) {
    console.error({ level: "error", action: "atualizar_fluxo", error: String(err) });
    return { success: false, error: "Erro inesperado ao salvar o fluxo." };
  }
}

/** Liga/desliga. Ligar exige canal disponível + bloco inicial (senão é ilusão). */
export async function alternarAtivoFluxo(id: string, ativo: boolean): Promise<ActionResult> {
  const denied = await requireCeo();
  if (denied) return { success: false, error: denied };

  try {
    const supabase = await createAuditedSupabaseClient();
    if (ativo) {
      const { data, error } = await supabase
        .from("fluxos")
        .select("canal, bloco_inicial_id")
        .eq("id", id)
        .maybeSingle();
      if (error) return { success: false, error: error.message };
      if (!data) return { success: false, error: "Fluxo não encontrado." };
      if (!CANAIS_DISPONIVEIS.has(String(data.canal))) {
        return {
          success: false,
          error:
            "O canal Instagram ainda não pode enviar mensagens (App Review pendente). Monte e teste o fluxo — ele liga sozinho quando a Meta aprovar.",
        };
      }
      if (!data.bloco_inicial_id) {
        return { success: false, error: "Adicione pelo menos um bloco antes de ativar o fluxo." };
      }
    }
    const { error } = await supabase.from("fluxos").update({ ativo }).eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidarFluxos(id);
    return { success: true, id };
  } catch (err) {
    console.error({ level: "error", action: "alternar_fluxo", error: String(err) });
    return { success: false, error: "Erro inesperado ao alterar o fluxo." };
  }
}

export async function excluirFluxo(id: string): Promise<ActionResult> {
  const denied = await requireCeo();
  if (denied) return { success: false, error: denied };
  try {
    const supabase = await createAuditedSupabaseClient();
    // Soft delete + desliga (fluxo apagado nunca pode continuar disparando)
    const { error } = await supabase
      .from("fluxos")
      .update({ deleted_at: new Date().toISOString(), ativo: false })
      .eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidarFluxos(id);
    return { success: true, id };
  } catch (err) {
    console.error({ level: "error", action: "excluir_fluxo", error: String(err) });
    return { success: false, error: "Erro inesperado ao excluir o fluxo." };
  }
}

export async function duplicarFluxo(id: string): Promise<ActionResult> {
  const denied = await requireCeo();
  if (denied) return { success: false, error: denied };
  try {
    const supabase = await createAuditedSupabaseClient();
    const { data: orig, error: e1 } = await supabase
      .from("fluxos")
      .select("nome, descricao, canal, gatilho, gatilho_config, limite_hora, reentrada_horas")
      .eq("id", id)
      .maybeSingle();
    if (e1) return { success: false, error: e1.message };
    if (!orig) return { success: false, error: "Fluxo não encontrado." };

    const { data: novo, error: e2 } = await supabase
      .from("fluxos")
      .insert({ ...orig, nome: `${orig.nome} (cópia)`, ativo: false })
      .select("id")
      .single();
    if (e2) return { success: false, error: e2.message };

    // Clona blocos preservando as ligações (mapa id antigo → novo).
    const { data: blocos } = await supabase
      .from("fluxo_blocos")
      .select("id, tipo, conteudo, proximo_id, ramos, ordem")
      .eq("fluxo_id", id);

    if (blocos && blocos.length > 0) {
      const mapa = new Map<string, string>();
      for (const b of blocos) {
        const { data: nb } = await supabase
          .from("fluxo_blocos")
          .insert({ fluxo_id: novo.id, tipo: b.tipo, conteudo: b.conteudo, ordem: b.ordem, ramos: [] })
          .select("id")
          .single();
        if (nb) mapa.set(String(b.id), String(nb.id));
      }
      const traduz = (x: unknown): string | null =>
        typeof x === "string" && mapa.has(x) ? (mapa.get(x) as string) : null;
      for (const b of blocos) {
        const novoId = mapa.get(String(b.id));
        if (!novoId) continue;
        const ramos = Array.isArray(b.ramos)
          ? b.ramos.map((r) => {
              const o = r as Record<string, unknown>;
              return { valor: String(o.valor ?? ""), blocoId: traduz(o.blocoId) };
            })
          : [];
        await supabase
          .from("fluxo_blocos")
          .update({ proximo_id: traduz(b.proximo_id), ramos })
          .eq("id", novoId);
      }
      const primeiro = [...blocos].sort((a, b) => Number(a.ordem) - Number(b.ordem))[0];
      const inicial = primeiro ? mapa.get(String(primeiro.id)) : undefined;
      if (inicial) await supabase.from("fluxos").update({ bloco_inicial_id: inicial }).eq("id", novo.id);
    }

    revalidarFluxos();
    return { success: true, id: novo.id };
  } catch (err) {
    console.error({ level: "error", action: "duplicar_fluxo", error: String(err) });
    return { success: false, error: "Erro inesperado ao duplicar o fluxo." };
  }
}

// ─── Blocos ──────────────────────────────────────────────────────────────

export async function salvarBloco(fluxoId: string, input: BlocoInput): Promise<ActionResult> {
  const denied = await requireCeo();
  if (denied) return { success: false, error: denied };

  const parsed = blocoSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Bloco inválido" };
  const b = parsed.data;

  try {
    const supabase = await createAuditedSupabaseClient();
    const payload = {
      fluxo_id: fluxoId,
      tipo: b.tipo,
      conteudo: b.conteudo,
      proximo_id: b.proximoId,
      ramos: b.ramos,
      ordem: b.ordem,
    };

    let blocoId = b.id;
    if (blocoId) {
      const { error } = await supabase.from("fluxo_blocos").update(payload).eq("id", blocoId);
      if (error) return { success: false, error: error.message };
    } else {
      const { data, error } = await supabase.from("fluxo_blocos").insert(payload).select("id").single();
      if (error) return { success: false, error: error.message };
      blocoId = data.id;
    }

    // Primeiro bloco criado vira a entrada do fluxo.
    const { data: fluxo } = await supabase.from("fluxos").select("bloco_inicial_id").eq("id", fluxoId).maybeSingle();
    if (fluxo && !fluxo.bloco_inicial_id && blocoId) {
      await supabase.from("fluxos").update({ bloco_inicial_id: blocoId }).eq("id", fluxoId);
    }

    revalidarFluxos(fluxoId);
    return { success: true, id: blocoId };
  } catch (err) {
    console.error({ level: "error", action: "salvar_bloco", error: String(err) });
    return { success: false, error: "Erro inesperado ao salvar o bloco." };
  }
}

export async function excluirBloco(fluxoId: string, blocoId: string): Promise<ActionResult> {
  const denied = await requireCeo();
  if (denied) return { success: false, error: denied };
  try {
    const supabase = await createAuditedSupabaseClient();
    const { error } = await supabase.from("fluxo_blocos").delete().eq("id", blocoId);
    if (error) return { success: false, error: error.message };

    // Limpa referências órfãs — bloco apagado não pode deixar o fluxo apontando
    // para o vazio (execução travaria).
    const { data: restantes } = await supabase
      .from("fluxo_blocos")
      .select("id, proximo_id, ramos")
      .eq("fluxo_id", fluxoId);
    for (const r of restantes ?? []) {
      const ramos = Array.isArray(r.ramos) ? r.ramos : [];
      const limpou = ramos.map((x) => {
        const o = x as Record<string, unknown>;
        return { valor: String(o.valor ?? ""), blocoId: o.blocoId === blocoId ? null : (o.blocoId as string | null) };
      });
      const mudouProximo = r.proximo_id === blocoId;
      const mudouRamo = JSON.stringify(limpou) !== JSON.stringify(ramos);
      if (mudouProximo || mudouRamo) {
        await supabase
          .from("fluxo_blocos")
          .update({ proximo_id: mudouProximo ? null : r.proximo_id, ramos: limpou })
          .eq("id", r.id);
      }
    }
    const { data: fluxo } = await supabase.from("fluxos").select("bloco_inicial_id").eq("id", fluxoId).maybeSingle();
    if (fluxo?.bloco_inicial_id === blocoId) {
      const proximo = (restantes ?? []).find((x) => x.id !== blocoId);
      await supabase
        .from("fluxos")
        .update({ bloco_inicial_id: proximo?.id ?? null, ativo: false })
        .eq("id", fluxoId);
    }

    revalidarFluxos(fluxoId);
    return { success: true, id: blocoId };
  } catch (err) {
    console.error({ level: "error", action: "excluir_bloco", error: String(err) });
    return { success: false, error: "Erro inesperado ao excluir o bloco." };
  }
}

/** Define qual bloco é a entrada do fluxo. */
export async function definirBlocoInicial(fluxoId: string, blocoId: string): Promise<ActionResult> {
  const denied = await requireCeo();
  if (denied) return { success: false, error: denied };
  try {
    const supabase = await createAuditedSupabaseClient();
    const { error } = await supabase.from("fluxos").update({ bloco_inicial_id: blocoId }).eq("id", fluxoId);
    if (error) return { success: false, error: error.message };
    revalidarFluxos(fluxoId);
    return { success: true, id: blocoId };
  } catch (err) {
    console.error({ level: "error", action: "definir_bloco_inicial", error: String(err) });
    return { success: false, error: "Erro inesperado." };
  }
}
