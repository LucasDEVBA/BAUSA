import { AlertTriangle } from "lucide-react";
import { type RiskLevel } from "@/types/family";

const RISK_STYLES: Record<RiskLevel, { wrapper: string; dot: string; label: string }> = {
  baixo: {
    wrapper: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    dot: "bg-emerald-400",
    label: "Baixo",
  },
  medio: {
    wrapper: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    dot: "bg-amber-400",
    label: "Médio",
  },
  alto: {
    wrapper: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
    dot: "bg-orange-400",
    label: "Alto",
  },
  critico: {
    wrapper: "bg-red-500/10 text-red-400 border border-red-500/20",
    dot: "bg-red-400",
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
