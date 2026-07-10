"use server";

import { revalidatePath } from "next/cache";
import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";
import { isCeoLevel } from "@/lib/papel";

export type OnboardingEtapaStatus =
  | "pendente"
  | "em_andamento"
  | "concluida"
  | "pulada";

export type OnboardingInstanciaStatus =
  | "em_andamento"
  | "concluido"
  | "pausado"
  | "cancelado";

export interface OnboardingEtapaEstado {
  id: string;
  instancia_id: string;
  template_etapa_id: string;
  ordem: number;
  titulo: string;
  descricao: string | null;
  prazo: string;
  status: OnboardingEtapaStatus;
  iniciada_at: string | null;
  concluida_at: string | null;
  observacao: string | null;
  requer_reuniao: boolean;
  requer_assuntos: boolean;
  requer_documentos: boolean;
}

export interface OnboardingInstancia {
  id: string;
  experiencia_id: string;
  template_id: string;
  responsavel_id: string | null;
  status: OnboardingInstanciaStatus;
  iniciado_at: string;
  concluido_at: string | null;
}

export interface OnboardingProgresso {
  existe: boolean;
  instancia_id?: string;
  total?: number;
  concluidas?: number;
  percent?: number;
  atrasadas?: number;
  proxima?: {
    id: string;
    titulo: string;
    prazo: string;
    status: OnboardingEtapaStatus;
    ordem: number;
  } | null;
}

async function requireHeadOrCeo() {
  const papel = await getUserPapel();
  if (!papel || (!isCeoLevel(papel) && papel !== "head_sucesso")) return null;
  return papel;
}

// ─── Buscar instância completa por experiencia ──────────────
export async function getOnboardingByExperiencia(
  experienciaId: string,
): Promise<{
  instancia: OnboardingInstancia | null;
  etapas: OnboardingEtapaEstado[];
}> {
  const papel = await requireHeadOrCeo();
  if (!papel) return { instancia: null, etapas: [] };

  const supabase = await createAuditedSupabaseClient();

  const { data: instancia } = await supabase
    .from("onboarding_instancias")
    .select("*")
    .eq("experiencia_id", experienciaId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!instancia) return { instancia: null, etapas: [] };

  const { data: etapas } = await supabase
    .from("onboarding_etapa_estado")
    .select("*")
    .eq("instancia_id", instancia.id)
    .order("ordem", { ascending: true });

  return {
    instancia: instancia as OnboardingInstancia,
    etapas: (etapas ?? []) as OnboardingEtapaEstado[],
  };
}

// ─── Progresso (RPC) ────────────────────────────────────────
export async function getProgressoOnboarding(
  experienciaId: string,
): Promise<OnboardingProgresso> {
  const papel = await requireHeadOrCeo();
  if (!papel) return { existe: false };

  const supabase = await createAuditedSupabaseClient();
  const { data, error } = await supabase.rpc("progresso_onboarding", {
    p_experiencia_id: experienciaId,
  });
  if (error || !data) return { existe: false };
  return data as OnboardingProgresso;
}

// ─── Listar onboardings ativos (CEO vê tudo, Head vê próprios)
export interface OnboardingResumo {
  instancia_id: string;
  experiencia_id: string;
  atleta_nome: string;
  responsavel_nome: string;
  head_nome: string | null;
  iniciado_at: string;
  total: number;
  concluidas: number;
  percent: number;
  atrasadas: number;
  proxima_titulo: string | null;
  proxima_prazo: string | null;
  status: OnboardingInstanciaStatus;
}

export async function listarOnboardingsAtivos(): Promise<OnboardingResumo[]> {
  const papel = await requireHeadOrCeo();
  if (!papel) return [];

  const supabase = await createAuditedSupabaseClient();

  // Buscar instâncias ativas (todas se ceo, próprias se head)
  let q = supabase
    .from("onboarding_instancias")
    .select("id, experiencia_id, responsavel_id, status, iniciado_at")
    .eq("status", "em_andamento")
    .is("deleted_at", null);

  if (papel === "head_sucesso") {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) q = q.eq("responsavel_id", user.id);
  }

  const { data: instancias } = await q.order("iniciado_at", { ascending: false });
  const list = (instancias ?? []) as Array<{
    id: string;
    experiencia_id: string;
    responsavel_id: string | null;
    status: OnboardingInstanciaStatus;
    iniciado_at: string;
  }>;

  if (list.length === 0) return [];

  // Buscar progresso + dados em paralelo
  const expIds = list.map((i) => i.experiencia_id);
  const headIds = Array.from(
    new Set(list.map((i) => i.responsavel_id).filter((x): x is string => !!x)),
  );

  // Busca explícita por id (o embed aninhado atletas→responsaveis retornava null,
  // exibindo "Atleta" sem nome). Mesmo padrão robusto do familias-pipeline.
  const [{ data: experiencias }, { data: heads }] = await Promise.all([
    supabase.from("crm_experiencia").select("id, atleta_id").in("id", expIds),
    headIds.length
      ? supabase.from("user_profiles").select("id, nome").in("id", headIds)
      : Promise.resolve({ data: [] }),
  ]);

  const expList = (experiencias ?? []) as Array<{
    id: string;
    atleta_id: string | null;
  }>;
  const expToAtleta = new Map(expList.map((e) => [e.id, e.atleta_id]));

  const atletaIds = Array.from(
    new Set(expList.map((e) => e.atleta_id).filter((x): x is string => !!x)),
  );
  const { data: atletasData } = atletaIds.length
    ? await supabase
        .from("atletas")
        .select("id, nome_completo, responsavel_id")
        .in("id", atletaIds)
    : { data: [] };
  const atletaById = new Map(
    (
      (atletasData ?? []) as Array<{
        id: string;
        nome_completo: string | null;
        responsavel_id: string | null;
      }>
    ).map((a) => [a.id, a]),
  );

  const respIds = Array.from(
    new Set(
      ((atletasData ?? []) as Array<{ responsavel_id: string | null }>)
        .map((a) => a.responsavel_id)
        .filter((x): x is string => !!x),
    ),
  );
  const { data: respData } = respIds.length
    ? await supabase.from("responsaveis").select("id, nome").in("id", respIds)
    : { data: [] };
  const respById = new Map(
    ((respData ?? []) as Array<{ id: string; nome: string | null }>).map((r) => [
      r.id,
      r.nome,
    ]),
  );

  const headMap = new Map(
    (heads ?? []).map((h) => [h.id as string, h.nome as string]),
  );

  // Para cada instância, busca progresso
  const results: OnboardingResumo[] = [];
  for (const inst of list) {
    const atletaId = expToAtleta.get(inst.experiencia_id) ?? null;
    const atleta = atletaId ? atletaById.get(atletaId) : null;
    const atletaNome = atleta?.nome_completo ?? "Atleta";
    const respNome =
      (atleta?.responsavel_id ? respById.get(atleta.responsavel_id) : null) ??
      "Responsável";

    const { data: progressoRaw } = await supabase.rpc("progresso_onboarding", {
      p_experiencia_id: inst.experiencia_id,
    });
    const progresso = (progressoRaw ?? {}) as OnboardingProgresso;
    const proxima = progresso.proxima ?? null;

    results.push({
      instancia_id: inst.id,
      experiencia_id: inst.experiencia_id,
      atleta_nome: atletaNome,
      responsavel_nome: respNome,
      head_nome: inst.responsavel_id ? headMap.get(inst.responsavel_id) ?? null : null,
      iniciado_at: inst.iniciado_at,
      total: progresso.total ?? 0,
      concluidas: progresso.concluidas ?? 0,
      percent: progresso.percent ?? 0,
      atrasadas: progresso.atrasadas ?? 0,
      proxima_titulo: proxima?.titulo ?? null,
      proxima_prazo: proxima?.prazo ?? null,
      status: inst.status,
    });
  }

  return results;
}

// ─── Marcar etapa como em andamento ─────────────────────────
export async function marcarEtapaEmAndamento(etapaEstadoId: string) {
  const papel = await requireHeadOrCeo();
  if (!papel) return { success: false, error: "Sem permissão." };

  const supabase = await createAuditedSupabaseClient();
  const { error } = await supabase
    .from("onboarding_etapa_estado")
    .update({
      status: "em_andamento",
      iniciada_at: new Date().toISOString(),
    })
    .eq("id", etapaEstadoId)
    .in("status", ["pendente"]);

  if (error) return { success: false, error: error.message };
  revalidatePath("/familias-crm");
  revalidatePath("/familias-pipeline");
  revalidatePath("/minha-area");
  revalidatePath("/war-room");
  return { success: true };
}

// ─── Marcar etapa como concluída + notificar CEO ────────────
export async function marcarEtapaConcluida(
  etapaEstadoId: string,
  observacao?: string,
) {
  const papel = await requireHeadOrCeo();
  if (!papel) return { success: false, error: "Sem permissão." };

  const supabase = await createAuditedSupabaseClient();

  // Buscar dados para notificação
  const { data: etapa } = await supabase
    .from("onboarding_etapa_estado")
    .select(
      "id, instancia_id, titulo, ordem, instancia:onboarding_instancias(experiencia_id)",
    )
    .eq("id", etapaEstadoId)
    .maybeSingle();

  if (!etapa) return { success: false, error: "Etapa não encontrada." };

  const { error } = await supabase
    .from("onboarding_etapa_estado")
    .update({
      status: "concluida",
      concluida_at: new Date().toISOString(),
      observacao: observacao?.trim() || null,
    })
    .eq("id", etapaEstadoId);

  if (error) return { success: false, error: error.message };

  // Notificar CEO (best-effort)
  try {
    const inst = etapa.instancia as unknown;
    const instObj = (Array.isArray(inst) ? inst[0] : inst) as { experiencia_id?: string } | null;
    const expId = instObj?.experiencia_id;
    if (expId) {
      const { data: exp } = await supabase
        .from("crm_experiencia")
        .select("atleta:atletas(nome_completo)")
        .eq("id", expId)
        .maybeSingle();
      const atletaRaw = exp?.atleta as unknown;
      const atletaObj = (Array.isArray(atletaRaw) ? atletaRaw[0] : atletaRaw) as { nome_completo?: string } | null;
      const nome = atletaObj?.nome_completo ?? "atleta";

      const { data: ceos } = await supabase
        .from("user_profiles")
        .select("id")
        .in("papel", ["ceo", "cto"])
        .eq("ativo", true);

      if (ceos && ceos.length > 0) {
        const payload = ceos.map((c) => ({
          destinatario_id: c.id,
          titulo: `Etapa de onboarding concluida: ${nome}`,
          mensagem: `Etapa "${etapa.titulo}" concluida (ordem ${etapa.ordem}).` +
            (observacao ? ` Observacao: ${observacao}` : ""),
          tipo: "onboarding_etapa_concluida",
          severidade: "baixa",
          link: "/war-room/familias-onboarding",
        }));
        await supabase.from("notificacoes").insert(payload);
      }
    }
  } catch (notifErr) {
    console.warn("[marcarEtapaConcluida] notif failed", notifErr);
  }

  revalidatePath("/familias-crm");
  revalidatePath("/familias-pipeline");
  revalidatePath("/minha-area");
  revalidatePath("/war-room");
  return { success: true };
}

// ─── Pular etapa (caso não se aplique) ──────────────────────
export async function pularEtapa(etapaEstadoId: string, motivo: string) {
  const papel = await requireHeadOrCeo();
  if (!papel) return { success: false, error: "Sem permissão." };
  if (!motivo.trim()) return { success: false, error: "Motivo é obrigatório." };

  const supabase = await createAuditedSupabaseClient();
  const { error } = await supabase
    .from("onboarding_etapa_estado")
    .update({
      status: "pulada",
      concluida_at: new Date().toISOString(),
      observacao: `[Pulada] ${motivo}`,
    })
    .eq("id", etapaEstadoId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/familias-crm");
  revalidatePath("/familias-pipeline");
  revalidatePath("/minha-area");
  return { success: true };
}

// ─── Templates ───────────────────────────────────────────────
export async function listarTemplatesOnboarding() {
  const papel = await requireHeadOrCeo();
  if (!papel) return [];

  const supabase = await createAuditedSupabaseClient();
  const { data } = await supabase
    .from("onboarding_templates")
    .select(
      "id, nome, descricao, is_default, ativo, created_at, etapas:onboarding_template_etapas(id, ordem, titulo, descricao, prazo_dias, requer_reuniao, requer_assuntos, requer_documentos)",
    )
    .is("deleted_at", null)
    .eq("ativo", true)
    .order("is_default", { ascending: false })
    .order("nome");
  return data ?? [];
}
