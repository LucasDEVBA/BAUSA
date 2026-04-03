"use client";

import { useState } from "react";
import { MessageCircle, Phone, Calendar, AlertCircle, MapPin } from "lucide-react";
import { type Family } from "@/types/family";
import { getInitials, formatRelativeTime } from "@/lib/utils";
import { JourneyProgress } from "./JourneyProgress";
import { RiskBadge } from "./RiskBadge";
import { EmotionalTempBadge } from "./EmotionalTempBadge";
import { FamilyDetailSheet } from "./FamilyDetailSheet";

const NPS_COLOR = (score: number | null): string => {
  if (score === null) return "text-zinc-500";
  if (score >= 9) return "text-emerald-400";
  if (score >= 7) return "text-amber-400";
  return "text-red-400";
};

interface FamilyCardProps {
  family: Family;
}

export function FamilyCard({ family }: FamilyCardProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <div
        className="group flex flex-col gap-3 rounded-xl border border-[#1e2130] bg-[#141720] p-4 transition-all hover:border-zinc-600/50 hover:shadow-lg hover:shadow-black/20 cursor-pointer"
        onClick={() => setSheetOpen(true)}
      >
        {/* Header: avatar + nome + estado */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 text-sm font-bold text-indigo-300">
            {getInitials(family.athlete_name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-100">{family.athlete_name}</p>
            <p className="truncate text-xs text-zinc-500">{family.guardian_name}</p>
            {family.address_state && (
              <div className="mt-0.5 flex items-center gap-1">
                <MapPin className="h-2.5 w-2.5 text-zinc-600" />
                <span className="text-[10px] text-zinc-600">{family.address_state}</span>
              </div>
            )}
          </div>
          {family.target_university && (
            <div className="text-right">
              <p className="text-[9px] text-zinc-600 leading-tight">{family.target_university}</p>
            </div>
          )}
        </div>

        {/* Journey progress */}
        <JourneyProgress currentStage={family.journey_stage} />

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-2">
          <RiskBadge level={family.risk_level ?? "baixo"} />
          <EmotionalTempBadge temperature={family.emotional_temperature ?? "bem"} />
          {(family.nps_score ?? null) !== null && (
            <span className="text-xs">
              <span className="text-zinc-600">NPS </span>
              <span className={`font-bold ${NPS_COLOR(family.nps_score ?? null)}`}>
                {family.nps_score}
              </span>
            </span>
          )}
        </div>

        {/* Próximo marco */}
        <div className="rounded-lg border border-[#1e2130] bg-[#0f1117] p-2.5">
          <div className="flex items-start gap-2">
            <Calendar className="mt-0.5 h-3 w-3 flex-shrink-0 text-indigo-400" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-zinc-500">Próximo marco</p>
              <p className="text-xs font-medium text-zinc-200 leading-tight">{family.next_milestone}</p>
            </div>
          </div>
        </div>

        {/* Alertas */}
        {(family.alerts ?? []).length > 0 && (
          <div className="space-y-1">
            {(family.alerts ?? []).map((alert, i) => (
              <div key={i} className="flex items-start gap-1.5 rounded-lg bg-amber-500/5 border border-amber-500/20 px-2 py-1.5">
                <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0 text-amber-400" />
                <p className="text-[10px] text-amber-300 leading-tight">{alert}</p>
              </div>
            ))}
          </div>
        )}

        {/* Footer: último contato + ações */}
        <div className="flex items-center justify-between border-t border-[#1e2130] pt-2.5">
          <p className="text-[10px] text-zinc-600">
            Último contato:{" "}
            <span className="text-zinc-400">{formatRelativeTime(family.last_contact_at)}</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); }}
              className="flex h-6 w-6 items-center justify-center rounded-md bg-white/5 text-zinc-500 transition-colors hover:bg-emerald-500/10 hover:text-emerald-400"
            >
              <MessageCircle className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); }}
              className="flex h-6 w-6 items-center justify-center rounded-md bg-white/5 text-zinc-500 transition-colors hover:bg-blue-500/10 hover:text-blue-400"
            >
              <Phone className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      <FamilyDetailSheet family={family} open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}
