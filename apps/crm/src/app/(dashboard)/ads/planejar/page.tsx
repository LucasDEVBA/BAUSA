import Link from "next/link";
import { Sparkles, FileText } from "lucide-react";

import { requirePapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { metaAdsConfigurado } from "@/lib/meta-ads";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlanejarClient, type AprendizadoItem } from "./client";

// /ads/planejar (A4/A4.1) — o Engine PENSA a campanha; o CEO executa no
// Gerenciador de Anúncios. Nunca cria campanha via API (invariante).
// Planos gerados viram entidades salvas (clicáveis/editáveis).
export const dynamic = "force-dynamic";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const dataCurta = (iso: string): string =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

interface PlanoResumo {
  id: string;
  titulo: string;
  status: string;
  campanhaId: string | null;
  orcamentoDiario: number | null;
  cplAlvo: number | null;
  criadoEm: string;
}

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

      {/* Planos salvos — clicáveis */}
      {planos.length > 0 ? (
        <section>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-label-tertiary">
            Planos salvos ({planos.length})
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {planos.map((p) => (
              <Link
                key={p.id}
                href={`/ads/planejar/${p.id}`}
                className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="flex h-full flex-col gap-2 p-4 transition-shadow hover:shadow-lg">
                  <div className="flex items-start gap-2">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <p className="line-clamp-2 min-w-0 flex-1 text-xs font-bold leading-snug text-foreground" title={p.titulo}>
                      {p.titulo}
                    </p>
                  </div>
                  <div className="mt-auto flex flex-wrap items-center gap-1.5">
                    <Badge tone={p.status === "executado" ? "green" : "blue"} size="sm">
                      {p.status === "executado" ? "Executado" : "Rascunho"}
                    </Badge>
                    {p.orcamentoDiario !== null ? <Badge tone="neutral" size="sm">{brl.format(p.orcamentoDiario)}/dia</Badge> : null}
                    {p.cplAlvo !== null ? <Badge tone="neutral" size="sm">CPL alvo {brl.format(p.cplAlvo)}</Badge> : null}
                    {p.campanhaId ? <Badge tone="green" size="sm">Vinculado</Badge> : null}
                    <span className="ml-auto text-[10px] text-label-tertiary">{p.criadoEm ? dataCurta(p.criadoEm) : ""}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <PlanejarClient aprendizados={aprendizados} />
    </div>
  );
}
