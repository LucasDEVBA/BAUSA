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
  | "stage_updated_at"
  | "next_action_date";

type SortDir = "asc" | "desc";

const CLASS_BADGE: Record<string, string> = {
  QUENTE: "bg-sys-green/12 text-sys-green",
  MORNO: "bg-sys-orange/12 text-sys-orange",
  FRIO: "bg-sys-blue/12 text-sys-blue",
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

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="h-2.5 w-2.5 opacity-40" />;
  return dir === "asc" ? (
    <ArrowUp className="h-2.5 w-2.5 text-primary" />
  ) : (
    <ArrowDown className="h-2.5 w-2.5 text-primary" />
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
          av = a.athlete_name.toLowerCase();
          bv = b.athlete_name.toLowerCase();
          break;
        case "stage":
          av = DEAL_STAGE_CONFIG[a.stage].order;
          bv = DEAL_STAGE_CONFIG[b.stage].order;
          break;
        case "deal_value_brl":
          av = a.deal_value_brl;
          bv = b.deal_value_brl;
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
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  if (deals.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card py-12 text-xs text-muted-foreground">
        Nenhum deal corresponde aos filtros.
      </div>
    );
  }

  const headerCell = (
    label: string,
    key: SortKey | null,
    align?: "left" | "right" | "center",
  ) => (
    <th
      key={label}
      onClick={key ? () => toggleSort(key) : undefined}
      className={cn(
        "select-none px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
        align === "right" && "text-right",
        align === "center" && "text-center",
        key && "cursor-pointer hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1",
          align === "right" && "justify-end",
          align === "center" && "justify-center",
        )}
      >
        {label}
        {key && <SortIcon active={sortKey === key} dir={sortDir} />}
      </span>
    </th>
  );

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="max-h-[calc(100vh-220px)] overflow-auto">
        <table className="w-full">
          <colgroup>
            <col style={{ width: "32%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "6%" }} />
          </colgroup>
          <thead className="sticky top-0 z-10 border-b border-border bg-card shadow-[inset_0_-1px_0_var(--border)]">
            <tr>
              {headerCell("Atleta", "athlete_name")}
              {headerCell("Etapa", "stage")}
              {headerCell("Valor", "deal_value_brl", "right")}
              {headerCell("Etapa há", "stage_updated_at", "right")}
              {headerCell("Próxima ação", "next_action_date")}
              {headerCell("", null, "center")}
            </tr>
          </thead>
          <tbody>
            {sorted.map((d) => {
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
                    "group h-11 cursor-pointer border-b border-border/40 transition-colors last:border-0 hover:bg-bau-blue/[0.04]",
                  )}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center rounded px-1.5 py-px text-[9px] font-semibold tracking-wide",
                          CLASS_BADGE[d.classification] ??
                            "bg-secondary text-muted-foreground",
                        )}
                      >
                        {d.classification}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-xs font-medium text-foreground"
                          title={d.athlete_name}
                        >
                          {d.athlete_name}
                        </p>
                        <p
                          className="truncate text-[10px] text-muted-foreground"
                          title={d.guardian_name}
                        >
                          {d.guardian_name}
                          {d.product_tier && ` · ${d.product_tier}`}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className="inline-flex items-center gap-1.5 text-xs text-foreground"
                      title={stageCfg.label}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          stageCfg.dotColor,
                        )}
                      />
                      <span className="truncate">{stageCfg.shortLabel}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums text-foreground">
                    {fmtBRL(d.deal_value_brl)}
                  </td>
                  <td
                    className="px-3 py-2 text-right text-xs tabular-nums"
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
                  <td className="px-3 py-2" title={d.next_action ?? ""}>
                    {d.next_action ? (
                      <>
                        <p className="truncate text-xs text-foreground">
                          {d.next_action}
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
                            {atraso != null && atraso > 0 &&
                              ` · ${atraso}d atraso`}
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/60">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                      {semAcao && (
                        <span
                          title="Sem próxima ação definida"
                          className="text-sys-red"
                        >
                          <AlertTriangle className="h-3 w-3" />
                        </span>
                      )}
                      {semContato && !semAcao && (
                        <span
                          title={`${dEtapa}d parado nesta etapa`}
                          className="text-sys-orange"
                        >
                          <Clock className="h-3 w-3" />
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
