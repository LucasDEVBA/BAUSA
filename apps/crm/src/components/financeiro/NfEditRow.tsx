"use client";

import { useState, useTransition } from "react";
import { Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

import { MoneyInput } from "@/components/ui/MoneyInput";
import { NfBadge } from "./NfBadge";
import { updateNfData } from "@/lib/actions/financeiro";

interface NfEditRowProps {
  contractId: string;
  nfStatus: "pendente" | "emitida" | "nao_aplicavel";
  nfNumero: string | null;
  nfEmitidaAt: string | null;
  nfValor: number | null;
  /** Quem guarda o contrato em estado local (ex.: /contratos/[id]) recarrega aqui. */
  onSalvo?: () => void;
}

const FALHA_INESPERADA = "Não foi possível salvar a NF. Tente de novo.";

export function NfEditRow({
  contractId,
  nfStatus,
  nfNumero,
  nfEmitidaAt,
  nfValor,
  onSalvo,
}: NfEditRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [numero, setNumero] = useState(nfNumero || "");
  const [data, setData] = useState(nfEmitidaAt?.split("T")[0] || "");
  // MoneyInput (T6/T9): o type="number" lia "7.800" como 7,8.
  const [valor, setValor] = useState<number | null>(nfValor ?? null);
  const [valorInvalido, setValorInvalido] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    // Texto inválido no valor apagaria o valor salvo (null): trava (o campo mostra o erro).
    if (valorInvalido) return;
    startTransition(async () => {
      try {
        const result = await updateNfData({
          contractId,
          nfNumero: numero || null,
          nfEmitidaAt: data || null,
          nfValor: valor,
          nfStatus: numero ? "emitida" : nfStatus,
        });
        if (!result.success) {
          // Sem isso a edição fechava como se tivesse salvo (ex.: Head sem permissão).
          toast.error(result.error ?? FALHA_INESPERADA);
          return;
        }
        toast.success("NF atualizada");
        setIsEditing(false);
        onSalvo?.();
      } catch (err) {
        console.error({ level: "error", action: "nf_edit_row_salvar", contractId, error: String(err) });
        toast.error(FALHA_INESPERADA);
      }
    });
  };

  const handleCancel = () => {
    setNumero(nfNumero || "");
    setData(nfEmitidaAt?.split("T")[0] || "");
    setValor(nfValor ?? null);
    setValorInvalido(false);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div className="flex items-center gap-2">
        <NfBadge status={nfStatus} />
        {nfNumero && <span className="text-[10px] text-muted-foreground">#{nfNumero}</span>}
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="rounded p-1 text-label-tertiary transition-colors hover:bg-fill-4 hover:text-muted-foreground"
          aria-label="Editar NF"
        >
          <Pencil className="h-3 w-3" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="text"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          placeholder="N. NF"
          aria-label="Número da NF"
          className="w-20 rounded-md border border-border bg-popover px-2 py-1 text-[11px] text-foreground outline-none focus:border-primary"
        />
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          aria-label="Data de emissão da NF"
          className="w-28 rounded-md border border-border bg-popover px-2 py-1 text-[11px] text-foreground outline-none focus:border-primary"
        />
        <div className="w-32">
          <MoneyInput
            value={valor}
            onValueChange={(x, { invalido }) => {
              setValor(x);
              setValorInvalido(invalido);
            }}
            placeholder="Valor"
            aria-label="Valor da NF"
            className="sm:h-7 sm:text-[11px]"
          />
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || valorInvalido}
          className="rounded-md bg-sys-green p-1 text-white transition-colors hover:opacity-80 disabled:opacity-50"
          aria-label="Salvar NF"
        >
          <Check className="h-3 w-3" aria-hidden />
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isPending}
          className="rounded-md bg-secondary p-1 text-muted-foreground transition-colors hover:bg-fill-2 disabled:opacity-50"
          aria-label="Cancelar edição da NF"
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      </div>
    </div>
  );
}
