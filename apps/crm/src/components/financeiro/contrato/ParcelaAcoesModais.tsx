"use client";

import { useId, useState } from "react";
import { Loader2, PencilLine, Undo2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { FinModal } from "@/components/financeiro/contrato/FinModal";
import { editarParcela, estornarParcela, quitarContrato } from "@/lib/actions/financeiro-contrato";
import { formatarMoeda } from "@/lib/financeiro/calculo.mjs";
import {
  hojeBRT,
  JUSTIFICATIVA_MIN,
  METODO_LABEL,
  METODOS_PARCELA,
  type MetodoParcelaContrato,
} from "@/lib/financeiro/schemas";
import type { ParcelaRow } from "@/types/contrato";

const campo = "h-10 w-full rounded-lg border border-input bg-card px-3 text-base sm:h-9 sm:text-sm";
const rotulo = "block text-xs font-medium text-muted-foreground";

// ─── Estornar baixa (T9) ────────────────────────────────────────────────
export function EstornoParcelaModal({
  parcela,
  aguardandoPlano,
  athleteName,
  onFechar,
  onFeito,
}: {
  parcela: ParcelaRow;
  /** Sinal de contrato sem plano: estorno = REMOVER o registro (não volta a "previsto"). */
  aguardandoPlano: boolean;
  athleteName: string;
  onFechar: () => void;
  onFeito: () => void;
}) {
  const id = useId();
  const [just, setJust] = useState("");
  const [novoVenc, setNovoVenc] = useState("");
  const [salvando, setSalvando] = useState(false);
  const curta = just.trim().length < JUSTIFICATIVA_MIN;
  const hoje = hojeBRT();
  const vencida = !aguardandoPlano && parcela.vencimento < hoje;

  const enviar = async () => {
    setSalvando(true);
    try {
      const r = await estornarParcela({ parcelaId: parcela.id, justificativa: just, novoVencimento: novoVenc || null });
      if (!r.success) return void toast.error(r.error, { description: athleteName });
      for (const a of r.avisos) toast.warning(a, { description: athleteName });
      toast.success(r.data.sinalRemovido ? "Registro de sinal removido" : "Baixa estornada", { description: athleteName });
      onFeito();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <FinModal
      aberto
      onFechar={onFechar}
      bloqueado={salvando}
      titulo={aguardandoPlano ? `Remover sinal · ${parcela.numero_parcela}` : `Estornar baixa · ${parcela.numero_parcela}`}
      descricao={`${athleteName} · ${formatarMoeda(parcela.valor)}`}
      icone={<Undo2 className="size-4" />}
      rodape={
        <>
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button variant="destructive" onClick={enviar} disabled={salvando || curta} title={curta ? "Informe a justificativa" : undefined}>
            {salvando && <Loader2 className="animate-spin" />}
            {aguardandoPlano ? "Remover sinal" : "Estornar"}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-xs text-muted-foreground">
        {aguardandoPlano
          ? "O pagamento sai do caixa e do contrato. Se era o único sinal, o contrato some (e pode ser registrado de novo)."
          : "A parcela volta a ficar em aberto (prevista ou atrasada). Se for a entrada, “Entrada paga” é desfeita. O negócio NÃO muda de etapa."}
      </p>
      <label htmlFor={`${id}-j`} className={rotulo}>Justificativa *</label>
      <textarea id={`${id}-j`} rows={3} value={just} onChange={(e) => setJust(e.target.value)} autoFocus
        placeholder="Ex.: baixa lançada na parcela errada" className="mt-1 w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-base sm:text-sm" />
      {!aguardandoPlano && (
        <div className="mt-3 space-y-1.5">
          <label htmlFor={`${id}-v`} className={rotulo}>Novo vencimento (opcional)</label>
          <input id={`${id}-v`} type="date" min={hoje} value={novoVenc} onChange={(e) => setNovoVenc(e.target.value)}
            aria-describedby={vencida ? `${id}-aviso` : undefined} className={campo} />
          {vencida && !novoVenc && (
            <p id={`${id}-aviso`} role="note" className="text-[11px] text-sys-orange">
              Venceu em {parcela.vencimento.split("-").reverse().join("/")}: sem novo vencimento ela volta ATRASADA e a régua de cobrança pode mandar lembrete à família no próximo envio.
            </p>
          )}
        </div>
      )}
    </FinModal>
  );
}

// ─── Editar parcela em aberto (T9) ──────────────────────────────────────
export function EditarParcelaModal({
  parcela,
  versao,
  temOutraAberta,
  podeAlterarTotal,
  athleteName,
  onFechar,
  onFeito,
}: {
  parcela: ParcelaRow;
  versao: string;
  temOutraAberta: boolean;
  /** Saldo de contrato COM plano: pode virar item de "ajuste" (Regra 3). */
  podeAlterarTotal: boolean;
  athleteName: string;
  onFechar: () => void;
  onFeito: () => void;
}) {
  const id = useId();
  const [valor, setValor] = useState<number | null>(parcela.valor);
  const [venc, setVenc] = useState(parcela.vencimento);
  const [metodo, setMetodo] = useState<MetodoParcelaContrato>(parcela.metodo);
  const [modo, setModo] = useState<"ajustar_ultima" | "alterar_total">(temOutraAberta ? "ajustar_ultima" : "alterar_total");
  const [just, setJust] = useState("");
  const [salvando, setSalvando] = useState(false);
  const mudouValor = valor !== null && valor !== parcela.valor;
  const nadaMudou = !mudouValor && venc === parcela.vencimento && metodo === parcela.metodo;
  const bloqueio = valor === null || valor <= 0 ? "Informe o valor." : nadaMudou ? "Nada mudou." :
    just.trim().length < JUSTIFICATIVA_MIN ? "Informe a justificativa." :
    mudouValor && modo === "ajustar_ultima" && !temOutraAberta ? "Não há outra parcela em aberto para absorver a diferença." :
    mudouValor && modo === "alterar_total" && !podeAlterarTotal ? "Para mudar a entrada, use Editar contrato." : null;

  const enviar = async () => {
    setSalvando(true);
    try {
      const r = await editarParcela({
        parcelaId: parcela.id, versao, justificativa: just,
        valor: mudouValor ? valor : null,
        vencimento: venc !== parcela.vencimento ? venc : null,
        metodo: metodo !== parcela.metodo ? metodo : null,
        modoValor: modo,
      });
      if (!r.success) return void toast.error(r.error, { description: athleteName });
      toast.success("Parcela atualizada", { description: athleteName });
      onFeito();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <FinModal
      aberto onFechar={onFechar} bloqueado={salvando}
      titulo={`Editar parcela · ${parcela.numero_parcela}`}
      descricao={`${athleteName} · em aberto`}
      icone={<PencilLine className="size-4" />}
      rodape={
        <>
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button onClick={enviar} disabled={salvando || bloqueio !== null} title={bloqueio ?? undefined}>
            {salvando && <Loader2 className="animate-spin" />}Salvar parcela
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <MoneyInput label="Valor" value={valor} onValueChange={setValor} />
        {mudouValor && (
          <fieldset className="space-y-1.5 text-xs">
            <legend className={rotulo}>A diferença de {formatarMoeda((valor ?? 0) - parcela.valor)}…</legend>
            <label className="flex items-start gap-2">
              <input type="radio" name={`${id}-modo`} checked={modo === "ajustar_ultima"} disabled={!temOutraAberta}
                onChange={() => setModo("ajustar_ultima")} className="mt-0.5" />
              <span>sai/entra na ÚLTIMA parcela em aberto (o total do contrato não muda)</span>
            </label>
            <label className="flex items-start gap-2">
              <input type="radio" name={`${id}-modo`} checked={modo === "alterar_total"} disabled={!podeAlterarTotal}
                onChange={() => setModo("alterar_total")} className="mt-0.5" />
              <span>muda o valor do contrato (vira um “ajuste” com a justificativa)</span>
            </label>
          </fieldset>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-v`} className={rotulo}>Vencimento</label>
            <input id={`${id}-v`} type="date" value={venc} onChange={(e) => setVenc(e.target.value)} className={campo} />
          </div>
          <div>
            <label htmlFor={`${id}-m`} className={rotulo}>Método</label>
            <select id={`${id}-m`} value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoParcelaContrato)} className={campo}>
              {METODOS_PARCELA.map((m) => <option key={m} value={m}>{METODO_LABEL[m]}</option>)}
            </select>
          </div>
        </div>
        {venc !== parcela.vencimento && (
          <p className="text-[11px] text-muted-foreground">Vencimento novo: a régua de cobrança recomeça os lembretes para esta parcela.</p>
        )}
        <div>
          <label htmlFor={`${id}-j`} className={rotulo}>Justificativa *</label>
          <textarea id={`${id}-j`} rows={2} value={just} onChange={(e) => setJust(e.target.value)}
            className="mt-1 w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-base sm:text-sm" />
        </div>
      </div>
    </FinModal>
  );
}

// ─── Quitar contrato (T9) ───────────────────────────────────────────────
export function QuitarContratoModal({
  contratoId,
  versao,
  aReceber,
  semCronograma,
  athleteName,
  onFechar,
  onFeito,
}: {
  contratoId: string;
  versao: string;
  aReceber: number;
  semCronograma: number;
  athleteName: string;
  onFechar: () => void;
  onFeito: () => void;
}) {
  const id = useId();
  const [data, setData] = useState(hojeBRT());
  const [metodo, setMetodo] = useState<MetodoParcelaContrato | "">("");
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);

  const enviar = async () => {
    if (!metodo) return;
    setSalvando(true);
    try {
      const r = await quitarContrato({ contratoId, versao, data, metodo, observacao: obs });
      if (!r.success) return void toast.error(r.error, { description: athleteName });
      for (const a of r.avisos) toast.warning(a, { description: athleteName });
      toast.success(`Contrato quitado — ${formatarMoeda(r.data.valorQuitado)} em ${r.data.parcelasQuitadas} parcela(s)`, {
        description: `${athleteName} · a etapa do negócio não muda`,
      });
      onFeito();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <FinModal
      aberto onFechar={onFechar} bloqueado={salvando}
      titulo="Quitar contrato"
      descricao={`${athleteName} · dá baixa em tudo que está em aberto`}
      icone={<Wallet className="size-4" />}
      rodape={
        <>
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button onClick={enviar} disabled={salvando || !metodo || data > hojeBRT()} title={!metodo ? "Escolha o método" : undefined}>
            {salvando && <Loader2 className="animate-spin" />}Quitar {formatarMoeda(aReceber + semCronograma)}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-foreground">
          Em aberto: <strong>{formatarMoeda(aReceber)}</strong>
          {semCronograma > 0 && <> + <strong>{formatarMoeda(semCronograma)}</strong> sem parcelas (vira “Quitação”)</>}.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-d`} className={rotulo}>Data do pagamento *</label>
            <input id={`${id}-d`} type="date" max={hojeBRT()} value={data} onChange={(e) => setData(e.target.value)} className={campo} />
          </div>
          <div>
            <label htmlFor={`${id}-m`} className={rotulo}>Método *</label>
            <select id={`${id}-m`} value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoParcelaContrato | "")} className={campo}>
              <option value="">Escolha…</option>
              {METODOS_PARCELA.map((m) => <option key={m} value={m}>{METODO_LABEL[m]}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor={`${id}-o`} className={rotulo}>Observação</label>
          <input id={`${id}-o`} value={obs} onChange={(e) => setObs(e.target.value)} className={campo} placeholder="Ex.: família pagou o restante à vista" />
        </div>
      </div>
    </FinModal>
  );
}
