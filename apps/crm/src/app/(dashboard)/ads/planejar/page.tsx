import { Sparkles } from "lucide-react";

import { requirePapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { metaAdsConfigurado } from "@/lib/meta-ads";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlanejarClient, type AprendizadoItem } from "./client";
import { PlanosSalvos, type PlanoResumo } from "./PlanosSalvos";

// /ads/planejar (A4/A4.1) — o Engine PENSA a campanha; o CEO executa no
// Gerenciador de Anúncios. Nunca cria campanha via API (invariante).
// Planos gerados viram entidades salvas (clicáveis/editáveis/filtráveis).
export const dynamic = "force-dynamic";

export default async function AdsPlanejarPage() {
  await requirePapel("ceo");

  if (!metaAdsConfigurado()) {
    return (
      <div className="space-y-4">
        <PageHeader title="Planejar campanha" description="Briefing com IA baseado no seu funil real" dense />
        <EmptyState
          icon={Sparkles}
          title="Integração Meta não configurada"
          description="Defina META_ACCESS_TOKEN e META_AD_ACCOUNT_ID no ambiente do Engine para ativar esta tela."
        />
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();
  const [aprendRes, planosRes] = await Promise.all([
    supabase.from("ads_aprendizados").select("tipo, resumo, confianca, created_at").order("created_at", { ascending: false }).limit(30),
    supabase
      .from("ads_planos")
      .select("id, titulo, status, campanha_id, plano, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(24),
  ]);

  const aprendizados: AprendizadoItem[] = (aprendRes.data ?? []).map((a) => ({
    tipo: String(a.tipo),
    resumo: String(a.resumo),
    confianca: typeof a.confianca === "string" ? a.confianca : null,
    criadoEm: String(a.created_at ?? ""),
  }));

  const planos: PlanoResumo[] = (planosRes.data ?? []).map((p) => {
    const plano = (p.plano ?? {}) as { orcamento?: { diarioBrl?: number }; cplAlvo?: { valorBrl?: number } };
    return {
      id: String(p.id),
      titulo: String(p.titulo),
      status: String(p.status),
      campanhaId: typeof p.campanha_id === "string" ? p.campanha_id : null,
      orcamentoDiario: typeof plano.orcamento?.diarioBrl === "number" ? plano.orcamento.diarioBrl : null,
      cplAlvo: typeof plano.cplAlvo?.valorBrl === "number" ? plano.cplAlvo.valorBrl : null,
      criadoEm: String(p.created_at ?? ""),
    };
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Planejar campanha"
        description="A IA monta o briefing com base no funil real + aprendizados; você preenche no Gerenciador de Anúncios"
        dense
      />

      {/* Planos salvos — clicáveis, com filtros */}
      <PlanosSalvos planos={planos} />

      <PlanejarClient aprendizados={aprendizados} />
    </div>
  );
}
