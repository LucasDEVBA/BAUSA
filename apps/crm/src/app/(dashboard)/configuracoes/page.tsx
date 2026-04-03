import { requirePapel } from "@/lib/auth";
import { getConfiguracoes } from "@/lib/actions/configuracoes";
import { ConfiguracoesClient } from "./ConfiguracoesClient";

export default async function ConfiguracoesPage() {
  await requirePapel("ceo");

  const configs = await getConfiguracoes();

  return <ConfiguracoesClient configsIniciais={configs} />;
}
