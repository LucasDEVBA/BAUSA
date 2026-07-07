"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { atualizarConfiguracao } from "@/lib/actions/configuracoes";
import type { EmpresaDados } from "@/types/financeiro";
import { FormModal, ModalSection, modalFieldClasses } from "./FormModal";

const { input: inputClass, label: labelClass } = modalFieldClasses;

interface EmpresaDadosModalProps {
  open: boolean;
  onClose: () => void;
  empresa: EmpresaDados;
}

export function EmpresaDadosModal({ open, onClose, empresa }: EmpresaDadosModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { register, handleSubmit, reset } = useForm<EmpresaDados>({ defaultValues: empresa });

  useEffect(() => {
    if (open) reset(empresa);
  }, [open, empresa, reset]);

  const salvar = (form: EmpresaDados) => {
    startTransition(async () => {
      const result = await atualizarConfiguracao("empresa_dados", {
        razao_social: form.razao_social.trim(),
        cnpj: form.cnpj.trim(),
        cidade: form.cidade.trim(),
      });
      if (result.success) {
        toast.success("Dados da empresa salvos");
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
      icon={Building2}
      title="Dados da empresa"
      subtitle="Pagador nos recibos de pagamento"
      ariaLabel="Editar dados da empresa"
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit(salvar)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <ModalSection title="Empresa (pagador)">
            <div>
              <label className={labelClass}>Razão social</label>
              <input {...register("razao_social")} className={inputClass} placeholder="Ex.: Bolsa Atleta USA" autoFocus />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>CNPJ</label>
                <input {...register("cnpj")} className={inputClass} placeholder="00.000.000/0001-00" inputMode="numeric" />
              </div>
              <div>
                <label className={labelClass}>Cidade</label>
                <input {...register("cidade")} className={inputClass} placeholder="Ex.: Salvador/BA" />
              </div>
            </div>
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
            Salvar
          </button>
        </div>
      </form>
    </FormModal>
  );
}
