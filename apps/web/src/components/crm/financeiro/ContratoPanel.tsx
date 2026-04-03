"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Check, Plus } from "lucide-react";
import { criarContrato, confirmarPagamento, getContratoByDeal } from "@/lib/crm/actions/financeiro";
import { PLANO_VALORES, ENTRADA_PADRAO } from "@/types/crm";
import type { ContratoFinanceiro, Parcela } from "@/types/crm";
import { toast } from "sonner";

interface ContratoPanelProps {
  dealId: string;
}

export function ContratoPanel({ dealId }: ContratoPanelProps) {
  const router = useRouter();
  const [contrato, setContrato] = useState<ContratoFinanceiro | null>(null);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [plano, setPlano] = useState<'journey' | 'legacy' | 'start'>('journey');
  const [formaPagamento, setFormaPagamento] = useState<'padrao' | 'pix_avista'>('padrao');
  const [entradaValor, setEntradaValor] = useState(ENTRADA_PADRAO);
  const [entradaForma, setEntradaForma] = useState<'pix' | 'getnet_parcelado'>('pix');
  const [entradaParcelas, setEntradaParcelas] = useState(1);
  const [saldoForma, setSaldoForma] = useState<'pix_avista' | 'getnet_parcelado'>('getnet_parcelado');
  const [saldoParcelas, setSaldoParcelas] = useState(6);

  useEffect(() => {
    loadContrato();
  }, [dealId]);

  const loadContrato = async () => {
    setLoading(true);
    const result = await getContratoByDeal(dealId);
    setContrato(result.contrato as ContratoFinanceiro | null);
    setParcelas(result.parcelas as Parcela[]);
    setLoading(false);
  };

  const planoConfig = PLANO_VALORES[plano];
  const valorTotal = formaPagamento === 'pix_avista' ? planoConfig.pix : planoConfig.padrao;
  const saldo = valorTotal - entradaValor;

  const handleCriar = () => {
    startTransition(async () => {
      const result = await criarContrato(dealId, {
        plano,
        forma_pagamento_plano: formaPagamento,
        entrada_valor: entradaValor,
        entrada_forma: entradaForma,
        entrada_parcelas: entradaForma === 'getnet_parcelado' ? entradaParcelas : 1,
        saldo_forma: saldoForma,
        saldo_parcelas: saldoForma === 'getnet_parcelado' ? saldoParcelas : 1,
      });
      if (result.success) {
        toast.success("Contrato criado!");
        await loadContrato();
        setShowForm(false);
        router.refresh();
      } else {
        toast.error(result.error || "Erro ao criar contrato.");
      }
    });
  };

  const handleConfirmarPagamento = (parcelaId: string) => {
    startTransition(async () => {
      const result = await confirmarPagamento(parcelaId);
      if (result.success) {
        toast.success("Pagamento confirmado!");
        await loadContrato();
        router.refresh();
      } else {
        toast.error(result.error || "Erro.");
      }
    });
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[var(--crm-text-tertiary)]" /></div>;
  }

  if (!contrato && !showForm) {
    return (
      <div className="crm-empty-state py-8">
        <p className="crm-empty-state-description">Nenhum contrato financeiro.</p>
        <button onClick={() => setShowForm(true)} className="crm-btn crm-btn-primary mt-2">
          <Plus className="w-4 h-4" /> Criar Contrato
        </button>
      </div>
    );
  }

  if (showForm && !contrato) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-[var(--crm-text-secondary)]">Plano</Label>
            <Select value={plano} onValueChange={(v) => setPlano(v as any)}>
              <SelectTrigger className="crm-input"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="journey">Journey (R$ 26.000)</SelectItem>
                <SelectItem value="legacy">Legacy (R$ 32.000)</SelectItem>
                <SelectItem value="start">Start (R$ 18.000)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[var(--crm-text-secondary)]">Pagamento</Label>
            <Select value={formaPagamento} onValueChange={(v) => setFormaPagamento(v as any)}>
              <SelectTrigger className="crm-input"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="padrao">Padrao</SelectItem>
                <SelectItem value="pix_avista">Pix a vista (desconto)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-[var(--crm-text-secondary)]">Entrada (R$)</Label>
            <input type="number" value={entradaValor} onChange={(e) => setEntradaValor(Number(e.target.value))} className="crm-input" />
          </div>
          <div className="space-y-2">
            <Label className="text-[var(--crm-text-secondary)]">Forma entrada</Label>
            <Select value={entradaForma} onValueChange={(v) => setEntradaForma(v as any)}>
              <SelectTrigger className="crm-input"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">Pix</SelectItem>
                <SelectItem value="getnet_parcelado">GetNet parcelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {entradaForma === 'getnet_parcelado' && (
          <div className="space-y-2">
            <Label className="text-[var(--crm-text-secondary)]">Parcelas entrada</Label>
            <input type="number" min={1} max={12} value={entradaParcelas} onChange={(e) => setEntradaParcelas(Number(e.target.value))} className="crm-input" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-[var(--crm-text-secondary)]">Forma saldo</Label>
            <Select value={saldoForma} onValueChange={(v) => setSaldoForma(v as any)}>
              <SelectTrigger className="crm-input"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pix_avista">Pix a vista</SelectItem>
                <SelectItem value="getnet_parcelado">GetNet parcelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {saldoForma === 'getnet_parcelado' && (
            <div className="space-y-2">
              <Label className="text-[var(--crm-text-secondary)]">Parcelas saldo</Label>
              <input type="number" min={1} max={24} value={saldoParcelas} onChange={(e) => setSaldoParcelas(Number(e.target.value))} className="crm-input" />
            </div>
          )}
        </div>

        <div className="rounded-[var(--crm-radius-lg)] bg-[var(--crm-neutral-100)] border border-[var(--crm-border)] p-4 text-[var(--crm-text-sm)] space-y-1">
          <div className="flex justify-between"><span className="text-[var(--crm-text-secondary)]">Valor total:</span><span className="font-[var(--crm-weight-semibold)] text-[var(--crm-text-primary)]">R$ {valorTotal.toLocaleString("pt-BR")}</span></div>
          <div className="flex justify-between"><span className="text-[var(--crm-text-secondary)]">Entrada:</span><span className="text-[var(--crm-text-primary)]">R$ {entradaValor.toLocaleString("pt-BR")}</span></div>
          <div className="flex justify-between"><span className="text-[var(--crm-text-secondary)]">Saldo:</span><span className="text-[var(--crm-text-primary)]">R$ {saldo.toLocaleString("pt-BR")}</span></div>
          {planoConfig.psicologa && <div className="flex justify-between text-[var(--crm-text-tertiary)]"><span>Psicologa:</span><span>R$ 1.200</span></div>}
        </div>

        <div className="flex gap-2">
          <button onClick={handleCriar} disabled={isPending} className="crm-btn crm-btn-primary flex-1">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Criar Contrato
          </button>
          <button onClick={() => setShowForm(false)} className="crm-btn crm-btn-secondary">Cancelar</button>
        </div>
      </div>
    );
  }

  // Contrato existente
  const statusColor = (s: string) => {
    if (s === "recebido") return "bg-[var(--crm-success-subtle)] text-[var(--crm-success)] border-[var(--crm-success-border)]";
    if (s === "atrasado") return "bg-[var(--crm-error-subtle)] text-[var(--crm-error)] border-[var(--crm-error-border)]";
    return "bg-[var(--crm-neutral-100)] text-[var(--crm-text-secondary)] border-[var(--crm-border)]";
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[var(--crm-radius-lg)] bg-[var(--crm-neutral-100)] border border-[var(--crm-border)] p-4 text-[var(--crm-text-sm)] space-y-1">
        <div className="flex justify-between"><span className="text-[var(--crm-text-secondary)]">Plano:</span><span className="font-[var(--crm-weight-semibold)] capitalize text-[var(--crm-text-primary)]">{contrato!.plano}</span></div>
        <div className="flex justify-between"><span className="text-[var(--crm-text-secondary)]">Valor total:</span><span className="font-[var(--crm-weight-semibold)] text-[var(--crm-text-primary)]">R$ {Number(contrato!.valor_total).toLocaleString("pt-BR")}</span></div>
        <div className="flex justify-between"><span className="text-[var(--crm-text-secondary)]">Entrada:</span><span className="text-[var(--crm-text-primary)]">R$ {Number(contrato!.entrada_valor).toLocaleString("pt-BR")} ({contrato!.entrada_paga ? "Pago" : "Pendente"})</span></div>
        <div className="flex justify-between"><span className="text-[var(--crm-text-secondary)]">Saldo:</span><span className="text-[var(--crm-text-primary)]">R$ {Number(contrato!.saldo_remanescente).toLocaleString("pt-BR")}</span></div>
        <div className="flex justify-between"><span className="text-[var(--crm-text-secondary)]">NF:</span><span className="crm-badge crm-badge-neutral crm-badge-no-dot text-[var(--crm-text-xs)]">{contrato!.nf_status}</span></div>
      </div>

      <div>
        <h4 className="crm-section-label mb-2">Parcelas</h4>
        <div className="overflow-x-auto">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Parcela</th>
                <th>Valor</th>
                <th>Vencimento</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {parcelas.map((p) => {
                const vencida = p.vencimento < new Date().toISOString().split("T")[0] && p.status === "previsto";
                return (
                  <tr key={p.id} className={vencida ? "bg-[var(--crm-error-tint)]" : ""}>
                    <td className="text-[var(--crm-text-sm)] text-[var(--crm-text-primary)]">{p.numero_parcela}</td>
                    <td className="text-[var(--crm-text-sm)] text-[var(--crm-text-primary)]">R$ {Number(p.valor).toLocaleString("pt-BR")}</td>
                    <td className={`text-[var(--crm-text-sm)] ${vencida ? "text-[var(--crm-error)] font-[var(--crm-weight-medium)]" : "text-[var(--crm-text-secondary)]"}`}>
                      {new Date(p.vencimento).toLocaleDateString("pt-BR")}
                    </td>
                    <td>
                      <span className={`crm-badge crm-badge-no-dot text-[var(--crm-text-xs)] ${statusColor(p.status)}`}>{p.status}</span>
                    </td>
                    <td>
                      {(p.status === "previsto" || p.status === "atrasado") && (
                        <button
                          className="crm-btn crm-btn-ghost text-[var(--crm-text-xs)]"
                          disabled={isPending}
                          onClick={() => handleConfirmarPagamento(p.id)}
                        >
                          <Check className="w-3 h-3" /> Recebido
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
