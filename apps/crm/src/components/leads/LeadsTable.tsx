"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type SortingState,
  flexRender,
} from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown, Search, ChevronLeft, ChevronRight, MessageCircle, Check, Calendar, Send, Clock, AlertTriangle, X, Users, EyeOff } from "lucide-react";
import { type Lead, type LeadClassification } from "@/types/lead";
import { DEAL_STAGE_CONFIG, type DealStage } from "@/types/deal";
import { LeadStatusBadge } from "./LeadStatusBadge";
import { LeadOrDealSheet } from "./LeadOrDealSheet";
import { formatRelativeTime, formatInvestmentRange, formatPhone } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface LeadsTableProps {
  leads: Lead[];
}

const CLASSIFICATION_FILTERS: Array<{ label: string; value: LeadClassification | "ALL" }> = [
  { label: "Todos", value: "ALL" },
  { label: "Quente", value: "QUENTE" },
  { label: "Morno", value: "MORNO" },
  { label: "Frio", value: "FRIO" },
];

function SortIcon({ isSorted }: { isSorted: false | "asc" | "desc" }) {
  if (isSorted === "asc") return <ArrowUp className="h-3 w-3" />;
  if (isSorted === "desc") return <ArrowDown className="h-3 w-3" />;
  return <ArrowUpDown className="h-3 w-3 opacity-40" />;
}

export function LeadsTable({ leads }: LeadsTableProps) {
  const searchParams = useSearchParams();
  const atletaParam = searchParams.get("atleta");
  const qParam = searchParams.get("q") ?? "";

  const [sorting, setSorting] = useState<SortingState>([
    { id: "submitted_at", desc: true },
  ]);
  // ?q= pré-filtra a tabela (ex.: link vindo das Execuções por nome).
  const [globalFilter, setGlobalFilter] = useState(qParam);
  const [classificationFilter, setClassificationFilter] = useState<LeadClassification | "ALL">("ALL");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // ?atleta=<id> abre direto o detalhe do lead correspondente (deep-link das
  // Execuções). Casa pelo atleta do pipeline. Auto-abre UMA vez por valor de
  // param — se o usuário fechar o sheet, um re-render dos `leads` não reabre.
  const atletaAbertoRef = useRef<string | null>(null);
  useEffect(() => {
    if (!atletaParam || atletaAbertoRef.current === atletaParam) return;
    const found = leads.find((l) => l.pipeline_atleta_id === atletaParam);
    if (found) {
      atletaAbertoRef.current = atletaParam;
      setSelectedLead(found);
    }
  }, [atletaParam, leads]);
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

  const filteredLeads = useMemo(() => {
    if (classificationFilter === "ALL") return leads;
    return leads.filter((l) => l.qualification_classification === classificationFilter);
  }, [leads, classificationFilter]);

  const columns = useMemo<ColumnDef<Lead>[]>(
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
          if (!lead.is_in_pipeline) {
            return <span className="text-xs text-label-tertiary">—</span>;
          }
          const stage = lead.pipeline_stage as DealStage | null;
          const config = stage ? DEAL_STAGE_CONFIG[stage] : null;
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
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(getValue() as string)}
          </span>
        ),
        size: 100,
      },
    ],
    []
  );

  const table = useReactTable({
    data: filteredLeads,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  return (
    <>
      {/* Filtros */}
      <div className="mb-4 flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Buscar por nome, email..."
            className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-placeholder outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/30"
          />
        </div>

        {/* Filtro por classificação */}
        <div className="flex rounded-md border border-border bg-card p-0.5">
          {CLASSIFICATION_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setClassificationFilter(filter.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                classificationFilter === filter.value
                  ? "bg-primary/15 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="ml-auto text-xs text-muted-foreground">
          {table.getFilteredRowModel().rows.length} leads
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
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
                  onClick={() => setSelectedLead(row.original)}
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
                    Nenhum lead encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Página {table.getState().pagination.pageIndex + 1} de{" "}
            {table.getPageCount()}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Full-screen Detail (mesmo padrão do /pipeline) */}
      {selectedLead && (
        <LeadOrDealSheet
          key={selectedLead.id}
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
        />
      )}
    </>
  );
}
