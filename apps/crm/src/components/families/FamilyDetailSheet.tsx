"use client";

import { X, MessageCircle, Phone, Calendar, CheckCircle2, Circle, MapPin } from "lucide-react";
import { type Family, JOURNEY_STAGE_CONFIG } from "@/types/family";
import { getInitials, formatRelativeTime, formatDate } from "@/lib/utils";
import { RiskBadge } from "./RiskBadge";
import { EmotionalTempBadge } from "./EmotionalTempBadge";
import { JourneyProgress } from "./JourneyProgress";

const STAGES_ORDER = [
  "admissao",
  "aprovado",
  "pre_embarque",
  "embarcado_inicial",
  "acompanhamento",
  "encerrado",
] as const;

interface FamilyDetailSheetProps {
  family: Family;
  open: boolean;
  onClose: () => void;
}

export function FamilyDetailSheet({ family, open, onClose }: FamilyDetailSheetProps) {
  if (!open) return null;

  const currentIndex = STAGES_ORDER.indexOf(family.journey_stage);

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed right-0 top-0 z-50 flex h-screen w-[480px] flex-col border-l border-border bg-popover shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-plan-legacy/30 text-lg font-bold text-primary">
              {getInitials(family.athlete_name)}
            </div>
            <div>
              <p className="text-base font-bold text-foreground">{family.athlete_name}</p>
              <p className="text-sm text-muted-foreground">{family.guardian_name}</p>
              {family.address_state && (
                <div className="mt-0.5 flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-label-tertiary" />
                  <span className="text-xs text-label-tertiary">{family.address_state}</span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-border hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Indicadores rápidos */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-card p-3 text-center">
              <p className="text-[10px] text-muted-foreground">Risco</p>
              <div className="mt-1 flex justify-center">
                <RiskBadge level={family.risk_level ?? "baixo"} />
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 text-center">
              <p className="text-[10px] text-muted-foreground">Temperatura</p>
              <div className="mt-1 flex justify-center">
                <EmotionalTempBadge temperature={family.emotional_temperature ?? "bem"} />
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 text-center">
              <p className="text-[10px] text-muted-foreground">NPS</p>
              <p
                className={`mt-1 text-xl font-bold ${
                  (family.nps_score ?? null) === null
                    ? "text-muted-foreground"
                    : (family.nps_score ?? 0) >= 9
                    ? "text-sys-green"
                    : (family.nps_score ?? 0) >= 7
                    ? "text-sys-orange"
                    : "text-sys-red"
                }`}
              >
                {family.nps_score ?? "—"}
              </p>
            </div>
          </div>

          {/* Jornada */}
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-3 text-xs font-semibold text-foreground/80">Progresso da Jornada</p>
            <JourneyProgress currentStage={family.journey_stage} />

            {/* Timeline vertical */}
            <div className="mt-4 space-y-2">
              {STAGES_ORDER.map((stage, index) => {
                const isPast = index < currentIndex;
                const isCurrent = index === currentIndex;
                const stageConfig = JOURNEY_STAGE_CONFIG[stage];

                return (
                  <div key={stage} className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">
                      {isPast ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : isCurrent ? (
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        </div>
                      ) : (
                        <Circle className="h-4 w-4 text-label-quaternary" />
                      )}
                    </div>
                    <div>
                      <p
                        className={`text-xs font-medium ${
                          isCurrent
                            ? "text-primary"
                            : isPast
                            ? "text-muted-foreground"
                            : "text-label-tertiary"
                        }`}
                      >
                        {stageConfig.label}
                      </p>
                      <p className="text-[10px] text-label-tertiary">{stageConfig.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Próximo marco */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-start gap-2">
              <Calendar className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
              <div>
                <p className="text-xs font-semibold text-foreground">{family.next_milestone}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatDate(family.next_milestone_date)}
                </p>
              </div>
            </div>
          </div>

          {/* Contrato */}
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 text-xs font-semibold text-foreground/80">Informações do Contrato</p>
            <div className="space-y-1.5">
              {family.target_university && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Universidade</span>
                  <span className="font-medium text-foreground">{family.target_university}</span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Valor contratado</span>
                <span className="font-semibold text-sys-green">
                  R$ {(family.contract_value_usd ?? family.contract_value_brl).toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Início</span>
                <span className="text-foreground">{formatDate(family.contracted_at)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Último contato</span>
                <span className="text-foreground">{formatRelativeTime(family.last_contact_at)}</span>
              </div>
            </div>
          </div>

          {/* Notas do consultor */}
          {family.consultant_notes && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="mb-2 text-xs font-semibold text-foreground/80">
                Notas — {family.consultant ?? "Consultora"}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">{family.consultant_notes}</p>
            </div>
          )}
        </div>

        {/* Ações rápidas */}
        <div className="border-t border-border p-4">
          <div className="grid grid-cols-3 gap-2">
            <button className="flex items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-sys-green/30 hover:bg-sys-green/10 hover:text-sys-green">
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </button>
            <button className="flex items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-sys-blue/30 hover:bg-sys-blue/10 hover:text-sys-blue">
              <Phone className="h-3.5 w-3.5" />
              Ligar
            </button>
            <button className="flex items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary">
              <Calendar className="h-3.5 w-3.5" />
              Agendar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
