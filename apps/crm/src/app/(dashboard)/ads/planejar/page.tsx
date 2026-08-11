import { Sparkles } from "lucide-react";

import { requirePapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { metaAdsConfigurado } from "@/lib/meta-ads";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlanejarClient, type AprendizadoItem } from "./client";

// /ads/planejar (A4) — o Engine PENSA a campanha; o CEO executa no
// Gerenciador de Anúncios. Nunca cria campanha via API (invariante).
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

  // Aprendizados recentes (cérebro) — a lista degrada para vazia sem quebrar.
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("ads_aprendizados")
    .select("tipo, resumo, confianca, created_at")
    .order("created_at", { ascending: false })
    .limit(30);
  const aprendizados: AprendizadoItem[] = (data ?? []).map((a) => ({
    tipo: String(a.tipo),
    resumo: String(a.resumo),
    confianca: typeof a.confianca === "string" ? a.confianca : null,
    criadoEm: String(a.created_at ?? ""),
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Planejar campanha"
        description="A IA monta o briefing com base no funil real + aprendizados; você preenche no Gerenciador de Anúncios"
        dense
      />
      <PlanejarClient aprendizados={aprendizados} />
    </div>
  );
}
