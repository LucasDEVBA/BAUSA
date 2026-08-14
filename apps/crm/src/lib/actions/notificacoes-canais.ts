"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUserPapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import {
  DEFAULT_CANAIS,
  EVENTOS,
  type ConfigNotificacoes,
  type MatrizCanais,
  type Severidades,
} from "@/lib/notificacoes-eventos";

/**
 * Quais notificações saem por qual canal.
 *
 * Antes, toda falha do monitor ia por WhatsApp E e-mail. Virou ruído — e
 * alerta que o CEO para de ler não protege nada. Aqui cada evento declara
 * seus canais, e a severidade de cada check decide se ele é "crítico"
 * (algo parou) ou "atenção" (vale olhar depois).
 */

type Result = { success: true } | { success: false; error: string };

const canaisSchema = z.object({
  inapp: z.boolean(),
  email: z.boolean(),
  whatsapp: z.boolean(),
});

const salvarSchema = z.object({
  canais: z.record(z.string().max(64), canaisSchema),
  severidades: z.record(z.string().max(64), z.enum(["critico", "atencao"])),
});

export async function getConfigNotificacoes(): Promise<ConfigNotificacoes> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("configuracoes_sistema")
    .select("chave, valor")
    .in("chave", ["notificacoes_canais", "monitor_severidades"]);

  const mapa = new Map((data ?? []).map((r) => [r.chave, r.valor]));
  const canaisRaw = (mapa.get("notificacoes_canais") ?? {}) as Partial<MatrizCanais>;
  const severidades = (mapa.get("monitor_severidades") ?? {}) as Severidades;

  // Default por evento, não pelo objeto inteiro: um evento novo no código
  // não fica sem canais só porque a chave do banco é antiga.
  const canais: MatrizCanais = {};
  for (const e of EVENTOS) {
    canais[e.id] = { ...DEFAULT_CANAIS[e.id], ...(canaisRaw[e.id] ?? {}) };
  }

  return {
    canais,
    severidades,
    checksConhecidos: Object.keys(severidades).sort(),
  };
}

export async function salvarConfigNotificacoes(input: unknown): Promise<Result> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas CEO/CTO podem alterar notificações." };
  }
  const parsed = salvarSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  // Deixar TUDO desligado num evento crítico é uma decisão perigosa e
  // silenciosa: sem canal nenhum, uma parada de funil não avisa ninguém.
  const critico = parsed.data.canais.monitor_critico;
  if (critico && !critico.inapp && !critico.email && !critico.whatsapp) {
    return {
      success: false,
      error: "Deixe ao menos um canal ligado em “Algo parou de funcionar” — sem nenhum, uma parada do funil não avisaria ninguém.",
    };
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    const agora = new Date().toISOString();
    const { error } = await supabase.from("configuracoes_sistema").upsert(
      [
        { chave: "notificacoes_canais", valor: parsed.data.canais, updated_at: agora },
        { chave: "monitor_severidades", valor: parsed.data.severidades, updated_at: agora },
      ],
      { onConflict: "chave" },
    );
    if (error) return { success: false, error: `Não foi possível salvar: ${error.message}` };

    revalidatePath("/configuracoes");
    revalidatePath("/observabilidade");
    return { success: true };
  } catch (e) {
    console.error({ level: "error", action: "salvar_notificacoes", erro: String(e) });
    return { success: false, error: "Falha ao salvar. Tente de novo." };
  }
}
