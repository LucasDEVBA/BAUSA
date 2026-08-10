import { Megaphone, Wallet, Users, CalendarCheck } from "lucide-react";

import { requirePapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  fetchCampanhasAds,
  fetchFunilPorCampanha,
  metaAdsConfigurado,
  MetaAdsError,
  type CampanhaAds,
  type FunilCampanha,
} from "@/lib/meta-ads";
import { CampanhaCard } from "@/components/ads/CampanhaCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";

// /ads — aba Campanhas (A1: leitura). Cards com criativo, status e o
// cruzamento que a Meta não tem: leads/reuniões REAIS por campanha.
export const dynamic = "force-dynamic";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Quem gastou aparece primeiro (é onde a decisão mora); empate = ativas antes.
function ordenar(campanhas: CampanhaAds[]): CampanhaAds[] {
  return [...campanhas].sort((a, b) => {
    if (b.gasto30d !== a.gasto30d) return b.gasto30d - a.gasto30d;
    const ativaA = a.status === "ACTIVE" ? 0 : 1;
    const ativaB = b.status === "ACTIVE" ? 0 : 1;
    return ativaA - ativaB;
  });
}

export default async function AdsPage() {
  await requirePapel("ceo");

  if (!metaAdsConfigurado()) {
    return (
      <div className="space-y-4">
        <PageHeader title="Meta Ads" description="Campanhas da conta com resultados reais do funil" dense />
        <EmptyState
          icon={Megaphone}
          title="Integração Meta não configurada"
          description="Defina META_ACCESS_TOKEN e META_AD_ACCOUNT_ID no ambiente do Engine para ativar esta tela."
        />
      </div>
    );
  }

  let campanhas: CampanhaAds[] = [];
  let funil = new Map<string, FunilCampanha>();
  let erro: string | null = null;
  let funilIndisponivel = false;
  try {
    campanhas = await fetchCampanhasAds();
  } catch (e) {
    erro = e instanceof MetaAdsError ? e.message : "Falha inesperada ao consultar a Meta.";
  }
  if (!erro) {
    // Funil é enriquecimento — se falhar, os cards rendem sem os chips (nunca tela morta).
    try {
      funil = await fetchFunilPorCampanha(await createServerSupabaseClient());
    } catch {
      funilIndisponivel = true;
    }
  }

  if (erro) {
    return (
      <div className="space-y-4">
        <PageHeader title="Meta Ads" description="Campanhas da conta com resultados reais do funil" dense />
        <EmptyState icon={Megaphone} title="Não foi possível carregar as campanhas" description={erro} />
      </div>
    );
  }

  const visiveis = ordenar(campanhas.filter((c) => c.status !== "DELETED" && c.status !== "ARCHIVED"));
  const ativas = visiveis.filter((c) => c.status === "ACTIVE").length;
  const gasto30d = visiveis.reduce((s, c) => s + c.gasto30d, 0);
  const leads30d = [...funil.values()].reduce((s, f) => s + f.leads30d, 0);
  const reunioes = [...funil.values()].reduce((s, f) => s + f.reunioes, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Meta Ads" description="Campanhas da conta com resultados reais do funil" dense />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Campanhas ativas" value={String(ativas)} context={`${visiveis.length} no total`} icon={Megaphone} accent="brand" />
        <StatCard label="Gasto 30d" value={brl.format(gasto30d)} icon={Wallet} accent="burgundy" />
        <StatCard label="Leads 30d (funil)" value={funilIndisponivel ? "—" : String(leads30d)} context="via utm_id das campanhas" icon={Users} accent="green" />
        <StatCard label="Reuniões geradas" value={funilIndisponivel ? "—" : String(reunioes)} context="todas as campanhas" icon={CalendarCheck} accent="blue" />
      </div>

      {funilIndisponivel && (
        <p className="text-xs text-muted-foreground">
          Cruzamento com o funil temporariamente indisponível — os cards mostram só os dados da Meta.
        </p>
      )}

      {visiveis.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Nenhuma campanha na conta"
          description="Quando houver campanhas na conta de anúncios, elas aparecem aqui automaticamente."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visiveis.map((c) => (
            <CampanhaCard key={c.id} campanha={c} funil={funil.get(c.id) ?? null} />
          ))}
        </div>
      )}
    </div>
  );
}
