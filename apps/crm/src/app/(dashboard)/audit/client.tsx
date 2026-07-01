"use client";

import { useState, useMemo } from "react";
import { Shield, Filter } from "lucide-react";
import { ExportCSVButton } from "@/components/shared/ExportCSVButton";
import { cn } from "@/lib/utils";

interface AuditLogEntry {
  id: string;
  tabela: string;
  registro_id: string;
  operacao: "INSERT" | "UPDATE" | "DELETE";
  campos_alterados: string[];
  user_id: string | null;
  user_papel: string | null;
  created_at: string;
}

interface AuditClientProps {
  logs: AuditLogEntry[];
  tabelas: string[];
}

const OPERACAO_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  INSERT: { label: "INSERT", bg: "bg-sys-green/10 border-sys-green/20", color: "text-sys-green" },
  UPDATE: { label: "UPDATE", bg: "bg-sys-blue/10 border-sys-blue/20", color: "text-sys-blue" },
  DELETE: { label: "DELETE", bg: "bg-sys-red/10 border-sys-red/20", color: "text-sys-red" },
};

export function AuditClient({ logs, tabelas }: AuditClientProps) {
  const [filterTabela, setFilterTabela] = useState("");
  const [filterOperacao, setFilterOperacao] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      if (filterTabela && log.tabela !== filterTabela) return false;
      if (filterOperacao && log.operacao !== filterOperacao) return false;
      if (filterDateFrom) {
        const logDate = log.created_at.split("T")[0];
        if (logDate < filterDateFrom) return false;
      }
      if (filterDateTo) {
        const logDate = log.created_at.split("T")[0];
        if (logDate > filterDateTo) return false;
      }
      return true;
    });
  }, [logs, filterTabela, filterOperacao, filterDateFrom, filterDateTo]);

  const exportHeaders = [
    "Data",
    "Tabela",
    "Operacao",
    "Registro ID",
    "Usuario (papel)",
    "Campos Alterados",
  ];

  const exportRows = filtered.map((log) => [
    new Date(log.created_at).toLocaleString("pt-BR"),
    log.tabela,
    log.operacao,
    log.registro_id,
    log.user_papel ?? "sistema",
    (log.campos_alterados ?? []).join(", "),
  ]);

  const selectClass =
    "rounded-md border border-border bg-card py-2 px-3 text-sm text-foreground outline-none focus:border-primary";

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-title-2 text-foreground">Audit Trail</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Historico de alteracoes — {filtered.length} registros
            </p>
          </div>
        </div>
        <ExportCSVButton
          filename={`audit_trail_${new Date().toISOString().split("T")[0]}.csv`}
          headers={exportHeaders}
          rows={exportRows}
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Filtros:</span>
        </div>
        <select
          value={filterTabela}
          onChange={(e) => setFilterTabela(e.target.value)}
          className={selectClass}
        >
          <option value="">Todas as tabelas</option>
          {tabelas.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={filterOperacao}
          onChange={(e) => setFilterOperacao(e.target.value)}
          className={selectClass}
        >
          <option value="">Todas operacoes</option>
          <option value="INSERT">INSERT</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
        </select>
        <input
          type="date"
          value={filterDateFrom}
          onChange={(e) => setFilterDateFrom(e.target.value)}
          className={selectClass}
          placeholder="De"
        />
        <input
          type="date"
          value={filterDateTo}
          onChange={(e) => setFilterDateTo(e.target.value)}
          className={selectClass}
          placeholder="Ate"
        />
        {(filterTabela || filterOperacao || filterDateFrom || filterDateTo) && (
          <button
            onClick={() => {
              setFilterTabela("");
              setFilterOperacao("");
              setFilterDateFrom("");
              setFilterDateTo("");
            }}
            className="text-xs text-primary hover:text-primary/80"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Tabela */}
      <div className="border border-border/70 bg-card/60 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="py-2.5 pl-4 pr-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Data
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Tabela
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Operacao
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Registro
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Usuario
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Campos Alterados
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              )}
              {filtered.slice(0, 100).map((log) => {
                const opCfg = OPERACAO_CONFIG[log.operacao] ?? OPERACAO_CONFIG.UPDATE;
                return (
                  <tr
                    key={log.id}
                    className="border-b border-border transition-colors hover:bg-accent"
                  >
                    <td className="py-2.5 pl-4 pr-3 text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {log.tabela}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold",
                          opCfg.bg,
                          opCfg.color,
                        )}
                      >
                        {opCfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">
                      {log.registro_id.slice(0, 8)}...
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {log.user_papel ?? "sistema"}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[300px] truncate">
                      {(log.campos_alterados ?? []).join(", ") || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
