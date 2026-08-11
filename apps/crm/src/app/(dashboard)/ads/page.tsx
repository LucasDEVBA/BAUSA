import { Megaphone, Wallet, Users, CalendarCheck } from "lucide-react";

import { requirePapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  fetchAgregado30dPorCampanha,
  fetchCampanhasAds,
  fetchFunilPorCampanha,
  metaAdsConfigurado,
  MetaAdsError,
  type CampanhaAds,
  type FunilCampanha,
} from "@/lib/meta-ads";
import { CampanhasClient } from "@/components/ads/CampanhasClient";
import { RefreshAds } from "@/components/ads/RefreshAds";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";

// /ads — aba Campanhas (A1.5: leitura). Grid com filtros + clique → detalhe.
export const dynamic = "force-dynamic";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

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
    const supabase = await createServerSupabaseClient();
    // Funil é enriquecimento — se falhar, os cards rendem sem os chips (nunca tela morta).
    try {
      funil = await fetchFunilPorCampanha(supabase);
    } catch {
      funilIndisponivel = true;
    }
    // 30d vem do NOSSO histórico diário (a janela da Meta zerava campanhas
    // ativas que entregaram fora dos últimos 30 dias).
    try {
      const agregado = await fetchAgregado30dPorCampanha(supabase);
      campanhas = campanhas.map((c) => {
        const a = agregado.get(c.id);
        return a ? { ...c, gasto30d: a.gasto, cliques30d: a.cliques, impressoes30d: a.impressoes } : c;
      });
    } catch {
      // sem 30d próprio, os cards mostram só a vida toda
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

  const visiveis = campanhas.filter((c) => c.status !== "DELETED" && c.status !== "ARCHIVED");
  const ativas = visiveis.filter((c) => c.status === "ACTIVE").length;
  const gasto30d = visiveis.reduce((s, c) => s + c.gasto30d, 0);
  const leads30d = [...funil.values()].reduce((s, f) => s + f.leads30d, 0);
  const reunioes = [...funil.values()].reduce((s, f) => s + f.reunioes, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Meta Ads" description="Campanhas da conta com resultados reais do funil" dense actions={<RefreshAds />} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Campanhas ativas" value={String(ativas)} context={`${visiveis.length} no total`} icon={Megaphone} accent="brand" />
        <StatCard label="Gasto 30d" value={brl.format(gasto30d)} icon={Wallet} accent="burgundy" />
        <StatCard label="Leads 30d (funil)" value={funilIndisponivel ? "—" : String(leads30d)} context="via utm_id das campanhas" icon={Users} accent="green" />
        <StatCard label="Reuniões geradas" value={funilIndisponivel ? "—" : String(reunioes)} context="todas as campanhas" icon={CalendarCheck} accent="blue" />
      </div>

      {funilIndisponivel ? (
        <p className="text-xs text-muted-foreground">
          Cruzamento com o funil temporariamente indisponível — os cards mostram só os dados da Meta.
        </p>
      ) : null}

      <CampanhasClient campanhas={visiveis} funil={Object.fromEntries(funil)} />
    </div>
  );
}
