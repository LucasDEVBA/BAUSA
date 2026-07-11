"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Clock,
  Inbox,
} from "lucide-react";
import {
  JOURNEY_STAGE_CONFIG,
  type FamilyJourneyStage,
} from "@/types/family";
import type { JourneyConfigMap } from "@/lib/fases-familia";
import { Badge, Card, EmptyState, type BadgeTone } from "@/components/ui";
import { cn } from "@/lib/utils";

interface FamiliaRow {
  id: string;
  athlete_name: string;
  guardian_name: string;
  plano: string;
  esporte: string | null;
  fase: FamilyJourneyStage;
  status: "satisfeita" | "atencao" | "crise";
  temperatura: "verde" | "amarelo" | "vermelho";
  ansiedade: number;
  satisfacao: number;
  risco_percebido: number;
  dias_sem_contato: number | null;
}

interface Props {
  cards: FamiliaRow[];
  journeyConfig?: JourneyConfigMap;
  onCardClick: (card: FamiliaRow) => void;
}

type SortKey =
  | "athlete_name"
  | "fase"
  | "status"
  | "satisfacao"
  | "dias_sem_contato";
type SortDir = "asc" | "desc";

const STATUS_META: Record<
  FamiliaRow["status"],
  { label: string; tone: BadgeTone }
> = {
  satisfeita: { label: "Satisfeita", tone: "green" },
  atencao: { label: "Atenção", tone: "orange" },
  crise: { label: "Crise", tone: "red" },
};

const TEMP_DOT: Record<string, string> = {
  verde: "bg-sys-green",
  amarelo: "bg-sys-orange",
  vermelho: "bg-sys-red",
};

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active)
    return <ArrowUpDown className="h-3 w-3 text-muted-foreground/40" />;
  return dir === "asc" ? (
    <ArrowUp className="h-3 w-3 text-primary" />
  ) : (
    <ArrowDown className="h-3 w-3 text-primary" />
  );
}

export function FamiliasPipelineTable({
  cards,
  journeyConfig = JOURNEY_STAGE_CONFIG,
  onCardClick,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const statusOrder: Record<FamiliaRow["status"], number> = {
    crise: 0,
    atencao: 1,
    satisfeita: 2,
  };

  const sorted = useMemo(() => {
    const arr = [...cards];
    arr.sort((a, b) => {
      let av: number | string = "";
      let bv: number | string = "";
      switch (sortKey) {
        case "athlete_name":
          av = a.athlete_name;
          bv = b.athlete_name;
          break;
        case "fase":
          av = journeyConfig[a.fase].order;
          bv = journeyConfig[b.fase].order;
          break;
        case "status":
          av = statusOrder[a.status];
          bv = statusOrder[b.status];
          break;
        case "satisfacao":
          av = a.satisfacao;
          bv = b.satisfacao;
          break;
        case "dias_sem_contato":
          av = a.dias_sem_contato ?? -1;
          bv = b.dias_sem_contato ?? -1;
          break;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, sortKey, sortDir, journeyConfig]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  if (cards.length === 0) {
    return (
      <Card padding="none" variant="plain">
        <EmptyState
          icon={Inbox}
          title="Nenhuma família"
          description="Nenhuma família corresponde aos filtros."
        />
      </Card>
    );
  }

  const cols: Array<{
    key: SortKey | "actions";
    label: string;
    width: number;
    align?: "left" | "right" | "center";
    sortable?: boolean;
  }> = [
    { key: "athlete_name", label: "Família", width: 240, sortable: true },
    { key: "fase", label: "Fase", width: 140, sortable: true },
    { key: "status", label: "Status", width: 110, sortable: true },
    {
      key: "satisfacao",
      label: "Satisf.",
      width: 80,
      align: "right",
      sortable: true,
    },
    {
      key: "dias_sem_contato",
      label: "Sem contato",
      width: 100,
      align: "right",
      sortable: true,
    },
    { key: "actions", label: "Sinais", width: 80, align: "center" },
  ];

  return (
    <Card padding="none" variant="plain" className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed">
          <thead>
            <tr className="border-b border-border">
              {cols.map((c) => {
                const sortable = c.sortable && c.key !== "actions";
                return (
                  <th
                    key={c.key}
                    style={{ width: c.width, maxWidth: c.width }}
                    aria-sort={
                      sortable && sortKey === c.key
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                    className={cn(
                      "px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center",
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key as SortKey)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded uppercase tracking-wider transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          c.align === "right" && "justify-end",
                        )}
                      >
                        {c.label}
                        <SortIcon active={sortKey === c.key} dir={sortDir} />
                      </button>
                    ) : (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1",
                          c.align === "center" && "justify-center",
                        )}
                      >
                        {c.label}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => {
              const stageCfg = journeyConfig[c.fase];
              const statusCfg = STATUS_META[c.status];
              const semContato = (c.dias_sem_contato ?? 0) > 30;
              const semContatoMedio = (c.dias_sem_contato ?? 0) > 15;
              return (
                <tr
                  key={c.id}
                  onClick={() => onCardClick(c)}
                  className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-accent"
                >
                  <td
                    style={{ width: 240, maxWidth: 240 }}
                    className="overflow-hidden px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          TEMP_DOT[c.temperatura],
                        )}
                        title={`Temperatura ${c.temperatura}`}
                      />
                      <div className="min-w-0">
                        <p
                          className="truncate text-xs font-medium text-foreground"
                          title={c.athlete_name}
                        >
                          {c.athlete_name}
                        </p>
                        <p
                          className="truncate text-[10px] text-muted-foreground"
                          title={c.guardian_name}
                        >
                          {c.guardian_name}
                          {c.plano !== "—" && ` · ${c.plano}`}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td
                    style={{ width: 140, maxWidth: 140 }}
                    className="overflow-hidden px-3 py-2.5"
                  >
                    <span
                      className="block truncate text-xs text-muted-foreground"
                      title={stageCfg.label}
                    >
                      {stageCfg.label}
                    </span>
                  </td>
                  <td
                    style={{ width: 110, maxWidth: 110 }}
                    className="overflow-hidden px-3 py-2.5"
                  >
                    <Badge tone={statusCfg.tone} size="sm">
                      {statusCfg.label}
                    </Badge>
                  </td>
                  <td
                    style={{ width: 80, maxWidth: 80 }}
                    className="overflow-hidden px-3 py-2.5 text-right text-xs tabular-nums text-foreground"
                  >
                    {c.satisfacao}/5
                  </td>
                  <td
                    style={{ width: 100, maxWidth: 100 }}
                    className="overflow-hidden px-3 py-2.5 text-right text-xs tabular-nums"
                  >
                    {c.dias_sem_contato == null ? (
                      <span className="text-muted-foreground/60">—</span>
                    ) : (
                      <span
                        className={cn(
                          semContato
                            ? "font-medium text-sys-red"
                            : semContatoMedio
                              ? "font-medium text-sys-orange"
                              : "text-muted-foreground",
                        )}
                      >
                        {c.dias_sem_contato}d
                      </span>
                    )}
                  </td>
                  <td
                    style={{ width: 80, maxWidth: 80 }}
                    className="overflow-hidden px-3 py-2.5"
                  >
                    <div className="flex items-center justify-center gap-1">
                      {c.status === "crise" && (
                        <span className="text-sys-red" title="Em crise">
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </span>
                      )}
                      {semContato && (
                        <span
                          className="text-sys-orange"
                          title={`${c.dias_sem_contato}d sem contato`}
                        >
                          <Clock className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
