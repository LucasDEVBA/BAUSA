"use client";

import { useState } from "react";
import { ArrowLeft, Loader2, X } from "lucide-react";
import { labelEtapa } from "@/lib/move-deal-result";
import type { StatusDeal } from "@/types/crm";
import { cn } from "@/lib/utils";

interface RetrocessoModalProps {
  open: boolean;
  athleteName: string;
  fromStage: StatusDeal;
  toStage: StatusDeal;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: (motivo: string) => void;
}

export function RetrocessoModal({
  open,
  athleteName,
  fromStage,
  toStage,
  isPending,
  onCancel,
  onConfirm,
}: RetrocessoModalProps) {
  const [motivo, setMotivo] = useState("");

  if (!open) return null;

  const valid = motivo.trim().length >= 5;

  const handleConfirm = () => {
    if (!valid) return;
    onConfirm(motivo.trim());
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-sys-orange/30 bg-popover p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4 text-sys-orange" />
            <p className="text-sm font-bold text-sys-orange">
              Retroceder etapa
            </p>
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
          <p className="mb-2 text-sm font-semibold text-foreground">{athleteName}</p>
          <p className="text-xs text-muted-foreground">
            {labelEtapa(fromStage)}{" "}
            <span className="text-sys-orange">{"→"}</span>{" "}
            <span className="font-semibold text-sys-orange">
              {labelEtapa(toStage)}
            </span>
          </p>
        </div>

        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Motivo do retrocesso <span className="text-sys-orange">*</span>
        </label>
        <textarea
          autoFocus
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          minLength={5}
          placeholder="Explique por que esta etapa precisa ser revisitada (mín. 5 caracteres)"
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground placeholder:text-placeholder outline-none focus:border-sys-orange/40"
        />
        <p className="mt-1 text-[10px] text-label-tertiary">
          O retrocesso fica registrado no histórico do deal (audit trail).
        </p>

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
                ? "bg-sys-orange text-white hover:bg-sys-orange/80"
                : "bg-sys-orange/30 text-white/50 cursor-not-allowed",
            )}
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Confirmar retrocesso
          </button>
        </div>
      </div>
    </div>
  );
}
