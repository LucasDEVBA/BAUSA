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
  if (score === null) return "text-muted-foreground";
  if (score >= 9) return "text-sys-green";
  if (score >= 7) return "text-sys-orange";
  return "text-sys-red";
};

interface FamilyCardProps {
  family: Family;
}

export function FamilyCard({ family }: FamilyCardProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <div
        className="group flex flex-col gap-3 rounded-xl p-4 transition-all hover:shadow-md cursor-pointer glass-card"
        onClick={() => setSheetOpen(true)}
      >
        {/* Header: avatar + nome + estado */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-plan-legacy/30 text-sm font-bold text-primary">
            {getInitials(family.athlete_name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{family.athlete_name}</p>
            <p className="truncate text-xs text-muted-foreground">{family.guardian_name}</p>
            {family.address_state && (
              <div className="mt-0.5 flex items-center gap-1">
                <MapPin className="h-2.5 w-2.5 text-label-tertiary" />
                <span className="text-[10px] text-label-tertiary">{family.address_state}</span>
              </div>
            )}
          </div>
          {family.target_university && (
            <div className="text-right">
              <p className="text-[9px] text-label-tertiary leading-tight">{family.target_university}</p>
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
              <span className="text-label-tertiary">NPS </span>
              <span className={`font-bold ${NPS_COLOR(family.nps_score ?? null)}`}>
                {family.nps_score}
              </span>
            </span>
          )}
        </div>

        {/* Próximo marco */}
        <div className="rounded-xl border border-border bg-popover p-2.5">
          <div className="flex items-start gap-2">
            <Calendar className="mt-0.5 h-3 w-3 flex-shrink-0 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground">Próximo marco</p>
              <p className="text-xs font-medium text-foreground leading-tight">{family.next_milestone}</p>
            </div>
          </div>
        </div>

        {/* Alertas */}
        {(family.alerts ?? []).length > 0 && (
          <div className="space-y-1">
            {(family.alerts ?? []).map((alert, i) => (
              <div key={i} className="flex items-start gap-1.5 rounded-xl bg-sys-orange/5 border border-sys-orange/20 px-2 py-1.5">
                <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0 text-sys-orange" />
                <p className="text-[10px] text-sys-orange leading-tight">{alert}</p>
              </div>
            ))}
          </div>
        )}

        {/* Footer: último contato + ações */}
        <div className="flex items-center justify-between border-t border-border pt-2.5">
          <p className="text-[10px] text-label-tertiary">
            Último contato:{" "}
            <span className="text-muted-foreground">{formatRelativeTime(family.last_contact_at)}</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); }}
              className="flex h-6 w-6 items-center justify-center rounded-md bg-fill-4 text-muted-foreground transition-colors hover:bg-sys-green/10 hover:text-sys-green"
            >
              <MessageCircle className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); }}
              className="flex h-6 w-6 items-center justify-center rounded-md bg-fill-4 text-muted-foreground transition-colors hover:bg-sys-blue/10 hover:text-sys-blue"
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
