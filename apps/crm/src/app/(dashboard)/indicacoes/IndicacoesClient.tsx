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
  pendente: { bg: "bg-zinc-500/15", text: "text-zinc-400", label: "Pendente" },
  em_negociacao: { bg: "bg-amber-500/15", text: "text-amber-400", label: "Em negociacao" },
  convertido: { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "Convertido" },
  perdido: { bg: "bg-red-500/15", text: "text-red-400", label: "Perdido" },
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
          <GitBranch className="h-5 w-5 text-indigo-400" />
          <h1 className="text-xl font-bold text-zinc-100">Indicacoes</h1>
        </div>
        <p className="text-sm text-zinc-500">
          Programa de indicacoes e recompensas
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border border-[#1e2130] bg-[#141720] px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10">
            <Users className="h-4 w-4 text-indigo-400" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-500">Total indicacoes</p>
            <p className="text-lg font-bold text-zinc-100">{kpis.total}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-[#1e2130] bg-[#141720] px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-500">Taxa de conversao</p>
            <p className="text-lg font-bold text-emerald-400">{kpis.taxaConversao}%</p>
            <p className="text-[10px] text-zinc-600">{kpis.convertidos} convertidos</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-[#1e2130] bg-[#141720] px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
            <Gift className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-500">Recompensas pendentes</p>
            <p className={cn(
              "text-lg font-bold",
              kpis.recompensasPendentes > 0 ? "text-amber-400" : "text-zinc-100",
            )}>
              {kpis.recompensasPendentes}
            </p>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg border border-[#1e2130] bg-[#141720] p-1 w-fit">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFiltro(opt.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              statusFiltro === opt.value
                ? "bg-indigo-600/20 text-indigo-300"
                : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-xl border border-[#1e2130] bg-[#141720]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#1e2130]">
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Quem indicou
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Atleta indicado
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Status
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Recompensa
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Data
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Acao
              </th>
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-zinc-600">
                  Nenhuma indicacao encontrada
                </td>
              </tr>
            ) : (
              filtradas.map((ind) => {
                const cfg = STATUS_CONFIG[ind.status] ?? STATUS_CONFIG.pendente;
                return (
                  <tr key={ind.id} className="border-b border-[#1e2130] last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-200">
                        {ind.indicador?.nome ?? "—"}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {ind.indicador?.email ?? ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-200">
                        {ind.atleta?.nome_completo ?? "—"}
                      </p>
                      <p className="text-[11px] text-zinc-500">
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
                          <span className="flex items-center gap-1 text-xs text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Entregue
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-amber-400">Pendente</span>
                        )
                      ) : (
                        <span className="text-xs text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {new Date(ind.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      {ind.recompensa_devida && !ind.recompensa_entregue && (
                        <button
                          onClick={() => handleEntregarRecompensa(ind.id)}
                          disabled={isPending}
                          className="rounded-lg bg-emerald-600/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-600/30 disabled:opacity-50"
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
        <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Top Indicadores</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e2130]">
                  <th className="py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Nome</th>
                  <th className="py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Total</th>
                  <th className="py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Convertidos</th>
                  <th className="py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Taxa</th>
                </tr>
              </thead>
              <tbody>
                {topIndicadores.map((ind, i) => (
                  <tr key={ind.id} className="border-b border-[#1e2130]/50 last:border-0">
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600/20 text-[10px] font-bold text-indigo-400">
                          {i + 1}
                        </span>
                        <span className="font-medium text-zinc-200">{ind.nome}</span>
                      </div>
                    </td>
                    <td className="py-2 text-right text-zinc-400">{ind.total}</td>
                    <td className="py-2 text-right text-emerald-400">{ind.convertidos}</td>
                    <td className="py-2 text-right text-purple-400">{ind.taxa}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Origem dos Leads (CAC proxy) */}
      {origemLeads.length > 0 && (
        <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Origem dos Leads</h3>
          </div>
          <div className="space-y-2">
            {origemLeads.map((ch) => (
              <div key={ch.canal} className="flex items-center gap-3">
                <span className="w-32 text-sm text-zinc-300">{ch.label}</span>
                <div className="flex-1 h-2 rounded-full bg-[#1e2130] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all"
                    style={{ width: `${Math.min(100, ch.pct)}%` }}
                  />
                </div>
                <span className="w-10 text-right text-xs font-semibold text-zinc-400">{ch.count}</span>
                <span className="w-12 text-right text-xs text-zinc-500">{ch.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
