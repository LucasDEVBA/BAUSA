import { requirePapel } from "@/lib/auth";
import { fetchRemarketingData } from "@/lib/remarketing-queries";
import { RemarketingClient } from "./client";

export default async function RemarketingPage() {
  await requirePapel("ceo");

  // Os leads passados ao client são ANÔNIMOS (idade/esporte/classe/etapa/score
  // — sem nome/email/telefone). O export reconstrói o PII server-side.
  const data = await fetchRemarketingData();

  return <RemarketingClient data={data} />;
}
