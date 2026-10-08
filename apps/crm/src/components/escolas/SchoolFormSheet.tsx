"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { GraduationCap, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { criarEscola } from "@/lib/actions/escolas";
import {
  FORM_PADRAO_CRIACAO,
  colunasDoForm,
  escolaFormSchema,
  type EscolaFormValues,
} from "@/lib/escolas/formulario";
import { escolaCriarSchema, mensagemValidacao } from "@/lib/escolas/schema";

import { prenderTabNoDialogo, travarRolagemDoFundo } from "./prender-foco";
import { SchoolFormFields } from "./SchoolFormFields";

interface SchoolFormSheetProps {
  open: boolean;
  onClose: () => void;
}

export function SchoolFormSheet({ open, onClose }: SchoolFormSheetProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    reset,
    formState: { errors },
  } = useForm<EscolaFormValues>({
    resolver: zodResolver(escolaFormSchema),
    defaultValues: FORM_PADRAO_CRIACAO,
  });

  // Reseta o formulário sempre que o sheet é fechado (estado limpo na próxima abertura).
  useEffect(() => {
    if (!open) reset(FORM_PADRAO_CRIACAO);
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const destravar = travarRolagemDoFundo();
    return () => {
      document.removeEventListener("keydown", onKey);
      destravar();
    };
  }, [open, onClose]);

  const onSubmit = (values: EscolaFormValues) => {
    const montagem = colunasDoForm(values, null);
    if (!montagem.ok) {
      setError(montagem.campo, { message: montagem.mensagem }, { shouldFocus: true });
      return;
    }
    const local = escolaCriarSchema.safeParse(montagem.valores);
    if (!local.success) {
      toast.error(mensagemValidacao(local.error));
      return;
    }

    startTransition(async () => {
      try {
        const result = await criarEscola(montagem.valores);
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.success("Escola cadastrada.");
        reset(FORM_PADRAO_CRIACAO);
        onClose();
        router.refresh();
      } catch (e) {
        console.error({ level: "error", action: "criar_escola_ui", erro: String(e) });
        toast.error("Falha de conexão ao cadastrar. Tente de novo.");
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
        aria-labelledby="nova-escola-titulo"
        onKeyDown={prenderTabNoDialogo}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col liquid-glass"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
              <GraduationCap aria-hidden className="size-5" />
            </span>
            <div>
              <h2 id="nova-escola-titulo" className="text-xs font-semibold uppercase tracking-widest text-foreground">
                Nova escola
              </h2>
              <p className="text-xs text-muted-foreground">Cadastro manual de high school</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-fill-4 hover:text-foreground"
            aria-label="Fechar"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-1 flex-col overflow-hidden">
          <div className="crm-scroll flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <SchoolFormFields register={register} errors={errors} watch={watch} setValue={setValue} autoFocusNome />
          </div>

          <div className="flex justify-end gap-2 border-t border-border bg-popover px-5 py-4 sm:px-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <GraduationCap aria-hidden className="size-3.5" />}
              Criar escola
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
