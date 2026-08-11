import { requirePapel } from "@/lib/auth";
import { getConfiguracoes } from "@/lib/actions/configuracoes";
import { getParametrosSistema } from "@/lib/actions/parametros";
import { ConfiguracoesClient } from "./ConfiguracoesClient";

export default async function ConfiguracoesPage() {
  await requirePapel("ceo");

  const [configs, parametros] = await Promise.all([
    getConfiguracoes(),
    getParametrosSistema(),
  ]);

  return <ConfiguracoesClient configsIniciais={configs} parametros={parametros} />;
}
