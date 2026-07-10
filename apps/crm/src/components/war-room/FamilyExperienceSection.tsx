import { Users, AlertTriangle, Star, Flame, Heart } from "lucide-react";
import { StatCard } from "@/components/ui";
import { type FamilyExperienceMetrics } from "@/types/revenue";

interface FamilyExperienceSectionProps {
  data: FamilyExperienceMetrics;
}

export function FamilyExperienceSection({ data }: FamilyExperienceSectionProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <StatCard
        label="Famílias ativas"
        value={data.active_families}
        context="pós-contrato em jornada"
        icon={Users}
        accent="brand"
      />
      <StatCard
        label="Famílias em risco"
        value={data.at_risk_families}
        context="atenção imediata"
        icon={AlertTriangle}
        accent={data.at_risk_families > 0 ? "red" : "green"}
      />
      <StatCard
        label="Famílias satisfeitas"
        value={data.satisfied_families}
        context="NPS ≥ 9 (promotoras)"
        icon={Star}
        accent="green"
      />
      <StatCard
        label="Crises abertas"
        value={data.open_crises}
        context="protocolo de crise ativo"
        icon={Flame}
        accent={data.open_crises > 0 ? "red" : "brand"}
      />
      <StatCard
        label="Potencial de indicação"
        value={data.referral_potential}
        context="promotoras sem indicação"
        icon={Heart}
        accent="purple"
      />
    </div>
  );
}
