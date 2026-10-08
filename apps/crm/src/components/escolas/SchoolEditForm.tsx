"use client";

import { useEffect, useMemo, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { atualizarEscola } from "@/lib/actions/escolas";
import { localizacaoPendente } from "@/lib/escolas/apresentacao";
import {
  colunasDoForm,
  diffEscola,
  escolaFormSchema,
  formDaEscola,
  valoresDaEscola,
  type EscolaFormValues,
} from "@/lib/escolas/formulario";
import { escolaAtualizarSchema, mensagemValidacao } from "@/lib/escolas/schema";
import type { School } from "@/types/school";

import { SchoolFormFields } from "./SchoolFormFields";

interface SchoolEditFormProps {
  school: School;
  onCancel: () => void;
  onSaved: () => void;
  onDirtyChange: (sujo: boolean) => void;
}

/**
 * Edição da escola. Começa com os valores CRUS do banco (null fica null) e
 * envia SÓ os campos alterados — "Salvar" sem mexer não chama o servidor.
 * O pai remonta este componente por `key={school.updated_at}`.
 */
export function SchoolEditForm({ school, onCancel, onSaved, onDirtyChange }: SchoolEditFormProps) {
  const original = useMemo(() => valoresDaEscola(school), [school]);
  const [salvando, startSalvar] = useTransition();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isDirty },
  } = useForm<EscolaFormValues>({
    resolver: zodResolver(escolaFormSchema),
    defaultValues: formDaEscola(school),
  });

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  const onSubmit = (values: EscolaFormValues) => {
    const montagem = colunasDoForm(values, original);
    if (!montagem.ok) {
      setError(montagem.campo, { message: montagem.mensagem }, { shouldFocus: true });
      return;
    }

    const patch = diffEscola(original, montagem.valores);
    if (Object.keys(patch).length === 0) {
      toast.info("Nenhuma alteração para salvar.");
      onCancel();
      return;
    }

    // Mesma validação do servidor, antes de gastar a ida e volta.
    const local = escolaAtualizarSchema.safeParse(patch);
    if (!local.success) {
      toast.error(mensagemValidacao(local.error));
      return;
    }

    startSalvar(async () => {
      try {
        const r = await atualizarEscola(school.id, patch);
        if (!r.success) {
          toast.error(r.error);
          return;
        }
        toast.success("Escola atualizada.");
        onSaved();
      } catch (e) {
        console.error({ level: "error", action: "atualizar_escola_ui", escolaId: school.id, erro: String(e) });
        toast.error("Falha de conexão ao salvar. Tente de novo.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5" aria-label={`Editar ${school.nome}`}>
      <SchoolFormFields
        register={register}
        errors={errors}
        watch={watch}
        setValue={setValue}
        atual={{
          serie_maxima: school.serie_maxima,
          ingles_minimo: school.ingles_minimo,
          localizacaoPendente: localizacaoPendente(school.cidade, school.estado_us),
        }}
      />

      <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 border-t border-border bg-popover px-5 py-3 sm:-mx-6 sm:px-6">
        <button
          type="button"
          onClick={onCancel}
          disabled={salvando}
          className="rounded-md border border-border px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={salvando}
          className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {salvando ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Save aria-hidden className="size-3.5" />}
          Salvar alterações
        </button>
      </div>
    </form>
  );
}
