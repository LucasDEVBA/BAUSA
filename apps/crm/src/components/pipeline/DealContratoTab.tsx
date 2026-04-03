"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import {
  Loader2,
  FileText,
  CheckCircle2,
  DollarSign,
  CreditCard,
  Upload,
  ExternalLink,
  AlertTriangle,
  Send,
  PenTool,
  Receipt,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  PLANO_VALORES,
  ENTRADA_PADRAO,
  type ContratoFinanceiro,
  type Parcela,
} from "@/types/crm";
import {
  criarContrato,
  confirmarPagamento,
  getContratoByDeal,
  updateNfData,
} from "@/lib/actions/financeiro";
import { uploadDocumento } from "@/lib/upload";

interface DealContratoTabProps {
  dealId: string;
  atletaId?: string;
}

type PlanoKey = "journey" | "legacy" | "start";
type FormaPagamento = "padrao" | "pix_avista";
type FormaEntrada = "pix" | "getnet_parcelado";
type FormaSaldo = "pix_avista" | "getnet_parcelado";

const PLANO_LABELS: Record<PlanoKey, string> = {
  journey: "Journey R$ 26k",
  legacy: "Legacy R$ 32k",
  start: "Start R$ 18k",
};

function formatCurrency(value: number): string {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function isOverdue(vencimento: string): boolean {
  return new Date(vencimento).getTime() < Date.now();
}

export function DealContratoTab({ dealId, atletaId }: DealContratoTabProps) {
  const [contrato, setContrato] = useState<ContratoFinanceiro | null>(null);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [plano, setPlano] = useState<PlanoKey>("journey");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>("padrao");
  const [entradaValor, setEntradaValor] = useState(ENTRADA_PADRAO);
  const [entradaForma, setEntradaForma] = useState<FormaEntrada>("pix");
  const [entradaParcelas, setEntradaParcelas] = useState(1);
  const [saldoForma, setSaldoForma] = useState<FormaSaldo>("getnet_parcelado");
  const [saldoParcelas, setSaldoParcelas] = useState(6);
  const [incluiPsicologa, setIncluiPsicologa] = useState(true);

  // Docusign state
  const [docusignStatus, setDocusignStatus] = useState<string>("nao_enviado");
  const [uploadingContrato, setUploadingContrato] = useState(false);
  const [contratoFileUrl, setContratoFileUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // NF state
  const [nfNumero, setNfNumero] = useState("");
  const [nfData, setNfData] = useState("");
  const [nfValor, setNfValor] = useState(0);

  const fetchData = async () => {
    try {
      const result = await getContratoByDeal(dealId);
      setContrato(result.contrato as ContratoFinanceiro | null);
      setParcelas((result.parcelas ?? []) as Parcela[]);
      if (result.contrato) {
        const c = result.contrato as Record<string, unknown>;
        setDocusignStatus((c.docusign_status as string) ?? "nao_enviado");
        setContratoFileUrl((c.contrato_assinado_url as string) ?? null);
        setNfNumero((c.nf_numero as string) ?? "");
        setNfData((c.nf_emitida_at as string)?.split("T")[0] ?? "");
        setNfValor((c.nf_valor as number) ?? 0);
      }
    } catch {
      toast.error("Erro ao carregar contrato");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  // Computed values for the create form
  const planoConfig = PLANO_VALORES[plano];
  const valorTotal = formaPagamento === "pix_avista" ? planoConfig.pix : planoConfig.padrao;
  const saldoRemanescente = valorTotal - entradaValor;

  const handleCreateContrato = () => {
    startTransition(async () => {
      const result = await criarContrato(dealId, {
        plano,
        forma_pagamento_plano: formaPagamento,
        entrada_valor: entradaValor,
        entrada_forma: entradaForma,
        entrada_parcelas: entradaForma === "getnet_parcelado" ? entradaParcelas : 1,
        saldo_forma: saldoForma,
        saldo_parcelas: saldoForma === "getnet_parcelado" ? saldoParcelas : 1,
      });
      if (result.success) {
        toast.success("Contrato criado com sucesso");
        setShowCreateForm(false);
        await fetchData();
      } else {
        toast.error(result.error ?? "Erro ao criar contrato");
      }
    });
  };

  const handleConfirmarPagamento = (parcelaId: string) => {
    startTransition(async () => {
      const result = await confirmarPagamento(parcelaId);
      if (result.success) {
        toast.success("Pagamento confirmado");
        await fetchData();
      } else {
        toast.error(result.error ?? "Erro ao confirmar pagamento");
      }
    });
  };

  const handleUploadContrato = async (file: File) => {
    if (!atletaId) return;
    setUploadingContrato(true);
    try {
      const url = await uploadDocumento(atletaId, "contrato_assinado", file);
      setContratoFileUrl(url);
      toast.success("Contrato assinado enviado");
    } catch {
      toast.error("Erro ao fazer upload do contrato");
    } finally {
      setUploadingContrato(false);
    }
  };

  const handleSaveNf = () => {
    if (!contrato) return;
    startTransition(async () => {
      const result = await updateNfData({
        contractId: contrato.id,
        nfNumero: nfNumero || null,
        nfEmitidaAt: nfData || null,
        nfValor: nfValor || null,
        nfStatus: nfNumero ? "emitida" : "pendente",
      });
      if (result.success) {
        toast.success("Dados da NF salvos");
        await fetchData();
      } else {
        toast.error(result.error ?? "Erro ao salvar NF");
      }
    });
  };

  const inputClass =
    "w-full rounded-lg border border-[#1e2130] bg-[#0f1117] py-2 px-3 text-sm text-zinc-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30";
  const selectClass =
    "w-full rounded-lg border border-[#1e2130] bg-[#0f1117] py-2 px-3 text-sm text-zinc-200 outline-none focus:border-indigo-500 appearance-none";
  const labelClass = "text-xs font-medium text-zinc-400";
  const cardClass = "rounded-xl border border-[#1e2130] bg-[#141720] p-4";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  // No contract exists
  if (!contrato) {
    return (
      <div className="space-y-5">
        {!showCreateForm ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <FileText className="h-10 w-10 text-zinc-600" />
            <p className="text-sm text-zinc-500">
              Nenhum contrato financeiro criado para este deal.
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              <DollarSign className="h-4 w-4" />
              Criar Contrato
            </button>
          </div>
        ) : (
          <CreateContratoForm />
        )}
      </div>
    );
  }

  // Contract exists — render full view
  const totalRecebido = parcelas
    .filter((p) => p.status === "recebido")
    .reduce((sum, p) => sum + p.valor, 0);
  const saldoPendente = contrato.valor_total - totalRecebido;

  return (
    <div className="space-y-5">
      {/* Summary card */}
      <div className={cardClass}>
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-zinc-200">
            Resumo do Contrato
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className={labelClass}>Plano</p>
            <p className="text-zinc-200 font-medium">
              {PLANO_LABELS[contrato.plano as PlanoKey] ?? contrato.plano}
            </p>
          </div>
          <div>
            <p className={labelClass}>Valor total</p>
            <p className="text-emerald-400 font-bold">
              {formatCurrency(contrato.valor_total)}
            </p>
          </div>
          <div>
            <p className={labelClass}>Entrada</p>
            <p className="text-zinc-200">
              {formatCurrency(contrato.entrada_valor)}
              <span className="ml-1 text-xs text-zinc-500">
                ({contrato.entrada_paga ? "Pago" : "Pendente"})
              </span>
            </p>
          </div>
          <div>
            <p className={labelClass}>Saldo pendente</p>
            <p className={cn(
              "font-medium",
              saldoPendente > 0 ? "text-amber-400" : "text-emerald-400",
            )}>
              {formatCurrency(saldoPendente)}
            </p>
          </div>
          {contrato.inclui_psicologa && (
            <div>
              <p className={labelClass}>Psicologa</p>
              <p className="text-zinc-200">
                Incluso ({formatCurrency(contrato.custo_psicologa)})
              </p>
            </div>
          )}
          <div>
            <p className={labelClass}>NF</p>
            <p className="text-zinc-200 capitalize">
              {contrato.nf_status.replace("_", " ")}
            </p>
          </div>
        </div>
      </div>

      {/* Parcelas table */}
      <div className={cardClass}>
        <div className="flex items-center gap-2 mb-3">
          <CreditCard className="h-4 w-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-zinc-200">Parcelas</h3>
        </div>
        <div className="space-y-2">
          {parcelas.map((p) => {
            const overdue =
              (p.status === "previsto" || p.status === "atrasado") &&
              isOverdue(p.vencimento);
            return (
              <div
                key={p.id}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-3 py-2.5",
                  overdue
                    ? "border-red-500/20 bg-red-500/5"
                    : p.status === "recebido"
                      ? "border-emerald-500/20 bg-emerald-500/5"
                      : p.status === "cancelado"
                        ? "border-zinc-600/20 bg-zinc-800/30 opacity-50"
                        : "border-[#1e2130] bg-[#0f1117]",
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-200">
                      {p.numero_parcela}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                        p.status === "recebido"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : overdue
                            ? "bg-red-500/10 text-red-400"
                            : p.status === "cancelado"
                              ? "bg-zinc-500/10 text-zinc-500"
                              : "bg-zinc-500/10 text-zinc-400",
                      )}
                    >
                      {overdue && p.status !== "cancelado" ? "Atrasado" : p.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-zinc-500">
                    <span>{formatCurrency(p.valor)}</span>
                    <span>
                      Venc.{" "}
                      {new Date(p.vencimento).toLocaleDateString("pt-BR")}
                    </span>
                    <span className="uppercase">{p.metodo}</span>
                  </div>
                </div>
                {(p.status === "previsto" || p.status === "atrasado") && (
                  <button
                    onClick={() => handleConfirmarPagamento(p.id)}
                    disabled={isPending}
                    className="flex items-center gap-1 rounded-lg bg-emerald-600/20 px-2.5 py-1.5 text-[10px] font-medium text-emerald-300 hover:bg-emerald-600/30 transition-colors flex-shrink-0"
                  >
                    {isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    Confirmar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Assinatura do contrato */}
      <div className={cardClass}>
        <div className="flex items-center gap-2 mb-3">
          <PenTool className="h-4 w-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-zinc-200">
            Assinatura do Contrato
          </h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className={labelClass}>Status:</span>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold",
                docusignStatus === "assinado"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : docusignStatus === "enviado"
                    ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                    : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
              )}
            >
              {docusignStatus === "assinado"
                ? "Assinado"
                : docusignStatus === "enviado"
                  ? "Enviado"
                  : "Nao enviado"}
            </span>
          </div>

          <div className="flex gap-2">
            {docusignStatus === "nao_enviado" && (
              <button
                onClick={() => setDocusignStatus("enviado")}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600/20 px-3 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-600/30 transition-colors"
              >
                <Send className="h-3 w-3" />
                Marcar como Enviado
              </button>
            )}
            {docusignStatus === "enviado" && (
              <button
                onClick={() => setDocusignStatus("assinado")}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600/20 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-600/30 transition-colors"
              >
                <CheckCircle2 className="h-3 w-3" />
                Marcar como Assinado
              </button>
            )}
          </div>

          {/* Upload contrato assinado */}
          <div className="pt-2 border-t border-[#1e2130]">
            <p className="text-xs text-zinc-500 mb-2">
              Upload contrato assinado (PDF)
            </p>
            {contratoFileUrl ? (
              <a
                href={contratoFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                Ver contrato assinado
              </a>
            ) : (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingContrato}
                  className="flex items-center gap-1.5 rounded-lg border border-dashed border-[#1e2130] px-3 py-2 text-xs text-zinc-500 hover:border-indigo-500/30 hover:text-indigo-400 transition-colors w-full justify-center"
                >
                  {uploadingContrato ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  Enviar PDF
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadContrato(file);
                  }}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* NF Section */}
      <div className={cardClass}>
        <div className="flex items-center gap-2 mb-3">
          <Receipt className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-zinc-200">Nota Fiscal</h3>
        </div>
        {contrato.nf_status === "emitida" ? (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className={labelClass}>Numero</p>
              <p className="text-zinc-200">{contrato.nf_numero ?? "---"}</p>
            </div>
            <div>
              <p className={labelClass}>Data emissao</p>
              <p className="text-zinc-200">
                {contrato.nf_emitida_at
                  ? new Date(contrato.nf_emitida_at).toLocaleDateString("pt-BR")
                  : "---"}
              </p>
            </div>
            <div>
              <p className={labelClass}>Valor NF</p>
              <p className="text-zinc-200">
                {contrato.nf_valor ? formatCurrency(contrato.nf_valor) : "---"}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Numero NF</label>
              <input
                type="text"
                value={nfNumero}
                onChange={(e) => setNfNumero(e.target.value)}
                placeholder="Ex: NF-00123"
                className={cn(inputClass, "mt-1")}
              />
            </div>
            <div>
              <label className={labelClass}>Data emissao</label>
              <input
                type="date"
                value={nfData}
                onChange={(e) => setNfData(e.target.value)}
                className={cn(inputClass, "mt-1")}
              />
            </div>
            <div>
              <label className={labelClass}>Valor NF</label>
              <input
                type="number"
                value={nfValor || ""}
                onChange={(e) => setNfValor(Number(e.target.value))}
                placeholder="0.00"
                className={cn(inputClass, "mt-1")}
              />
            </div>
            <button
              onClick={handleSaveNf}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg bg-amber-600/20 px-3 py-2 text-xs font-medium text-amber-300 hover:bg-amber-600/30 disabled:opacity-50 transition-colors"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Salvar dados NF
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // Nested create form component (uses parent state)
  function CreateContratoForm() {
    return (
      <div className="space-y-5">
        <div className={cardClass}>
          <h3 className="text-sm font-semibold text-zinc-200 mb-4">
            Criar Contrato Financeiro
          </h3>
          <div className="space-y-3">
            {/* Plano */}
            <div>
              <label className={labelClass}>Plano</label>
              <select
                value={plano}
                onChange={(e) => setPlano(e.target.value as PlanoKey)}
                className={cn(selectClass, "mt-1")}
              >
                <option value="journey">Journey - R$ 26.000</option>
                <option value="legacy">Legacy - R$ 32.000</option>
                <option value="start">Start - R$ 18.000</option>
              </select>
            </div>

            {/* Forma pagamento */}
            <div>
              <label className={labelClass}>Forma de pagamento</label>
              <select
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value as FormaPagamento)}
                className={cn(selectClass, "mt-1")}
              >
                <option value="padrao">Padrao</option>
                <option value="pix_avista">Pix a vista</option>
              </select>
            </div>

            {/* Entrada */}
            <div>
              <label className={labelClass}>
                Valor entrada (R$)
              </label>
              <input
                type="number"
                value={entradaValor}
                onChange={(e) => setEntradaValor(Number(e.target.value))}
                className={cn(inputClass, "mt-1")}
              />
            </div>

            <div>
              <label className={labelClass}>Forma de entrada</label>
              <select
                value={entradaForma}
                onChange={(e) => setEntradaForma(e.target.value as FormaEntrada)}
                className={cn(selectClass, "mt-1")}
              >
                <option value="pix">Pix</option>
                <option value="getnet_parcelado">GetNet parcelado</option>
              </select>
            </div>

            {entradaForma === "getnet_parcelado" && (
              <div>
                <label className={labelClass}>Parcelas entrada</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={entradaParcelas}
                  onChange={(e) => setEntradaParcelas(Number(e.target.value))}
                  className={cn(inputClass, "mt-1")}
                />
              </div>
            )}

            {/* Saldo */}
            <div>
              <label className={labelClass}>Forma do saldo</label>
              <select
                value={saldoForma}
                onChange={(e) => setSaldoForma(e.target.value as FormaSaldo)}
                className={cn(selectClass, "mt-1")}
              >
                <option value="pix_avista">Pix a vista</option>
                <option value="getnet_parcelado">GetNet parcelado</option>
              </select>
            </div>

            {saldoForma === "getnet_parcelado" && (
              <div>
                <label className={labelClass}>Parcelas saldo</label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={saldoParcelas}
                  onChange={(e) => setSaldoParcelas(Number(e.target.value))}
                  className={cn(inputClass, "mt-1")}
                />
              </div>
            )}

            {/* Psicologa toggle */}
            <div className="flex items-center justify-between">
              <label className={labelClass}>Inclui psicologa</label>
              <button
                type="button"
                onClick={() => setIncluiPsicologa(!incluiPsicologa)}
                className={cn(
                  "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                  incluiPsicologa ? "bg-indigo-600" : "bg-zinc-700",
                )}
                role="switch"
                aria-checked={incluiPsicologa}
              >
                <span
                  className={cn(
                    "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
                    incluiPsicologa ? "translate-x-4" : "translate-x-0.5",
                  )}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Summary card */}
        <div className={cn(cardClass, "border-indigo-500/20")}>
          <h4 className="text-xs font-semibold text-indigo-300 mb-3">
            Resumo
          </h4>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Valor total</span>
              <span className="text-zinc-200 font-medium">
                {formatCurrency(valorTotal)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Entrada</span>
              <span className="text-zinc-200">
                {formatCurrency(entradaValor)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Saldo</span>
              <span className="text-zinc-200">
                {formatCurrency(saldoRemanescente > 0 ? saldoRemanescente : 0)}
              </span>
            </div>
            {incluiPsicologa && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Psicologa</span>
                <span className="text-zinc-200">
                  {formatCurrency(1200)} (incluso)
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCreateContrato}
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <DollarSign className="h-4 w-4" />
            )}
            Criar Contrato
          </button>
          <button
            onClick={() => setShowCreateForm(false)}
            className="rounded-lg px-4 py-2.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }
}
