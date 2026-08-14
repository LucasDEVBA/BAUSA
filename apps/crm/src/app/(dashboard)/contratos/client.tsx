"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  FileSignature,
  Search,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { Badge, Card, EmptyState, Input, PageHeader, StatCard } from "@/components/ui";
import type { ContratoLista, ResumoCarteira, SituacaoContrato } from "@/lib/actions/contratos";
import { cn } from "@/lib/utils";

const SITUACAO = {
  em_dia: { label: "Em dia", tone: "green" as const },
  atrasado: { label: "Em atraso", tone: "red" as const },
  quitado: { label: "Quitado", tone: "blue" as const },
  cancelado: { label: "Cancelado", tone: "neutral" as const },
};

const PLANO_LABEL: Record<string, string> = {
  legacy: "Legacy",
  journey: "Journey",
  start: "Start",
};

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const dataCurta = (iso: string | null) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—";

export function ContratosClient({
  contratos,
  resumo,
}: {
  contratos: ContratoLista[];
  resumo: ResumoCarteira;
}) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | SituacaoContrato>("todos");

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return contratos.filter(
      (c) =>
        (filtro === "todos" || c.situacao === filtro) &&
        (termo.length < 2 || c.atleta.toLowerCase().includes(termo)),
    );
  }, [contratos, busca, filtro]);

  const pctRecebido =
    resumo.valorContratado > 0 ? Math.round((resumo.recebido / resumo.valorContratado) * 100) : 0;

  return (
    <div className="space-y-4">
      <PageHeader dense eyebrow="FINANCEIRO" title="Contratos" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Contratado"
          value={brl(resumo.valorContratado)}
          icon={FileSignature}
          accent="brand"
          context={`${resumo.contratos} contrato(s)`}
        />
        <StatCard
          label="Recebido"
          value={brl(resumo.recebido)}
          icon={CheckCircle2}
          accent="green"
          context={`${pctRecebido}% do contratado`}
        />
        <StatCard
          label="A receber"
          value={brl(resumo.aReceber)}
          icon={Wallet}
          accent="blue"
          context="parcelas em aberto"
        />
        <StatCard
          label="Em atraso"
          value={brl(resumo.emAtraso)}
          icon={AlertTriangle}
          accent={resumo.emAtraso > 0 ? "red" : "green"}
          context={
            resumo.contratosComAtraso > 0
              ? `${resumo.contratosComAtraso} contrato(s)`
              : "nenhum atraso"
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-label-tertiary"
          />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por atleta…"
            aria-label="Buscar contrato"
            className="pl-8"
          />
        </div>
        {(["todos", "em_dia", "atrasado", "quitado", "cancelado"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltro(f)}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
              filtro === f
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {f === "todos" ? "Todos" : SITUACAO[f].label}
          </button>
        ))}
        <span className="ml-auto text-xs text-label-tertiary">
          {visiveis.length} de {contratos.length}
        </span>
      </div>

      {visiveis.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileSignature}
            title={contratos.length === 0 ? "Nenhum contrato ainda" : "Nada neste filtro"}
            description={
              contratos.length === 0
                ? "O contrato nasce no deal: abra o lead no pipeline e use a aba Contrato."
                : "Ajuste a busca ou o filtro de situação."
            }
          />
        </Card>
      ) : (
        <>
          {/* Tabela — desktop */}
          <Card className="hidden overflow-x-auto p-0 lg:block">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {["Atleta", "Plano", "Valor", "Recebido", "Parcelas", "Próx. venc.", "Situação"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-label-tertiary"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {visiveis.map((c) => (
                  <tr key={c.id} className="border-b border-border/60 last:border-0 hover:bg-accent/50">
                    <td className="max-w-[220px] px-4 py-3">
                      <Link
                        href={`/contratos/${c.id}`}
                        className="block truncate font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {c.atleta}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {PLANO_LABEL[c.plano] ?? c.plano}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-foreground">
                      {brl(c.valorTotal)}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">
                      {brl(c.recebido)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-16 overflow-hidden rounded-full bg-secondary">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              c.parcelasAtrasadas > 0 ? "bg-sys-red" : "bg-sys-green",
                            )}
                            style={{
                              width: `${c.parcelasTotal ? (c.parcelasPagas / c.parcelasTotal) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <span className="text-[11px] tabular-nums text-muted-foreground">
                          {c.parcelasPagas}/{c.parcelasTotal}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">
                      {dataCurta(c.proximoVencimento)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={SITUACAO[c.situacao].tone} size="sm">
                        {SITUACAO[c.situacao].label}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Cards — mobile */}
          <div className="space-y-3 lg:hidden">
            {visiveis.map((c) => (
              <Link key={c.id} href={`/contratos/${c.id}`} className="block">
                <Card className="transition-colors hover:bg-accent/50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{c.atleta}</p>
                      <p className="mt-0.5 text-[11px] text-label-tertiary">
                        {PLANO_LABEL[c.plano] ?? c.plano} · {brl(c.valorTotal)}
                      </p>
                    </div>
                    <Badge tone={SITUACAO[c.situacao].tone} size="sm">
                      {SITUACAO[c.situacao].label}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span className="tabular-nums">
                      {c.parcelasPagas}/{c.parcelasTotal} parcelas · {brl(c.recebido)} recebido
                    </span>
                    <span className="flex items-center gap-1 tabular-nums">
                      <TrendingUp aria-hidden className="size-3" />
                      {dataCurta(c.proximoVencimento)}
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
