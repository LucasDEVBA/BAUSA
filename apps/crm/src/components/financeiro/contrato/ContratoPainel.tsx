"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ClipboardCheck, HandCoins, MoreHorizontal, PencilLine, Undo2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Badge, Button, EmptyState, useConfirm } from "@/components/ui";
import { BaixaParcelaModal } from "@/components/financeiro/contrato/BaixaParcelaModal";
import { CustosAlunoPanel } from "@/components/financeiro/contrato/CustosAlunoPanel";
import { HistoricoContrato } from "@/components/financeiro/contrato/HistoricoContrato";
import { EditarParcelaModal, EstornoParcelaModal, QuitarContratoModal } from "@/components/financeiro/contrato/ParcelaAcoesModais";
import { PlanoEscolhidoModal } from "@/components/financeiro/contrato/PlanoEscolhidoModal";
import { RegistrarSinalModal } from "@/components/financeiro/contrato/RegistrarSinalModal";
import { excluirContratoSemPagamento } from "@/lib/actions/financeiro";
import { formatarMoeda } from "@/lib/financeiro/calculo.mjs";
import { FORMA_LABEL, METODO_LABEL, PLANO_LABEL } from "@/lib/financeiro/schemas";
import { cn } from "@/lib/utils";
import type { ContratoCompleto, ParcelaRow } from "@/types/contrato";

/**
 * Painel financeiro do contrato — MESMO componente na aba Contrato do deal e
 * em /contratos/[id] (antes: aba do deal com ações, /contratos só leitura).
 * Estados: sem contrato · aguardando plano (só sinal) · condições pendentes ·
 * ativo · quitado. Todas as ações são CEO/CTO (a page/tab já exige o papel e
 * cada action revalida).
 */

const ESTADO_BADGE = {
  sem_contrato: { label: "Sem contrato", tone: "neutral" as const },
  aguardando_plano: { label: "Aguardando plano", tone: "orange" as const },
  cancelado: { label: "Cancelado", tone: "neutral" as const },
  condicoes_pendentes: { label: "Condições do saldo pendentes", tone: "orange" as const },
  ativo: { label: "Ativo", tone: "blue" as const },
  quitado: { label: "Quitado", tone: "green" as const },
};

type Acao =
  | { tipo: "sinal" }
  | { tipo: "plano" }
  | { tipo: "quitar" }
  | { tipo: "baixa"; parcela: ParcelaRow }
  | { tipo: "estorno"; parcela: ParcelaRow }
  | { tipo: "editar_parcela"; parcela: ParcelaRow }
  | null;

export function ContratoPainel({
  dados,
  onAlterado,
  onGanho,
  linkContratoCompleto = true,
}: {
  dados: ContratoCompleto;
  /** Recarrega os dados (o pai chama carregarContratoDoDeal/carregarContrato). */
  onAlterado: () => void;
  /** O deal acabou de virar "Sinal pago" (abrir a shortlist de escolas, como o board faz). */
  onGanho?: () => void;
  linkContratoCompleto?: boolean;
}) {
  const [acao, setAcao] = useState<Acao>(null);
  const confirm = useConfirm();
  const c = dados.contrato;
  const nome = dados.atletaNome ?? "";
  const r = dados.resumo;
  const hoje = dados.hoje;
  const fechar = () => setAcao(null);
  const concluir = (movido?: boolean) => {
    setAcao(null);
    onAlterado();
    if (movido) onGanho?.();
  };

  const descartar = async () => {
    if (!c) return;
    const ok = await confirm({
      title: "Descartar este contrato?",
      description: "Só é possível porque nenhum pagamento entrou. Ele some do Financeiro (nada é apagado de verdade) e você pode criar outro.",
      confirmLabel: "Descartar",
      tone: "danger",
    });
    if (!ok) return;
    const res = await excluirContratoSemPagamento(c.id, "Descartado pela aba Contrato");
    if (res.success) {
      toast.success("Contrato descartado");
      onAlterado();
    } else toast.error(res.error ?? "Não foi possível descartar.");
  };

  // ── Sem contrato ──
  if (!c) {
    return (
      <>
        <EmptyState
          icon={HandCoins}
          title="Nenhum contrato financeiro"
          description="A família pagou o sinal? Registre agora — o plano pode ser escolhido depois."
        />
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={() => setAcao({ tipo: "sinal" })}><HandCoins />Registrar sinal</Button>
          <Button variant="secondary" onClick={() => setAcao({ tipo: "plano" })}><ClipboardCheck />Escolher plano / criar contrato</Button>
        </div>
        {renderModais()}
      </>
    );
  }

  const recebidas = dados.parcelas.filter((p) => p.status === "recebido");
  const temRecebida = recebidas.length > 0;
  const aguardando = dados.estado === "aguardando_plano";

  return (
    <div className="space-y-4">
      {/* Cabeçalho do contrato */}
      <section aria-labelledby="ctr-titulo" className="rounded-xl border border-border/70 bg-card/60 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id="ctr-titulo" className="text-sm font-semibold text-foreground">
            {c.plano ? `${PLANO_LABEL[c.plano]} · ${formatarMoeda(c.valor_total)}` : "Plano a definir"}
          </h3>
          <Badge tone={ESTADO_BADGE[dados.estado].tone} size="sm">{ESTADO_BADGE[dados.estado].label}</Badge>
          {c.valor_customizado !== null && <Badge tone="orange" size="sm" title={c.justificativa_customizacao ?? undefined}>Fora da tabela</Badge>}
          <div className="ml-auto flex flex-wrap gap-1.5">
            {linkContratoCompleto && (
              <Button asChild variant="secondary" size="sm"><Link href={`/contratos/${c.id}`}>Ver contrato completo</Link></Button>
            )}
          </div>
        </div>

        {aguardando ? (
          <p className="mt-2 text-sm text-foreground">
            Sinal <strong>{formatarMoeda(r?.sinalRecebido ?? 0)}</strong> pago · <span className="text-muted-foreground">total a definir</span>
          </p>
        ) : (
          r && (
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Kpi rotulo="Recebido" valor={formatarMoeda(r.recebido)} sub={`${r.pctRecebido ?? 0}% · ${r.pagas}/${r.totalParcelas}`} tom="green" />
              <Kpi rotulo="A receber" valor={formatarMoeda(r.aReceber)} />
              <Kpi rotulo="Em atraso" valor={formatarMoeda(r.emAtraso)} tom={r.qtdAtrasadas > 0 ? "red" : undefined} />
              <Kpi rotulo="Entrada" valor={formatarMoeda(c.entrada_valor)} sub={c.entrada_paga ? `paga · ${fmt(c.entrada_paga_at)}` : "pendente"} />
            </dl>
          )
        )}
        {dados.estado === "condicoes_pendentes" && r && r.semCronograma > 0 && (
          <p className="mt-2 rounded-lg border border-sys-orange/25 bg-sys-orange/8 px-3 py-2 text-xs text-sys-orange">
            {formatarMoeda(r.semCronograma)} sem parcelas definidas — use “Editar contrato” para definir forma e vencimentos.
          </p>
        )}

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {dados.estado === "cancelado" ? (
            <p className="text-xs text-muted-foreground">Contrato cancelado — reembolso e parcelas são tratados em Financeiro → Cancelamentos.</p>
          ) : aguardando ? (
            <>
              <Button size="sm" onClick={() => setAcao({ tipo: "plano" })}><ClipboardCheck />Escolher plano</Button>
              <Button size="sm" variant="secondary" onClick={() => setAcao({ tipo: "sinal" })}><HandCoins />Registrar outro pagamento de sinal</Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="secondary" onClick={() => setAcao({ tipo: "plano" })}><PencilLine />Editar contrato</Button>
              {dados.estado !== "quitado" && (
                <Button size="sm" variant="secondary" onClick={() => setAcao({ tipo: "quitar" })}><Wallet />Quitar contrato</Button>
              )}
              {!temRecebida && !c.entrada_paga && (
                <Button size="sm" variant="ghost" className="text-sys-red" onClick={descartar}>Descartar contrato</Button>
              )}
            </>
          )}
        </div>
      </section>

      {/* Composição (T18a) */}
      {dados.itens.length > 0 && (
        <section aria-labelledby="ctr-itens" className="rounded-xl border border-border/70 bg-card/60 p-3 sm:p-4">
          <h3 id="ctr-itens" className="mb-2 text-sm font-semibold text-foreground">Serviços, descontos e ajustes</h3>
          <ul className="divide-y divide-border/60 text-xs">
            {dados.itens.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-1.5">
                <span className="min-w-0 truncate text-foreground">{i.descricao}</span>
                <span className={cn("shrink-0 tabular-nums font-medium", i.valor < 0 ? "text-bau-burgundy" : "text-sys-green")}>
                  {i.valor < 0 ? "−" : "+"} {formatarMoeda(Math.abs(i.valor))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Parcelas com ações */}
      <section aria-labelledby="ctr-parcelas" className="rounded-xl border border-border/70 bg-card/60 p-3 sm:p-4">
        <h3 id="ctr-parcelas" className="mb-2 text-sm font-semibold text-foreground">{aguardando ? "Pagamentos de sinal" : "Parcelas"}</h3>
        {dados.parcelas.length === 0 ? (
          <p className="text-xs text-label-tertiary">Nenhuma parcela.</p>
        ) : (
          <ul className="space-y-2">
            {dados.parcelas.map((p) => {
              const aberta = p.status === "previsto" || p.status === "atrasado";
              const atrasada = aberta && p.vencimento < hoje;
              return (
                <li key={p.id} className={cn(
                  "flex flex-col gap-2 rounded-lg border px-3 py-2.5 sm:flex-row sm:items-center",
                  atrasada ? "border-sys-red/25 bg-sys-red/5" : p.status === "recebido" ? "border-sys-green/20 bg-sys-green/5" : "border-border bg-popover",
                )}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-foreground">{p.numero_parcela}</span>
                      <Badge size="sm" tone={p.status === "recebido" ? "green" : atrasada ? "red" : "neutral"}>
                        {p.status === "recebido" ? `Recebida ${fmt(p.recebido_at)}` : atrasada ? "Atrasada" : p.status === "cancelado" ? "Cancelada" : "Prevista"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                      {formatarMoeda(p.valor)} · venc. {fmt(p.vencimento)} · {METODO_LABEL[p.metodo] ?? p.metodo}
                      {p.parcelas_cartao ? ` ${p.parcelas_cartao}×` : ""}{p.observacao ? ` · ${p.observacao}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {aberta && (
                      <>
                        <Button size="sm" onClick={() => setAcao({ tipo: "baixa", parcela: p })}><CheckCircle2 />Dar baixa</Button>
                        <Button size="sm" variant="ghost" aria-label={`Editar ${p.numero_parcela}`} onClick={() => setAcao({ tipo: "editar_parcela", parcela: p })}>
                          <MoreHorizontal />
                        </Button>
                      </>
                    )}
                    {p.status === "recebido" && (
                      <Button size="sm" variant="ghost" onClick={() => setAcao({ tipo: "estorno", parcela: p })}>
                        <Undo2 />{aguardando ? "Remover" : "Estornar"}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {c.entrada_forma && (
          <p className="mt-2 text-[11px] text-label-tertiary">
            Entrada: {FORMA_LABEL[c.entrada_forma]}{c.saldo_forma ? ` · Saldo: ${FORMA_LABEL[c.saldo_forma]}` : ""}
            {c.sinal_abatido ? "" : " · sinal cobrado à parte"}
          </p>
        )}
      </section>

      {/* Custos internos do aluno + margem (T18b) */}
      <CustosAlunoPanel dados={dados} onAlterado={onAlterado} />

      {/* Histórico legível (contrato_eventos) */}
      <HistoricoContrato eventos={dados.eventos} />

      {renderModais()}
    </div>
  );

  function renderModais() {
    if (!acao) return null;
    switch (acao.tipo) {
      case "sinal":
        return (
          <RegistrarSinalModal dealId={dados.dealId} atletaId={dados.atletaId} athleteName={nome} sugestao={dados.entradaPadrao}
            sinalJaRecebido={r?.sinalRecebido ?? 0} onFechar={fechar} onRegistrado={(x) => concluir(x.movidoParaSinalPago)} />
        );
      case "plano":
        return (
          <PlanoEscolhidoModal dealId={dados.dealId} athleteName={nome} origem="aba_contrato"
            iniciarEditando={Boolean(c?.plano)} onCancel={fechar} onConfirmed={(x) => concluir(x.movidoParaSinalPago)} />
        );
      case "quitar":
        return c && dados.versao && r ? (
          <QuitarContratoModal contratoId={c.id} versao={dados.versao} aReceber={r.aReceber} semCronograma={r.semCronograma}
            athleteName={nome} onFechar={fechar} onFeito={() => concluir()} />
        ) : null;
      case "baixa":
        return <BaixaParcelaModal parcela={acao.parcela} atletaId={dados.atletaId} athleteName={nome} onFechar={fechar} onBaixada={(x) => concluir(x.movidoParaSinalPago)} />;
      case "estorno":
        return <EstornoParcelaModal parcela={acao.parcela} aguardandoPlano={dados.estado === "aguardando_plano"} athleteName={nome} onFechar={fechar} onFeito={() => concluir()} />;
      case "editar_parcela":
        return dados.versao ? (
          <EditarParcelaModal parcela={acao.parcela} versao={dados.versao} athleteName={nome} onFechar={fechar} onFeito={() => concluir()}
            temOutraAberta={dados.parcelas.some((p) => p.id !== acao.parcela.id && p.tipo === acao.parcela.tipo && (p.status === "previsto" || p.status === "atrasado"))}
            podeAlterarTotal={acao.parcela.tipo === "saldo" && Boolean(c?.plano)} />
        ) : null;
    }
  }
}

function Kpi({ rotulo, valor, sub, tom }: { rotulo: string; valor: string; sub?: string; tom?: "green" | "red" }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{rotulo}</dt>
      <dd className={cn("text-sm font-semibold tabular-nums", tom === "green" ? "text-sys-green" : tom === "red" ? "text-sys-red" : "text-foreground")}>{valor}</dd>
      {sub && <dd className="text-[10px] text-label-tertiary">{sub}</dd>}
    </div>
  );
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");
}
