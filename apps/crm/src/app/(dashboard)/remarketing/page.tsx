import { requirePapel } from "@/lib/auth";
import { fetchRemarketingSegments } from "@/lib/remarketing-queries";
import { RemarketingClient } from "./client";

export default async function RemarketingPage() {
  await requirePapel("ceo");

  // Passa só metadados ao client — os contatos (email/telefone) ficam
  // server-side; o download é gerado pela server action exportarSegmentoCSV.
  const segments = (await fetchRemarketingSegments()).map(
    ({ leads: _leads, ...rest }) => rest,
  );

  return <RemarketingClient segments={segments} />;
}
