"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  criarColaborador,
  atualizarColaborador,
  type ColaboradorInput,
} from "@/lib/actions/colaboradores";
import { TIPO_CONTRATO_LABEL, type Colaborador, type TipoContrato } from "@/types/financeiro";
import { FormModal, ModalSection, modalFieldClasses } from "./FormModal";

const { input: inputClass, label: labelClass } = modalFieldClasses;
const selectClass = `${inputClass} appearance-none`;

interface FormValues {
  nome: string;
  cargo: string;
  cpf: string;
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
    cpf: c?.cpf ?? "",
    tipo_contrato: c?.tipo_contrato ?? "clt",
    custo_mensal_brl: c?.custo_mensal_brl ?? 0,
    ativo: c?.ativo ?? true,
    data_admissao: c?.data_admissao ?? "",
    observacao: c?.observacao ?? "",
  };
}

interface ColaboradorFormModalProps {
  open: boolean;
  onClose: () => void;
  colaborador?: Colaborador | null;
}

export function ColaboradorFormModal({ open, onClose, colaborador }: ColaboradorFormModalProps) {
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

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const payload: ColaboradorInput = {
        nome: values.nome.trim(),
        cargo: values.cargo.trim() || null,
        cpf: values.cpf.trim() || null,
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

  return (
    <FormModal
      open={open}
      onClose={onClose}
      icon={Users}
      title={isEdit ? "Editar colaborador" : "Novo colaborador"}
      subtitle="Folha — custo mensal já com encargos"
      ariaLabel={isEdit ? "Editar colaborador" : "Novo colaborador"}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <ModalSection title="Colaborador">
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
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className={labelClass}>Cargo</label>
                <input {...register("cargo")} className={inputClass} placeholder="Ex.: Designer" />
              </div>
              <div>
                <label className={labelClass}>Tipo de contrato</label>
                <select {...register("tipo_contrato")} className={selectClass}>
                  {(Object.keys(TIPO_CONTRATO_LABEL) as TipoContrato[]).map((t) => (
                    <option key={t} value={t}>{TIPO_CONTRATO_LABEL[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>CPF (recibo)</label>
                <input {...register("cpf")} className={inputClass} placeholder="000.000.000-00" inputMode="numeric" />
              </div>
            </div>
          </ModalSection>

          <ModalSection title="Custo & vínculo">
            <div className="grid gap-3 sm:grid-cols-2">
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
            {isEdit ? "Salvar" : "Adicionar"}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
