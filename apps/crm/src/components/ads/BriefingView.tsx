"use client";

import { useState } from "react";
import { Copy, Check, Target, Users, Image as ImageIcon, Wallet, Crosshair, FlaskConical, ListChecks } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { PlanoCampanha } from "@/lib/actions/ads-planner";
import { CONFIANCA_LABEL, type ConfiancaDimensao, type DimensaoPlano, type MapaConfianca, type NivelConfianca } from "@/lib/ads-confianca";

// Renderização do briefing — usada na geração (Planejar) E na tela do plano
// salvo. Badges de confiança SEMPRE do mapa determinístico (nunca da IA).
// UTM em DESTAQUE NO TOPO: decisão do CEO — "utm é primordial".

const NIVEL_TONE: Record<NivelConfianca, "green" | "orange" | "neutral"> = {
  assertiva: "green",
  parcial: "orange",
  sugestiva: "neutral",
};
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function ConfiancaBadge({ c }: { c: ConfiancaDimensao | undefined }) {
  if (!c) return null;
  return (
    <Badge tone={NIVEL_TONE[c.nivel] ?? "neutral"} size="sm" title={`${c.motivo} ${c.comoMelhorar}`}>
      {CONFIANCA_LABEL[c.nivel]}
    </Badge>
  );
}

function Secao({
  icone: Icone,
  titulo,
  confianca,
  children,
}: {
  icone: typeof Target;
  titulo: string;
  confianca: ConfiancaDimensao | undefined;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Icone className="h-4 w-4 text-primary" aria-hidden />
        <h3 className="text-sm font-bold text-foreground">{titulo}</h3>
        <span className="ml-auto"><ConfiancaBadge c={confianca} /></span>
      </div>
      <div className="mt-3 space-y-2 text-xs">{children}</div>
    </Card>
  );
}

export function UtmDestaque({ utmBloco }: { utmBloco: string }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    await navigator.clipboard.writeText(utmBloco);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
    toast.success("Parâmetros de URL copiados.");
  };
  return (
    <Card className="border-2 border-sys-green/40 bg-sys-green/5 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="green">PRIMORDIAL</Badge>
        <h3 className="text-sm font-bold text-foreground">UTM — sem isto a campanha nasce invisível</h3>
        <Button variant="secondary" size="sm" onClick={copiar} className="ml-auto">
          {copiado ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          <span className="ml-1.5">{copiado ? "Copiado!" : "Copiar"}</span>
        </Button>
      </div>
      <code className="mt-3 block overflow-x-auto rounded-lg border border-border bg-card px-3 py-2 text-[11px] text-foreground">
        {utmBloco}
      </code>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Cole no campo <strong>Parâmetros de URL</strong> do anúncio. A Meta preenche <code>{"{{campaign.id}}"}</code> sozinha — é o que
        carimba cada lead com a campanha (CAC/ROI exatos e badges verdes no próximo plano).
      </p>
    </Card>
  );
}

export function BriefingView({
  plano,
  confianca,
  utmBloco,
}: {
  plano: PlanoCampanha;
  confianca: MapaConfianca | undefined;
  utmBloco: string;
}) {
  const confDe = (d: DimensaoPlano): ConfiancaDimensao | undefined => confianca?.[d];

  return (
    <div className="space-y-4">
      <UtmDestaque utmBloco={utmBloco} />

      <Card className="border-primary/20 bg-primary/5 p-5">
        <h2 className="text-sm font-bold text-foreground">Estratégia</h2>
        <p className="mt-2 text-xs leading-relaxed text-foreground">{plano.resumoEstrategia}</p>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Secao icone={Target} titulo="Objetivo" confianca={confDe("objetivo")}>
          <p className="font-semibold text-foreground">{plano.objetivo.recomendacao}</p>
          <p className="text-muted-foreground">{plano.objetivo.porque}</p>
        </Secao>

        <Secao icone={Users} titulo="Público" confianca={confDe("publico")}>
          <p className="font-semibold text-foreground">{plano.publico.recomendacao}</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="blue" size="sm">{plano.publico.idades}</Badge>
            <Badge tone="blue" size="sm">{plano.publico.genero}</Badge>
            <Badge tone="neutral" size="sm">{plano.publico.localizacoes}</Badge>
          </div>
          <p className="text-muted-foreground">{plano.publico.porque}</p>
        </Secao>

        <Secao icone={ImageIcon} titulo="Criativo" confianca={confDe("criativo")}>
          <p className="font-semibold text-foreground">{plano.criativo.recomendacao}</p>
          <p className="text-muted-foreground">{plano.criativo.porque}</p>
          <div className="border-t border-border pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Ângulos de copy</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
              {plano.copyHints.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        </Secao>

        <Secao icone={Wallet} titulo="Orçamento e duração" confianca={confDe("orcamento")}>
          <p className="font-semibold text-foreground">
            {brl.format(plano.orcamento.diarioBrl)}/dia por {plano.orcamento.duracaoDias} dias
            <span className="ml-1.5 font-normal text-muted-foreground">(total ≈ {brl.format(plano.orcamento.diarioBrl * plano.orcamento.duracaoDias)})</span>
          </p>
          <p className="text-muted-foreground">{plano.orcamento.porque}</p>
        </Secao>

        <Secao icone={Crosshair} titulo="CPL alvo (critério de sucesso)" confianca={confDe("cplAlvo")}>
          <p className="font-semibold text-foreground">{brl.format(plano.cplAlvo.valorBrl)} por lead</p>
          <p className="text-muted-foreground">{plano.cplAlvo.porque}</p>
        </Secao>

        <Secao icone={FlaskConical} titulo="Testes desta campanha" confianca={undefined}>
          {plano.testes.map((t, i) => (
            <div key={i} className={i > 0 ? "border-t border-border pt-2" : ""}>
              <p className="font-semibold text-foreground">{t.hipotese}</p>
              <p className="text-muted-foreground">Como medir: {t.comoMedir}</p>
            </div>
          ))}
        </Secao>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" aria-hidden />
          <h3 className="text-sm font-bold text-foreground">Checklist — preencha no Gerenciador de Anúncios nesta ordem</h3>
        </div>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-xs text-foreground">
          {plano.checklistMeta.map((passo, i) => (
            <li key={i}>{passo}</li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
