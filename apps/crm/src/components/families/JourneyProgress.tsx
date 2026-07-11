import { type FamilyJourneyStage, JOURNEY_STAGE_CONFIG } from "@/types/family";
import { orderedStages, type JourneyConfigMap } from "@/lib/fases-familia";

interface JourneyProgressProps {
  currentStage: FamilyJourneyStage;
  /** Config das fases (rótulo/ordem configurados pelo CEO). Default: estático. */
  journeyConfig?: JourneyConfigMap;
}

export function JourneyProgress({
  currentStage,
  journeyConfig = JOURNEY_STAGE_CONFIG,
}: JourneyProgressProps) {
  const STAGES_ORDER = orderedStages(journeyConfig);
  const currentIndex = STAGES_ORDER.indexOf(currentStage);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">Jornada</p>
        <p className="text-[10px] font-medium text-foreground">
          {journeyConfig[currentStage].label}
        </p>
      </div>
      <div className="flex items-center gap-0.5">
        {STAGES_ORDER.map((stage, index) => {
          const isPast = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <div
              key={stage}
              title={journeyConfig[stage].label}
              className={`flex-1 rounded-full transition-all ${
                isCurrent
                  ? "h-2 bg-primary"
                  : isPast
                  ? "h-1.5 bg-primary/40"
                  : "h-1.5 bg-secondary"
              }`}
            />
          );
        })}
      </div>
      <p className="text-[9px] text-label-tertiary">
        Etapa {currentIndex + 1} de {STAGES_ORDER.length}
      </p>
    </div>
  );
}
