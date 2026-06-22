"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { type Deal, DEAL_STAGE_CONFIG } from "@/types/deal";
import { cn } from "@/lib/utils";

interface Props {
  deals: Deal[];
  onDealClick: (deal: Deal) => void;
}

type SortKey =
  | "athlete_name"
  | "stage"
  | "deal_value_brl"
  | "lead_score"
  | "stage_updated_at"
  | "next_action_date";

type SortDir = "asc" | "desc";

const CLASS_BADGE: Record<string, string> = {
  QUENTE: "bg-sys-green/15 text-sys-green border-sys-green/30",
  MORNO: "bg-sys-orange/15 text-sys-orange border-sys-orange/30",
  FRIO: "bg-sys-blue/15 text-sys-blue border-sys-blue/30",
};

function fmtBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

function diasAtras(iso?: string): number | null {
  if (!iso) return null;
  // eslint-disable-next-line react-hooks/purity
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function SortIcon({
  active,
  dir,
}: {
  active: boolean;
  dir: SortDir;
}) {
  if (!active)
    return <ArrowUpDown className="h-3 w-3 text-muted-foreground/40" />;
  return dir === "asc" ? (
    <ArrowUp className="h-3 w-3 text-primary" />
  ) : (
    <ArrowDown className="h-3 w-3 text-primary" />
  );
}

export function PipelineTableView({ deals, onDealClick }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("stage_updated_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const arr = [...deals];
    arr.sort((a, b) => {
      let av: number | string = "";
      let bv: number | string = "";
      switch (sortKey) {
        case "athlete_name":
          av = a.athlete_name;
          bv = b.athlete_name;
          break;
        case "stage":
          av = DEAL_STAGE_CONFIG[a.stage].order;
          bv = DEAL_STAGE_CONFIG[b.stage].order;
          break;
        case "deal_value_brl":
          av = a.deal_value_brl;
          bv = b.deal_value_brl;
          break;
        case "lead_score":
          av = a.lead_score ?? 0;
          bv = b.lead_score ?? 0;
          break;
        case "stage_updated_at":
          av = new Date(a.stage_updated_at).getTime();
          bv = new Date(b.stage_updated_at).getTime();
          break;
        case "next_action_date":
          av = a.next_action_date
            ? new Date(a.next_action_date).getTime()
            : Number.MAX_SAFE_INTEGER;
          bv = b.next_action_date
            ? new Date(b.next_action_date).getTime()
            : Number.MAX_SAFE_INTEGER;
          break;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [deals, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  if (deals.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border bg-card py-16 text-sm text-muted-foreground">
        Nenhum deal corresponde aos filtros.
      </div>
    );
  }

  const columns: Array<{
    key: SortKey | "actions";
    label: string;
    width: number;
    align?: "left" | "right" | "center";
    sortable?: boolean;
  }> = [
    { key: "athlete_name", label: "Atleta", width: 220, sortable: true },
    { key: "stage", label: "Etapa", width: 160, sortable: true },
    {
      key: "deal_value_brl",
      label: "Valor BRL",
      width: 120,
      align: "right",
      sortable: true,
    },
    {
      key: "lead_score",
      label: "Score",
      width: 80,
      align: "right",
      sortable: true,
    },
    {
      key: "stage_updated_at",
      label: "Mov.",
      width: 90,
      align: "right",
      sortable: true,
    },
    {
      key: "next_action_date",
      label: "Próx. ação",
      width: 220,
      sortable: true,
    },
    { key: "actions", label: "Sinais", width: 90, align: "center" },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed">
          <thead>
            <tr className="border-b border-border bg-card/80">
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={{ width: c.width, maxWidth: c.width }}
                  onClick={() =>
                    c.sortable && c.key !== "actions"
                      ? toggleSort(c.key as SortKey)
                      : undefined
                  }
                  className={cn(
                    "px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
                    c.align === "right" && "text-right",
                    c.align === "center" && "text-center",
                    c.sortable && c.key !== "actions" && "cursor-pointer hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex items-center gap-1",
                      c.align === "right" && "justify-end",
                      c.align === "center" && "justify-center",
                    )}
                  >
                    {c.label}
                    {c.sortable && c.key !== "actions" && (
                      <SortIcon
                        active={sortKey === c.key}
                        dir={sortDir}
                      />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((d, i) => {
              const stageCfg = DEAL_STAGE_CONFIG[d.stage];
              const dEtapa = diasAtras(d.stage_updated_at) ?? 0;
              const atraso = d.next_action_date
                ? diasAtras(d.next_action_date) ?? 0
                : null;
              const semAcao = !d.next_action;
              const semContato = dEtapa > 14;
              return (
                <tr
                  key={d.id}
                  onClick={() => onDealClick(d)}
                  className={cn(
                    "cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-accent",
                    i % 2 === 1 && "bg-fill-4",
                  )}
                >
                  <td
                    style={{ width: 220, maxWidth: 220 }}
                    className="overflow-hidden px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md border px-1.5 py-px text-[9px] font-medium shrink-0",
                          CLASS_BADGE[d.classification] ??
                            "border-border text-muted-foreground",
                        )}
                      >
                        {d.classification}
                      </span>
                      <span
                        className="truncate text-xs font-medium text-foreground"
                        title={d.athlete_name}
                      >
                        {d.athlete_name}
                      </span>
                    </div>
                  </td>
                  <td
                    style={{ width: 160, maxWidth: 160 }}
                    className="overflow-hidden px-3 py-2"
                  >
                    <span
                      className="inline-flex items-center gap-1.5 text-xs text-foreground"
                      title={stageCfg.label}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full shrink-0",
                          stageCfg.dotColor,
                        )}
                      />
                      <span className="truncate">{stageCfg.shortLabel}</span>
                    </span>
                  </td>
                  <td
                    style={{ width: 120, maxWidth: 120 }}
                    className="overflow-hidden px-3 py-2 text-right text-xs tabular-nums text-foreground"
                  >
                    {fmtBRL(d.deal_value_brl)}
                  </td>
                  <td
                    style={{ width: 80, maxWidth: 80 }}
                    className="overflow-hidden px-3 py-2 text-right text-xs tabular-nums"
                  >
                    {d.lead_score != null ? (
                      <span
                        className={cn(
                          d.lead_score >= 75
                            ? "text-sys-green"
                            : d.lead_score >= 50
                              ? "text-sys-orange"
                              : "text-muted-foreground",
                        )}
                      >
                        {d.lead_score}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </td>
                  <td
                    style={{ width: 90, maxWidth: 90 }}
                    className="overflow-hidden px-3 py-2 text-right text-xs tabular-nums"
                    title={new Date(d.stage_updated_at).toLocaleString("pt-BR")}
                  >
                    <span
                      className={cn(
                        dEtapa > 14
                          ? "text-sys-orange"
                          : dEtapa > 7
                            ? "text-foreground"
                            : "text-muted-foreground",
                      )}
                    >
                      {dEtapa}d
                    </span>
                  </td>
                  <td
                    style={{ width: 220, maxWidth: 220 }}
                    className="overflow-hidden px-3 py-2"
                    title={d.next_action ?? ""}
                  >
                    <p className="truncate text-xs text-foreground">
                      {d.next_action ?? (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </p>
                    {d.next_action_date && (
                      <p
                        className={cn(
                          "text-[10px] tabular-nums",
                          atraso != null && atraso > 0
                            ? "text-sys-red"
                            : "text-muted-foreground",
                        )}
                      >
                        {new Date(d.next_action_date).toLocaleDateString(
                          "pt-BR",
                        )}
                        {atraso != null && atraso > 0 && ` · ${atraso}d atraso`}
                      </p>
                    )}
                  </td>
                  <td
                    style={{ width: 90, maxWidth: 90 }}
                    className="overflow-hidden px-3 py-2"
                  >
                    <div className="flex items-center justify-center gap-1">
                      {semAcao && (
                        <span
                          title="Sem próxima ação definida"
                          className="text-sys-red"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </span>
                      )}
                      {semContato && (
                        <span
                          title={`${dEtapa}d parado nesta etapa`}
                          className="text-sys-orange"
                        >
                          <Clock className="h-3.5 w-3.5" />
                        </span>
                      )}
                      {d.flag_retrocedido && (
                        <span
                          title="Deal retrocedeu"
                          className="text-sys-orange"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
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
    </div>
  );
}
