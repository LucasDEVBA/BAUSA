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
  default: { card: "border-[#1e2130] bg-[#141720]", icon: "bg-zinc-800 text-zinc-400", value: "text-zinc-100" },
  danger: { card: "border-red-500/20 bg-red-500/5", icon: "bg-red-500/10 text-red-400", value: "text-red-400" },
  success: { card: "border-emerald-500/20 bg-emerald-500/5", icon: "bg-emerald-500/10 text-emerald-400", value: "text-emerald-400" },
  warning: { card: "border-amber-500/20 bg-amber-500/5", icon: "bg-amber-500/10 text-amber-400", value: "text-amber-400" },
  purple: { card: "border-purple-500/20 bg-purple-500/5", icon: "bg-purple-500/10 text-purple-400", value: "text-purple-400" },
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
        <p className="text-xs text-zinc-400 leading-tight">{label}</p>
        {sublabel && <p className="mt-0.5 text-[10px] text-zinc-600">{sublabel}</p>}
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
