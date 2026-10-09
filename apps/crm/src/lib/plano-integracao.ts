// ─────────────────────────────────────────────────────────────────────────────
// Ponto ÚNICO de integração com o grupo financeiro (T10/T11): coluna com
// "pedir o plano" → board/editor lateral abrem o PlanoEscolhidoModal
// (financeiro) ANTES de mover; cancelar não move nada.
//
// Abre SEMPRE que a coluna pede o plano — inclusive quando o deal já tem
// plano: o próprio modal decide o fluxo pelo estado do contrato (sem contrato
// → cria; aguardando plano → escolhe; com plano → "Manter" ou "Alterar" no
// lugar). É o contrato publicado pelo financeiro (§5 de financeiro.md) e o
// critério do T10 ("soltar em Plano escolhido abre Escolher plano"; "com
// contrato existente, trocar o plano usa a alteração no lugar"). Nunca há
// bloqueio: o CEO desliga "Pedir o plano ao entrar" no modal da coluna.
// ─────────────────────────────────────────────────────────────────────────────

import type { DealStageDisplayConfig } from "@/lib/etapas-deal";

export function colunaPedePlano(
  destino: Pick<DealStageDisplayConfig, "pedePlano"> | undefined,
): boolean {
  return destino?.pedePlano === true;
}
