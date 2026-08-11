"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUserPapel, getUserProfile } from "@/lib/auth";
import { createAdminClient, hasServiceKey } from "@/lib/supabase-admin";
import {
  alterarOrcamentoDiario,
  alterarStatus,
  lerEstadoAtual,
  metaAdsEscritaConfigurada,
  MetaAdsEscritaError,
} from "@/lib/meta-ads-escrita";

// ════════════════════════════════════════════════════════════════════════
// Server actions de ESCRITA no Meta Ads (A2)
// Guardrails (decisão do CEO 2026-08-10): SÓ CEO/CTO, confirmação explícita
// na UI, TODA ação registrada em audit_logs (dados_anteriores + dados_novos).
// ════════════════════════════════════════════════════════════════════════

const ID_META = /^\d{5,25}$/;
const ORCAMENTO_MIN_BRL = 1;
const ORCAMENTO_MAX_BRL = 5000; // teto de sanidade por dia — ajustar se a operação crescer

const statusSchema = z.object({
  objetoId: z.string().regex(ID_META, "ID inválido."),
  nivel: z.enum(["campanha", "conjunto", "anuncio"]),
  acao: z.enum(["pausar", "reativar"]),
});

const orcamentoSchema = z.object({
  objetoId: z.string().regex(ID_META, "ID inválido."),
  nivel: z.enum(["campanha", "conjunto"]),
  valorDiarioBrl: z
    .number()
    .min(ORCAMENTO_MIN_BRL, `Orçamento mínimo: R$ ${ORCAMENTO_MIN_BRL}/dia.`)
    .max(ORCAMENTO_MAX_BRL, `Orçamento máximo: R$ ${ORCAMENTO_MAX_BRL}/dia (teto de segurança).`),
});

export interface ResultadoAcaoAds {
  success: boolean;
  error?: string;
  aviso?: string;
}

async function exigirCeo(): Promise<{ userId: string | null; papel: string } | null> {
  const papel = await getUserPapel();
  if (papel !== "ceo") return null; // cto→ceo já resolvido em getUserPapel()
  const profile = await getUserProfile();
  return { userId: profile?.id ?? null, papel: profile?.papel ?? "ceo" };
}

/** Trilha imutável da ação externa. Best-effort: falha vira aviso, nunca perde a ação. */
async function registrarAudit(params: {
  userId: string | null;
  papel: string;
  anteriores: Record<string, unknown>;
  novos: Record<string, unknown>;
}): Promise<string | undefined> {
  if (!hasServiceKey()) {
    console.error(JSON.stringify({ level: "WARN", action: "ads_audit_indisponivel", motivo: "sem SUPABASE_SERVICE_KEY" }));
    return "Ação executada, mas o audit trail está indisponível neste ambiente.";
  }
  const admin = createAdminClient();
  const { error } = await admin.from("audit_logs").insert({
    tabela: "meta_ads",
    registro_id: randomUUID(), // audit exige UUID; o id da Meta vai no JSONB
    operacao: "UPDATE",
    dados_anteriores: params.anteriores,
    dados_novos: params.novos,
    user_id: params.userId,
    user_papel: params.papel,
  });
  if (error) {
    console.error(JSON.stringify({ level: "WARN", action: "ads_audit_falhou", error: error.message }));
    return "Ação executada, mas o registro de auditoria falhou.";
  }
  return undefined;
}

export async function executarAcaoStatusAds(input: z.input<typeof statusSchema>): Promise<ResultadoAcaoAds> {
  const auth = await exigirCeo();
  if (!auth) return { success: false, error: "Apenas CEO/CTO podem executar ações no Meta Ads." };

  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Entrada inválida." };
  if (!metaAdsEscritaConfigurada()) return { success: false, error: "Token de gestão (META_ACCESS_TOKEN_MANAGE) não configurado." };

  const { objetoId, nivel, acao } = parsed.data;
  try {
    const antes = await lerEstadoAtual(objetoId);
    await alterarStatus(objetoId, acao === "pausar" ? "PAUSED" : "ACTIVE");
    const aviso = await registrarAudit({
      userId: auth.userId,
      papel: auth.papel,
      anteriores: { objeto_id: objetoId, nivel, nome: antes.nome, status: antes.status },
      novos: { objeto_id: objetoId, nivel, acao, status: acao === "pausar" ? "PAUSED" : "ACTIVE" },
    });
    revalidatePath("/ads");
    revalidatePath(`/ads/campanha/${objetoId}`);
    return { success: true, aviso };
  } catch (e) {
    return { success: false, error: e instanceof MetaAdsEscritaError ? e.message : "Falha inesperada ao falar com a Meta." };
  }
}

export async function alterarOrcamentoAds(input: z.input<typeof orcamentoSchema>): Promise<ResultadoAcaoAds> {
  const auth = await exigirCeo();
  if (!auth) return { success: false, error: "Apenas CEO/CTO podem executar ações no Meta Ads." };

  const parsed = orcamentoSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Entrada inválida." };
  if (!metaAdsEscritaConfigurada()) return { success: false, error: "Token de gestão (META_ACCESS_TOKEN_MANAGE) não configurado." };

  const { objetoId, nivel, valorDiarioBrl } = parsed.data;
  const centavos = Math.round(valorDiarioBrl * 100);
  try {
    const antes = await lerEstadoAtual(objetoId);
    if (antes.budgetDiarioCentavos === null) {
      return { success: false, error: "Este objeto não tem orçamento diário próprio (o budget mora em outro nível)." };
    }
    await alterarOrcamentoDiario(objetoId, centavos);
    const aviso = await registrarAudit({
      userId: auth.userId,
      papel: auth.papel,
      anteriores: { objeto_id: objetoId, nivel, nome: antes.nome, daily_budget_centavos: antes.budgetDiarioCentavos },
      novos: { objeto_id: objetoId, nivel, daily_budget_centavos: centavos },
    });
    revalidatePath("/ads");
    revalidatePath(`/ads/campanha/${objetoId}`);
    return { success: true, aviso };
  } catch (e) {
    return { success: false, error: e instanceof MetaAdsEscritaError ? e.message : "Falha inesperada ao falar com a Meta." };
  }
}
