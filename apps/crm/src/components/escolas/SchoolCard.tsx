"use client";

import {
  MapPin,
  Users,
  ExternalLink,
  AlertTriangle,
  Calendar,
  CheckCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { SCHOOL_STATUS_CONFIG, SCHOOL_TYPE_CONFIG, type School } from "@/types/school";

interface SchoolCardProps {
  school: School;
  onSelect: (school: School) => void;
  /** Timestamp de referência (gerado no servidor) para cálculos de "dias atrás" puros no client. */
  now: number;
}

export function SchoolCard({ school, onSelect, now }: SchoolCardProps) {
  const statusCfg = SCHOOL_STATUS_CONFIG[school.status];
  const typeCfg = SCHOOL_TYPE_CONFIG[school.type];
  const acceptanceRate = school.total_applications > 0
    ? Math.round((school.acceptance_count / school.total_applications) * 100)
    : 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(school)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(school);
        }
      }}
      className="cursor-pointer rounded-xl border border-[#1e2130] bg-[#141720] p-5 transition-colors hover:border-indigo-500/30 hover:bg-[#161b28] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold", typeCfg.bg, typeCfg.color)}>
              {typeCfg.label}
            </span>
            <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium", statusCfg.bg, statusCfg.color)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", statusCfg.color.replace("text-", "bg-"))} />
              {statusCfg.label}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-white leading-tight">{school.name}</h3>
          <p className="flex items-center gap-1 mt-0.5 text-xs text-zinc-500">
            <MapPin className="h-3 w-3" />
            {school.city}, {school.state}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-zinc-600">Match medio</p>
          <p className="text-xl font-bold text-emerald-400">{school.avg_scholarship_pct}%</p>
          <p className="text-[10px] text-zinc-600">bolsa media</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-[#0c0e16] px-3 py-2 text-center">
          <p className="text-lg font-bold text-white">{acceptanceRate}%</p>
          <p className="text-[10px] text-zinc-500">Taxa aceite</p>
        </div>
        <div className="rounded-lg bg-[#0c0e16] px-3 py-2 text-center">
          <p className="text-lg font-bold text-white">{school.total_applications}</p>
          <p className="text-[10px] text-zinc-500">Aplicacoes</p>
        </div>
        <div className="rounded-lg bg-[#0c0e16] px-3 py-2 text-center">
          <p className="text-lg font-bold text-white">{school.avg_response_days}d</p>
          <p className="text-[10px] text-zinc-500">Resp. media</p>
        </div>
      </div>

      {/* Regras financeiras */}
      <div className="mb-3 space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Budget exigido</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-md border border-[#1e2130] bg-[#0c0e16] px-2.5 py-1.5">
            <p className="text-[10px] text-zinc-600">Minimo</p>
            <p className="text-xs font-semibold text-amber-400">US$ {(school.min_budget_usd / 1000).toFixed(0)}k</p>
          </div>
          <div className="flex-1 rounded-md border border-[#1e2130] bg-[#0c0e16] px-2.5 py-1.5">
            <p className="text-[10px] text-zinc-600">Forte</p>
            <p className="text-xs font-semibold text-emerald-400">US$ {(school.strong_budget_usd / 1000).toFixed(0)}k</p>
          </div>
        </div>
      </div>

      {/* Agressividade de bolsa */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] text-zinc-600">Agressividade bolsa</p>
        <span className={cn(
          "rounded-md border px-2 py-0.5 text-[10px] font-medium",
          school.scholarship_aggressiveness === "agressiva"
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            : school.scholarship_aggressiveness === "moderada"
            ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
            : "border-zinc-500/30 bg-zinc-500/10 text-zinc-400"
        )}>
          {school.scholarship_aggressiveness.charAt(0).toUpperCase() + school.scholarship_aggressiveness.slice(1)}
        </span>
      </div>

      {/* Influencia esportiva */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[10px] text-zinc-600">Influencia esportiva</p>
        <span className={cn(
          "rounded-md border px-2 py-0.5 text-[10px] font-medium",
          school.sport_influence === "decisiva"
            ? "border-purple-500/30 bg-purple-500/10 text-purple-400"
            : school.sport_influence === "alta"
            ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
            : school.sport_influence === "media"
            ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
            : "border-zinc-500/30 bg-zinc-500/10 text-zinc-400"
        )}>
          {school.sport_influence.charAt(0).toUpperCase() + school.sport_influence.slice(1)}
        </span>
      </div>

      {/* Temperatura do relacionamento */}
      {school.temperatura_relacionamento && (
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] text-zinc-600">Relacionamento</p>
          <span className={cn(
            "rounded-md border px-2 py-0.5 text-[10px] font-medium",
            school.temperatura_relacionamento === "forte"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : school.temperatura_relacionamento === "bom"
              ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
              : school.temperatura_relacionamento === "frio"
              ? "border-red-500/30 bg-red-500/10 text-red-400"
              : "border-zinc-500/30 bg-zinc-500/10 text-zinc-400"
          )}>
            {school.temperatura_relacionamento.charAt(0).toUpperCase() + school.temperatura_relacionamento.slice(1)}
          </span>
        </div>
      )}

      {/* Ultimo contato */}
      {school.ultimo_contato_at && now > 0 && (() => {
        const dias = Math.floor((now - new Date(school.ultimo_contato_at!).getTime()) / (1000 * 60 * 60 * 24));
        const isAlert = dias > 90;
        return (
          <div className={cn("mb-3 flex items-center justify-between rounded-md px-2 py-1.5", isAlert && "bg-red-500/5 border border-red-500/20")}>
            <p className="text-[10px] text-zinc-600">Ultimo contato</p>
            <span className={cn("flex items-center gap-1 text-[10px] font-medium", isAlert ? "text-red-400" : "text-zinc-400")}>
              {isAlert && <AlertTriangle className="h-3 w-3" />}
              {dias}d atras
            </span>
          </div>
        );
      })()}

      {/* Deadlines */}
      {(school.deadline_fall || school.deadline_spring) && (
      <div className="mb-3 grid grid-cols-2 gap-2">
        {school.deadline_fall && (
          <div className="rounded-md border border-[#1e2130] bg-[#0c0e16] px-2.5 py-1.5">
            <p className="text-[10px] text-zinc-600 flex items-center gap-1"><Calendar className="h-2.5 w-2.5" />Fall</p>
            <p className="text-xs font-medium text-amber-400">{new Date(school.deadline_fall).toLocaleDateString("pt-BR")}</p>
          </div>
        )}
        {school.deadline_spring && (
          <div className="rounded-md border border-[#1e2130] bg-[#0c0e16] px-2.5 py-1.5">
            <p className="text-[10px] text-zinc-600 flex items-center gap-1"><Calendar className="h-2.5 w-2.5" />Spring</p>
            <p className="text-xs font-medium text-blue-400">{new Date(school.deadline_spring).toLocaleDateString("pt-BR")}</p>
          </div>
        )}
      </div>
      )}

      {/* Rolling admission + Serie maxima */}
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <span className={cn(
          "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium",
          school.rolling_admission
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            : "border-zinc-500/30 bg-zinc-500/10 text-zinc-500"
        )}>
          {school.rolling_admission && <CheckCircle className="h-2.5 w-2.5" />}
          Rolling: {school.rolling_admission ? "Sim" : "Nao"}
        </span>
        {school.serie_maxima && (
          <span className="rounded-md border border-zinc-500/30 bg-zinc-500/10 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
            Serie max: {school.serie_maxima}
          </span>
        )}
        {school.gpa_minimo != null && school.gpa_minimo > 0 && (
          <span className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-400">
            GPA min: {school.gpa_minimo.toFixed(1)}
          </span>
        )}
      </div>

      {/* Regra pratica BAUSA */}
      {school.practical_rule && (
        <div className="mb-4 rounded-md border border-indigo-500/20 bg-indigo-500/5 px-3 py-2">
          <p className="text-[10px] font-semibold text-indigo-400 mb-0.5">Regra BAUSA</p>
          <p className="text-[11px] text-zinc-400 leading-relaxed">{school.practical_rule}</p>
        </div>
      )}

      {/* Testes exigidos */}
      {school.required_tests.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {school.required_tests.map((test) => (
            <span key={test} className="rounded-md bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
              {test}
            </span>
          ))}
        </div>
      )}

      {/* Coach info */}
      {school.coach_name && (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Users className="h-3 w-3 flex-shrink-0" />
          <span>{school.coach_name}</span>
          {school.coach_email && (
            <a
              href={`mailto:${school.coach_email}`}
              onClick={(e) => e.stopPropagation()}
              className="ml-auto text-indigo-400 hover:text-indigo-300"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
