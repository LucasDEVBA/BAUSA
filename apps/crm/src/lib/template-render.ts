/**
 * Renderização de templates de mensagem.
 * Função PURA (sem "use server") para poder ser chamada em Client Components.
 *
 * Variáveis suportadas:
 *   {atleta_primeiro_nome}
 *   {atleta_nome}
 *   {responsavel_primeiro_nome}
 *   {responsavel_nome}
 *   {plano}
 *   {esporte}
 *   {data_embarque}
 *   {dias_sem_contato}
 */

export interface TemplateVars {
  atleta_nome?: string | null;
  responsavel_nome?: string | null;
  plano?: string | null;
  esporte?: string | null;
  data_embarque?: string | null;
  dias_sem_contato?: number | null;
}

export function renderTemplate(template: string, vars: TemplateVars): string {
  const atletaNome = vars.atleta_nome ?? "atleta";
  const responsavelNome = vars.responsavel_nome ?? "responsável";
  const dataEmbarque = vars.data_embarque
    ? new Date(vars.data_embarque).toLocaleDateString("pt-BR")
    : "—";

  return template
    .replace(/\{atleta_primeiro_nome\}/g, atletaNome.split(" ")[0])
    .replace(/\{atleta_nome\}/g, atletaNome)
    .replace(/\{responsavel_primeiro_nome\}/g, responsavelNome.split(" ")[0])
    .replace(/\{responsavel_nome\}/g, responsavelNome)
    .replace(/\{plano\}/g, vars.plano ?? "—")
    .replace(/\{esporte\}/g, vars.esporte ?? "—")
    .replace(/\{data_embarque\}/g, dataEmbarque)
    .replace(/\{dias_sem_contato\}/g, String(vars.dias_sem_contato ?? 0));
}
