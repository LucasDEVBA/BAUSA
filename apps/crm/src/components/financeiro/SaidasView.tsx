"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Wallet,
  Plus,
  Pencil,
  Trash2,
  Repeat,
  CheckCircle2,
  CalendarClock,
  CircleDollarSign,
  PlayCircle,
  ReceiptText,
} from "lucide-react";
import { toast } from "sonner";

import { Badge, Card, EmptyState, ScrollList, StatCard, type BadgeTone } from "@/components/ui";
import {
  removerDespesa,
  marcarDespesaPaga,
  efetivarDespesaRecorrente,
} from "@/lib/actions/despesas";
import { abrirRecibo } from "@/lib/recibo";
import {
  DESPESA_CATEGORIA_LABEL,
  DESPESA_STATUS_LABEL,
  type Despesa,
  type DespesaCategoria,
  type DespesaStatus,
  type EmpresaDados,
} from "@/types/financeiro";
import { DespesaFormModal } from "./DespesaFormModal";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const CATEGORIA_TONE: Record<DespesaCategoria, BadgeTone> = {
  folha: "burgundy",
  marketing: "purple",
  ferramentas: "blue",
  servicos: "blue",
  impostos: "orange",
  comissoes: "green",
  ocupacao: "neutral",
  outros: "neutral",
};

const STATUS_TONE: Record<DespesaStatus, BadgeTone> = {
  previsto: "blue",
  pago: "green",
  atrasado: "red",
  cancelado: "neutral",
};

export function SaidasView({ despesas, empresa }: { despesas: Despesa[]; empresa: EmpresaDados }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Despesa | null>(null);
  const [novaRecorrente, setNovaRecorrente] = useState(false);

  const gerarComprovante = (d: Despesa) => {
    const mes = d.competencia.slice(0, 7).split("-").reverse().join("/");
    const ok = abrirRecibo({
      empresa,
      recebedorNome: d.fornecedor || d.descricao,
      valor: d.valor_brl,
      referente: `${d.descricao} — competência ${mes}`,
      data: d.pago_at ? new Date(d.pago_at) : undefined,
    });
    if (!ok) toast.error("O navegador bloqueou a janela. Permita pop-ups para gerar o comprovante.");
  };

  const mesAtual = new Date().toISOString().slice(0, 7);
  const templates = despesas.filter((d) => d.recorrente);
  const lancamentos = despesas.filter((d) => !d.recorrente);
  const doMes = lancamentos.filter((d) => d.competencia.startsWith(mesAtual) && d.status !== "cancelado");

  const recorrentesMes = templates
    .filter((t) => t.recorrencia_ativa)
    .reduce((s, t) => s + t.valor_brl, 0);
  const lancadoMes = doMes.reduce((s, d) => s + d.valor_brl, 0);
  const pagoMes = doMes.filter((d) => d.status === "pago").reduce((s, d) => s + d.valor_brl, 0);
  const emAbertoMes = doMes
    .filter((d) => d.status === "previsto" || d.status === "atrasado")
    .reduce((s, d) => s + d.valor_brl, 0);

  const openNew = (recorrente: boolean) => {
    setEditing(null);
    setNovaRecorrente(recorrente);
    setSheetOpen(true);
  };
  const openEdit = (d: Despesa) => {
    setEditing(d);
    setSheetOpen(true);
  };

  const run = (fn: () => Promise<{ success: boolean; error?: string }>, okMsg: string) => {
    startTransition(async () => {
      const result = await fn();
      if (result.success) {
        toast.success(okMsg);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const remover = (d: Despesa) => {
    if (!window.confirm(`Remover "${d.descricao}"?`)) return;
    run(() => removerDespesa(d.id), "Despesa removida");
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Recorrentes / mês" value={formatBRL(recorrentesMes)} icon={Repeat} accent="purple" context={`${templates.length} templates`} />
        <StatCard label="Lançado no mês" value={formatBRL(lancadoMes)} icon={CircleDollarSign} accent="brand" context="avulsas + efetivadas" />
        <StatCard label="Pago no mês" value={formatBRL(pagoMes)} icon={CheckCircle2} accent="green" context="saídas realizadas" />
        <StatCard label="Em aberto no mês" value={formatBRL(emAbertoMes)} icon={CalendarClock} accent="orange" context="previsto + atrasado" />
      </div>

      {/* Recorrentes (templates) */}
      <Card variant="plain" padding="none" className="flex h-[20rem] flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Despesas recorrentes</h2>
            <p className="text-xs text-muted-foreground">Templates que se repetem todo mês</p>
          </div>
          <button
            type="button"
            onClick={() => openNew(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15"
          >
            <Repeat className="h-3.5 w-3.5" />
            Nova recorrente
          </button>
        </div>
        {templates.length === 0 ? (
          <EmptyState
            icon={Repeat}
            title="Nenhuma despesa recorrente"
            description="Cadastre custos fixos (folha, ferramentas, aluguel) para projetá-los todo mês."
          />
        ) : (
          <ScrollList gutter={false} className="divide-y divide-border">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-accent/50">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{t.descricao}</p>
                    <Badge tone={CATEGORIA_TONE[t.categoria]} size="sm">
                      {DESPESA_CATEGORIA_LABEL[t.categoria]}
                    </Badge>
                    {!t.recorrencia_ativa && (
                      <Badge tone="neutral" size="sm">
                        Pausada
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Todo dia {t.recorrencia_dia ?? "—"} · {formatBRL(t.valor_brl)}/mês
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => run(() => efetivarDespesaRecorrente(t.id, mesAtual), "Pagamento do mês registrado")}
                  disabled={isPending}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-sys-green/25 bg-sys-green/10 px-2 py-1 text-[11px] font-semibold text-sys-green hover:bg-sys-green/15 disabled:opacity-50"
                  title="Registrar o pagamento deste mês"
                >
                  <PlayCircle className="h-3.5 w-3.5" />
                  Pagar mês
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => openEdit(t)} aria-label={`Editar ${t.descricao}`} className="rounded-md p-1.5 text-muted-foreground hover:bg-fill-4 hover:text-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => remover(t)} disabled={isPending} aria-label={`Remover ${t.descricao}`} className="rounded-md p-1.5 text-muted-foreground hover:bg-sys-red/10 hover:text-sys-red disabled:opacity-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </ScrollList>
        )}
      </Card>

      {/* Lançamentos (avulsas + efetivadas) */}
      <Card variant="plain" padding="none" className="flex h-[28rem] flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Lançamentos</h2>
            <p className="text-xs text-muted-foreground">Despesas avulsas e recorrentes já efetivadas</p>
          </div>
          <button
            type="button"
            onClick={() => openNew(false)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova despesa
          </button>
        </div>
        {lancamentos.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Nenhum lançamento"
            description="As saídas avulsas e as recorrentes pagas aparecem aqui."
            action={
              <button
                type="button"
                onClick={() => openNew(false)}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-3.5 w-3.5" />
                Lançar despesa
              </button>
            }
          />
        ) : (
          <ScrollList gutter={false} className="divide-y divide-border">
            {lancamentos.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-5 py-3 hover:bg-accent/50">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{d.descricao}</p>
                    <Badge tone={CATEGORIA_TONE[d.categoria]} size="sm">
                      {DESPESA_CATEGORIA_LABEL[d.categoria]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(`${d.competencia}T00:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
                    {d.fornecedor ? ` · ${d.fornecedor}` : ""}
                  </p>
                </div>
                <Badge tone={STATUS_TONE[d.status]} size="sm">
                  {DESPESA_STATUS_LABEL[d.status]}
                </Badge>
                <p className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
                  {formatBRL(d.valor_brl)}
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  {d.status !== "pago" && d.status !== "cancelado" && (
                    <button
                      type="button"
                      onClick={() => run(() => marcarDespesaPaga(d.id), "Despesa marcada como paga")}
                      disabled={isPending}
                      aria-label={`Marcar ${d.descricao} como paga`}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-sys-green/10 hover:text-sys-green disabled:opacity-50"
                      title="Marcar como paga"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {d.status === "pago" && (
                    <button
                      type="button"
                      onClick={() => gerarComprovante(d)}
                      aria-label={`Comprovante de ${d.descricao}`}
                      title="Gerar comprovante de pagamento"
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-sys-green/10 hover:text-sys-green"
                    >
                      <ReceiptText className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button type="button" onClick={() => openEdit(d)} aria-label={`Editar ${d.descricao}`} className="rounded-md p-1.5 text-muted-foreground hover:bg-fill-4 hover:text-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => remover(d)} disabled={isPending} aria-label={`Remover ${d.descricao}`} className="rounded-md p-1.5 text-muted-foreground hover:bg-sys-red/10 hover:text-sys-red disabled:opacity-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </ScrollList>
        )}
      </Card>

      <DespesaFormModal open={sheetOpen} onClose={() => setSheetOpen(false)} despesa={editing} recorrenteInicial={novaRecorrente} />
    </div>
  );
}
