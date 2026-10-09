import { getStageConfigDeal } from "@/lib/actions/configuracoes";
import { requirePapel } from "@/lib/auth";
import { fetchRemarketingData } from "@/lib/remarketing-queries";
import { RemarketingClient } from "./client";

export default async function RemarketingPage() {
  await requirePapel("ceo");

  // Os leads passados ao client são ANÔNIMOS (idade/esporte/classe/etapa/score
  // — sem nome/email/telefone). O export reconstrói o PII server-side.
  // stageConfig = a MESMA config de colunas do board (o detalhe do lead abre
  // o editor do deal: Avançar/Retroceder só por colunas visíveis).
  const [data, stageConfig] = await Promise.all([fetchRemarketingData(), getStageConfigDeal()]);

  return <RemarketingClient data={data} stageConfig={stageConfig} />;
}
