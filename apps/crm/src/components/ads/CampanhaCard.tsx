import { ImageOff, CalendarPlus, Target } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { AdsStatusBadge, OBJETIVO_LABEL, VeiculacaoBadge } from "@/components/ads/ads-labels";
import type { CampanhaAds, FunilCampanha } from "@/lib/meta-ads";

// Card de campanha (leitura): foto do criativo, título, badges de
// status/objetivo e as métricas que o Ads Manager da Meta NÃO mostra —
// leads e reuniões REAIS do nosso funil (utm_id ↔ campanha_id).

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function Metrica({ label, valor, destaque = false }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">{label}</p>
      <p className={destaque ? "truncate text-sm font-bold text-primary" : "truncate text-sm font-semibold text-foreground"}>
        {valor}
      </p>
    </div>
  );
}

export function CampanhaCard({ campanha, funil }: { campanha: CampanhaAds; funil: FunilCampanha | null }) {
  const objetivo = campanha.objetivo ? (OBJETIVO_LABEL[campanha.objetivo] ?? campanha.objetivo) : null;
  const cplReal =
    funil && funil.leads30d > 0 && campanha.gasto30d > 0 ? campanha.gasto30d / funil.leads30d : null;

  return (
    <Card className="group flex flex-col overflow-hidden p-0 transition-shadow hover:shadow-lg">
      {/* Criativo — foto do anúncio com fallback de marca */}
      <div className="relative h-36 w-full shrink-0 overflow-hidden bg-secondary">
        {campanha.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- criativo vem do CDN da Meta (domínio variável); migração next/image é item de roadmap
          <img
            src={campanha.thumbnailUrl}
            alt={`Criativo da campanha ${campanha.nome}`}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-brand">
            <ImageOff className="h-8 w-8 text-white/60" aria-hidden />
          </div>
        )}
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          <AdsStatusBadge status={campanha.status} className="bg-card/90 backdrop-blur-sm" />
          <VeiculacaoBadge
            status={campanha.status}
            fimEm={campanha.fimEm}
            gasto7d={campanha.gasto7d}
            className="bg-card/90 backdrop-blur-sm"
          />
        </div>
      </div>

      {/* Título + badges informativas */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="line-clamp-2 text-sm font-bold leading-snug text-foreground" title={campanha.nome}>
            {campanha.nome}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {objetivo && (
              <Badge tone="blue" size="sm">
                <Target className="h-2.5 w-2.5" aria-hidden />
                {objetivo}
              </Badge>
            )}
            {campanha.budgetDiario !== null && (
              <Badge tone="neutral" size="sm">{brl.format(campanha.budgetDiario)}/dia</Badge>
            )}
            {campanha.criadaEm && (
              <Badge tone="neutral" size="sm">
                <CalendarPlus className="h-2.5 w-2.5" aria-hidden />
                {new Date(campanha.criadaEm).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })}
              </Badge>
            )}
          </div>
        </div>

        {/* Métricas: 30d (nosso histórico) + vida toda (Meta) + funil real */}
        <div className="mt-auto grid grid-cols-3 gap-2 border-t border-border pt-3">
          <Metrica label="Gasto 30d" valor={campanha.gasto30d > 0 ? brl.format(campanha.gasto30d) : "—"} />
          <Metrica label="Gasto total" valor={campanha.gastoVida > 0 ? brl.format(campanha.gastoVida) : "—"} />
          <Metrica label="CTR (vida)" valor={campanha.ctrVida !== null && campanha.gastoVida > 0 ? `${campanha.ctrVida.toFixed(2)}%` : "—"} />
          <Metrica label="Leads (funil)" valor={funil ? String(funil.leadsTotal) : "0"} destaque={Boolean(funil && funil.leadsTotal > 0)} />
          <Metrica label="Reuniões" valor={funil ? String(funil.reunioes) : "0"} destaque={Boolean(funil && funil.reunioes > 0)} />
          <Metrica label="CPL real 30d" valor={cplReal !== null ? brl.format(cplReal) : "—"} destaque={cplReal !== null} />
        </div>
      </div>
    </Card>
  );
}
