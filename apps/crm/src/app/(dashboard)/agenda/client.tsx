"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameMonth,
  format,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Video,
  FileText,
  ExternalLink,
  Clock,
  CalendarClock,
  Plus,
  X,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Card, Badge, Button, StatCard, Input } from "@/components/ui";
import { criarCompromisso } from "@/lib/actions/agenda";
import { DEAL_STAGE_CONFIG, type DealStage } from "@/types/deal";
import { cn } from "@/lib/utils";

export interface AgendaEvento {
  dealId: string;
  reuniaoData: string;
  reuniaoLink: string | null;
  etapa: DealStage;
  valorEstimado: number | null;
  atletaId: string | null;
  nome: string;
  esporte: string | null;
  classificacao: string | null;
  temTranscricao: boolean;
}

const CLASSIF: Record<string, { label: string; dot: string; badge: "red" | "orange" | "blue" }> = {
  hot: { label: "Quente", dot: "bg-sys-red", badge: "red" },
  warm: { label: "Morno", dot: "bg-sys-orange", badge: "orange" },
  cold: { label: "Frio", dot: "bg-sys-blue", badge: "blue" },
};

const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Chave de dia (yyyy-MM-dd) no fuso do navegador (CEO em BRT) — consistente. */
function diaKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function horaLocal(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function fmtValor(v: number | null): string | null {
  if (!v) return null;
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return `R$ ${v}`;
}

export interface DealAgendavel {
  dealId: string;
  etapa: DealStage;
  nome: string;
}

export function AgendaClient({
  eventos,
  hoje,
  nowMs,
  dealsAgendaveis,
}: {
  eventos: AgendaEvento[];
  hoje: string; // yyyy-MM-dd em BRT (do servidor)
  nowMs: number; // instante do servidor
  dealsAgendaveis: DealAgendavel[];
}) {
  const [novoAberto, setNovoAberto] = useState(false);
  const [mesAtual, setMesAtual] = useState<Date>(() => {
    const [y, m] = hoje.split("-").map(Number);
    return new Date(y, m - 1, 1);
  });
  const [diaSel, setDiaSel] = useState<string>(hoje);
  const agora = useMemo(() => new Date(nowMs), [nowMs]);

  // Agrupa eventos por dia; cada dia ordenado por horário.
  const porDia = useMemo(() => {
    const map = new Map<string, AgendaEvento[]>();
    for (const e of eventos) {
      const k = diaKey(new Date(e.reuniaoData));
      const arr = map.get(k);
      if (arr) arr.push(e);
      else map.set(k, [e]);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(a.reuniaoData).getTime() - new Date(b.reuniaoData).getTime());
    }
    return map;
  }, [eventos]);

  const dias = useMemo(() => {
    const ini = startOfWeek(startOfMonth(mesAtual), { weekStartsOn: 0 });
    const fim = endOfWeek(endOfMonth(mesAtual), { weekStartsOn: 0 });
    return eachDayOfInterval({ start: ini, end: fim });
  }, [mesAtual]);

  const kpis = useMemo(() => {
    const noMes = eventos.filter((e) => isSameMonth(new Date(e.reuniaoData), mesAtual)).length;
    const futuras = eventos.filter((e) => new Date(e.reuniaoData) >= agora).length;
    const comTrans = eventos.filter((e) => e.temTranscricao).length;
    return { noMes, futuras, comTrans };
  }, [eventos, mesAtual, agora]);

  const eventosDoDia = porDia.get(diaSel) ?? [];
  const dataSelLabel = useMemo(() => {
    const [y, m, d] = diaSel.split("-").map(Number);
    return format(new Date(y, m - 1, d), "EEEE, d 'de' MMMM", { locale: ptBR });
  }, [diaSel]);

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        eyebrow="Comercial"
        title="Agenda"
        description="Reuniões do pipeline — clique num dia para ver os detalhes e abrir o lead."
        actions={
          <div className="flex items-center gap-1.5">
            <Button size="sm" onClick={() => setNovoAberto(true)}>
              <Plus className="h-3.5 w-3.5" />
              Novo compromisso
            </Button>
            <Button
              variant="secondary"
              size="sm"
              aria-label="Mês anterior"
              onClick={() => setMesAtual((m) => subMonths(m, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-36 text-center text-sm font-semibold capitalize text-foreground">
              {format(mesAtual, "MMMM yyyy", { locale: ptBR })}
            </span>
            <Button
              variant="secondary"
              size="sm"
              aria-label="Próximo mês"
              onClick={() => setMesAtual((m) => addMonths(m, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const hoje = new Date();
                setMesAtual(hoje);
                setDiaSel(diaKey(hoje));
              }}
            >
              Hoje
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Reuniões no mês" value={kpis.noMes} icon={CalendarDays} accent="brand" />
        <StatCard label="Próximas" value={kpis.futuras} icon={CalendarClock} accent="blue" />
        <StatCard label="Com transcrição" value={kpis.comTrans} icon={FileText} accent="green" />
        <StatCard label="Total (janela)" value={eventos.length} icon={Clock} accent="purple" />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_22rem]">
        {/* Calendário */}
        <Card variant="plain" padding="none" className="flex flex-col overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border">
            {SEMANA.map((s) => (
              <div
                key={s}
                className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-label-tertiary"
              >
                {s}
              </div>
            ))}
          </div>
          <div className="grid flex-1 grid-cols-7 auto-rows-fr">
            {dias.map((dia) => {
              const k = diaKey(dia);
              const doDia = porDia.get(k) ?? [];
              const foraDoMes = !isSameMonth(dia, mesAtual);
              const ehHoje = k === hoje;
              const selecionado = k === diaSel;
              return (
                <button
                  key={k}
                  onClick={() => setDiaSel(k)}
                  className={cn(
                    "flex min-h-20 flex-col gap-1 border-b border-r border-border p-1.5 text-left transition-colors hover:bg-accent",
                    foraDoMes && "bg-secondary/30",
                    selecionado && "bg-primary/5 ring-1 ring-inset ring-primary/40",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
                      ehHoje ? "bg-primary text-primary-foreground" : "text-foreground",
                      foraDoMes && !ehHoje && "text-label-tertiary",
                    )}
                  >
                    {dia.getDate()}
                  </span>
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    {doDia.slice(0, 3).map((e) => {
                      const c = e.classificacao ? CLASSIF[e.classificacao] : null;
                      return (
                        <span
                          key={e.dealId}
                          className="flex items-center gap-1 truncate rounded bg-card px-1 py-0.5 text-[10px] text-foreground shadow-xs"
                          title={`${horaLocal(e.reuniaoData)} · ${e.nome}`}
                        >
                          <span
                            className={cn("h-1.5 w-1.5 shrink-0 rounded-full", c?.dot ?? "bg-muted-foreground")}
                          />
                          <span className="tabular-nums text-muted-foreground">
                            {horaLocal(e.reuniaoData)}
                          </span>
                          <span className="truncate">{e.nome}</span>
                        </span>
                      );
                    })}
                    {doDia.length > 3 && (
                      <span className="px-1 text-[10px] text-muted-foreground">
                        +{doDia.length - 3} mais
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Painel do dia */}
        <Card variant="plain" padding="none" className="flex flex-col overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <p className="text-eyebrow text-label-tertiary">Dia selecionado</p>
            <p className="mt-0.5 text-sm font-semibold capitalize text-foreground">{dataSelLabel}</p>
            <p className="text-[11px] text-muted-foreground">
              {eventosDoDia.length === 0
                ? "Sem reuniões"
                : `${eventosDoDia.length} reunião(ões)`}
            </p>
          </div>

          <div className="crm-scroll flex-1 space-y-2 overflow-y-auto p-3">
            {eventosDoDia.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
                <CalendarDays className="h-8 w-8 text-label-tertiary" />
                <p className="text-xs text-muted-foreground">Nenhuma reunião neste dia.</p>
              </div>
            ) : (
              eventosDoDia.map((e) => {
                const c = e.classificacao ? CLASSIF[e.classificacao] : null;
                const stage = DEAL_STAGE_CONFIG[e.etapa];
                const valor = fmtValor(e.valorEstimado);
                return (
                  <div key={e.dealId} className="rounded-xl border border-border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold tabular-nums text-foreground">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        {horaLocal(e.reuniaoData)}
                      </div>
                      {e.temTranscricao && (
                        <span
                          className="flex items-center gap-1 rounded-full bg-sys-green/12 px-1.5 py-0.5 text-[9px] font-semibold text-sys-green"
                          title="Transcrição capturada"
                        >
                          <FileText className="h-2.5 w-2.5" />
                          Transcrição
                        </span>
                      )}
                    </div>

                    <p className="mt-1.5 text-sm font-medium text-foreground">{e.nome}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {c && (
                        <Badge tone={c.badge} size="sm">
                          {c.label}
                        </Badge>
                      )}
                      {stage && (
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <span className={cn("h-1.5 w-1.5 rounded-full", stage.dotColor)} />
                          {stage.shortLabel}
                        </span>
                      )}
                      {e.esporte && <span className="text-[11px] text-muted-foreground">{e.esporte}</span>}
                      {valor && (
                        <span className="text-[11px] font-medium tabular-nums text-foreground/80">{valor}</span>
                      )}
                    </div>

                    <div className="mt-2.5 flex items-center gap-2">
                      {e.atletaId && (
                        <Link
                          href={`/leads?atleta=${e.atletaId}`}
                          className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/15"
                        >
                          Ver lead
                          <ExternalLink className="h-3 w-3 opacity-70" />
                        </Link>
                      )}
                      {e.reuniaoLink && (
                        <a
                          href={e.reuniaoLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
                        >
                          <Video className="h-3 w-3" />
                          Meet
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {novoAberto && (
        <NovoCompromissoModal
          deals={dealsAgendaveis}
          hoje={hoje}
          onClose={() => setNovoAberto(false)}
        />
      )}
    </div>
  );
}

const DURACOES = [30, 45, 60, 90] as const;

/** Modal "Novo compromisso": cria o evento no Google Calendar do CEO (com o
 *  nome do atleta no título) e vincula ao deal. 1ª reunião → o webhook
 *  notifica o lead sozinho; remarcação → checkbox de aviso por WhatsApp. */
function NovoCompromissoModal({
  deals,
  hoje,
  onClose,
}: {
  deals: DealAgendavel[];
  hoje: string;
  onClose: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [dealSel, setDealSel] = useState<DealAgendavel | null>(null);
  const [dataStr, setDataStr] = useState(hoje);
  const [horaStr, setHoraStr] = useState("10:00");
  const [duracao, setDuracao] = useState<number>(60);
  const [observacao, setObservacao] = useState("");
  const [notificar, setNotificar] = useState(true);
  const [isPending, startTransition] = useTransition();

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return deals.slice(0, 8);
    return deals.filter((d) => d.nome.toLowerCase().includes(q)).slice(0, 8);
  }, [deals, busca]);

  const criar = () => {
    if (!dealSel) return toastErro("Selecione o lead.");
    if (!dataStr || !horaStr) return toastErro("Informe data e hora.");
    // Offset FIXO -03:00 (BRT, sem DST desde 2019): o label diz "Hora (BRT)"
    // e precisa valer mesmo com o CEO viajando (navegador em outro fuso).
    const start = new Date(`${dataStr}T${horaStr}:00-03:00`);
    if (Number.isNaN(start.getTime())) return toastErro("Data/hora inválida.");
    if (start.getTime() <= Date.now()) return toastErro("O compromisso precisa ser no futuro.");

    startTransition(async () => {
      const r = await criarCompromisso({
        dealId: dealSel.dealId,
        startIso: start.toISOString(),
        duracaoMin: duracao,
        observacao: observacao.trim() || undefined,
        notificarLead: notificar,
      });
      if (r.success) {
        const aviso =
          r.notificacao === "webhook"
            ? "O lead receberá a confirmação automática por WhatsApp."
            : r.notificacao === "enviado"
              ? "Lead avisado por WhatsApp."
              : "Lead não notificado.";
        toast.success(`Compromisso criado${r.meetCriado ? " com Meet" : ""}.`, {
          description: aviso,
        });
        onClose();
      } else {
        toast.error(r.error);
      }
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="liquid-glass flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-base font-semibold text-foreground">Novo compromisso</h2>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-fill-4 hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4 overflow-y-auto px-6 py-5">
            {/* Lead/deal */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Lead *</label>
              {dealSel ? (
                <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{dealSel.nome}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {DEAL_STAGE_CONFIG[dealSel.etapa]?.shortLabel ?? dealSel.etapa}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setDealSel(null)}>
                    Trocar
                  </Button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar pelo nome do atleta..."
                      className="pl-9"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto rounded-md border border-border">
                    {filtrados.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum lead encontrado.</p>
                    ) : (
                      filtrados.map((d) => (
                        <button
                          key={d.dealId}
                          type="button"
                          onClick={() => setDealSel(d)}
                          className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-accent"
                        >
                          <span className="text-xs font-medium text-foreground">{d.nome}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {DEAL_STAGE_CONFIG[d.etapa]?.shortLabel ?? d.etapa}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Data/hora/duração */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Data *</label>
                <Input type="date" value={dataStr} min={hoje} onChange={(e) => setDataStr(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Hora (BRT) *</label>
                <Input type="time" value={horaStr} onChange={(e) => setHoraStr(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Duração</label>
              <div className="flex gap-1.5">
                {DURACOES.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuracao(d)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                      duracao === d
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {d} min
                  </button>
                ))}
              </div>
            </div>

            {/* Observação */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Observação (vai na descrição do evento)</label>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={2}
                className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-placeholder outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                placeholder="Contexto da reunião..."
              />
            </div>

            {/* Notificação */}
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={notificar}
                onChange={(e) => setNotificar(e.target.checked)}
                className="mt-0.5 accent-[var(--primary)]"
              />
              <span className="text-xs leading-relaxed text-muted-foreground">
                Avisar o lead por WhatsApp. <span className="text-label-tertiary">1ª reunião é
                confirmada automaticamente pelo sistema; em remarcação, o aviso usa esta opção.</span>
              </span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={criar} disabled={isPending || !dealSel}>
              {isPending ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <CalendarDays className="h-4 w-4" />
              )}
              Criar no Calendar
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function toastErro(msg: string) {
  toast.error(msg);
}
