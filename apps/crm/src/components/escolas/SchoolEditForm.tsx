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
import { Button } from "@/components/ui";

import { SchoolFormFields } from "./SchoolFormFields";

interface SchoolEditFormProps {
  school: School;
  onCancel: () => void;
  onSaved: () => void;
  /** Patch vazio: sai da edição SEM perguntar "Descartar?" (não há o que descartar). */
  onSemAlteracoes: () => void;
  onDirtyChange: (sujo: boolean) => void;
  /** O pai bloqueia fechar o sheet enquanto o UPDATE está em voo. */
  onSavingChange: (salvando: boolean) => void;
}

/**
 * Edição da escola. Começa com os valores CRUS do banco (null fica null) e
 * envia SÓ os campos alterados — "Salvar" sem mexer não chama o servidor.
 * O pai remonta este componente por `key={school.updated_at}`.
 */
export function SchoolEditForm({
  school,
  onCancel,
  onSaved,
  onSemAlteracoes,
  onDirtyChange,
  onSavingChange,
}: SchoolEditFormProps) {
  const original = useMemo(() => valoresDaEscola(school), [school]);
  const [salvando, startSalvar] = useTransition();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    setFocus,
    formState: { errors, isDirty },
  } = useForm<EscolaFormValues>({
    resolver: zodResolver(escolaFormSchema),
    defaultValues: formDaEscola(school),
  });

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    onSavingChange(salvando);
  }, [salvando, onSavingChange]);

  // O sucesso desmonta o form no mesmo commit em que `salvando` volta a
  // false (o efeito acima não roda mais): sem isto o sheet ficaria "salvando".
  useEffect(() => () => onSavingChange(false), [onSavingChange]);

  // O "Editar" que tinha o foco desmonta ao entrar na edição: o foco vai para
  // o 1º campo (senão cai no <body>, fora do diálogo).
  useEffect(() => {
    setFocus("nome");
  }, [setFocus]);

  const onSubmit = (values: EscolaFormValues) => {
    const montagem = colunasDoForm(values, original);
    if (!montagem.ok) {
      setError(montagem.campo, { message: montagem.mensagem }, { shouldFocus: true });
      return;
    }

    const patch = diffEscola(original, montagem.valores);
    if (Object.keys(patch).length === 0) {
      // O isDirty do RHF compara o input cru; o diff, o valor normalizado
      // (espaço no fim, ordem dos testes): sujo para um, vazio para o outro.
      toast.info("Nenhuma alteração para salvar.");
      onSemAlteracoes();
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
          temperatura_relacionamento: school.temperatura_relacionamento,
          localizacaoPendente: localizacaoPendente(school.cidade, school.estado_us),
        }}
      />

      <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 border-t border-border bg-popover px-5 py-3 sm:-mx-6 sm:px-6">
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={salvando}>
          {salvando ? <Loader2 aria-hidden className="animate-spin" /> : <Save aria-hidden />}
          Salvar alterações
        </Button>
      </div>
    </form>
  );
}
