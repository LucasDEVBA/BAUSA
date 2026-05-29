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
        className="w-full max-w-md rounded-xl border border-amber-500/30 bg-[#0f1117] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4 text-amber-400" />
            <p className="text-sm font-bold text-amber-300">
              Retroceder etapa
            </p>
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
          <p className="mb-2 text-sm font-semibold text-white">{athleteName}</p>
          <p className="text-xs text-zinc-500">
            {labelEtapa(fromStage)}{" "}
            <span className="text-amber-400">{"→"}</span>{" "}
            <span className="font-semibold text-amber-300">
              {labelEtapa(toStage)}
            </span>
          </p>
        </div>

        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Motivo do retrocesso <span className="text-amber-400">*</span>
        </label>
        <textarea
          autoFocus
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          minLength={5}
          placeholder="Explique por que esta etapa precisa ser revisitada (mín. 5 caracteres)"
          className="w-full rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-amber-500/40"
        />
        <p className="mt-1 text-[10px] text-zinc-600">
          O retrocesso fica registrado no histórico do deal (audit trail).
        </p>

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
                ? "bg-amber-600 text-white hover:bg-amber-500"
                : "bg-amber-600/30 text-white/50 cursor-not-allowed",
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
