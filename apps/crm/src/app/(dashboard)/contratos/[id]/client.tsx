"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  FileText,
  Receipt,
  User,
  Wallet,
} from "lucide-react";

import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import type { ContratoDetalhe } from "@/lib/actions/contratos";
import { cn } from "@/lib/utils";

const brl = (v: number) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

const dataLonga = (iso: string | null | undefined) =>
  iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

const PLANO_LABEL: Record<string, string> = { legacy: "Legacy", journey: "Journey", start: "Start" };
const FORMA_LABEL: Record<string, string> = {
  padrao: "Padrão",
  pix_avista: "Pix à vista",
  getnet_parcelado: "Getnet parcelado",
  pix: "Pix",
};
const STATUS_PARCELA = {
  recebido: { label: "Recebida", tone: "green" as const },
  previsto: { label: "Prevista", tone: "neutral" as const },
  atrasado: { label: "Atrasada", tone: "red" as const },
  cancelado: { label: "Cancelada", tone: "neutral" as const },
};

const ABAS = [
  { id: "resumo", label: "Resumo", icone: FileText },
  { id: "parcelas", label: "Parcelas", icone: CreditCard },
  { id: "contratante", label: "Contratante", icone: User },
  { id: "fiscal", label: "Nota fiscal", icone: Receipt },
] as const;

type Aba = (typeof ABAS)[number]["id"];

export function ContratoDetalheClient({ detalhe }: { detalhe: ContratoDetalhe }) {
  const [aba, setAba] = useState<Aba>("resumo");
  const c = (detalhe.contrato ?? {}) as Record<string, any>;

  const hoje = new Date().toISOString().slice(0, 10);
  const numeros = useMemo(() => {
    const recebidas = detalhe.parcelas.filter((p) => p.status === "recebido");
    const abertas = detalhe.parcelas.filter(
      (p) => p.status !== "recebido" && p.status !== "cancelado",
    );
    const atrasadas = abertas.filter((p) => p.vencimento < hoje);
    return {
      recebido: recebidas.reduce((s, p) => s + Number(p.valor ?? 0), 0),
      aReceber: abertas.reduce((s, p) => s + Number(p.valor ?? 0), 0),
      atrasado: atrasadas.reduce((s, p) => s + Number(p.valor ?? 0), 0),
      qtdAtrasadas: atrasadas.length,
      pagas: recebidas.length,
      total: detalhe.parcelas.length,
    };
  }, [detalhe.parcelas, hoje]);

  const pct = Number(c.valor_total)
    ? Math.round((numeros.recebido / Number(c.valor_total)) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/contratos"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Contratos
        </Link>
      </div>

      <PageHeader
        dense
        eyebrow={PLANO_LABEL[c.plano] ?? String(c.plano ?? "").toUpperCase()}
        title={detalhe.atleta?.nome ?? "Contrato"}
        actions={
          detalhe.dealId ? (
            <Link
              href={`/pipeline?deal=${detalhe.dealId}`}
              className="rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              Abrir no pipeline
            </Link>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Valor do contrato" value={brl(Number(c.valor_total))} icon={FileText} accent="brand" />
        <StatCard
          label="Recebido"
          value={brl(numeros.recebido)}
          icon={CheckCircle2}
          accent="green"
          context={`${pct}% · ${numeros.pagas}/${numeros.total} parcelas`}
        />
        <StatCard label="A receber" value={brl(numeros.aReceber)} icon={Wallet} accent="blue" />
        <StatCard
          label="Em atraso"
          value={brl(numeros.atrasado)}
          icon={CalendarClock}
          accent={numeros.qtdAtrasadas > 0 ? "red" : "green"}
          context={numeros.qtdAtrasadas > 0 ? `${numeros.qtdAtrasadas} parcela(s)` : "nada vencido"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {ABAS.map((a) => {
          const Icone = a.icone;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setAba(a.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                aba === a.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground",
              )}
            >
              <Icone aria-hidden className="size-3.5" />
              {a.label}
            </button>
          );
        })}
      </div>

      {aba === "resumo" && <AbaResumo contrato={c} />}
      {aba === "parcelas" && <AbaParcelas parcelas={detalhe.parcelas} hoje={hoje} />}
      {aba === "contratante" && (
        <AbaContratante atleta={detalhe.atleta} responsavel={detalhe.responsavel} />
      )}
      {aba === "fiscal" && <AbaFiscal contrato={c} />}
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2 last:border-0">
      <dt className="shrink-0 text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="min-w-0 text-right text-xs font-medium text-foreground">{valor}</dd>
    </div>
  );
}

function AbaResumo({ contrato: c }: { contrato: Record<string, any> }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Plano e valores</h3>
        <dl>
          <Linha rotulo="Plano" valor={PLANO_LABEL[c.plano] ?? c.plano} />
          <Linha rotulo="Forma do plano" valor={FORMA_LABEL[c.forma_pagamento_plano] ?? c.forma_pagamento_plano} />
          <Linha rotulo="Valor total" valor={brl(Number(c.valor_total))} />
          {c.valor_customizado != null && (
            <Linha rotulo="Valor customizado" valor={brl(Number(c.valor_customizado))} />
          )}
          <Linha rotulo="Saldo remanescente" valor={brl(Number(c.saldo_remanescente))} />
          <Linha
            rotulo="Psicóloga"
            valor={c.inclui_psicologa ? `Inclusa · ${brl(Number(c.custo_psicologa))}` : "Não inclusa"}
          />
          {c.lucro_estimado != null && (
            <Linha rotulo="Lucro estimado" valor={brl(Number(c.lucro_estimado))} />
          )}
        </dl>
        {c.justificativa_customizacao && (
          <p className="mt-3 rounded-lg border border-sys-orange/25 bg-sys-orange/8 px-3 py-2 text-[11px] leading-relaxed text-sys-orange">
            <strong>Justificativa do valor customizado:</strong> {c.justificativa_customizacao}
          </p>
        )}
      </Card>

      <Card>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Entrada e saldo</h3>
        <dl>
          <Linha rotulo="Entrada" valor={brl(Number(c.entrada_valor))} />
          <Linha rotulo="Forma da entrada" valor={FORMA_LABEL[c.entrada_forma] ?? c.entrada_forma} />
          <Linha rotulo="Parcelas da entrada" valor={c.entrada_parcelas ?? 1} />
          <Linha
            rotulo="Entrada paga"
            valor={
              c.entrada_paga ? (
                <Badge tone="green" size="sm">
                  Sim · {dataLonga(c.entrada_paga_at)}
                </Badge>
              ) : (
                <Badge tone="orange" size="sm">Pendente</Badge>
              )
            }
          />
          <Linha rotulo="Forma do saldo" valor={FORMA_LABEL[c.saldo_forma] ?? c.saldo_forma ?? "—"} />
          <Linha rotulo="Parcelas do saldo" valor={c.saldo_parcelas ?? "—"} />
          <Linha rotulo="Criado em" valor={dataLonga(c.created_at)} />
        </dl>
      </Card>
    </div>
  );
}

function AbaParcelas({
  parcelas,
  hoje,
}: {
  parcelas: ContratoDetalhe["parcelas"];
  hoje: string;
}) {
  if (parcelas.length === 0) {
    return (
      <Card>
        <EmptyState icon={CreditCard} title="Sem parcelas" description="Este contrato não tem parcelas geradas." />
      </Card>
    );
  }
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[620px] text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            {["Parcela", "Tipo", "Vencimento", "Valor", "Método", "Situação"].map((h) => (
              <th key={h} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-label-tertiary">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {parcelas.map((p) => {
            const atrasada = p.status !== "recebido" && p.status !== "cancelado" && p.vencimento < hoje;
            const info = atrasada ? STATUS_PARCELA.atrasado : STATUS_PARCELA[p.status as keyof typeof STATUS_PARCELA] ?? STATUS_PARCELA.previsto;
            return (
              <tr key={p.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3 text-xs font-medium text-foreground">{p.numero_parcela ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{p.tipo ?? "—"}</td>
                <td className={cn("px-4 py-3 text-xs tabular-nums", atrasada ? "font-semibold text-sys-red" : "text-muted-foreground")}>
                  {dataLonga(p.vencimento)}
                </td>
                <td className="px-4 py-3 text-xs tabular-nums text-foreground">{brl(Number(p.valor))}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{FORMA_LABEL[p.metodo ?? ""] ?? p.metodo ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge tone={info.tone} size="sm">{info.label}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function AbaContratante({
  atleta,
  responsavel,
}: {
  atleta: ContratoDetalhe["atleta"];
  responsavel: ContratoDetalhe["responsavel"];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Atleta</h3>
        <dl>
          <Linha rotulo="Nome" valor={atleta?.nome ?? "—"} />
          <Linha rotulo="E-mail" valor={atleta?.email ?? "—"} />
          <Linha rotulo="WhatsApp" valor={atleta?.whatsapp ?? "—"} />
        </dl>
      </Card>
      <Card>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Responsável financeiro</h3>
        {responsavel ? (
          <dl>
            <Linha rotulo="Nome" valor={responsavel.nome ?? "—"} />
            <Linha rotulo="E-mail" valor={responsavel.email ?? "—"} />
            <Linha rotulo="WhatsApp" valor={responsavel.whatsapp ?? "—"} />
          </dl>
        ) : (
          <p className="py-6 text-center text-xs text-label-tertiary">
            Sem responsável vinculado ao atleta.
          </p>
        )}
      </Card>
    </div>
  );
}

function AbaFiscal({ contrato: c }: { contrato: Record<string, any> }) {
  const tone = c.nf_status === "emitida" ? "green" : c.nf_status === "nao_aplicavel" ? "neutral" : "orange";
  const label =
    c.nf_status === "emitida" ? "Emitida" : c.nf_status === "nao_aplicavel" ? "Não aplicável" : "Pendente";
  return (
    <Card>
      <h3 className="mb-2 text-sm font-semibold text-foreground">Nota fiscal</h3>
      <dl>
        <Linha rotulo="Situação" valor={<Badge tone={tone} size="sm">{label}</Badge>} />
        <Linha rotulo="Número" valor={c.nf_numero ?? "—"} />
        <Linha rotulo="Valor" valor={c.nf_valor != null ? brl(Number(c.nf_valor)) : "—"} />
        <Linha rotulo="Emitida em" valor={dataLonga(c.nf_emitida_at)} />
      </dl>
      <p className="mt-3 text-[11px] leading-relaxed text-label-tertiary">
        A emissão e a baixa de parcelas continuam na aba Contrato do lead, no pipeline — esta tela
        é a visão consolidada da carteira.
      </p>
    </Card>
  );
}
