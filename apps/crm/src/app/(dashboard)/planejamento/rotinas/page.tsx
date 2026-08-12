import { requirePapel } from "@/lib/auth";
import { getPlanejamento, getRotinas } from "@/lib/actions/planejamento";

import { RotinasClient } from "./client";

export const metadata = { title: "Rotinas · Planejamento" };

export default async function RotinasPage() {
  const papel = await requirePapel(["ceo", "head_sucesso"]);
  const [plano, { rotinas, execucoes }] = await Promise.all([getPlanejamento(), getRotinas()]);

  return (
    <RotinasClient
      rotinas={rotinas}
      execucoes={execucoes}
      pessoas={plano.pessoas}
      podeEditar={papel === "ceo"}
    />
  );
}
