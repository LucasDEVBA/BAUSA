"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getFilteredRowModel, getPaginationRowModel,
  type ColumnDef, type SortingState, flexRender,
} from "@tanstack/react-table";
import {
  ArrowUpDown, ArrowUp, ArrowDown, Search, ChevronLeft,
  ChevronRight, MessageCircle, Check, X, Phone, Mail,
  Instagram, Video, Flame, MapPin, ArrowRight, Loader2,
  Users,
} from "lucide-react";
import { LeadStatusBadge } from "./LeadStatusBadge";
import { promoverLead } from "@/lib/crm/actions/leads";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { FormSubmission } from "@/types/crm";

/*
  COMPONENT: LeadsTable
  PROBLEM:   Entire table uses hardcoded zinc-* classes. Empty state is plain text
             "Nenhum lead encontrado" without visual anchor. Search input uses mixed
             token + hardcoded classes. Filter pills use raw indigo-* classes.
             Detail sheet uses raw zinc/indigo classes throughout. Pagination controls
             use raw white/10 hover.
  DECISION:  Full token migration. Table uses --crm-table-* tokens for consistent
             row heights and padding. Empty state uses crm-empty-state pattern with
             Users icon. Filter pills use accent tokens. Detail sheet header gets
             improved hierarchy with accent avatar.
             Brand DNA: Data-Rich (table with proper density), Premium (sheet animation),
             Controlled (consistent spacing, 44px min row height for touch targets).
  CONTRAST:  Table header: --crm-text-tertiary on surface = 4.2:1 AA
             Table cell text: --crm-text-primary on surface = 17.6:1 AAA
             Search placeholder: --crm-text-disabled (decorative, exempt)
*/

interface LeadsTableProps {
  leads: FormSubmission[];
  type: "novos" | "crm";
}

const CLASSIFICATION_FILTERS = [
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

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "agora";
  if (hours < 24) return `${hours}h atras`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d atras`;
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

export function LeadsTable({ leads, type }: LeadsTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([{ id: "submitted_at", desc: true }]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [classFilter, setClassFilter] = useState("ALL");
  const [selectedLead, setSelectedLead] = useState<FormSubmission | null>(null);
  const [isPending, startTransition] = useTransition();
  const [promotingId, setPromotingId] = useState<string | null>(null);

  const filteredLeads = useMemo(() => {
    if (classFilter === "ALL") return leads;
    return leads.filter((l) => l.qualification_classification === classFilter);
  }, [leads, classFilter]);

  const columns = useMemo<ColumnDef<FormSubmission>[]>(() => [
    {
      accessorKey: "athlete_name",
      header: "Atleta",
      cell: ({ row }) => {
        const lead = row.original;
        return (
          <div className="flex items-center gap-2.5">
            <div className="crm-avatar crm-avatar-sm">
              {getInitials(lead.athlete_name)}
            </div>
            <div>
              <p className="text-[var(--crm-text-base)] font-[var(--crm-weight-medium)] text-[var(--crm-text-primary)]">{lead.athlete_name}</p>
              <p className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">{lead.email}</p>
            </div>
          </div>
        );
      },
      size: 220,
    },
    {
      accessorKey: "qualification_classification",
      header: "Classificacao",
      cell: ({ getValue }) => <LeadStatusBadge classification={getValue() as string | null} />,
      size: 110,
    },
    {
      accessorKey: "investment_range",
      header: "Investimento",
      cell: ({ getValue }) => <span className="text-[var(--crm-text-base)] text-[var(--crm-text-secondary)]">{(getValue() as string) || "\u2014"}</span>,
      size: 150,
    },
    {
      accessorKey: "position",
      header: "Posicao",
      cell: ({ getValue }) => <span className="text-[var(--crm-text-base)] text-[var(--crm-text-secondary)]">{(getValue() as string) || "\u2014"}</span>,
      size: 120,
    },
    {
      id: "location",
      header: "Local",
      accessorFn: (row) => row.city_state,
      cell: ({ getValue }) => <span className="text-[var(--crm-text-base)] text-[var(--crm-text-secondary)]">{(getValue() as string) || "\u2014"}</span>,
      size: 100,
    },
    {
      id: "whatsapp",
      header: "WhatsApp",
      accessorFn: (row) => row.guardian_whatsapp,
      cell: ({ row }) => {
        const sent = row.original.qualification_classification;
        return sent ? (
          <div className="flex items-center gap-1.5 text-[var(--crm-text-xs)] text-[var(--crm-success)] font-[var(--crm-weight-medium)]">
            <Check className="h-3.5 w-3.5" />
            Qualificado
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">
            <MessageCircle className="h-3.5 w-3.5" />
            Pendente
          </div>
        );
      },
      size: 100,
    },
    {
      accessorKey: "submitted_at",
      header: "Recebido",
      cell: ({ getValue }) => <span className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">{formatRelativeTime(getValue() as string)}</span>,
      size: 100,
    },
  ], []);

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
    initialState: { pagination: { pageSize: 15 } },
  });

  const handlePromover = async (id: string) => {
    setPromotingId(id);
    startTransition(async () => {
      const result = await promoverLead(id);
      if (result.success) {
        toast.success("Lead promovido para o CRM!");
        router.refresh();
        setSelectedLead(null);
      } else {
        toast.error(result.error || "Erro ao promover lead.");
      }
      setPromotingId(null);
    });
  };

  return (
    <>
      {/* Filters */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--crm-text-tertiary)]" />
          <input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Buscar por nome, email..."
            className="crm-input pl-9"
          />
        </div>
        <div className="flex rounded-[var(--crm-radius-lg)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-0.5">
          {CLASSIFICATION_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setClassFilter(f.value)}
              className={cn(
                "rounded-[var(--crm-radius-md)] px-3 py-1.5 text-[var(--crm-text-xs)] font-[var(--crm-weight-medium)]",
                "transition-all duration-[var(--crm-duration-fast)]",
                classFilter === f.value
                  ? "bg-[var(--crm-accent-bg-hover)] text-[var(--crm-accent-text)]"
                  : "text-[var(--crm-text-tertiary)] hover:text-[var(--crm-text-secondary)]",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="ml-auto text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)] tabular-nums">
          {table.getFilteredRowModel().rows.length} leads
        </div>
      </div>

      {/* Table */}
      <div className="crm-card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="crm-table">
            <thead>
              <tr>
                {table.getHeaderGroups().map((hg) =>
                  hg.headers.map((header) => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      style={{ width: header.getSize() }}
                      className={cn(
                        header.column.getCanSort() && "cursor-pointer select-none hover:text-[var(--crm-text-secondary)]",
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && <SortIcon isSorted={header.column.getIsSorted()} />}
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
                    "cursor-pointer",
                    i % 2 !== 0 && "bg-[var(--crm-table-stripe)]",
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {table.getRowModel().rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length}>
                    <div className="crm-empty-state">
                      <div className="crm-empty-state-icon">
                        <Users className="h-5 w-5" />
                      </div>
                      <p className="crm-empty-state-title">Nenhum lead encontrado</p>
                      <p className="crm-empty-state-description">
                        Ajuste os filtros ou aguarde novos leads chegarem pelo formulario.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-[var(--crm-border)] px-[var(--crm-table-cell-padding)] py-3">
          <p className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)] tabular-nums">
            Pagina {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="flex h-7 w-7 items-center justify-center rounded-[var(--crm-radius-md)] text-[var(--crm-text-tertiary)] transition-colors duration-[var(--crm-duration-fast)] hover:bg-[var(--crm-hover-overlay)] hover:text-[var(--crm-text-secondary)] disabled:opacity-[var(--crm-disabled-opacity)]"
              aria-label="Pagina anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="flex h-7 w-7 items-center justify-center rounded-[var(--crm-radius-md)] text-[var(--crm-text-tertiary)] transition-colors duration-[var(--crm-duration-fast)] hover:bg-[var(--crm-hover-overlay)] hover:text-[var(--crm-text-secondary)] disabled:opacity-[var(--crm-disabled-opacity)]"
              aria-label="Proxima pagina"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Detail Sheet */}
      {selectedLead && (
        <>
          <div className="fixed inset-0 z-[var(--crm-z-overlay)] bg-black/60 backdrop-blur-sm" onClick={() => setSelectedLead(null)} />
          <div className="fixed inset-y-0 right-0 z-[var(--crm-z-modal)] flex w-full max-w-xl flex-col border-l border-[var(--crm-border)] bg-[var(--crm-surface)] shadow-[var(--crm-shadow-2xl)]">
            {/* Header */}
            <div className="flex items-start gap-4 border-b border-[var(--crm-border)] px-6 py-5">
              <div className="crm-avatar crm-avatar-lg">
                {getInitials(selectedLead.athlete_name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-base font-[var(--crm-weight-semibold)] text-[var(--crm-text-primary)]">{selectedLead.athlete_name}</h2>
                  <LeadStatusBadge classification={selectedLead.qualification_classification} />
                </div>
                <p className="mt-0.5 text-[var(--crm-text-base)] text-[var(--crm-text-tertiary)]">{selectedLead.position || "\u2014"} {"\u00B7"} {selectedLead.school_year || "\u2014"}</p>
                <p className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">Submetido em {new Date(selectedLead.submitted_at).toLocaleString("pt-BR")}</p>
              </div>
              <button onClick={() => setSelectedLead(null)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--crm-radius-lg)] text-[var(--crm-text-tertiary)] transition-colors duration-[var(--crm-duration-fast)] hover:bg-[var(--crm-hover-overlay)] hover:text-[var(--crm-text-secondary)]" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* AI Analysis */}
            {selectedLead.qualification_reason && (
              <div className="border-b border-[var(--crm-border)] px-6 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <Flame className="h-4 w-4 text-[var(--crm-accent-text)]" />
                  <span className="crm-section-label">Analise da IA</span>
                </div>
                <p className="text-[var(--crm-text-base)] text-[var(--crm-text-secondary)] leading-relaxed">{selectedLead.qualification_reason}</p>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Quick actions */}
              <div className="flex gap-2">
                {selectedLead.guardian_whatsapp && (
                  <a href={`https://wa.me/${selectedLead.guardian_whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-2 rounded-[var(--crm-radius-lg)] bg-[var(--crm-success-subtle)] border border-[var(--crm-success-border)] py-2 text-[var(--crm-text-base)] font-[var(--crm-weight-medium)] text-[var(--crm-success)] transition-colors duration-[var(--crm-duration-fast)] hover:bg-[color-mix(in_srgb,var(--crm-success)_20%,transparent)]">
                    <MessageCircle className="h-4 w-4" />WhatsApp
                  </a>
                )}
                {selectedLead.email && (
                  <a href={`mailto:${selectedLead.email}`}
                    className="flex flex-1 items-center justify-center gap-2 rounded-[var(--crm-radius-lg)] bg-[var(--crm-accent-bg)] border border-[var(--crm-accent-border)] py-2 text-[var(--crm-text-base)] font-[var(--crm-weight-medium)] text-[var(--crm-accent-text)] transition-colors duration-[var(--crm-duration-fast)] hover:bg-[var(--crm-accent-bg-hover)]">
                    <Mail className="h-4 w-4" />E-mail
                  </a>
                )}
              </div>

              {/* Data sections */}
              <Section title="Atleta">
                <DataRow label="E-mail" value={selectedLead.email} />
                <DataRow label="Nascimento" value={selectedLead.birth_date} />
                <DataRow label="Esporte / Posicao" value={selectedLead.position} />
                <DataRow label="Historico" value={selectedLead.club_history} />
                <DataRow label="Conquistas" value={selectedLead.achievements} />
                {selectedLead.instagram && (
                  <div className="flex items-center justify-between gap-4 py-1.5 text-[var(--crm-text-base)]">
                    <span className="text-[var(--crm-text-tertiary)]">Instagram</span>
                    <a href={`https://instagram.com/${selectedLead.instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[var(--crm-text-link)] hover:text-[var(--crm-text-link-hover)]">
                      <Instagram className="h-3.5 w-3.5" />{selectedLead.instagram}
                    </a>
                  </div>
                )}
                {selectedLead.video_link && (
                  <div className="flex items-center justify-between gap-4 py-1.5 text-[var(--crm-text-base)]">
                    <span className="text-[var(--crm-text-tertiary)]">Video</span>
                    <a href={selectedLead.video_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[var(--crm-text-link)] hover:text-[var(--crm-text-link-hover)]">
                      <Video className="h-3.5 w-3.5" />Ver highlights
                    </a>
                  </div>
                )}
              </Section>

              <Section title="Educacao">
                <DataRow label="Serie" value={selectedLead.school_year} />
                <DataRow label="Escola" value={selectedLead.current_school} />
                <DataRow label="Cidade / Estado" value={selectedLead.city_state} />
                <DataRow label="Ingles" value={selectedLead.english_level} />
              </Section>

              <Section title="Projeto">
                <DataRow label="Investimento" value={selectedLead.investment_range} />
                <DataRow label="Classificacao" value={selectedLead.qualification_classification} />
              </Section>

              <Section title="Responsavel Financeiro">
                <DataRow label="Nome" value={selectedLead.guardian_name} />
                <DataRow label="Profissao" value={selectedLead.guardian_profession} />
                <DataRow label="E-mail" value={selectedLead.guardian_email} />
                <DataRow label="WhatsApp" value={selectedLead.guardian_whatsapp} />
              </Section>

              <Section title="Endereco">
                <DataRow label="Endereco" value={selectedLead.family_address} />
                <DataRow label="Pais" value={selectedLead.address_country} />
              </Section>
            </div>

            {/* Footer with action */}
            {type === "novos" && (
              <div className="border-t border-[var(--crm-border)] px-6 py-4">
                <button
                  onClick={() => handlePromover(selectedLead.id)}
                  disabled={promotingId === selectedLead.id || isPending}
                  className="crm-btn crm-btn-brand w-full py-2.5"
                >
                  {promotingId === selectedLead.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  Promover para CRM
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="crm-section-label mb-3">{title}</h4>
      <div className="divide-y divide-[var(--crm-border)]">{children}</div>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-[var(--crm-text-base)]">
      <span className="shrink-0 text-[var(--crm-text-tertiary)]">{label}</span>
      <span className="text-right text-[var(--crm-text-primary)]">{value}</span>
    </div>
  );
}
