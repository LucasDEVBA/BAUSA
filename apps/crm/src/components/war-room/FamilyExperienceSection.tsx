import { Users, AlertTriangle, Star, Flame, Heart } from "lucide-react";
import { type FamilyExperienceMetrics } from "@/types/revenue";

interface ExperienceChipProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  sublabel?: string;
  variant: "default" | "danger" | "success" | "warning" | "purple";
}

const VARIANT_STYLES = {
  default: { card: "border-border bg-card", icon: "bg-secondary text-muted-foreground", value: "text-foreground" },
  danger: { card: "border-sys-red/20 bg-sys-red/5", icon: "bg-sys-red/10 text-sys-red", value: "text-sys-red" },
  success: { card: "border-sys-green/20 bg-sys-green/5", icon: "bg-sys-green/10 text-sys-green", value: "text-sys-green" },
  warning: { card: "border-sys-orange/20 bg-sys-orange/5", icon: "bg-sys-orange/10 text-sys-orange", value: "text-sys-orange" },
  purple: { card: "border-plan-legacy/20 bg-plan-legacy/5", icon: "bg-plan-legacy/10 text-plan-legacy", value: "text-plan-legacy" },
};

function ExperienceChip({ icon: Icon, label, value, sublabel, variant }: ExperienceChipProps) {
  const styles = VARIANT_STYLES[variant];
  return (
    <div className={`flex flex-col gap-2.5 rounded-xl border p-4 ${styles.card}`}>
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${styles.icon}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div>
        <p className={`text-2xl font-bold tabular-nums ${styles.value}`}>{value}</p>
        <p className="text-xs text-muted-foreground leading-tight">{label}</p>
        {sublabel && <p className="mt-0.5 text-[10px] text-label-tertiary">{sublabel}</p>}
      </div>
    </div>
  );
}

interface FamilyExperienceSectionProps {
  data: FamilyExperienceMetrics;
}

export function FamilyExperienceSection({ data }: FamilyExperienceSectionProps) {
  return (
    <div className="grid grid-cols-5 gap-4">
      <ExperienceChip
        icon={Users}
        label="Famílias Ativas"
        value={data.active_families}
        sublabel="Pós-contrato em jornada"
        variant="default"
      />
      <ExperienceChip
        icon={AlertTriangle}
        label="Famílias em Risco"
        value={data.at_risk_families}
        sublabel="Precisam de atenção imediata"
        variant={data.at_risk_families > 0 ? "danger" : "success"}
      />
      <ExperienceChip
        icon={Star}
        label="Famílias Satisfeitas"
        value={data.satisfied_families}
        sublabel="NPS ≥ 9 (Promotoras)"
        variant="success"
      />
      <ExperienceChip
        icon={Flame}
        label="Crises Abertas"
        value={data.open_crises}
        sublabel="Protocolo de crise ativo"
        variant={data.open_crises > 0 ? "danger" : "default"}
      />
      <ExperienceChip
        icon={Heart}
        label="Potencial de Indicação"
        value={data.referral_potential}
        sublabel="Promotoras sem indicação"
        variant="purple"
      />
    </div>
  );
}
