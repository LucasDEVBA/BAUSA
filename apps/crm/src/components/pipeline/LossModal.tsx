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
        className="w-full max-w-md rounded-2xl border-sys-red/30 liquid-glass p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-sys-red" />
            <p className="text-sm font-bold text-sys-red">Marcar como perdido</p>
          </div>
          <button
            onClick={onCancel}
            className="rounded-md p-1 text-muted-foreground hover:bg-fill-4 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Atleta</p>
          <p className="text-sm font-semibold text-foreground">{athleteName}</p>
        </div>

        <div className="mb-3">
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Motivo <span className="text-sys-red">*</span>
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
                    ? "border-sys-red/40 bg-sys-red/15 text-sys-red"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Detalhe <span className="text-sys-red">*</span>
          </label>
          <textarea
            autoFocus
            value={detalhe}
            onChange={(e) => setDetalhe(e.target.value)}
            rows={3}
            placeholder="Descreva o que aconteceu (mín. 3 caracteres)"
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground placeholder:text-placeholder outline-none focus:border-sys-red/40"
          />
        </div>

        <label className="mb-2 flex items-center gap-2 text-xs text-foreground">
          <input
            type="checkbox"
            checked={reativar}
            onChange={(e) => setReativar(e.target.checked)}
            className="accent-destructive"
          />
          Pode reativar no futuro?
        </label>

        {reativar && (
          <div className="mb-3">
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Data sugerida de reativação
            </label>
            <input
              type="date"
              value={dataReativacao}
              onChange={(e) => setDataReativacao(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-sys-red/40"
            />
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!valid || isPending}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors",
              valid && !isPending
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-destructive/30 text-destructive-foreground/50 cursor-not-allowed",
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
