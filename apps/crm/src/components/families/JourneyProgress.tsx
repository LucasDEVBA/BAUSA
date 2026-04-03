import { type FamilyJourneyStage, JOURNEY_STAGE_CONFIG } from "@/types/family";

const STAGES_ORDER: FamilyJourneyStage[] = [
  "admissao",
  "aprovado",
  "pre_embarque",
  "embarcado",
  "acompanhamento",
  "encerrado",
];

interface JourneyProgressProps {
  currentStage: FamilyJourneyStage;
}

export function JourneyProgress({ currentStage }: JourneyProgressProps) {
  const currentIndex = STAGES_ORDER.indexOf(currentStage);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-zinc-500">Jornada</p>
        <p className="text-[10px] font-medium text-zinc-300">
          {JOURNEY_STAGE_CONFIG[currentStage].label}
        </p>
      </div>
      <div className="flex items-center gap-0.5">
        {STAGES_ORDER.map((stage, index) => {
          const isPast = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <div
              key={stage}
              title={JOURNEY_STAGE_CONFIG[stage].label}
              className={`flex-1 rounded-full transition-all ${
                isCurrent
                  ? "h-2 bg-indigo-500"
                  : isPast
                  ? "h-1.5 bg-indigo-500/40"
                  : "h-1.5 bg-zinc-700"
              }`}
            />
          );
        })}
      </div>
      <p className="text-[9px] text-zinc-600">
        Etapa {currentIndex + 1} de {STAGES_ORDER.length}
      </p>
    </div>
  );
}
