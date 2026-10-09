import "server-only";

import { getConfigEtapasDeal } from "@/lib/actions/configuracoes";
import { moverDeal } from "@/lib/actions/deals";
import { mergeDealStageConfig } from "@/lib/etapas-deal";
import { deveMoverParaSinalPago } from "@/lib/etapas-ordem";
import { registrarEventoGamificacao, type ResultadoGamificacao } from "@/lib/gamificacao";
import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { StatusDeal } from "@/types/crm";

/**
 * Efeitos do SINAL no deal (T5/T11), depois que a RPC já gravou a prova
 * (deals.sinal_pago_confirmado_por + sinal_pago_at = data real).
 *
 *  1. Etapa: só AVANÇA para "Sinal pago" se o deal estiver ANTES dela na
 *     ordem do board. A regra e a leitura da config são as do grupo etapas
 *     (T2) — FONTE ÚNICA: `deveMoverParaSinalPago` (@/lib/etapas-ordem) sobre
 *     `mergeDealStageConfig(overrides, regras)` lido por `getConfigEtapasDeal`
 *     (o mesmo que o moverDeal/trigger usam). Colunas custom e etapas
 *     posteriores NUNCA se movem. Config ilegível (`lida=false`) → NÃO move.
 *     `moverEtapa: false` (quitação) → nunca move (critério do T9).
 *  2. Handoff (experiência + tarefa + notificações) — mesmo bloco legado do
 *     confirmarSinalPago, só quando ainda não existe experiência.
 *  3. XP "sinal_pago": uma vez por deal (estorno + nova baixa não pontua de novo).
 */

async function jaPontuouSinal(dealId: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("gamificacao_eventos")
    .select("id")
    .eq("tipo", "sinal_pago")
    .eq("ref_tipo", "deal")
    .eq("ref_id", dealId)
    .limit(1);
  // Erro de leitura → trata como "já pontuou" (XP é tempero; duplicar é pior).
  if (error) return true;
  return (data ?? []).length > 0;
}

export interface EfeitosSinal {
  movidoParaSinalPago: boolean;
  etapaAtual: StatusDeal | null;
  avisos: string[];
  gamificacao: ResultadoGamificacao | null;
}

export async function aplicarEfeitosDoSinal(
  dealId: string,
  opcoes: { sinalConfirmadoAgora: boolean; moverEtapa?: boolean },
): Promise<EfeitosSinal> {
  const avisos: string[] = [];
  const supabase = await createAuditedSupabaseClient();

  const { data: deal, error: dealErr } = await supabase
    .from("deals")
    .select("id, etapa, atleta_id, atleta:atletas(nome_completo)")
    .eq("id", dealId)
    .maybeSingle();
  if (dealErr || !deal) {
    console.error({ level: "error", action: "sinal_deal_nao_lido", dealId, error: dealErr?.message });
    return { movidoParaSinalPago: false, etapaAtual: null, avisos: ["Pagamento salvo, mas o negócio não pôde ser lido."], gamificacao: null };
  }

  let etapa = deal.etapa as StatusDeal;
  let movido = false;
  if (opcoes.moverEtapa !== false) {
    const cfg = await getConfigEtapasDeal();
    const config = cfg.lida ? mergeDealStageConfig(cfg.overrides, cfg.regras) : null;
    if (!config) {
      avisos.push("Pagamento salvo. Não movi o card de etapa (configuração do board indisponível).");
    } else if (deveMoverParaSinalPago(etapa, config)) {
      const r = await moverDeal(dealId, "sinal_pago");
      if (r.success) {
        movido = true;
        etapa = "sinal_pago";
      } else {
        avisos.push(`Pagamento salvo, mas não consegui mover o card: ${r.error}`);
      }
    }
  }

  // Handoff legado (best-effort — NUNCA derruba o pagamento já gravado)
  if (deal.atleta_id) {
    try {
      const { data: existente } = await supabase
        .from("crm_experiencia")
        .select("id")
        .eq("atleta_id", deal.atleta_id)
        .maybeSingle();
      if (!existente) {
        await criarHandoffExperiencia(supabase, dealId, deal.atleta_id, nomeDoAtleta(deal.atleta));
      }
    } catch (err) {
      console.warn({ level: "warn", action: "sinal_handoff_falhou", dealId, error: String(err) });
    }
  }

  const gamificacao =
    opcoes.sinalConfirmadoAgora && !(await jaPontuouSinal(dealId))
      ? await registrarEventoGamificacao("sinal_pago", { tipo: "deal", id: dealId })
      : null;

  return { movidoParaSinalPago: movido, etapaAtual: etapa, avisos, gamificacao };
}

function nomeDoAtleta(raw: unknown): string {
  const a = (Array.isArray(raw) ? raw[0] : raw) as { nome_completo?: string } | null | undefined;
  return a?.nome_completo ?? "Atleta";
}

type SupabaseAuditado = Awaited<ReturnType<typeof createAuditedSupabaseClient>>;

/** Corpo extraído do confirmarSinalPago legado (financeiro.ts:299-394), sem mudança de regra. */
async function criarHandoffExperiencia(
  supabase: SupabaseAuditado,
  dealId: string,
  atletaId: string,
  atletaNome: string,
): Promise<void> {
  const { data: contrato } = await supabase
    .from("contratos_financeiros")
    .select("inclui_psicologa")
    .eq("deal_id", dealId)
    .is("deleted_at", null)
    .maybeSingle();

  const expInsert: Record<string, unknown> = {
    atleta_id: atletaId,
    deal_id: dealId,
    fase: "admissao",
    temperatura: "verde",
    ansiedade: 3,
    satisfacao: 5,
    risco_percebido: 1,
    status: "satisfeita",
    escola_confirmada_id: null,
    data_prevista_embarque: null,
  };
  if (contrato?.inclui_psicologa) expInsert.psicologa_acionada = false;
  const { error: expErr } = await supabase.from("crm_experiencia").insert(expInsert);
  if (expErr) {
    console.warn({ level: "warn", action: "sinal_handoff_experiencia", dealId, error: expErr.message });
    return;
  }

  const { data: headUser } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("papel", "head_sucesso")
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  const headId = headUser?.id ?? currentUser?.id;

  if (headId) {
    const prazo = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await supabase.from("tarefas").insert({
      titulo: `Reuniao de onboarding — ${atletaNome}`,
      descricao: "Realizar reuniao de onboarding com a familia. Prazo: 48h.",
      responsavel_id: headId,
      prazo: prazo.toISOString(),
      prioridade: "alta",
      deal_id: dealId,
      modulo_origem: "experiencia",
      criada_automaticamente: true,
    });
  }

  if (currentUser?.id) {
    const notifs = [
      {
        destinatario_id: currentUser.id,
        titulo: "Sinal pago — Handoff para Experiencia",
        mensagem: `${atletaNome} pagou o sinal. Registro de experiencia criado. Onboarding em 48h.`,
        tipo: "handoff",
        severidade: "alta",
        deal_id: dealId,
        link: "/crm/experiencia",
      },
    ];
    if (headId && headId !== currentUser.id) {
      notifs.push({
        destinatario_id: headId,
        titulo: "Nova familia para onboarding",
        mensagem: `${atletaNome} assinou e pagou o sinal. Realizar onboarding em 48h.`,
        tipo: "handoff",
        severidade: "alta",
        deal_id: dealId,
        link: "/crm/experiencia",
      });
    }
    await supabase.from("notificacoes").insert(notifs);
  }
}
