"use client";

import { useState, useTransition } from "react";
import { Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NfBadge } from "./NfBadge";
import { updateNfData } from "@/lib/actions/financeiro";

interface NfEditRowProps {
  contractId: string;
  nfStatus: "pendente" | "emitida" | "nao_aplicavel";
  nfNumero: string | null;
  nfEmitidaAt: string | null;
  nfValor: number | null;
}

export function NfEditRow({
  contractId,
  nfStatus,
  nfNumero,
  nfEmitidaAt,
  nfValor,
}: NfEditRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [numero, setNumero] = useState(nfNumero || "");
  const [data, setData] = useState(nfEmitidaAt?.split("T")[0] || "");
  const [valor, setValor] = useState(nfValor?.toString() || "");
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      await updateNfData({
        contractId,
        nfNumero: numero || null,
        nfEmitidaAt: data || null,
        nfValor: valor ? Number(valor) : null,
        nfStatus: numero ? "emitida" : nfStatus,
      });
      setIsEditing(false);
    });
  };

  const handleCancel = () => {
    setNumero(nfNumero || "");
    setData(nfEmitidaAt?.split("T")[0] || "");
    setValor(nfValor?.toString() || "");
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div className="flex items-center gap-2">
        <NfBadge status={nfStatus} />
        {nfNumero && <span className="text-[10px] text-zinc-500">#{nfNumero}</span>}
        <button
          onClick={() => setIsEditing(true)}
          className="rounded p-1 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-400"
          aria-label="Editar NF"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          placeholder="N. NF"
          className="w-20 rounded border border-[#1e2130] bg-[#0f1117] px-2 py-1 text-[11px] text-zinc-300 outline-none focus:border-indigo-500"
        />
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="w-28 rounded border border-[#1e2130] bg-[#0f1117] px-2 py-1 text-[11px] text-zinc-300 outline-none focus:border-indigo-500"
        />
        <input
          type="number"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="Valor"
          className="w-20 rounded border border-[#1e2130] bg-[#0f1117] px-2 py-1 text-[11px] text-zinc-300 outline-none focus:border-indigo-500"
        />
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="rounded bg-emerald-600 p-1 text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          aria-label="Salvar"
        >
          <Check className="h-3 w-3" />
        </button>
        <button
          onClick={handleCancel}
          disabled={isPending}
          className="rounded bg-zinc-700 p-1 text-zinc-300 transition-colors hover:bg-zinc-600 disabled:opacity-50"
          aria-label="Cancelar"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
