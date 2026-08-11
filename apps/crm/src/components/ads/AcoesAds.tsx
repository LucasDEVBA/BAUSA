"use client";

import { useState, useTransition } from "react";
import { Pause, Play, PencilLine, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { alterarOrcamentoAds, executarAcaoStatusAds } from "@/lib/actions/ads";
import { cn } from "@/lib/utils";

// Ações de escrita do Ads (A2): TODA ação passa por confirmação explícita.
// Server action revalida a rota — o novo estado aparece sem reload manual.

type Nivel = "campanha" | "conjunto" | "anuncio";

const NIVEL_LABEL: Record<Nivel, string> = { campanha: "a campanha", conjunto: "o conjunto", anuncio: "o anúncio" };
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function Overlay({ children, onFechar }: { children: React.ReactNode; onFechar: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onFechar}
      onKeyDown={(e) => e.key === "Escape" && onFechar()}
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function AcaoStatusAds({
  objetoId,
  nivel,
  nome,
  statusAtual,
  compacto = false,
}: {
  objetoId: string;
  nivel: Nivel;
  nome: string;
  statusAtual: string;
  compacto?: boolean;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [pendente, startTransition] = useTransition();
  const ativa = statusAtual === "ACTIVE";
  const acao = ativa ? "pausar" : "reativar";

  const executar = () =>
    startTransition(async () => {
      const r = await executarAcaoStatusAds({ objetoId, nivel, acao });
      setConfirmando(false);
      if (r.success) {
        toast.success(`${ativa ? "Pausado" : "Reativado"} com sucesso.`);
        if (r.aviso) toast.warning(r.aviso);
      } else {
        toast.error(r.error ?? "Falha na ação.");
      }
    });

  return (
    <>
      <Button
        variant={compacto ? "ghost" : "secondary"}
        size="sm"
        onClick={() => setConfirmando(true)}
        disabled={pendente}
        aria-label={`${ativa ? "Pausar" : "Reativar"} ${NIVEL_LABEL[nivel]} ${nome}`}
        className={cn(compacto && "h-7 px-2")}
      >
        {pendente ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : ativa ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
        {!compacto && <span className="ml-1.5">{ativa ? "Pausar" : "Reativar"}</span>}
      </Button>

      {confirmando ? (
        <Overlay onFechar={() => setConfirmando(false)}>
          <div className="flex items-start gap-3">
            <div className={cn("rounded-full p-2", ativa ? "bg-sys-orange/12 text-sys-orange" : "bg-sys-green/12 text-sys-green")}>
              {ativa ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-foreground">{ativa ? "Pausar" : "Reativar"} {NIVEL_LABEL[nivel]}?</h3>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground" title={nome}>{nome}</p>
              {!ativa ? (
                <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-sys-orange">
                  <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden /> Reativar pode voltar a gastar o orçamento configurado.
                </p>
              ) : null}
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmando(false)} disabled={pendente}>Cancelar</Button>
            <Button size="sm" onClick={executar} disabled={pendente}>
              {pendente ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : `Confirmar ${acao}`}
            </Button>
          </div>
        </Overlay>
      ) : null}
    </>
  );
}

export function AcaoOrcamentoAds({
  objetoId,
  nivel,
  nome,
  orcamentoAtualBrl,
}: {
  objetoId: string;
  nivel: "campanha" | "conjunto";
  nome: string;
  orcamentoAtualBrl: number;
}) {
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState(String(orcamentoAtualBrl));
  const [pendente, startTransition] = useTransition();
  const numero = Number(valor.replace(",", "."));
  const valido = Number.isFinite(numero) && numero >= 1 && numero <= 5000;

  const executar = () =>
    startTransition(async () => {
      const r = await alterarOrcamentoAds({ objetoId, nivel, valorDiarioBrl: numero });
      setAberto(false);
      if (r.success) {
        toast.success(`Orçamento atualizado para ${brl.format(numero)}/dia.`);
        if (r.aviso) toast.warning(r.aviso);
      } else {
        toast.error(r.error ?? "Falha na ação.");
      }
    });

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setAberto(true)} disabled={pendente} aria-label={`Editar orçamento de ${nome}`}>
        {pendente ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <PencilLine className="h-3.5 w-3.5" aria-hidden />}
        <span className="ml-1.5">Orçamento</span>
      </Button>

      {aberto ? (
        <Overlay onFechar={() => setAberto(false)}>
          <h3 className="text-sm font-bold text-foreground">Orçamento diário</h3>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground" title={nome}>{nome}</p>
          <label htmlFor={`orc-${objetoId}`} className="mt-4 block text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">
            Novo valor (R$/dia) — atual {brl.format(orcamentoAtualBrl)}
          </label>
          <input
            id={`orc-${objetoId}`}
            type="number"
            min={1}
            max={5000}
            step="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {!valido && valor !== "" ? (
            <p className="mt-1.5 text-[11px] font-semibold text-sys-red">Valor entre R$ 1 e R$ 5.000 por dia.</p>
          ) : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAberto(false)} disabled={pendente}>Cancelar</Button>
            <Button size="sm" onClick={executar} disabled={pendente || !valido}>
              {pendente ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : "Confirmar alteração"}
            </Button>
          </div>
        </Overlay>
      ) : null}
    </>
  );
}
