"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Copy, Check, Brain, Plus, Target, Users, Image as ImageIcon, Wallet, Crosshair, FlaskConical, ListChecks } from "lucide-react";
import { toast } from "sonner";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { ScrollList } from "@/components/ui/ScrollList";
import { gerarPlanoCampanha, registrarAprendizadoAds, type PlanoResult } from "@/lib/actions/ads-planner";
import { CONFIANCA_LABEL, type ConfiancaDimensao, type DimensaoPlano } from "@/lib/ads-confianca";

// Badges de confiança: SEMPRE do mapa determinístico vindo do server
// (ads-confianca) — nunca da IA. A IA só escreve o "porquê".

export interface AprendizadoItem {
  tipo: string;
  resumo: string;
  confianca: string | null;
  criadoEm: string;
}

const NIVEL_TONE: Record<string, BadgeTone> = { assertiva: "green", parcial: "orange", sugestiva: "neutral" };
const TIPO_LABEL: Record<string, string> = { plano_gerado: "Plano", resultado_campanha: "Resultado", observacao: "Obs." };
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

export function PlanejarClient({ aprendizados }: { aprendizados: AprendizadoItem[] }) {
  const router = useRouter();
  const [foco, setFoco] = useState("");
  const [resultado, setResultado] = useState<PlanoResult | null>(null);
  const [gerando, startGerar] = useTransition();
  const [copiado, setCopiado] = useState(false);
  const [obs, setObs] = useState("");
  const [salvandoObs, startObs] = useTransition();

  const gerar = () =>
    startGerar(async () => {
      const r = await gerarPlanoCampanha({ foco: foco || undefined });
      setResultado(r);
      if (!r.success) {
        toast.error(r.error ?? "Falha ao gerar o plano.");
      } else {
        toast.success("Briefing gerado — cada seção mostra o quanto é sustentada por dados.");
        router.refresh(); // o plano vira aprendizado → lista do cérebro atualiza
      }
    });

  const copiarUtm = async () => {
    if (!resultado?.utmBloco) return;
    await navigator.clipboard.writeText(resultado.utmBloco);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
    toast.success("Parâmetros de URL copiados.");
  };

  const salvarObs = () =>
    startObs(async () => {
      const r = await registrarAprendizadoAds({ resumo: obs });
      if (r.success) {
        toast.success("Aprendizado registrado — entra no próximo plano.");
        setObs("");
        router.refresh();
      } else {
        toast.error(r.error ?? "Falha ao registrar.");
      }
    });

  const plano = resultado?.success ? resultado.plano : undefined;
  const conf = resultado?.success ? resultado.confianca : undefined;
  const confDe = (d: DimensaoPlano): ConfiancaDimensao | undefined => conf?.[d];

  return (
    <div className="space-y-5">
      {/* Gerador */}
      <Card className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="foco" className="block text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">
              Foco desta campanha (opcional)
            </label>
            <Input
              id="foco"
              value={foco}
              onChange={(e) => setFoco(e.target.value)}
              placeholder='Ex.: "captar leads para a temporada 2027" ou "testar público de pais de goleiros"'
              className="mt-1.5"
            />
          </div>
          <Button onClick={gerar} disabled={gerando}>
            {gerando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
            <span className="ml-1.5">{gerando ? "Analisando funil + histórico…" : "Gerar briefing"}</span>
          </Button>
        </div>
        {resultado?.success && resultado.evidencia ? (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Base analisada: {resultado.evidencia.campanhasComGasto} campanhas · {brl.format(resultado.evidencia.gastoTotal)} em {resultado.evidencia.diasComDados} dias ·{" "}
            <strong className="text-foreground">{resultado.evidencia.leadsAtribuidos} leads e {resultado.evidencia.clientesAtribuidos} clientes atribuídos</strong> — os badges refletem essa massa.
          </p>
        ) : null}
      </Card>

      {/* Briefing */}
      {plano ? (
        <>
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

          {/* UTM — o elo que fecha a atribuição */}
          <Card className="border-sys-green/30 bg-sys-green/5 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">Parâmetros de URL (cole no campo do anúncio)</h3>
              <Button variant="secondary" size="sm" onClick={copiarUtm} className="ml-auto">
                {copiado ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                <span className="ml-1.5">{copiado ? "Copiado!" : "Copiar"}</span>
              </Button>
            </div>
            <code className="mt-3 block overflow-x-auto rounded-lg border border-border bg-card px-3 py-2 text-[11px] text-foreground">
              {resultado?.utmBloco}
            </code>
            <p className="mt-2 text-[11px] text-muted-foreground">
              A Meta preenche <code>{"{{campaign.id}}"}</code> sozinha — é o que faz cada lead nascer carimbado com a campanha (CAC/ROI exatos no Engine).
            </p>
          </Card>

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
        </>
      ) : resultado && !resultado.success ? (
        <EmptyState icon={Sparkles} title="Não foi possível gerar o briefing" description={resultado.error} />
      ) : null}

      {/* Cérebro — aprendizados */}
      <Card className="flex h-[22rem] flex-col p-5">
        <div className="flex shrink-0 items-center gap-2">
          <Brain className="h-4 w-4 text-bau-burgundy" aria-hidden />
          <h3 className="text-sm font-bold text-foreground">Cérebro de Ads — aprendizados ({aprendizados.length})</h3>
        </div>
        <p className="mt-1 shrink-0 text-[11px] text-muted-foreground">
          Cada plano, resultado e observação entra aqui e alimenta o próximo briefing e os insights de CAC.
        </p>
        <div className="mt-3 flex shrink-0 gap-2">
          <Input
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder='Registrar observação (ex.: "vídeos de tour convertem melhor que fotos")'
            aria-label="Nova observação para o cérebro de Ads"
          />
          <Button variant="secondary" size="sm" onClick={salvarObs} disabled={salvandoObs || obs.trim().length < 10}>
            {salvandoObs ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
          </Button>
        </div>
        {aprendizados.length === 0 ? (
          <EmptyState title="Cérebro vazio ainda" description="Gere o primeiro briefing ou registre uma observação." className="flex-1" />
        ) : (
          <ScrollList className="mt-3 divide-y divide-border" gutter={false}>
            {aprendizados.map((a, i) => (
              <div key={i} className="flex items-start gap-2 py-2.5">
                <Badge tone="neutral" size="sm" className="mt-0.5 shrink-0">{TIPO_LABEL[a.tipo] ?? a.tipo}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-relaxed text-foreground">{a.resumo}</p>
                  <p className="mt-0.5 text-[10px] text-label-tertiary">
                    {a.criadoEm ? new Date(a.criadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : ""}
                  </p>
                </div>
                {a.confianca ? <Badge tone={NIVEL_TONE[a.confianca] ?? "neutral"} size="sm" className="shrink-0">{a.confianca}</Badge> : null}
              </div>
            ))}
          </ScrollList>
        )}
      </Card>
    </div>
  );
}
