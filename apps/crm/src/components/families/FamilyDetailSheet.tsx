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
  "embarcado",
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
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed right-0 top-0 z-50 flex h-screen w-[480px] flex-col border-l border-[#1e2130] bg-[#0f1117] shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#1e2130] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 text-lg font-bold text-indigo-300">
              {getInitials(family.athlete_name)}
            </div>
            <div>
              <p className="text-base font-bold text-zinc-100">{family.athlete_name}</p>
              <p className="text-sm text-zinc-500">{family.guardian_name}</p>
              {family.address_state && (
                <div className="mt-0.5 flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-zinc-600" />
                  <span className="text-xs text-zinc-600">{family.address_state}</span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#1e2130] text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Indicadores rápidos */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-[#1e2130] bg-[#141720] p-3 text-center">
              <p className="text-[10px] text-zinc-500">Risco</p>
              <div className="mt-1 flex justify-center">
                <RiskBadge level={family.risk_level ?? "baixo"} />
              </div>
            </div>
            <div className="rounded-lg border border-[#1e2130] bg-[#141720] p-3 text-center">
              <p className="text-[10px] text-zinc-500">Temperatura</p>
              <div className="mt-1 flex justify-center">
                <EmotionalTempBadge temperature={family.emotional_temperature ?? "bem"} />
              </div>
            </div>
            <div className="rounded-lg border border-[#1e2130] bg-[#141720] p-3 text-center">
              <p className="text-[10px] text-zinc-500">NPS</p>
              <p
                className={`mt-1 text-xl font-bold ${
                  (family.nps_score ?? null) === null
                    ? "text-zinc-500"
                    : (family.nps_score ?? 0) >= 9
                    ? "text-emerald-400"
                    : (family.nps_score ?? 0) >= 7
                    ? "text-amber-400"
                    : "text-red-400"
                }`}
              >
                {family.nps_score ?? "—"}
              </p>
            </div>
          </div>

          {/* Jornada */}
          <div className="rounded-lg border border-[#1e2130] bg-[#141720] p-4">
            <p className="mb-3 text-xs font-semibold text-zinc-300">Progresso da Jornada</p>
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
                        <CheckCircle2 className="h-4 w-4 text-indigo-400" />
                      ) : isCurrent ? (
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        </div>
                      ) : (
                        <Circle className="h-4 w-4 text-zinc-700" />
                      )}
                    </div>
                    <div>
                      <p
                        className={`text-xs font-medium ${
                          isCurrent
                            ? "text-indigo-400"
                            : isPast
                            ? "text-zinc-400"
                            : "text-zinc-600"
                        }`}
                      >
                        {stageConfig.label}
                      </p>
                      <p className="text-[10px] text-zinc-600">{stageConfig.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Próximo marco */}
          <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4">
            <div className="flex items-start gap-2">
              <Calendar className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-400" />
              <div>
                <p className="text-xs font-semibold text-zinc-200">{family.next_milestone}</p>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  {formatDate(family.next_milestone_date)}
                </p>
              </div>
            </div>
          </div>

          {/* Contrato */}
          <div className="rounded-lg border border-[#1e2130] bg-[#141720] p-4">
            <p className="mb-2 text-xs font-semibold text-zinc-300">Informações do Contrato</p>
            <div className="space-y-1.5">
              {family.target_university && (
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Universidade</span>
                  <span className="font-medium text-zinc-200">{family.target_university}</span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Valor contratado</span>
                <span className="font-semibold text-emerald-400">
                  R$ {(family.contract_value_usd ?? family.contract_value_brl).toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Início</span>
                <span className="text-zinc-200">{formatDate(family.contracted_at)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Último contato</span>
                <span className="text-zinc-200">{formatRelativeTime(family.last_contact_at)}</span>
              </div>
            </div>
          </div>

          {/* Notas do consultor */}
          {family.consultant_notes && (
            <div className="rounded-lg border border-[#1e2130] bg-[#141720] p-4">
              <p className="mb-2 text-xs font-semibold text-zinc-300">
                Notas — {family.consultant ?? "Consultora"}
              </p>
              <p className="text-xs text-zinc-400 leading-relaxed">{family.consultant_notes}</p>
            </div>
          )}
        </div>

        {/* Ações rápidas */}
        <div className="border-t border-[#1e2130] p-4">
          <div className="grid grid-cols-3 gap-2">
            <button className="flex items-center justify-center gap-2 rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-2.5 text-xs font-medium text-zinc-300 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-400">
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </button>
            <button className="flex items-center justify-center gap-2 rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-2.5 text-xs font-medium text-zinc-300 transition-colors hover:border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-400">
              <Phone className="h-3.5 w-3.5" />
              Ligar
            </button>
            <button className="flex items-center justify-center gap-2 rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-2.5 text-xs font-medium text-zinc-300 transition-colors hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-400">
              <Calendar className="h-3.5 w-3.5" />
              Agendar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
