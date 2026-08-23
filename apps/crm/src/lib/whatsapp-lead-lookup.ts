/**
 * De-para telefone → nome do lead/responsável, para nomear conversas do
 * espelho WhatsApp quando o contato não tem nome salvo no aparelho.
 *
 * Casamento por SUFIXO de 8 dígitos (número local sem DDI/DDD e sem o 9º
 * dígito de celular, que varia entre a Z-API e o cadastro). Módulo puro —
 * as queries ficam na API route; aqui só a lógica testável.
 */

const SUBSCRIBER_LEN = 8;

export interface AtletaLookupRow {
  nome_completo: string | null;
  whatsapp: string | null;
  responsavel_id: string | null;
}
export interface ResponsavelLookupRow {
  id: string;
  nome: string | null;
  whatsapp: string | null;
}

/**
 * Chave de casamento BR-tolerante: remove o DDI 55 (quando presente) e monta
 * `DDD + últimos 8 do assinante` (o 9º dígito de celular varia entre a Z-API e
 * o cadastro). Chave de 10 dígitos inclui o DDD → colisão muito menor que só
 * os últimos 8. Retorna "" para números sem DDD (< 10 dígitos), que NÃO casam
 * (melhor não nomear do que nomear errado). Números não-BR viram uma chave
 * determinística própria (mesmo número → mesma chave nos dois lados).
 */
export function phoneKey(input: string | null | undefined): string {
  let digits = String(input ?? "").replace(/\D/g, "");
  // DDI 55: só quando o número nacional (10-11 díg.) fica com 12-13 díg. — não
  // confunde com o DDD 55 (RS), cujo nacional tem no máx. 11 dígitos.
  if (digits.length >= 12 && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length < 10) return "";
  const ddd = digits.slice(0, 2);
  const subscriber = digits.slice(2);
  return ddd + subscriber.slice(-SUBSCRIBER_LEN);
}

/**
 * Padrão de exibição do contato do RESPONSÁVEL (pedido do CEO, 2026-08-23):
 * "Débora Gama Telles - Resp - Gustavo Telles Bastos". Sem o nome do
 * responsável no cadastro, degrada para "Resp - <atleta>" — o vínculo com o
 * atleta é a informação que importa.
 */
export function nomeContatoResponsavel(
  respNome: string | null | undefined,
  atletaNome: string,
): string {
  const nome = respNome?.trim();
  return nome ? `${nome} - Resp - ${atletaNome}` : `Resp - ${atletaNome}`;
}

/**
 * Monta o mapa sufixo→nome: o número do ATLETA resolve para o nome do atleta;
 * o número do RESPONSÁVEL vinculado resolve para o padrão
 * "<responsável> - Resp - <atleta>" (nomeContatoResponsavel). Responsáveis sem
 * atleta vinculado caem no próprio nome. Família com o MESMO número para os
 * dois fica só com o nome do atleta (rotular "X - Resp - X" seria ruído).
 */
export function construirMapaNomes(
  atletas: AtletaLookupRow[],
  responsaveis: ResponsavelLookupRow[],
): Map<string, string> {
  const respById = new Map(responsaveis.map((r) => [r.id, r]));
  const mapa = new Map<string, string>();

  // 1. Responsáveis (fallback): nome do responsável no seu próprio número.
  for (const r of responsaveis) {
    const suf = phoneKey(r.whatsapp);
    const nome = r.nome?.trim();
    if (suf && nome && !mapa.has(suf)) mapa.set(suf, nome);
  }

  // 2. Atletas (prioridade): número do atleta = nome do atleta; número do
  //    responsável vinculado = padrão "<resp> - Resp - <atleta>".
  for (const a of atletas) {
    const nome = a.nome_completo?.trim();
    if (!nome) continue;
    const sufAtleta = phoneKey(a.whatsapp);
    if (sufAtleta) mapa.set(sufAtleta, nome);
    const resp = a.responsavel_id ? respById.get(a.responsavel_id) : null;
    const sufResp = phoneKey(resp?.whatsapp);
    if (sufResp && sufResp !== sufAtleta) {
      mapa.set(sufResp, nomeContatoResponsavel(resp?.nome, nome));
    }
  }

  return mapa;
}

/** Resolve o nome de um telefone de conversa; null se não houver match. */
export function resolverNomeLead(
  mapa: Map<string, string>,
  chatPhone: string,
): string | null {
  const suf = phoneKey(chatPhone);
  return suf ? (mapa.get(suf) ?? null) : null;
}
