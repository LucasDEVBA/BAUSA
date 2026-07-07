"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Wallet, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { criarDespesa, atualizarDespesa, type DespesaInput } from "@/lib/actions/despesas";
import {
  DESPESA_CATEGORIA_LABEL,
  DESPESA_METODO_LABEL,
  DESPESA_STATUS_LABEL,
  type Despesa,
  type DespesaCategoria,
  type DespesaMetodo,
  type DespesaStatus,
  type DespesaTipo,
} from "@/types/financeiro";

const inputClass =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";
const selectClass = `${inputClass} appearance-none`;
const labelClass = "text-[10px] font-medium text-muted-foreground mb-1 block";

interface FormValues {
  descricao: string;
  categoria: DespesaCategoria;
  tipo: DespesaTipo;
  valor_brl: number;
  competenciaMes: string; // YYYY-MM (input type=month)
  vencimento: string;
  status: DespesaStatus;
  metodo: "" | DespesaMetodo;
  fornecedor: string;
  recorrente: boolean;
  recorrencia_dia: number;
  observacao: string;
}

function mesAtual(): string {
  return new Date().toISOString().slice(0, 7);
}

function defaults(d?: Despesa | null): FormValues {
  return {
    descricao: d?.descricao ?? "",
    categoria: d?.categoria ?? "outros",
    tipo: d?.tipo ?? "fixa",
    valor_brl: d?.valor_brl ?? 0,
    competenciaMes: d?.competencia?.slice(0, 7) ?? mesAtual(),
    vencimento: d?.vencimento ?? "",
    status: d?.status ?? "previsto",
    metodo: d?.metodo ?? "",
    fornecedor: d?.fornecedor ?? "",
    recorrente: d?.recorrente ?? false,
    recorrencia_dia: d?.recorrencia_dia ?? 5,
    observacao: d?.observacao ?? "",
  };
}

interface DespesaFormSheetProps {
  open: boolean;
  onClose: () => void;
  despesa?: Despesa | null;
}

export function DespesaFormSheet({ open, onClose, despesa }: DespesaFormSheetProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(despesa);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: defaults(despesa) });

  useEffect(() => {
    if (open) reset(defaults(despesa));
  }, [open, despesa, reset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const recorrente = watch("recorrente");

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const payload: DespesaInput = {
        descricao: values.descricao.trim(),
        categoria: values.categoria,
        tipo: values.tipo,
        valor_brl: Number(values.valor_brl) || 0,
        competencia: `${values.competenciaMes}-01`,
        vencimento: values.vencimento || null,
        status: values.status,
        metodo: values.metodo || null,
        fornecedor: values.fornecedor.trim() || null,
        recorrente: values.recorrente,
        recorrencia_dia: values.recorrente ? Number(values.recorrencia_dia) : null,
        observacao: values.observacao.trim() || null,
      };

      const result = isEdit
        ? await atualizarDespesa(despesa!.id, payload)
        : await criarDespesa(payload);

      if (result.success) {
        toast.success(isEdit ? "Despesa atualizada" : "Despesa criada");
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
        aria-label={isEdit ? "Editar despesa" : "Nova despesa"}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col liquid-glass"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sys-red/12 text-sys-red ring-1 ring-sys-red/25">
              <Wallet className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-foreground">
                {isEdit ? "Editar despesa" : "Nova despesa"}
              </h2>
              <p className="text-xs text-muted-foreground">Saída financeira — avulsa ou recorrente</p>
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
              <label className={labelClass}>Descrição</label>
              <input
                {...register("descricao", { required: true })}
                className={inputClass}
                placeholder="Ex.: Assinatura da ferramenta X"
                autoFocus
                aria-invalid={!!errors.descricao}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Categoria</label>
                <select {...register("categoria")} className={selectClass}>
                  {(Object.keys(DESPESA_CATEGORIA_LABEL) as DespesaCategoria[]).map((c) => (
                    <option key={c} value={c}>
                      {DESPESA_CATEGORIA_LABEL[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Tipo</label>
                <select {...register("tipo")} className={selectClass}>
                  <option value="fixa">Fixa</option>
                  <option value="variavel">Variável</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  {...register("valor_brl", { required: true, valueAsNumber: true, min: 0 })}
                  className={inputClass}
                  aria-invalid={!!errors.valor_brl}
                />
              </div>
              <div>
                <label className={labelClass}>Competência (mês)</label>
                <input
                  type="month"
                  {...register("competenciaMes", { required: true })}
                  className={inputClass}
                  aria-invalid={!!errors.competenciaMes}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 rounded-md bg-secondary/50 px-3 py-2 text-xs text-foreground">
              <input type="checkbox" {...register("recorrente")} className="size-4 accent-primary" />
              Despesa recorrente (repete todo mês)
            </label>

            {recorrente ? (
              <div>
                <label className={labelClass}>Dia do vencimento (1–28)</label>
                <input
                  type="number"
                  min={1}
                  max={28}
                  {...register("recorrencia_dia", { valueAsNumber: true, min: 1, max: 28 })}
                  className={inputClass}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Vencimento</label>
                  <input type="date" {...register("vencimento")} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Status</label>
                  <select {...register("status")} className={selectClass}>
                    {(Object.keys(DESPESA_STATUS_LABEL) as DespesaStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {DESPESA_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Método (opcional)</label>
                <select {...register("metodo")} className={selectClass}>
                  <option value="">—</option>
                  {(Object.keys(DESPESA_METODO_LABEL) as DespesaMetodo[]).map((m) => (
                    <option key={m} value={m}>
                      {DESPESA_METODO_LABEL[m]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Fornecedor (opcional)</label>
                <input {...register("fornecedor")} className={inputClass} placeholder="Ex.: Google" />
              </div>
            </div>

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
              {isEdit ? "Salvar" : "Criar despesa"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
