"use client";

import { useState, useTransition } from "react";
import {
  GitBranch,
  Users,
  TrendingUp,
  Gift,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { ScrollList } from "@/components/ui";
import { marcarRecompensaEntregue } from "@/lib/actions/indicacoes";
import { cn } from "@/lib/utils";

interface IndicadorData {
  id: string;
  nome: string;
  email: string;
}

interface AtletaData {
  id: string;
  nome_completo: string;
  esporte: string;
}

interface IndicacaoRow {
  id: string;
  status: "pendente" | "em_negociacao" | "convertido" | "perdido";
  recompensa_devida: boolean;
  recompensa_entregue: boolean;
  recompensa_entregue_at: string | null;
  recompensa_descricao: string | null;
  created_at: string;
  indicador: IndicadorData | null;
  atleta: AtletaData | null;
}

interface Kpis {
  total: number;
  convertidos: number;
  taxaConversao: number;
  recompensasPendentes: number;
}

const STATUS_OPTIONS = [
  { value: "todas", label: "Todas" },
  { value: "pendente", label: "Pendente" },
  { value: "em_negociacao", label: "Em negociacao" },
  { value: "convertido", label: "Convertido" },
  { value: "perdido", label: "Perdido" },
] as const;

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  pendente: { bg: "bg-secondary", text: "text-muted-foreground", label: "Pendente" },
  em_negociacao: { bg: "bg-sys-orange/15", text: "text-sys-orange", label: "Em negociacao" },
  convertido: { bg: "bg-sys-green/15", text: "text-sys-green", label: "Convertido" },
  perdido: { bg: "bg-sys-red/15", text: "text-sys-red", label: "Perdido" },
};

interface TopIndicador {
  id: string;
  nome: string;
  total: number;
  convertidos: number;
  taxa: number;
}

interface OrigemChannel {
  canal: string;
  label: string;
  count: number;
  pct: number;
}

interface IndicacoesClientProps {
  indicacoesIniciais: IndicacaoRow[];
  kpis: Kpis;
  topIndicadores: TopIndicador[];
  origemLeads: OrigemChannel[];
}

const ORIGEM_LABELS: Record<string, string> = {
  formulario_web: "Formulario web",
  indicacao: "Indicacao",
  instagram: "Instagram",
  meta_ads: "Meta Ads",
  outro: "Outro",
};

export function IndicacoesClient({ indicacoesIniciais, kpis, topIndicadores, origemLeads }: IndicacoesClientProps) {
  const [indicacoes, setIndicacoes] = useState<IndicacaoRow[]>(indicacoesIniciais);
  const [statusFiltro, setStatusFiltro] = useState("todas");
  const [isPending, startTransition] = useTransition();

  const handleEntregarRecompensa = (indicacaoId: string) => {
    const descricao = prompt("Descreva a recompensa entregue:");
    if (!descricao) return;

    startTransition(async () => {
      const result = await marcarRecompensaEntregue(indicacaoId, descricao);
      if (result.success) {
        setIndicacoes((prev) =>
          prev.map((ind) =>
            ind.id === indicacaoId
              ? {
                  ...ind,
                  recompensa_entregue: true,
                  recompensa_entregue_at: new Date().toISOString(),
                  recompensa_descricao: descricao,
                }
              : ind,
          ),
        );
        toast.success("Recompensa marcada como entregue");
      } else {
        toast.error(result.error ?? "Erro ao marcar recompensa");
      }
    });
  };

  const filtradas = statusFiltro === "todas"
    ? indicacoes
    : indicacoes.filter((i) => i.status === statusFiltro);

  return (
    <div className="flex h-full flex-col gap-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <GitBranch className="h-5 w-5 text-primary" />
          <h1 className="text-title-2 text-foreground">Indicacoes</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Programa de indicacoes e recompensas
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="border border-border/70 bg-card/60 flex items-center gap-3 rounded-xl px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Total indicacoes</p>
            <p className="text-lg font-bold text-foreground">{kpis.total}</p>
          </div>
        </div>
        <div className="border border-border/70 bg-card/60 flex items-center gap-3 rounded-xl px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sys-green/10">
            <TrendingUp className="h-4 w-4 text-sys-green" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Taxa de conversao</p>
            <p className="text-lg font-bold text-sys-green">{kpis.taxaConversao}%</p>
            <p className="text-[10px] text-label-tertiary">{kpis.convertidos} convertidos</p>
          </div>
        </div>
        <div className="border border-border/70 bg-card/60 flex items-center gap-3 rounded-xl px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sys-orange/10">
            <Gift className="h-4 w-4 text-sys-orange" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Recompensas pendentes</p>
            <p className={cn(
              "text-lg font-bold",
              kpis.recompensasPendentes > 0 ? "text-sys-orange" : "text-foreground",
            )}>
              {kpis.recompensasPendentes}
            </p>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-card p-1 w-fit">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFiltro(opt.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              statusFiltro === opt.value
                ? "bg-primary/15 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border border-border/70 bg-card/60 flex-1 overflow-auto rounded-xl">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Quem indicou
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Atleta indicado
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Recompensa
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Data
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Acao
              </th>
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-label-tertiary">
                  Nenhuma indicacao encontrada
                </td>
              </tr>
            ) : (
              filtradas.map((ind) => {
                const cfg = STATUS_CONFIG[ind.status] ?? STATUS_CONFIG.pendente;
                return (
                  <tr key={ind.id} className="border-b border-border last:border-0 hover:bg-accent">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">
                        {ind.indicador?.nome ?? "—"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {ind.indicador?.email ?? ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">
                        {ind.atleta?.nome_completo ?? "—"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {ind.atleta?.esporte ?? ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          cfg.bg,
                          cfg.text,
                        )}
                      >
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {ind.recompensa_devida ? (
                        ind.recompensa_entregue ? (
                          <span className="flex items-center gap-1 text-xs text-sys-green">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Entregue
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-sys-orange">Pendente</span>
                        )
                      ) : (
                        <span className="text-xs text-label-tertiary">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(ind.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      {ind.recompensa_devida && !ind.recompensa_entregue && (
                        <button
                          onClick={() => handleEntregarRecompensa(ind.id)}
                          disabled={isPending}
                          className="rounded-md bg-sys-green/15 px-2.5 py-1 text-[11px] font-semibold text-sys-green transition-colors hover:bg-sys-green/25 disabled:opacity-50"
                        >
                          Entregar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Top Indicadores */}
      {topIndicadores.length > 0 && (
        <div className="rounded-lg border border-border/70 bg-card/60 p-3.5 flex flex-col h-[18rem]">
          <div className="flex items-center gap-2 mb-4 shrink-0">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Top Indicadores</h3>
          </div>
          <ScrollList className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome</th>
                  <th className="py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total</th>
                  <th className="py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Convertidos</th>
                  <th className="py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Taxa</th>
                </tr>
              </thead>
              <tbody>
                {topIndicadores.map((ind, i) => (
                  <tr key={ind.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                          {i + 1}
                        </span>
                        <span className="font-medium text-foreground">{ind.nome}</span>
                      </div>
                    </td>
                    <td className="py-2 text-right text-muted-foreground">{ind.total}</td>
                    <td className="py-2 text-right text-sys-green">{ind.convertidos}</td>
                    <td className="py-2 text-right text-plan-legacy">{ind.taxa}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollList>
        </div>
      )}

      {/* Origem dos Leads (CAC proxy) */}
      {origemLeads.length > 0 && (
        <div className="rounded-lg border border-border/70 bg-card/60 p-3.5 flex flex-col h-[16rem]">
          <div className="flex items-center gap-2 mb-4 shrink-0">
            <TrendingUp className="h-4 w-4 text-sys-green" />
            <h3 className="text-sm font-semibold text-foreground">Origem dos Leads</h3>
          </div>
          <ScrollList className="space-y-2">
            {origemLeads.map((ch) => (
              <div key={ch.canal} className="flex items-center gap-3">
                <span className="w-32 text-sm text-foreground">{ch.label}</span>
                <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, ch.pct)}%` }}
                  />
                </div>
                <span className="w-10 text-right text-xs font-semibold text-muted-foreground">{ch.count}</span>
                <span className="w-12 text-right text-xs text-muted-foreground">{ch.pct}%</span>
              </div>
            ))}
          </ScrollList>
        </div>
      )}
    </div>
  );
}
