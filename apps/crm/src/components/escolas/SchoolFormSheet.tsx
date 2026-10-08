"use client";

import { useCallback, useEffect, useTransition } from "react";
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
import { Button, useConfirm } from "@/components/ui";

import { prenderTabNoDialogo, travarRolagemDoFundo } from "./prender-foco";
import { SchoolFormFields } from "./SchoolFormFields";

interface SchoolFormSheetProps {
  open: boolean;
  onClose: () => void;
}

export function SchoolFormSheet({ open, onClose }: SchoolFormSheetProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    setFocus,
    reset,
    formState: { errors, isDirty },
  } = useForm<EscolaFormValues>({
    resolver: zodResolver(escolaFormSchema),
    defaultValues: FORM_PADRAO_CRIACAO,
  });

  // Reseta o formulário sempre que o sheet é fechado (estado limpo na próxima abertura).
  useEffect(() => {
    if (!open) reset(FORM_PADRAO_CRIACAO);
  }, [open, reset]);

  // Esc, fundo, X e Cancelar passam por aqui: cadastro digitado não some sem confirmação.
  const fechar = useCallback(async () => {
    if (isPending) return;
    if (isDirty) {
      const descartar = await confirm({
        title: "Descartar cadastro?",
        description: "Os dados desta nova escola ainda não foram salvos.",
        confirmLabel: "Descartar",
        tone: "danger",
      });
      if (!descartar) return;
    }
    onClose();
  }, [confirm, isDirty, isPending, onClose]);

  // Quem abriu é lido ANTES de focar o nome (com autoFocus o input já estaria
  // focado aqui e a referência se perderia); ao fechar, o foco volta para ele.
  useEffect(() => {
    if (!open) return;
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setFocus("nome");
    const destravar = travarRolagemDoFundo();
    return () => {
      destravar();
      if (anterior?.isConnected) anterior.focus();
    };
  }, [open, setFocus]);

  useEffect(() => {
    if (!open) return;
    // Com o "Descartar cadastro?" aberto, o ConfirmProvider consome o Esc antes deste listener.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void fechar();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, fechar]);

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
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => void fechar()} aria-hidden="true" />

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
          <Button variant="ghost" size="icon" onClick={() => void fechar()} aria-label="Fechar cadastro de escola">
            <X aria-hidden />
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-1 flex-col overflow-hidden">
          <div className="crm-scroll flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <SchoolFormFields register={register} errors={errors} watch={watch} setValue={setValue} />
          </div>

          <div className="flex justify-end gap-2 border-t border-border bg-popover px-5 py-4 sm:px-6">
            <Button variant="secondary" size="sm" onClick={() => void fechar()} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? <Loader2 aria-hidden className="animate-spin" /> : <GraduationCap aria-hidden />}
              Criar escola
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
