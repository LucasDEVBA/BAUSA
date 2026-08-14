import { requirePapel } from "@/lib/auth";
import { getConfiguracoes } from "@/lib/actions/configuracoes";
import { getParametrosSistema } from "@/lib/actions/parametros";
import { getConfigNotificacoes } from "@/lib/actions/notificacoes-canais";
import { ConfiguracoesClient } from "./ConfiguracoesClient";

export default async function ConfiguracoesPage() {
  await requirePapel("ceo");

  const [configs, parametros, notificacoes] = await Promise.all([
    getConfiguracoes(),
    getParametrosSistema(),
    getConfigNotificacoes(),
  ]);

  return <ConfiguracoesClient configsIniciais={configs} parametros={parametros}
      notificacoes={notificacoes} />;
}
