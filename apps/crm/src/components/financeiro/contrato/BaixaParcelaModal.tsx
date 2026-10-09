"use client";

import { useId, useState } from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { ComprovanteUpload } from "@/components/financeiro/contrato/ComprovanteUpload";
import { FinModal } from "@/components/financeiro/contrato/FinModal";
import { baixarParcela } from "@/lib/actions/financeiro-contrato";
import { ehValorIrrisorio, formatarMoeda } from "@/lib/financeiro/calculo.mjs";
import {
  baixarParcelaSchema,
  hojeBRT,
  METODO_LABEL,
  METODOS_PARCELA,
  type BaixarParcelaInput,
} from "@/lib/financeiro/schemas";
import { GAMIFICACAO_TIPO_LABEL } from "@/lib/gamificacao-labels";
import { celebrar } from "@/lib/gamificacao-store";
import type { ParcelaRow } from "@/types/contrato";

type SaidaBaixa = ReturnType<typeof baixarParcelaSchema.parse>;

/**
 * T5/T9 — dar baixa com DATA, MÉTODO e VALOR reais (antes: sempre "agora" e
 * o método previsto). Valor menor = pagamento parcial: a diferença vira uma
 * parcela "(restante)" com o mesmo vencimento. Parcela irrisória (< R$ 100)
 * pede confirmação explícita (o R$ 7,80 da Amanda foi baixado em 10 s).
 * Baixar a entrada marca "Entrada paga" quando todas as de entrada fecham e
 * NUNCA puxa o deal para trás (só avança se ele estiver antes de Sinal pago).
 */
export function BaixaParcelaModal({
  parcela,
  atletaId,
  athleteName,
  onFechar,
  onBaixada,
}: {
  parcela: ParcelaRow;
  atletaId?: string | null;
  athleteName: string;
  onFechar: () => void;
  onBaixada: (r: { entradaPagaAgora: boolean; movidoParaSinalPago: boolean }) => void;
}) {
  const formId = useId();
  const [salvando, setSalvando] = useState(false);
  const { control, register, handleSubmit, setValue, formState } = useForm<BaixarParcelaInput, unknown, SaidaBaixa>({
    resolver: zodResolver(baixarParcelaSchema) as Resolver<BaixarParcelaInput, unknown, SaidaBaixa>,
    defaultValues: {
      parcelaId: parcela.id,
      data: hojeBRT(),
      metodo: parcela.metodo,
      valorRecebido: null,
      valorParcela: parcela.valor,
      comprovanteUrl: null,
      observacao: "",
      parcelasCartao: null,
      confirmarValorBaixo: false,
    },
    mode: "onChange",
  });
  const recebido = useWatch({ control, name: "valorRecebido" });
  const comprovante = useWatch({ control, name: "comprovanteUrl" });
  const valorEfetivo = recebido ?? parcela.valor;
  const parcial = recebido !== null && recebido !== undefined && recebido < parcela.valor;

  const enviar = async (dados: SaidaBaixa) => {
    setSalvando(true);
    try {
      const r = await baixarParcela(dados);
      if (!r.success) {
        toast.error(r.error, { description: `${athleteName} · ${parcela.numero_parcela}` });
        return;
      }
      for (const aviso of r.avisos) toast.warning(aviso, { description: athleteName });
      celebrar(r.gamificacao, GAMIFICACAO_TIPO_LABEL.pagamento_confirmado);
      toast.success(
        r.data.entradaPagaAgora ? "Entrada paga — contrato atualizado" : `Baixa de ${formatarMoeda(valorEfetivo)} registrada`,
        { description: r.data.movidoParaSinalPago ? `${athleteName} · movido para Sinal pago` : athleteName },
      );
      onBaixada(r.data);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <FinModal
      aberto
      onFechar={onFechar}
      bloqueado={salvando}
      titulo={`Dar baixa · ${parcela.numero_parcela}`}
      descricao={`${athleteName} · ${formatarMoeda(parcela.valor)} · venc. ${parcela.vencimento.split("-").reverse().join("/")}`}
      icone={<CheckCircle2 className="size-4" />}
      rodape={
        <>
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button type="submit" form={formId} disabled={salvando}>
            {salvando && <Loader2 className="animate-spin" />}
            Confirmar recebimento
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={handleSubmit(enviar)} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-data`} className="block text-xs font-medium text-muted-foreground">Data em que o dinheiro entrou *</label>
            <input id={`${formId}-data`} type="date" max={hojeBRT()} {...register("data")}
              className="h-10 w-full rounded-lg border border-input bg-card px-3 text-base sm:h-9 sm:text-sm" />
            {formState.errors.data && <p role="alert" className="text-[11px] text-sys-red">{formState.errors.data.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-metodo`} className="block text-xs font-medium text-muted-foreground">Método *</label>
            <select id={`${formId}-metodo`} {...register("metodo")}
              className="h-10 w-full rounded-lg border border-input bg-card px-3 text-base sm:h-9 sm:text-sm">
              {METODOS_PARCELA.map((m) => <option key={m} value={m}>{METODO_LABEL[m]}</option>)}
            </select>
          </div>
        </div>
        <Controller
          control={control}
          name="valorRecebido"
          render={({ field, fieldState }) => (
            <MoneyInput
              label="Valor recebido"
              value={field.value ?? parcela.valor}
              onValueChange={(x) => field.onChange(x === null || x === parcela.valor ? null : x)}
              onBlur={field.onBlur}
              erro={fieldState.error?.message}
              ajuda={parcial ? `Pagamento parcial: ${formatarMoeda(parcela.valor - (recebido ?? 0))} ficam em aberto como “${parcela.numero_parcela} (restante)”.` : "Igual ao valor da parcela? Deixe como está."}
            />
          )}
        />
        <ComprovanteUpload atletaId={atletaId} valor={comprovante ?? null}
          onChange={(url) => setValue("comprovanteUrl", url, { shouldValidate: true })} />
        <div className="space-y-1.5">
          <label htmlFor={`${formId}-obs`} className="block text-xs font-medium text-muted-foreground">Observação</label>
          <input id={`${formId}-obs`} {...register("observacao")} placeholder="Ex.: transferência da conta do pai"
            className="h-10 w-full rounded-lg border border-input bg-card px-3 text-base sm:h-9 sm:text-sm" />
        </div>
        {ehValorIrrisorio(valorEfetivo) && (
          <label className="flex items-start gap-2 rounded-lg border border-sys-orange/30 bg-sys-orange/8 p-2.5 text-xs text-sys-orange">
            <input type="checkbox" className="mt-0.5 size-4"
              onChange={(e) => setValue("confirmarValorBaixo", e.target.checked, { shouldValidate: true })} />
            <span><AlertTriangle aria-hidden className="mr-1 inline size-3.5" />
              Valor de <strong>{formatarMoeda(valorEfetivo)}</strong> está abaixo de R$ 100. Confirmo que está certo.</span>
          </label>
        )}
        {formState.errors.confirmarValorBaixo && (
          <p role="alert" className="text-[11px] text-sys-red">{formState.errors.confirmarValorBaixo.message}</p>
        )}
      </form>
    </FinModal>
  );
}
