import { type EmotionalTemperature, EMOTIONAL_TEMP_CONFIG } from "@/types/family";

interface EmotionalTempBadgeProps {
  temperature: EmotionalTemperature;
}

export function EmotionalTempBadge({ temperature }: EmotionalTempBadgeProps) {
  const config = EMOTIONAL_TEMP_CONFIG[temperature];

  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span>{config.emoji}</span>
      <span className="text-muted-foreground">{config.label}</span>
    </span>
  );
}
