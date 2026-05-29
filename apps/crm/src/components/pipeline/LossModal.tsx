"use client";

import { useState } from "react";
import { AlertCircle, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type MotivoPerda =
  | "financeiro"
  | "timing"
  | "desistencia_familia"
  | "atleta_nao_qualificado"
  | "concorrencia"
  | "outro";

const MOTIVO_OPTIONS: { value: MotivoPerda; label: string }[] = [
  { value: "financeiro", label: "Financeiro" },
  { value: "timing", label: "Timing inadequado" },
  { value: "desistencia_familia", label: "Desistência da família" },
  { value: "atleta_nao_qualificado", label: "Atleta não qualificado" },
  { value: "concorrencia", label: "Concorrência" },
  { value: "outro", label: "Outro" },
];

export interface LossPayload {
  motivo_perda: MotivoPerda;
  detalhe_perda: string;
  pode_reativar: boolean;
  data_reativacao?: string;
}

interface LossModalProps {
  open: boolean;
  athleteName: string;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: (payload: LossPayload) => void;
}

export function LossModal({
  open,
  athleteName,
  isPending,
  onCancel,
  onConfirm,
}: LossModalProps) {
  const [motivo, setMotivo] = useState<MotivoPerda>("outro");
  const [detalhe, setDetalhe] = useState("");
  const [reativar, setReativar] = useState(false);
  const [dataReativacao, setDataReativacao] = useState("");

  if (!open) return null;

  const valid = detalhe.trim().length >= 3;

  const handleConfirm = () => {
    if (!valid) return;
    onConfirm({
      motivo_perda: motivo,
      detalhe_perda: detalhe.trim(),
      pode_reativar: reativar,
      data_reativacao: reativar && dataReativacao ? dataReativacao : undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-xl border border-red-500/30 bg-[#0f1117] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <p className="text-sm font-bold text-red-300">Marcar como perdido</p>
          </div>
          <button
            onClick={onCancel}
            className="rounded-md p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 rounded-lg border border-[#1e2130] bg-[#141720] p-3">
          <p className="text-xs text-zinc-500">Atleta</p>
          <p className="text-sm font-semibold text-white">{athleteName}</p>
        </div>

        <div className="mb-3">
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Motivo <span className="text-red-400">*</span>
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {MOTIVO_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMotivo(opt.value)}
                className={cn(
                  "rounded-md border px-2 py-1.5 text-[10px] font-medium transition-colors text-left",
                  motivo === opt.value
                    ? "border-red-500/40 bg-red-500/10 text-red-300"
                    : "border-[#1e2130] bg-[#141720] text-zinc-500 hover:text-zinc-300",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Detalhe <span className="text-red-400">*</span>
          </label>
          <textarea
            autoFocus
            value={detalhe}
            onChange={(e) => setDetalhe(e.target.value)}
            rows={3}
            placeholder="Descreva o que aconteceu (mín. 3 caracteres)"
            className="w-full rounded-md border border-[#1e2130] bg-[#141720] px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-red-500/40"
          />
        </div>

        <label className="mb-2 flex items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={reativar}
            onChange={(e) => setReativar(e.target.checked)}
            className="accent-red-500"
          />
          Pode reativar no futuro?
        </label>

        {reativar && (
          <div className="mb-3">
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Data sugerida de reativação
            </label>
            <input
              type="date"
              value={dataReativacao}
              onChange={(e) => setDataReativacao(e.target.value)}
              className="w-full rounded-md border border-[#1e2130] bg-[#141720] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-red-500/40"
            />
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-[#1a1d2a] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!valid || isPending}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
              valid && !isPending
                ? "bg-red-600 text-white hover:bg-red-500"
                : "bg-red-600/30 text-white/50 cursor-not-allowed",
            )}
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Confirmar perda
          </button>
        </div>
      </div>
    </div>
  );
}
