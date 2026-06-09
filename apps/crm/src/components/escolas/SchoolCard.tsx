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
      className="glass-card cursor-pointer rounded-xl p-5 transition-all hover:border-primary/30 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
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
          <h3 className="text-sm font-semibold text-foreground leading-tight">{school.name}</h3>
          <p className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {school.city}, {school.state}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-label-tertiary">Match medio</p>
          <p className="text-xl font-bold text-sys-green">{school.avg_scholarship_pct}%</p>
          <p className="text-[10px] text-label-tertiary">bolsa media</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-secondary px-3 py-2 text-center">
          <p className="text-lg font-bold text-foreground">{acceptanceRate}%</p>
          <p className="text-[10px] text-muted-foreground">Taxa aceite</p>
        </div>
        <div className="rounded-lg bg-secondary px-3 py-2 text-center">
          <p className="text-lg font-bold text-foreground">{school.total_applications}</p>
          <p className="text-[10px] text-muted-foreground">Aplicacoes</p>
        </div>
        <div className="rounded-lg bg-secondary px-3 py-2 text-center">
          <p className="text-lg font-bold text-foreground">{school.avg_response_days}d</p>
          <p className="text-[10px] text-muted-foreground">Resp. media</p>
        </div>
      </div>

      {/* Regras financeiras */}
      <div className="mb-3 space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Budget exigido</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-md border border-border bg-secondary px-2.5 py-1.5">
            <p className="text-[10px] text-label-tertiary">Minimo</p>
            <p className="text-xs font-semibold text-sys-orange">US$ {(school.min_budget_usd / 1000).toFixed(0)}k</p>
          </div>
          <div className="flex-1 rounded-md border border-border bg-secondary px-2.5 py-1.5">
            <p className="text-[10px] text-label-tertiary">Forte</p>
            <p className="text-xs font-semibold text-sys-green">US$ {(school.strong_budget_usd / 1000).toFixed(0)}k</p>
          </div>
        </div>
      </div>

      {/* Agressividade de bolsa */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] text-label-tertiary">Agressividade bolsa</p>
        <span className={cn(
          "rounded-md border px-2 py-0.5 text-[10px] font-medium",
          school.scholarship_aggressiveness === "agressiva"
            ? "border-sys-green/30 bg-sys-green/10 text-sys-green"
            : school.scholarship_aggressiveness === "moderada"
            ? "border-sys-orange/30 bg-sys-orange/10 text-sys-orange"
            : "border-border bg-secondary text-muted-foreground"
        )}>
          {school.scholarship_aggressiveness.charAt(0).toUpperCase() + school.scholarship_aggressiveness.slice(1)}
        </span>
      </div>

      {/* Influencia esportiva */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[10px] text-label-tertiary">Influencia esportiva</p>
        <span className={cn(
          "rounded-md border px-2 py-0.5 text-[10px] font-medium",
          school.sport_influence === "decisiva"
            ? "border-plan-legacy/30 bg-plan-legacy/10 text-plan-legacy"
            : school.sport_influence === "alta"
            ? "border-primary/30 bg-primary/10 text-primary"
            : school.sport_influence === "media"
            ? "border-sys-orange/30 bg-sys-orange/10 text-sys-orange"
            : "border-border bg-secondary text-muted-foreground"
        )}>
          {school.sport_influence.charAt(0).toUpperCase() + school.sport_influence.slice(1)}
        </span>
      </div>

      {/* Temperatura do relacionamento */}
      {school.temperatura_relacionamento && (
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] text-label-tertiary">Relacionamento</p>
          <span className={cn(
            "rounded-md border px-2 py-0.5 text-[10px] font-medium",
            school.temperatura_relacionamento === "forte"
              ? "border-sys-green/30 bg-sys-green/10 text-sys-green"
              : school.temperatura_relacionamento === "bom"
              ? "border-primary/30 bg-primary/10 text-primary"
              : school.temperatura_relacionamento === "frio"
              ? "border-sys-red/30 bg-sys-red/10 text-sys-red"
              : "border-border bg-secondary text-muted-foreground"
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
          <div className={cn("mb-3 flex items-center justify-between rounded-md px-2 py-1.5", isAlert && "bg-sys-red/5 border border-sys-red/20")}>
            <p className="text-[10px] text-label-tertiary">Ultimo contato</p>
            <span className={cn("flex items-center gap-1 text-[10px] font-medium", isAlert ? "text-sys-red" : "text-muted-foreground")}>
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
          <div className="rounded-md border border-border bg-secondary px-2.5 py-1.5">
            <p className="text-[10px] text-label-tertiary flex items-center gap-1"><Calendar className="h-2.5 w-2.5" />Fall</p>
            <p className="text-xs font-medium text-sys-orange">{new Date(school.deadline_fall).toLocaleDateString("pt-BR")}</p>
          </div>
        )}
        {school.deadline_spring && (
          <div className="rounded-md border border-border bg-secondary px-2.5 py-1.5">
            <p className="text-[10px] text-label-tertiary flex items-center gap-1"><Calendar className="h-2.5 w-2.5" />Spring</p>
            <p className="text-xs font-medium text-sys-blue">{new Date(school.deadline_spring).toLocaleDateString("pt-BR")}</p>
          </div>
        )}
      </div>
      )}

      {/* Rolling admission + Serie maxima */}
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <span className={cn(
          "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium",
          school.rolling_admission
            ? "border-sys-green/30 bg-sys-green/10 text-sys-green"
            : "border-border bg-secondary text-muted-foreground"
        )}>
          {school.rolling_admission && <CheckCircle className="h-2.5 w-2.5" />}
          Rolling: {school.rolling_admission ? "Sim" : "Nao"}
        </span>
        {school.serie_maxima && (
          <span className="rounded-md border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            Serie max: {school.serie_maxima}
          </span>
        )}
        {school.gpa_minimo != null && school.gpa_minimo > 0 && (
          <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            GPA min: {school.gpa_minimo.toFixed(1)}
          </span>
        )}
      </div>

      {/* Regra pratica BAUSA */}
      {school.practical_rule && (
        <div className="mb-4 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
          <p className="text-[10px] font-semibold text-primary mb-0.5">Regra BAUSA</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{school.practical_rule}</p>
        </div>
      )}

      {/* Testes exigidos */}
      {school.required_tests.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {school.required_tests.map((test) => (
            <span key={test} className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {test}
            </span>
          ))}
        </div>
      )}

      {/* Coach info */}
      {school.coach_name && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-3 w-3 flex-shrink-0" />
          <span>{school.coach_name}</span>
          {school.coach_email && (
            <a
              href={`mailto:${school.coach_email}`}
              onClick={(e) => e.stopPropagation()}
              className="ml-auto text-primary hover:text-primary/80"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
