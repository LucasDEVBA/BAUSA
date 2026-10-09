"use client";

import { useEffect, useRef, useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
  type SortingState,
  type Updater,
  flexRender,
} from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MessageCircle, Check, Calendar, Send, Clock, AlertTriangle, Users, EyeOff, Trash2, Loader2 } from "lucide-react";
import { type Lead, type LeadClassification } from "@/types/lead";
import { excluirLead } from "@/lib/actions/leads-excluir";
import {
  BUSCA_LEADS_MAX,
  BUSCA_LEADS_MIN,
  ORDENS_LEADS,
  POR_PAGINA_LEADS,
  urlFiltrosLeads,
  type ClasseFiltroLeads,
  type FiltrosLeads,
  type OrdemLeads,
} from "@/lib/leads-filtros";
import { type LeadLinha } from "@/lib/leads-mapper";
import { normalizarTermoBusca } from "@/lib/revisao-leads";
import { DossieLeadView, useDossieLead } from "./DossieLead";
// Type-only (statement inteiro é elidido no build): a lib é server-side.
import type { PrioridadeLead } from "@/lib/prioridade-engajamento";
import { getStageDisplay, type DealStageConfigMap } from "@/lib/etapas-deal";
import { Badge } from "@/components/ui";
import { ReuniaoDetectadaBadge } from "@/components/pipeline/ReuniaoDetectadaBadge";
import { LeadStatusBadge } from "./LeadStatusBadge";
import { formatRelativeTime, formatInvestmentRange } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface LeadsTableProps {
  /** UMA página do servidor (T8) — busca/filtro/ordem/paginação vivem na URL. */
  linhas: LeadLinha[];
  /** Total real do filtro atual (count exact). */
  total: number;
  filtros: FiltrosLeads;
  /** Prioridade P1/P2 por engajamento, keyed por form_submission_id — só
   *  leads aprovados QUENTE/MORNO têm entrada; sem entrada = sem badge. */
  prioridades?: Record<string, PrioridadeLead>;
  /** Aviso do servidor (ex.: ordenação por prioridade só cobre aprovados). */
  aviso?: string | null;
  /** Deep-link ?atleta=<id> ou ?lead=<form_submission_id> (T14): dossiê já
   *  carregado pelo servidor, abre 1 vez. */
  leadInicial?: Lead | null;
  /** Config MESCLADA das colunas — a MESMA do board: nome da coluna na
   *  tabela e no editor do deal aberto pelo dossiê (T17/T2/T20). */
  stageConfig: DealStageConfigMap;
}

const BUSCA_DEBOUNCE_MS = 300;

const CLASSIFICATION_FILTERS: Array<{ label: string; value: ClasseFiltroLeads }> = [
  { label: "Todos", value: "ALL" },
  { label: "Quente", value: "QUENTE" },
  { label: "Morno", value: "MORNO" },
  { label: "Frio", value: "FRIO" },
  // Estados v2 (dado sujo / campos ausentes) — fora do funil, mas filtráveis
  { label: "Inválido", value: "INVALIDO" },
  { label: "Incompleto", value: "INCOMPLETO" },
];

function SortIcon({ isSorted }: { isSorted: false | "asc" | "desc" }) {
  if (isSorted === "asc") return <ArrowUp className="h-3 w-3" />;
  if (isSorted === "desc") return <ArrowDown className="h-3 w-3" />;
  return <ArrowUpDown className="h-3 w-3 opacity-40" />;
}

export function LeadsTable({ linhas, total, filtros, prioridades, aviso = null, leadInicial = null, stageConfig }: LeadsTableProps) {
  const router = useRouter();
  const [navegando, startNavegar] = useTransition();
  // Confirmação de exclusão fora das colunas memoizadas (closure stale) —
  // dentro da coluna só vive o setter, que é estável.
  const [leadParaExcluir, setLeadParaExcluir] = useState<LeadLinha | null>(null);
  const [excluindo, startExcluir] = useTransition();
  const cancelarExclusaoRef = useRef<HTMLButtonElement>(null);
  const confirmarExclusaoRef = useRef<HTMLButtonElement>(null);
  // Esc e Tab no WINDOW: com o foco fora do diálogo (clique no texto, botão
  // desabilitado durante a exclusão) o onKeyDown do próprio diálogo não
  // dispara — o Esc morria e o Tab andava pela tabela atrás do overlay.
  useEffect(() => {
    if (!leadParaExcluir) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!excluindo) setLeadParaExcluir(null);
        return;
      }
      if (e.key !== "Tab") return;
      e.preventDefault();
      const botoes = [cancelarExclusaoRef.current, confirmarExclusaoRef.current].filter(
        (b): b is HTMLButtonElement => b !== null && !b.disabled,
      );
      if (botoes.length === 0) return;
      const atual = botoes.findIndex((b) => b === document.activeElement);
      const proximo = e.shiftKey ? (atual <= 0 ? botoes.length - 1 : atual - 1) : (atual + 1) % botoes.length;
      botoes[proximo].focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [leadParaExcluir, excluindo]);
  // Exclusão que falha mantém o diálogo aberto: o botão clicado ficou
  // desabilitado e o foco caiu no body — devolve ao Cancelar.
  useEffect(() => {
    if (leadParaExcluir && !excluindo) cancelarExclusaoRef.current?.focus();
  }, [leadParaExcluir, excluindo]);
  // Dossiê sob demanda (a lista só tem o resumo). ?atleta=/?lead= já chegam abertos.
  const dossie = useDossieLead(leadInicial);

  // Filtros que a tela DEVE ter: os da URL ou, com navegação em curso, os do
  // último pedido. O servidor leva 0,5–1,5 s; um clique em "Quente" seguido
  // do timer da busca partia do `filtros` velho e desfazia o "Quente".
  const alvoRef = useRef(filtros);
  useEffect(() => {
    if (!navegando) alvoRef.current = filtros;
  }, [filtros, navegando]);
  const navegar = (patch: Partial<FiltrosLeads>) => {
    const proximo: FiltrosLeads = { ...alvoRef.current, ...patch, atleta: null, lead: null };
    alvoRef.current = proximo;
    startNavegar(() => router.replace(urlFiltrosLeads(proximo), { scroll: false }));
  };
  // Fechar solta o ?lead=/?atleta= da URL: com ele preso, clicar de novo no
  // mesmo link (sininho, Execuções) não muda o id e o dossiê não reabre.
  const fecharDossie = () => {
    dossie.fechar();
    if (filtros.lead || filtros.atleta) {
      router.replace(urlFiltrosLeads(alvoRef.current), { scroll: false });
    }
  };

  // Busca: digita → 300 ms → URL (?q=) → servidor. Menos de 2 caracteres
  // úteis não filtra (mas apagar tudo limpa).
  const [busca, setBusca] = useState(filtros.q);
  const [qAnterior, setQAnterior] = useState(filtros.q);
  // Termos que ESTE campo mandou e cuja navegação ainda não voltou. A
  // navegação é assíncrona: quando ?q=joao chega, o CEO pode já ter digitado
  // "joao s" — a resposta do próprio campo não pode apagar o que veio depois.
  const [qPendentes, setQPendentes] = useState<readonly string[]>([]);
  if (filtros.q !== qAnterior) {
    setQAnterior(filtros.q);
    const minha = qPendentes.indexOf(filtros.q);
    // Resposta da própria busca: consome (e as mais antigas, já superadas).
    if (minha >= 0) setQPendentes(qPendentes.slice(minha + 1));
    // URL mudou POR FORA (voltar do navegador, link, menu): o campo acompanha.
    else setBusca(filtros.q);
  }
  useEffect(() => {
    const termo = busca.trim();
    if (termo === filtros.q) return;
    const util = normalizarTermoBusca(termo).replace(/[^a-z0-9]/g, "").length;
    if (termo !== "" && util < BUSCA_LEADS_MIN) return;
    const t = setTimeout(() => {
      setQPendentes((atuais) => [...atuais.slice(-9), termo]);
      navegar({ q: termo, pagina: 1 });
    }, BUSCA_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- navegar parte do alvoRef (filtros atuais/pedidos); re-disparar só quando o texto muda
  }, [busca, filtros.q]);

  const sorting: SortingState = [{ id: filtros.ordem, desc: filtros.dir === "desc" }];
  const onSortingChange = (updater: Updater<SortingState>) => {
    const proximo = typeof updater === "function" ? updater(sorting) : updater;
    const primeiro = proximo[0];
    const ordem = (ORDENS_LEADS as readonly string[]).includes(primeiro?.id ?? "")
      ? (primeiro?.id as OrdemLeads)
      : "submitted_at";
    navegar({ ordem, dir: primeiro ? (primeiro.desc ? "desc" : "asc") : "desc", pagina: 1 });
  };
  const [dismissedDuplicates, setDismissedDuplicates] = useState<Set<string>>(new Set());
  const [linkedSiblings, setLinkedSiblings] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("crm_linked_siblings");
        return stored ? new Set(JSON.parse(stored)) : new Set();
      } catch { return new Set(); }
    }
    return new Set();
  });
  const [openDuplicatePopover, setOpenDuplicatePopover] = useState<string | null>(null);

  const columns = useMemo<ColumnDef<LeadLinha>[]>(
    () => [
      {
        accessorKey: "athlete_name",
        header: "Atleta",
        cell: ({ row }) => {
          const lead = row.original;
          return (
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-secondary to-secondary/80 text-[10px] font-bold text-muted-foreground">
                {lead.athlete_name
                  .split(" ")
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p
                    className="truncate text-sm font-medium text-foreground"
                    title={lead.athlete_name}
                  >
                    {lead.athlete_name}
                  </p>
                  {lead.possible_duplicate && !dismissedDuplicates.has(lead.id) && !linkedSiblings.has(lead.id) && (
                    <span className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDuplicatePopover(openDuplicatePopover === lead.id ? null : lead.id);
                        }}
                        className="inline-flex items-center gap-0.5 rounded-full bg-sys-orange/10 border border-sys-orange/20 px-1.5 py-0.5 text-[9px] font-semibold text-sys-orange hover:bg-sys-orange/20 transition-colors"
                      >
                        <AlertTriangle className="h-2.5 w-2.5" />
                        Duplicata?
                      </button>
                      {openDuplicatePopover === lead.id && (
                        <div
                          className="absolute left-0 top-full z-30 mt-1 w-52 rounded-xl border border-border bg-popover shadow-lg"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              setDismissedDuplicates((prev) => new Set([...prev, lead.id]));
                              setOpenDuplicatePopover(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-accent transition-colors rounded-t-xl"
                          >
                            <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                            Ignorar
                          </button>
                          <button
                            onClick={() => {
                              const updated = new Set([...linkedSiblings, lead.id]);
                              setLinkedSiblings(updated);
                              try { localStorage.setItem("crm_linked_siblings", JSON.stringify([...updated])); } catch { /* noop */ }
                              setOpenDuplicatePopover(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-accent transition-colors border-t border-border"
                          >
                            <Check className="h-3.5 w-3.5 text-sys-green" />
                            E o mesmo lead
                          </button>
                          <button
                            onClick={() => {
                              toast.success("Vinculado como irmao");
                              setOpenDuplicatePopover(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-accent transition-colors border-t border-border rounded-b-xl"
                          >
                            <Users className="h-3.5 w-3.5 text-primary" />
                            Novo atleta, mesma familia
                          </button>
                        </div>
                      )}
                    </span>
                  )}
                </div>
                <p
                  className="truncate text-xs text-muted-foreground"
                  title={lead.email}
                >
                  {lead.email}
                </p>
              </div>
            </div>
          );
        },
        size: 220,
      },
      {
        accessorKey: "qualification_classification",
        header: "Classificação",
        cell: ({ getValue }) => (
          <LeadStatusBadge
            classification={getValue() as LeadClassification | null}
          />
        ),
        size: 110,
      },
      {
        id: "prioridade",
        header: "Prioridade",
        // 1º clique = P1 no topo (a ordem é calculada no servidor)
        sortDescFirst: true,
        accessorFn: (row) => prioridades?.[row.id]?.nivel ?? "",
        cell: ({ row }) => {
          const p = prioridades?.[row.original.id];
          // Sem entrada (não aprovado / FRIO / falha de leitura) = sem badge.
          if (!p) return <span className="text-xs text-label-tertiary">—</span>;
          const title =
            p.motivos.length > 0
              ? `${p.motivos.join(" · ")} · ${p.pontos} pts`
              : `Sem sinais de engajamento ainda · ${p.pontos} pts`;
          return (
            <Badge size="sm" tone={p.nivel === "P1" ? "red" : "orange"} title={title}>
              {p.nivel}
            </Badge>
          );
        },
        size: 90,
      },
      {
        accessorKey: "investment_range",
        header: "Investimento",
        cell: ({ getValue }) => {
          const raw = getValue() as string | null;
          const formatted = raw ? formatInvestmentRange(raw) : "—";
          return (
            <span
              className="block truncate text-sm text-foreground"
              title={formatted}
            >
              {formatted}
            </span>
          );
        },
        size: 170,
      },
      {
        accessorKey: "position",
        header: "Posição",
        cell: ({ getValue }) => {
          const v = (getValue() as string | null) ?? "—";
          return (
            <span
              className="block truncate text-sm text-muted-foreground"
              title={v}
            >
              {v}
            </span>
          );
        },
        size: 130,
      },
      {
        id: "location",
        header: "Local",
        accessorFn: (row) => row.address_state ?? row.school_city_state,
        cell: ({ getValue }) => {
          const v = (getValue() as string | null) ?? "—";
          return (
            <span
              className="block truncate text-sm text-muted-foreground"
              title={v}
            >
              {v}
            </span>
          );
        },
        size: 90,
      },
      {
        id: "comunicacao",
        header: "Comunicação",
        accessorFn: (row) => {
          if (row.meeting_scheduled) return "reuniao";
          if (row.followup_2_sent_at) return "followup_2";
          if (row.followup_1_sent_at) return "followup_1";
          if (row.whatsapp_sent_at) return "whatsapp";
          return "pendente";
        },
        cell: ({ row }) => {
          const lead = row.original;
          if (lead.meeting_scheduled) {
            return (
              <div className="flex items-center gap-1.5 text-xs text-sys-green font-medium">
                <Calendar className="h-3.5 w-3.5" />
                Reunião
              </div>
            );
          }
          if (lead.followup_2_sent_at) {
            return (
              <div className="flex items-center gap-1.5 text-xs text-sys-orange font-medium">
                <MessageCircle className="h-3.5 w-3.5" />
                Follow-up 2
              </div>
            );
          }
          if (lead.followup_1_sent_at) {
            return (
              <div className="flex items-center gap-1.5 text-xs text-sys-orange font-medium">
                <MessageCircle className="h-3.5 w-3.5" />
                Follow-up 1
              </div>
            );
          }
          if (lead.whatsapp_sent_at) {
            return (
              <div className="flex items-center gap-1.5 text-xs text-sys-blue font-medium">
                <Send className="h-3.5 w-3.5" />
                Enviado
              </div>
            );
          }
          return (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Pendente
            </div>
          );
        },
        size: 120,
      },
      {
        id: "pipeline",
        header: "Pipeline",
        accessorFn: (row) => row.pipeline_stage ?? "",
        cell: ({ row }) => {
          const lead = row.original;
          // T14: reunião detectada e nenhum deal = a reunião existe e o funil não sabe.
          // pipeline_deal_id vem da view (só deal ATIVO) → aqui o "sem deal" é garantido.
          if (lead.meeting_scheduled === true && !lead.pipeline_deal_id) {
            return <ReuniaoDetectadaBadge detectadaEm={lead.meeting_scheduled_at} semDeal />;
          }
          if (!lead.is_in_pipeline) {
            return <span className="text-xs text-label-tertiary">—</span>;
          }
          // Nome/cor da coluna do CEO (T17) — nunca o rótulo estático.
          const config = lead.pipeline_stage ? getStageDisplay(stageConfig, lead.pipeline_stage) : null;
          const label = config?.shortLabel ?? "No Pipeline";
          return (
            <span className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
              config
                ? "bg-primary/10 text-primary border border-primary/20"
                : "bg-secondary text-muted-foreground border border-border",
            )}>
              {config && (
                <span className={cn("h-1.5 w-1.5 rounded-full", config.dotColor)} />
              )}
              {label}
            </span>
          );
        },
        size: 140,
      },
      {
        id: "origem",
        header: "Origem",
        accessorFn: (row) => row.utm_source ?? row.cta_source ?? "",
        cell: ({ row }) => {
          const lead = row.original;
          const source = lead.utm_source || lead.cta_source;
          if (!source) return <span className="text-xs text-label-tertiary">—</span>;

          const device = lead.device_type;
          return (
            <div className="flex flex-col gap-0.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-plan-legacy/10 px-2 py-0.5 text-xs font-medium text-plan-legacy border border-plan-legacy/20 w-fit">
                {source}
              </span>
              {device && (
                <span className="text-[10px] text-muted-foreground">{device}</span>
              )}
            </div>
          );
        },
        size: 120,
      },
      {
        accessorKey: "submitted_at",
        header: "Recebido",
        // Data: 1º clique vindo de outra coluna = mais recentes primeiro
        sortDescFirst: true,
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(getValue() as string)}
          </span>
        ),
        size: 100,
      },
      {
        id: "acoes",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLeadParaExcluir(row.original);
            }}
            aria-label={`Excluir lead ${row.original.athlete_name}`}
            title="Excluir lead"
            className="flex h-7 w-7 items-center justify-center rounded-md text-label-tertiary transition-colors hover:bg-sys-red/10 hover:text-sys-red"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ),
        size: 44,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- estados de popover/duplicata já eram lidos via closure (comportamento herdado); prioridades e stageConfig entram como deps reais.
    [prioridades, stageConfig]
  );

  const totalPaginas = Math.max(1, Math.ceil(total / filtros.porPagina));
  // Paginação, ordenação e filtro são do SERVIDOR (T8): a tabela só desenha
  // a página recebida — nada de getPaginationRowModel no navegador.
  const table = useReactTable({
    data: linhas,
    columns,
    state: {
      sorting,
      pagination: { pageIndex: filtros.pagina - 1, pageSize: filtros.porPagina },
    },
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    // Ordem vive na URL e sempre existe (padrão Recebido ↓): "remover" a
    // ordenação devolvia o mesmo padrão e o clique em "Recebido" não fazia nada.
    enableSortingRemoval: false,
    pageCount: totalPaginas,
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
  });
  const inicio = total === 0 ? 0 : (filtros.pagina - 1) * filtros.porPagina + 1;
  const fim = Math.min(total, filtros.pagina * filtros.porPagina);

  return (
    <>
      {/* Filtros (mobile: quebram linha; o segmentado rola por dentro) */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-auto sm:max-w-xs sm:flex-1">
          <Search aria-hidden className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={busca}
            maxLength={BUSCA_LEADS_MAX}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, responsável, e-mail ou telefone…"
            aria-label="Buscar leads por nome, responsável, e-mail ou telefone"
            className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-placeholder outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/30"
          />
        </div>

        {/* Filtro por classificação */}
        <div className="flex max-w-full overflow-x-auto rounded-md border border-border bg-card p-0.5" role="group" aria-label="Filtrar por classificação">
          {CLASSIFICATION_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => navegar({ classe: filter.value, pagina: 1 })}
              aria-pressed={filtros.classe === filter.value}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                filtros.classe === filter.value
                  ? "bg-primary/15 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
          {navegando && <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />}
          {total} {total === 1 ? "lead" : "leads"}
        </div>
      </div>

      {aviso && (
        <p className="mb-3 rounded-lg border border-sys-orange/25 bg-sys-orange/5 px-3 py-2 text-xs text-sys-orange">{aviso}</p>
      )}

      {/* Tabela */}
      <div className={cn("overflow-hidden rounded-xl border border-border bg-card transition-opacity", navegando && "opacity-60")}>
        <div className="overflow-x-auto" aria-busy={navegando}>
          <table className="w-full table-fixed">
            <thead>
              <tr className="border-b border-border">
                {table.getHeaderGroups().map((headerGroup) =>
                  headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      style={{ width: header.getSize() }}
                      className={cn(
                        "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground",
                        header.column.getCanSort() &&
                          "cursor-pointer select-none hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <SortIcon isSorted={header.column.getIsSorted()} />
                        )}
                      </div>
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row, i) => (
                <tr
                  key={row.id}
                  onClick={() => void dossie.abrir(row.original.id)}
                  className={cn(
                    "cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-accent",
                    i % 2 === 0 ? "" : "bg-fill-4"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      style={{
                        width: cell.column.getSize(),
                        maxWidth: cell.column.getSize(),
                      }}
                      className="overflow-hidden px-4 py-3"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {table.getRowModel().rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="py-12 text-center text-sm text-muted-foreground">
                    {filtros.q || filtros.classe !== "ALL" ? "Nenhum lead encontrado com esses filtros" : "Nenhum lead encontrado"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação (servidor): total real, primeira/última página alcançáveis */}
        <nav aria-label="Paginação de leads" className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">
            {total === 0 ? "Nenhum lead" : `Mostrando ${inicio}–${fim} de ${total}`} · Página {filtros.pagina} de {totalPaginas}
          </p>
          <div className="flex items-center gap-1">
            <label className="mr-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              Por página
              <select
                value={filtros.porPagina}
                onChange={(e) => navegar({ porPagina: Number(e.target.value), pagina: 1 })}
                className="h-7 rounded-md border border-border bg-card px-1.5 text-xs text-foreground"
              >
                {POR_PAGINA_LEADS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            {[
              { label: "Primeira página", icon: ChevronsLeft, pagina: 1, off: filtros.pagina <= 1 },
              { label: "Página anterior", icon: ChevronLeft, pagina: filtros.pagina - 1, off: filtros.pagina <= 1 },
              { label: "Próxima página", icon: ChevronRight, pagina: filtros.pagina + 1, off: filtros.pagina >= totalPaginas },
              { label: "Última página", icon: ChevronsRight, pagina: totalPaginas, off: filtros.pagina >= totalPaginas },
            ].map(({ label, icon: Icone, pagina, off }) => (
              <button
                key={label}
                type="button"
                onClick={() => navegar({ pagina })}
                disabled={off || navegando}
                aria-label={label}
                title={label}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icone className="h-4 w-4" />
              </button>
            ))}
          </div>
        </nav>
      </div>

      {/* Dossiê sob demanda (mesmo LeadOrDealSheet do /pipeline) */}
      <DossieLeadView estado={dossie.estado} onClose={fecharDossie} stageConfig={stageConfig} />

      {/* Confirmação de exclusão (soft delete) */}
      {leadParaExcluir && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !excluindo && setLeadParaExcluir(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="excluir-lead-titulo"
            aria-describedby="excluir-lead-descricao"
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sys-red/10">
                <Trash2 className="h-4 w-4 text-sys-red" />
              </div>
              <div className="min-w-0">
                <h2 id="excluir-lead-titulo" className="text-sm font-semibold text-foreground">
                  Excluir {leadParaExcluir.athlete_name}?
                </h2>
                <p id="excluir-lead-descricao" className="mt-1 text-xs text-muted-foreground">
                  O lead sai das listas, do pipeline e de todas as mensagens
                  automáticas. Tarefas abertas são canceladas e grupos de
                  WhatsApp desvinculados (a conversa fica). Nada é apagado de
                  verdade — a exclusão é reversível pelo suporte.
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                ref={cancelarExclusaoRef}
                autoFocus
                onClick={() => setLeadParaExcluir(null)}
                disabled={excluindo}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                ref={confirmarExclusaoRef}
                onClick={() => {
                  const lead = leadParaExcluir;
                  startExcluir(async () => {
                    const r = await excluirLead(lead.id);
                    // Falha = NADA mudou (função atômica): modal aberto, linha fica.
                    if (!r.success) {
                      toast.error(r.error);
                      return;
                    }
                    setLeadParaExcluir(null);
                    toast.success(
                      r.jaExcluido ? `Exclusão de ${lead.athlete_name} concluída.` : `Lead ${lead.athlete_name} excluído.`,
                    );
                    if (r.aviso) toast.warning(r.aviso);
                    router.refresh();
                  });
                }}
                disabled={excluindo}
                className="rounded-lg bg-sys-red px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-sys-red/90 disabled:opacity-60"
              >
                {excluindo ? "Excluindo…" : "Sim, excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
