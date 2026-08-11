"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Brain, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { ScrollList } from "@/components/ui/ScrollList";
import { BriefingView } from "@/components/ads/BriefingView";
import { gerarPlanoCampanha, registrarAprendizadoAds, type PlanoResult } from "@/lib/actions/ads-planner";

export interface AprendizadoItem {
  tipo: string;
  resumo: string;
  confianca: string | null;
  criadoEm: string;
}

const NIVEL_TONE: Record<string, "green" | "orange" | "neutral"> = { assertiva: "green", parcial: "orange", sugestiva: "neutral" };
const TIPO_LABEL: Record<string, string> = { plano_gerado: "Plano", resultado_campanha: "Resultado", observacao: "Obs." };
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function PlanejarClient({ aprendizados }: { aprendizados: AprendizadoItem[] }) {
  const router = useRouter();
  const [foco, setFoco] = useState("");
  const [resultado, setResultado] = useState<PlanoResult | null>(null);
  const [gerando, startGerar] = useTransition();
  const [obs, setObs] = useState("");
  const [salvandoObs, startObs] = useTransition();

  const gerar = () =>
    startGerar(async () => {
      const r = await gerarPlanoCampanha({ foco: foco || undefined });
      setResultado(r);
      if (!r.success) {
        toast.error(r.error ?? "Falha ao gerar o plano.");
      } else {
        toast.success("Briefing gerado e salvo — abra na lista para personalizar.");
        router.refresh(); // plano salvo + aprendizado → listas atualizam
      }
    });

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

      {/* Briefing recém-gerado */}
      {resultado?.success && resultado.plano && resultado.utmBloco ? (
        <BriefingView plano={resultado.plano} confianca={resultado.confianca} utmBloco={resultado.utmBloco} />
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
