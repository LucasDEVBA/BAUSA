import { AlertTriangle } from "lucide-react";
import { type RiskLevel } from "@/types/family";

const RISK_STYLES: Record<RiskLevel, { wrapper: string; dot: string; label: string }> = {
  baixo: {
    wrapper: "bg-sys-green/15 text-sys-green border border-sys-green/20",
    dot: "bg-sys-green",
    label: "Baixo",
  },
  medio: {
    wrapper: "bg-sys-yellow/15 text-sys-yellow border border-sys-yellow/20",
    dot: "bg-sys-yellow",
    label: "Médio",
  },
  alto: {
    wrapper: "bg-sys-orange/15 text-sys-orange border border-sys-orange/20",
    dot: "bg-sys-orange",
    label: "Alto",
  },
  critico: {
    wrapper: "bg-sys-red/15 text-sys-red border border-sys-red/20",
    dot: "bg-sys-red",
    label: "Crítico",
  },
};

interface RiskBadgeProps {
  level: RiskLevel;
}

export function RiskBadge({ level }: RiskBadgeProps) {
  const styles = RISK_STYLES[level];
  const showWarning = level === "alto" || level === "critico";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${styles.wrapper}`}
    >
      {showWarning ? (
        <AlertTriangle className="h-2.5 w-2.5" />
      ) : (
        <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
      )}
      {styles.label}
    </span>
  );
}
