import { requirePapel } from "@/lib/auth";
import { fetchFamilyExperience, fetchFamiliesFromExperiencia } from "@/lib/war-room-queries";
import { FamilyExperienceSection } from "@/components/war-room/FamilyExperienceSection";
import { FamilyRiskDonut } from "@/components/war-room/FamilyRiskDonut";
import { FamilyStageChart } from "@/components/war-room/FamilyStageChart";

export default async function WarRoomFamiliasPage() {
  await requirePapel("ceo");

  const [familyExperience, families] = await Promise.all([
    fetchFamilyExperience(),
    fetchFamiliesFromExperiencia(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-title-2 text-foreground">Experiencia das Familias</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Familias ativas, saude da jornada, NPS e potencial de indicacao.
        </p>
      </div>

      <FamilyExperienceSection data={familyExperience} />

      <div className="grid grid-cols-2 gap-4">
        <FamilyRiskDonut families={families} />
        <FamilyStageChart families={families} />
      </div>
    </div>
  );
}
