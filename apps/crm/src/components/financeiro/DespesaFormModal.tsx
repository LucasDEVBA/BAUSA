"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Wallet, Loader2 } from "lucide-react";
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
import { FormModal, ModalSection, modalFieldClasses } from "./FormModal";

const { input: inputClass, label: labelClass } = modalFieldClasses;
const selectClass = `${inputClass} appearance-none`;

interface FormValues {
  descricao: string;
  categoria: DespesaCategoria;
  tipo: DespesaTipo;
  valor_brl: number;
  competenciaMes: string;
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

function defaults(d?: Despesa | null, recorrenteInicial = false): FormValues {
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
    recorrente: d?.recorrente ?? recorrenteInicial,
    recorrencia_dia: d?.recorrencia_dia ?? 5,
    observacao: d?.observacao ?? "",
  };
}

interface DespesaFormModalProps {
  open: boolean;
  onClose: () => void;
  despesa?: Despesa | null;
  /** Ao criar (sem despesa), pré-marca "recorrente" — usado pelo botão "Nova recorrente". */
  recorrenteInicial?: boolean;
}

export function DespesaFormModal({ open, onClose, despesa, recorrenteInicial = false }: DespesaFormModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(despesa);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: defaults(despesa, recorrenteInicial) });

  useEffect(() => {
    if (open) reset(defaults(despesa, recorrenteInicial));
  }, [open, despesa, recorrenteInicial, reset]);

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

  return (
    <FormModal
      open={open}
      onClose={onClose}
      icon={Wallet}
      iconClass="bg-sys-red/12 text-sys-red ring-sys-red/25"
      title={isEdit ? "Editar despesa" : "Nova despesa"}
      subtitle="Saída financeira — avulsa ou recorrente"
      ariaLabel={isEdit ? "Editar despesa" : "Nova despesa"}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <ModalSection title="Despesa">
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
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className={labelClass}>Categoria</label>
                <select {...register("categoria")} className={selectClass}>
                  {(Object.keys(DESPESA_CATEGORIA_LABEL) as DespesaCategoria[]).map((c) => (
                    <option key={c} value={c}>{DESPESA_CATEGORIA_LABEL[c]}</option>
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
            </div>
          </ModalSection>

          <ModalSection title="Pagamento">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Competência (mês)</label>
                <input
                  type="month"
                  {...register("competenciaMes", { required: true })}
                  className={inputClass}
                  aria-invalid={!!errors.competenciaMes}
                />
              </div>
              <label className="flex items-end gap-2 pb-2 text-xs text-foreground sm:items-center sm:pb-0">
                <input type="checkbox" {...register("recorrente")} className="size-4 accent-primary" />
                Despesa recorrente (repete todo mês)
              </label>
            </div>

            {recorrente ? (
              <div className="sm:max-w-[50%]">
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
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Vencimento</label>
                  <input type="date" {...register("vencimento")} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Status</label>
                  <select {...register("status")} className={selectClass}>
                    {(Object.keys(DESPESA_STATUS_LABEL) as DespesaStatus[]).map((s) => (
                      <option key={s} value={s}>{DESPESA_STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Método (opcional)</label>
                <select {...register("metodo")} className={selectClass}>
                  <option value="">—</option>
                  {(Object.keys(DESPESA_METODO_LABEL) as DespesaMetodo[]).map((m) => (
                    <option key={m} value={m}>{DESPESA_METODO_LABEL[m]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Fornecedor (opcional)</label>
                <input {...register("fornecedor")} className={inputClass} placeholder="Ex.: Google" />
              </div>
            </div>
          </ModalSection>

          <ModalSection title="Observação">
            <textarea {...register("observacao")} className={`${inputClass} min-h-16 resize-y`} placeholder="Anotações internas (opcional)" />
          </ModalSection>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-6 py-4">
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
    </FormModal>
  );
}
