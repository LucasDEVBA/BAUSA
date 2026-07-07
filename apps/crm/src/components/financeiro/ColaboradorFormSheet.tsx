"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Users, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  criarColaborador,
  atualizarColaborador,
  type ColaboradorInput,
} from "@/lib/actions/colaboradores";
import { TIPO_CONTRATO_LABEL, type Colaborador, type TipoContrato } from "@/types/financeiro";

const inputClass =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";
const selectClass = `${inputClass} appearance-none`;
const labelClass = "text-[10px] font-medium text-muted-foreground mb-1 block";

interface FormValues {
  nome: string;
  cargo: string;
  tipo_contrato: TipoContrato;
  custo_mensal_brl: number;
  ativo: boolean;
  data_admissao: string;
  observacao: string;
}

function defaults(c?: Colaborador | null): FormValues {
  return {
    nome: c?.nome ?? "",
    cargo: c?.cargo ?? "",
    tipo_contrato: c?.tipo_contrato ?? "clt",
    custo_mensal_brl: c?.custo_mensal_brl ?? 0,
    ativo: c?.ativo ?? true,
    data_admissao: c?.data_admissao ?? "",
    observacao: c?.observacao ?? "",
  };
}

interface ColaboradorFormSheetProps {
  open: boolean;
  onClose: () => void;
  colaborador?: Colaborador | null;
}

export function ColaboradorFormSheet({ open, onClose, colaborador }: ColaboradorFormSheetProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(colaborador);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: defaults(colaborador) });

  useEffect(() => {
    if (open) reset(defaults(colaborador));
  }, [open, colaborador, reset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const payload: ColaboradorInput = {
        nome: values.nome.trim(),
        cargo: values.cargo.trim() || null,
        tipo_contrato: values.tipo_contrato,
        custo_mensal_brl: Number(values.custo_mensal_brl) || 0,
        ativo: values.ativo,
        data_admissao: values.data_admissao || null,
        observacao: values.observacao.trim() || null,
      };

      const result = isEdit
        ? await atualizarColaborador(colaborador!.id, payload)
        : await criarColaborador(payload);

      if (result.success) {
        toast.success(isEdit ? "Colaborador atualizado" : "Colaborador adicionado");
        onClose();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Editar colaborador" : "Novo colaborador"}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col liquid-glass"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/25">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-foreground">
                {isEdit ? "Editar colaborador" : "Novo colaborador"}
              </h2>
              <p className="text-xs text-muted-foreground">Folha — custo mensal já com encargos</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-fill-4 hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div>
              <label className={labelClass}>Nome</label>
              <input
                {...register("nome", { required: true })}
                className={inputClass}
                placeholder="Ex.: Maria Silva"
                autoFocus
                aria-invalid={!!errors.nome}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Cargo</label>
                <input {...register("cargo")} className={inputClass} placeholder="Ex.: Designer" />
              </div>
              <div>
                <label className={labelClass}>Tipo de contrato</label>
                <select {...register("tipo_contrato")} className={selectClass}>
                  {(Object.keys(TIPO_CONTRATO_LABEL) as TipoContrato[]).map((t) => (
                    <option key={t} value={t}>
                      {TIPO_CONTRATO_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Custo mensal (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  {...register("custo_mensal_brl", { required: true, valueAsNumber: true, min: 0 })}
                  className={inputClass}
                  aria-invalid={!!errors.custo_mensal_brl}
                />
                <p className="mt-1 text-[10px] text-label-tertiary">Total já com encargos.</p>
              </div>
              <div>
                <label className={labelClass}>Admissão (opcional)</label>
                <input type="date" {...register("data_admissao")} className={inputClass} />
              </div>
            </div>

            <label className="flex items-center gap-2 rounded-md bg-secondary/50 px-3 py-2 text-xs text-foreground">
              <input type="checkbox" {...register("ativo")} className="size-4 accent-primary" />
              Ativo (entra no custo da folha)
            </label>

            <div>
              <label className={labelClass}>Observação (opcional)</label>
              <textarea {...register("observacao")} className={`${inputClass} min-h-16 resize-y`} />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-fill-4 hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Salvar" : "Adicionar"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
