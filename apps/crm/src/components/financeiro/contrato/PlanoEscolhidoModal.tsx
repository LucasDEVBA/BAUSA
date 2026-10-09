"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge, Button, Skeleton } from "@/components/ui";
import { ContratoForm, type ModoContratoForm } from "@/components/financeiro/contrato/ContratoForm";
import { FinModal } from "@/components/financeiro/contrato/FinModal";
import {
  carregarContratoDoDeal,
  criarContratoCompleto,
  salvarCondicoesContrato,
} from "@/lib/actions/financeiro-contrato";
import { composicaoValorTotal, formatarMoeda } from "@/lib/financeiro/calculo.mjs";
import { PLANO_LABEL, valorAssinadoDoItem, type CondicoesContrato, type PlanoContrato } from "@/lib/financeiro/schemas";
import { GAMIFICACAO_TIPO_LABEL } from "@/lib/gamificacao-labels";
import { celebrar } from "@/lib/gamificacao-store";
import type { ContratoCompleto } from "@/types/contrato";

/**
 * T10 — "Escolher plano". INTERFACE PÚBLICA para o grupo de etapas:
 *
 *   • Board (PipelineBoard.handleDragEnd) e DealDetailSheet.handleAdvance:
 *     se `stageConfig[destino].pedePlano`, NÃO chamar moverDeal; abrir este
 *     modal com origem="mover_coluna". `onConfirmed` → aí sim performMove.
 *     `onCancel` → nada (o card nunca saiu da coluna de origem).
 *   • Aba Contrato: origem="aba_contrato" (sem mover nada).
 *
 * Decide sozinho o fluxo pelo estado do contrato do deal:
 *   sem_contrato      → cria o contrato completo (plano + entrada + saldo)
 *   aguardando_plano  → escolhe o plano sobre o(s) sinal(is) já recebido(s)
 *   com plano         → mostra o plano atual: "Manter" ou "Alterar" (edição no lugar)
 */

export interface PlanoEscolhidoResultado {
  contratoId: string;
  plano: PlanoContrato;
  valorTotal: number;
  /** true = só confirmou o plano que já existia (nada gravado). */
  manteveExistente: boolean;
  movidoParaSinalPago: boolean;
}

export interface PlanoEscolhidoModalProps {
  dealId: string;
  athleteName: string;
  origem: "mover_coluna" | "aba_contrato";
  /** Rótulo configurado da coluna de destino (stageConfig[toStage].label). */
  destinoLabel?: string;
  /** Abre direto no formulário (botão "Editar contrato" da aba Contrato). */
  iniciarEditando?: boolean;
  onCancel: () => void;
  onConfirmed: (resultado: PlanoEscolhidoResultado) => void;
}

export function PlanoEscolhidoModal({
  dealId,
  athleteName,
  origem,
  destinoLabel,
  iniciarEditando = false,
  onCancel,
  onConfirmed,
}: PlanoEscolhidoModalProps) {
  const formId = useId();
  const [dados, setDados] = useState<ContratoCompleto | null>(null);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [alterando, setAlterando] = useState(iniciarEditando);
  const [salvando, setSalvando] = useState(false);
  const [bloqueios, setBloqueios] = useState<string[]>([]);
  // Edição concorrente: o form é remontado com a versão nova (key) e avisa.
  const [atualizadoPorOutro, setAtualizadoPorOutro] = useState(false);

  const carregar = useCallback(async () => {
    setErroCarga(null);
    try {
      const r = await carregarContratoDoDeal(dealId);
      if (!r) setErroCarga("Sem permissão para ver o financeiro deste negócio.");
      else setDados(r);
    } catch (err) {
      console.error({ level: "error", action: "plano_modal_carga", dealId, error: String(err) });
      setErroCarga("Não foi possível carregar o contrato. Tente de novo.");
    }
  }, [dealId]);

  useEffect(() => {
    let vivo = true;
    carregarContratoDoDeal(dealId)
      .then((r) => {
        if (!vivo) return;
        if (r) setDados(r);
        else setErroCarga("Sem permissão para ver o financeiro deste negócio.");
      })
      .catch((err: unknown) => {
        console.error({ level: "error", action: "plano_modal_carga", dealId, error: String(err) });
        if (vivo) setErroCarga("Não foi possível carregar o contrato. Tente de novo.");
      });
    return () => {
      vivo = false;
    };
  }, [dealId]);

  const temPlano = Boolean(dados?.contrato?.plano);
  const modo: ModoContratoForm = !dados?.contrato
    ? "criar"
    : dados.contrato.plano === null
      ? "escolher_plano"
      : "editar";
  const mostrarForm = dados !== null && (!temPlano || alterando);

  const enviar = async (valores: CondicoesContrato, regerar: { entrada: boolean; saldo: boolean }) => {
    if (!dados) return;
    setSalvando(true);
    try {
      const r = !dados.contrato
        ? await criarContratoCompleto(dealId, valores)
        : await salvarCondicoesContrato(dados.contrato.id, dados.versao ?? "", valores, {
            regerarEntrada: regerar.entrada,
            regerarSaldo: regerar.saldo,
          });
      if (!r.success) {
        toast.error(r.error, { description: athleteName });
        if (r.code === "FIN_CONTRATO_MUDOU") {
          await carregar();
          setAtualizadoPorOutro(true);
        }
        return;
      }
      for (const aviso of r.avisos) toast.warning(aviso, { description: athleteName });
      celebrar(r.gamificacao, GAMIFICACAO_TIPO_LABEL.contrato_criado);
      const total = await totalGravado(valores);
      toast.success(`Plano ${PLANO_LABEL[valores.plano]} salvo — ${formatarMoeda(total)}`, { description: athleteName });
      onConfirmed({
        contratoId: r.data.contratoId,
        plano: valores.plano,
        valorTotal: total,
        manteveExistente: false,
        movidoParaSinalPago: r.data.movidoParaSinalPago,
      });
    } catch (err) {
      console.error({ level: "error", action: "plano_modal_salvar", dealId, error: String(err) });
      toast.error("Não foi possível salvar o plano. Tente de novo.", { description: athleteName });
    } finally {
      setSalvando(false);
    }
  };

  // O contrato JÁ foi gravado: a releitura só confirma o total. Se ela falhar,
  // usa a mesma conta do servidor — o card precisa mover mesmo assim (senão o
  // modal ficava em "criar" e o 2º clique dava "este negócio já tem contrato").
  const totalGravado = async (valores: CondicoesContrato): Promise<number> => {
    try {
      const atualizado = await carregarContratoDoDeal(dealId);
      if (atualizado?.contrato) return atualizado.contrato.valor_total;
    } catch (err) {
      console.warn({ level: "warn", action: "plano_modal_releitura_falhou", dealId, error: String(err) });
    }
    return composicaoValorTotal({
      valorBase: valores.valorBasePlano,
      itens: valores.itens.map((i) => ({ valor: valorAssinadoDoItem(i) })),
      entrada: valores.entrada.valor,
      sinalAbatido: valores.sinalAbatido,
    });
  };

  const manter = () => {
    if (!dados?.contrato?.plano) return;
    onConfirmed({
      contratoId: dados.contrato.id,
      plano: dados.contrato.plano,
      valorTotal: dados.contrato.valor_total,
      manteveExistente: true,
      movidoParaSinalPago: false,
    });
  };

  const titulo =
    origem === "mover_coluna" && destinoLabel
      ? `Escolher plano · mover para ${destinoLabel}`
      : temPlano
        ? "Editar contrato"
        : "Escolher plano";
  const rotuloSalvar = origem === "mover_coluna" ? "Salvar plano e mover" : "Salvar plano";

  return (
    <FinModal
      aberto
      onFechar={onCancel}
      bloqueado={salvando}
      titulo={titulo}
      descricao={athleteName}
      icone={<ClipboardCheck className="size-4" />}
      largura={mostrarForm ? "xl" : "md"}
      rodape={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={salvando}>
            {origem === "mover_coluna" ? "Cancelar (não mover)" : "Cancelar"}
          </Button>
          {temPlano && !alterando ? (
            <>
              <Button variant="secondary" onClick={() => setAlterando(true)}>Alterar plano</Button>
              <Button onClick={manter}>{origem === "mover_coluna" ? "Manter plano e mover" : "Fechar"}</Button>
            </>
          ) : (
            <Button
              type="submit"
              form={formId}
              disabled={salvando || !dados || bloqueios.length > 0}
              title={bloqueios[0]}
              aria-describedby={bloqueios.length > 0 ? `${formId}-bloqueio` : undefined}
            >
              {salvando && <Loader2 className="animate-spin" />}
              {rotuloSalvar}
            </Button>
          )}
          {bloqueios.length > 0 && mostrarForm && (
            <p id={`${formId}-bloqueio`} className="text-[11px] text-muted-foreground sm:mr-auto sm:order-first">
              {bloqueios[0]}
            </p>
          )}
        </>
      }
    >
      {erroCarga ? (
        <div className="space-y-3 text-sm">
          <p role="alert" className="text-sys-red">{erroCarga}</p>
          <Button variant="secondary" size="sm" onClick={() => void carregar()}>Tentar de novo</Button>
        </div>
      ) : !dados ? (
        <div className="space-y-3" aria-busy="true" aria-live="polite">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : temPlano && !alterando && dados.contrato ? (
        <div className="space-y-2 text-sm">
          <p className="text-foreground">
            Plano atual: <strong>{PLANO_LABEL[dados.contrato.plano as PlanoContrato]}</strong> ·{" "}
            <span className="tabular-nums">{formatarMoeda(dados.contrato.valor_total)}</span>
          </p>
          {dados.estado === "condicoes_pendentes" && (
            <Badge tone="orange" size="sm">Condições do saldo pendentes</Badge>
          )}
          <p className="text-xs text-muted-foreground">
            Alterar o plano edita o contrato no lugar: pagamentos recebidos não mudam e só as parcelas em aberto são recalculadas.
          </p>
        </div>
      ) : (
        <>
          {atualizadoPorOutro && (
            <p role="status" className="mb-3 rounded-lg border border-sys-orange/25 bg-sys-orange/8 px-3 py-2 text-xs text-sys-orange">
              O contrato foi alterado em outra aba ou por outra pessoa. O formulário foi recarregado com a versão atual — refaça a alteração.
            </p>
          )}
          {/* key = versão: o useForm só lê defaultValues na montagem; sem remontar,
              o form antigo seria enviado com a versão nova e desfaria a outra edição. */}
          <ContratoForm key={dados.versao ?? "novo"} modo={modo} dados={dados} formId={formId} onEnviar={enviar} onBloqueio={setBloqueios} />
        </>
      )}
    </FinModal>
  );
}
