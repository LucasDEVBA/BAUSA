"use client";

import { useId, useState } from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, HandCoins, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { ComprovanteUpload } from "@/components/financeiro/contrato/ComprovanteUpload";
import { FinModal } from "@/components/financeiro/contrato/FinModal";
import { registrarSinal } from "@/lib/actions/financeiro-contrato";
import { ehValorIrrisorio, formatarMoeda } from "@/lib/financeiro/calculo.mjs";
import {
  FORMA_LABEL,
  FORMAS_COM_CARTAO,
  FORMAS_ENTRADA,
  hojeBRT,
  registrarSinalSchema,
  type RegistrarSinalInput,
} from "@/lib/financeiro/schemas";
import { GAMIFICACAO_TIPO_LABEL } from "@/lib/gamificacao-labels";
import { celebrar } from "@/lib/gamificacao-store";

type SaidaSinal = ReturnType<typeof registrarSinalSchema.parse>;

/**
 * T11 — registrar o sinal ANTES do plano: valor variável (sugestão = entrada
 * padrão), forma real (Pix, Getnet parcelado, transferência…), data real do
 * pagamento (entra no caixa nesse dia) e comprovante opcional. Pode ser usado
 * mais de uma vez (sinal pago em 2 Pix, por exemplo) enquanto o plano não é
 * escolhido.
 */
export function RegistrarSinalModal({
  dealId,
  atletaId,
  athleteName,
  sugestao,
  sinalJaRecebido,
  onFechar,
  onRegistrado,
}: {
  dealId: string;
  /** Para o upload do comprovante (bucket documentos do atleta). */
  atletaId?: string | null;
  athleteName: string;
  /** configuracoes_sistema.entrada_padrao (R$ 4.500 hoje) — só sugestão. */
  sugestao: number;
  sinalJaRecebido: number;
  onFechar: () => void;
  onRegistrado: (r: { contratoId: string; sinalTotal: number; movidoParaSinalPago: boolean }) => void;
}) {
  const formId = useId();
  const [salvando, setSalvando] = useState(false);
  const { control, register, handleSubmit, setValue, formState } = useForm<RegistrarSinalInput, unknown, SaidaSinal>({
    resolver: zodResolver(registrarSinalSchema) as Resolver<RegistrarSinalInput, unknown, SaidaSinal>,
    defaultValues: {
      dealId,
      dataPagamento: hojeBRT(),
      parcelasCartao: null,
      comprovanteUrl: null,
      observacao: "",
      confirmarValorBaixo: false,
    },
    mode: "onChange",
  });
  const valor = useWatch({ control, name: "valor" });
  const comprovante = useWatch({ control, name: "comprovanteUrl" });
  const forma = useWatch({ control, name: "forma" });

  const enviar = async (dados: SaidaSinal) => {
    setSalvando(true);
    try {
      const r = await registrarSinal(dados);
      if (!r.success) {
        toast.error(r.error, { description: athleteName });
        return;
      }
      for (const aviso of r.avisos) toast.warning(aviso, { description: athleteName });
      celebrar(r.gamificacao, GAMIFICACAO_TIPO_LABEL.sinal_pago);
      toast.success(`Sinal de ${formatarMoeda(dados.valor)} registrado`, {
        description: r.data.movidoParaSinalPago ? `${athleteName} · movido para Sinal pago` : athleteName,
      });
      onRegistrado(r.data);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <FinModal
      aberto
      onFechar={onFechar}
      bloqueado={salvando}
      titulo="Registrar sinal"
      descricao={
        sinalJaRecebido > 0
          ? `${athleteName} · já recebido: ${formatarMoeda(sinalJaRecebido)} (este pagamento soma)`
          : `${athleteName} · o plano pode ser escolhido depois`
      }
      icone={<HandCoins className="size-4" />}
      rodape={
        <>
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button type="submit" form={formId} disabled={salvando}>
            {salvando && <Loader2 className="animate-spin" />}
            Registrar sinal
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={handleSubmit(enviar)} className="space-y-3">
        <Controller
          control={control}
          name="valor"
          render={({ field, fieldState }) => (
            <MoneyInput
              label="Valor pago *"
              autoFocus
              value={field.value ?? null}
              onValueChange={(x) => field.onChange(x ?? undefined)}
              onBlur={field.onBlur}
              erro={fieldState.error?.message}
              ajuda={
                field.value === undefined ? (
                  <button type="button" className="font-medium text-primary hover:underline" onClick={() => field.onChange(sugestao)}>
                    Usar sugestão {formatarMoeda(sugestao)}
                  </button>
                ) : undefined
              }
            />
          )}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-forma`} className="block text-xs font-medium text-muted-foreground">Forma *</label>
            <select id={`${formId}-forma`} {...register("forma")} defaultValue=""
              className="h-10 w-full rounded-lg border border-input bg-card px-3 text-base sm:h-9 sm:text-sm">
              <option value="" disabled>Escolha…</option>
              {FORMAS_ENTRADA.map((f) => <option key={f} value={f}>{FORMA_LABEL[f]}</option>)}
            </select>
            {formState.errors.forma && <p role="alert" className="text-[11px] text-sys-red">{formState.errors.forma.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-data`} className="block text-xs font-medium text-muted-foreground">Data do pagamento *</label>
            <input id={`${formId}-data`} type="date" max={hojeBRT()} {...register("dataPagamento")}
              className="h-10 w-full rounded-lg border border-input bg-card px-3 text-base sm:h-9 sm:text-sm" />
            {formState.errors.dataPagamento && <p role="alert" className="text-[11px] text-sys-red">{formState.errors.dataPagamento.message}</p>}
          </div>
        </div>
        {forma && FORMAS_COM_CARTAO.has(forma) && (
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-cartao`} className="block text-xs font-medium text-muted-foreground">Vezes no cartão</label>
            <input id={`${formId}-cartao`} type="number" inputMode="numeric" min={1} max={24}
              {...register("parcelasCartao", { setValueAs: (x: string) => (x === "" ? null : Number(x)) })}
              className="h-10 w-full rounded-lg border border-input bg-card px-3 text-base sm:h-9 sm:text-sm" />
            <p className="text-[11px] text-label-tertiary">Informativo: o sinal entra no caixa na data do pagamento.</p>
          </div>
        )}
        <ComprovanteUpload atletaId={atletaId} valor={comprovante ?? null}
          onChange={(url) => setValue("comprovanteUrl", url, { shouldValidate: true })} />
        <div className="space-y-1.5">
          <label htmlFor={`${formId}-obs`} className="block text-xs font-medium text-muted-foreground">Observação</label>
          <textarea id={`${formId}-obs`} rows={2} {...register("observacao")} placeholder="Ex.: pago pelo avô; comprovante no WhatsApp"
            className="w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-base sm:text-sm" />
        </div>
        {ehValorIrrisorio(valor ?? 0) && (
          <label className="flex items-start gap-2 rounded-lg border border-sys-orange/30 bg-sys-orange/8 p-2.5 text-xs text-sys-orange">
            <input type="checkbox" className="mt-0.5 size-4"
              onChange={(e) => setValue("confirmarValorBaixo", e.target.checked, { shouldValidate: true })} />
            <span><AlertTriangle aria-hidden className="mr-1 inline size-3.5" />
              Sinal de <strong>{formatarMoeda(valor ?? 0)}</strong> está abaixo de R$ 100. Confirmo que o valor está certo.</span>
          </label>
        )}
        {formState.errors.confirmarValorBaixo && (
          <p role="alert" className="text-[11px] text-sys-red">{formState.errors.confirmarValorBaixo.message}</p>
        )}
      </form>
    </FinModal>
  );
}
