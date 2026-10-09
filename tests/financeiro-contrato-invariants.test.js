'use strict';

// ════════════════════════════════════════════════════════════════════════
// Guard — contrato financeiro de ponta a ponta (T5/T6/T9/T10/T11/T18, 2026-10)
// ════════════════════════════════════════════════════════════════════════
//
// Invariantes (cada um nasceu de um bug real visto nos vídeos do CEO de 28/09):
//   1. Toda escrita de dinheiro é RPC fin_* com papel CEO checado no banco e
//      autor no audit (set_audit_user na MESMA transação).
//   2. Remontar cronograma valida a soma no banco (fin_validar_contrato).
//   3. Regeração só descarta parcelas EM ABERTO e por soft delete (ids novos →
//      a régua não herda marcos; histórico recebido intocado). Nada de DELETE.
//   4. Estornar o sinal de contrato SEM plano remove o registro (soft delete) —
//      voltar a "previsto" faria a régua cobrar sinal fantasma.
//   5. Confirmar sinal/entrada NUNCA puxa o deal para trás: sem
//      `etapa: "sinal_pago"` forçado; só avança se ANTES de Sinal pago no
//      board (compararOrdemBoard); colunas custom nunca se movem.
//   6. Quitar não mexe na etapa do deal.
//   7. UNIQUE(deal_id) completa preservada (embed 1:1 = objeto; incidente 05/09):
//      contrato descartado é REUTILIZADO, nunca índice parcial.
//   8. CHECKs ampliados são SUPERSET dos valores antigos (código antigo segue gravando).
//   9. Actions "use server": todo export checa papel; leituras com deleted_at.
//  10. Form de contrato: nada de componente aninhado no render nem
//      Number(e.target.value) em dinheiro (bug R$ 7,80).
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), 'utf8');

// Migrations achadas pelo SUFIXO (PLANO.md §3): o timestamp pode ser
// re-carimbado na hora do merge — `supabase db push` sem --include-all exige
// versões crescentes — e o guard não pode depender do número.
const lerMigration = (sufixo) => {
  const dir = path.join(raiz, 'supabase', 'migrations');
  const achadas = fs.readdirSync(dir).filter((n) => n.endsWith(sufixo));
  if (achadas.length !== 1) {
    throw new Error(`esperava exatamente 1 migration *${sufixo}, achei ${achadas.length}`);
  }
  return fs.readFileSync(path.join(dir, achadas[0]), 'utf8');
};

const semComentarioSql = (s) => s.replace(/--[^\n]*/g, '');
const semComentarioTs = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const migA = lerMigration('_financeiro_contrato_flexivel.sql');
const migB = semComentarioSql(lerMigration('_financeiro_rpcs.sql'));

/** Corpo de uma função plpgsql (do CREATE até o próximo CREATE/DO de topo). */
function corpoFuncao(nome) {
  const ini = migB.indexOf(`FUNCTION public.${nome}(`);
  assert.ok(ini >= 0, `função ${nome} sumiu da migration de RPCs`);
  const resto = migB.slice(ini + 10);
  const fim = resto.search(/\nCREATE OR REPLACE FUNCTION|\nDO \$\$/);
  return resto.slice(0, fim === -1 ? undefined : fim);
}

const RPCS_ESCRITA = [
  'fin_criar_contrato', 'fin_registrar_sinal', 'fin_salvar_condicoes', 'fin_baixar_parcela',
  'fin_estornar_parcela', 'fin_editar_parcela', 'fin_quitar_contrato', 'fin_descartar_contrato',
];

// Helpers que ESCREVEM também ficam expostos via PostgREST (/rpc) — authenticated
// precisa de EXECUTE porque as RPCs são SECURITY INVOKER. Cada um checa o papel.
const HELPERS_ESCRITA = [
  'fin_recalcular_entrada_paga', 'fin_confirmar_sinal_no_deal', 'fin_desconfirmar_sinal_se_vazio',
  'fin_inserir_parcelas', 'fin_descartar_abertas', 'fin_sincronizar_itens', 'fin_registrar_evento',
];

test('1. toda RPC de escrita exige CEO e grava autor no audit', () => {
  for (const nome of RPCS_ESCRITA) {
    const c = corpoFuncao(nome);
    assert.match(c, /PERFORM fin_exigir_ceo\(\)/, `${nome}: sem checagem de papel`);
    assert.match(c, /PERFORM set_audit_user\(\)/, `${nome}: audit sem autor`);
    assert.doesNotMatch(c, /SECURITY DEFINER/, `${nome}: não pode passar por cima da RLS`);
  }
  assert.match(corpoFuncao('fin_exigir_ceo'), /get_user_papel\(\) IS DISTINCT FROM 'ceo'/);
  for (const nome of HELPERS_ESCRITA) {
    assert.match(corpoFuncao(nome), /PERFORM fin_exigir_ceo\(\)/, `${nome}: helper de escrita chamável por qualquer authenticated sem checar papel`);
  }
  assert.match(migB, /REVOKE ALL ON FUNCTION public\.%s FROM PUBLIC, anon/, 'anon não pode executar RPC financeira');
});

test('2. remontar cronograma valida a soma no banco', () => {
  for (const nome of ['fin_criar_contrato', 'fin_registrar_sinal', 'fin_salvar_condicoes', 'fin_quitar_contrato']) {
    assert.match(corpoFuncao(nome), /PERFORM fin_validar_contrato\(/, `${nome}: sem validação de soma`);
  }
  const v = corpoFuncao('fin_validar_contrato');
  assert.match(v, /FIN_CRONOGRAMA_ENTRADA/);
  assert.match(v, /FIN_CRONOGRAMA_SALDO/);
  assert.match(v, /FIN_COMPOSICAO/);
});

test('3. regeração: só abertas, por soft delete; nunca DELETE de parcela', () => {
  const d = corpoFuncao('fin_descartar_abertas');
  assert.match(d, /SET deleted_at = now\(\)/);
  assert.match(d, /status IN \('previsto', 'atrasado'\)/, 'regeração não pode tocar parcela recebida/cancelada');
  for (const fonte of [migB, ler('apps', 'crm', 'src', 'lib', 'actions', 'financeiro-contrato.ts')]) {
    assert.doesNotMatch(fonte, /DELETE FROM parcelas|from\("parcelas"\)\s*\.delete\(/, 'parcela nunca é apagada de verdade');
  }
});

test('4. estorno do sinal em contrato aguardando plano = remover (não volta a previsto)', () => {
  const e = corpoFuncao('fin_estornar_parcela');
  assert.match(e, /IF c\.plano IS NULL AND p\.tipo = 'entrada' THEN\s+UPDATE parcelas SET deleted_at = now\(\)/);
  assert.match(e, /fin_desconfirmar_sinal_se_vazio/);
  assert.match(e, /char_length\(v_just\) < 5/, 'estorno exige justificativa');
});

test('5. sinal/entrada nunca puxam o deal para trás', () => {
  const sinal = ler('apps', 'crm', 'src', 'lib', 'financeiro', 'sinal-deal.ts');
  const fin = ler('apps', 'crm', 'src', 'lib', 'actions', 'financeiro.ts');
  const acoes = ler('apps', 'crm', 'src', 'lib', 'actions', 'financeiro-contrato.ts');
  for (const [nome, src] of [['sinal-deal.ts', sinal], ['financeiro.ts', fin], ['financeiro-contrato.ts', acoes]]) {
    assert.doesNotMatch(src, /etapa:\s*["']sinal_pago["']/, `${nome}: etapa forçada para sinal_pago (puxava "Valor total pago" para trás)`);
  }
  assert.match(sinal, /deveMoverParaSinalPago\(etapa, config\)/);
  // FONTE ÚNICA (T2): regra e leitura da config são as do grupo etapas — a
  // mesma que o moverDeal e o trigger usam. Nada de cópia local.
  assert.match(sinal, /import \{ deveMoverParaSinalPago \} from "@\/lib\/etapas-ordem"/, 'regra de avanço duplicada fora de @/lib/etapas-ordem');
  assert.match(sinal, /const cfg = await getConfigEtapasDeal\(\);/, 'config do board lida fora do getConfigEtapasDeal (ignoraria etapas_deal_regras)');
  assert.match(sinal, /cfg\.lida \? mergeDealStageConfig\(cfg\.overrides, cfg\.regras\) : null/);
  assert.doesNotMatch(sinal, /function deveMoverParaSinalPago|function lerStageConfigEstrito/, 'cópia local da regra voltou');
  assert.match(sinal, /if \(!config\)/, 'config ilegível → não move (fail-safe)');
  // a RPC confirma a prova de sinal mas nunca mexe na etapa
  assert.doesNotMatch(corpoFuncao('fin_confirmar_sinal_no_deal'), /etapa/);
});

test('6. quitar não mexe na etapa do deal (nem na RPC, nem na action)', () => {
  assert.doesNotMatch(corpoFuncao('fin_quitar_contrato'), /UPDATE deals/);
  const acoes = ler('apps', 'crm', 'src', 'lib', 'actions', 'financeiro-contrato.ts');
  const ini = acoes.indexOf('export async function quitarContrato(');
  const corpo = acoes.slice(ini, acoes.indexOf('\nexport ', ini + 10));
  assert.match(corpo, /aplicarEfeitosDoSinal\([^)]*moverEtapa: false/, 'quitar voltou a poder mover o deal (critério do T9)');
  const sinal = ler('apps', 'crm', 'src', 'lib', 'financeiro', 'sinal-deal.ts');
  assert.match(sinal, /if \(opcoes\.moverEtapa !== false\)/);
});

test('11. estorno: parcela vencida + régua — novo vencimento opcional zera os marcos; cancelamento cancela previsto E atrasado', () => {
  const e = corpoFuncao('fin_estornar_parcela');
  assert.match(e, /p_novo_vencimento date DEFAULT NULL/);
  for (const marco of ['dneg3', 'd0', 'd1', 'd3', 'd7', 'd15']) {
    assert.match(e, new RegExp(`regua_${marco}_at\\s*= CASE WHEN p_novo_vencimento IS NOT NULL THEN NULL`), `marco ${marco} não reinicia com vencimento novo`);
  }
  assert.match(migB, /'fin_estornar_parcela\(uuid, text, date\)'/, 'GRANT da assinatura nova do estorno');
  const fin = ler('apps', 'crm', 'src', 'lib', 'actions', 'financeiro.ts');
  const canc = fin.slice(fin.indexOf('export async function solicitarCancelamento'));
  assert.match(canc, /\.in\("status", \["previsto", "atrasado"\]\)/, 'parcela atrasada de quem cancelou continuaria na régua');
});

test('12. Regra 3 completa e irrisório checado no servidor contra o banco', () => {
  const acoes = ler('apps', 'crm', 'src', 'lib', 'actions', 'financeiro-contrato.ts');
  const ini = acoes.indexOf('export async function baixarParcela(');
  const corpo = acoes.slice(ini, acoes.indexOf('\nexport ', ini + 10));
  assert.match(corpo, /ehValorIrrisorio\(b\.valorRecebido \?\? Number\(parc\.valor\)\) && !b\.confirmarValorBaixo/,
    'irrisório da baixa confiava no valorParcela vindo do client');
  assert.ok(corpo.indexOf('ehValorIrrisorio') < corpo.indexOf('"fin_baixar_parcela"'), 'checagem tem de vir ANTES da RPC');
});

test('7. UNIQUE(deal_id) completa preservada; descartado é reutilizado', () => {
  const todas = fs.readdirSync(path.join(raiz, 'supabase', 'migrations'))
    .filter((f) => f >= '20261008') // migrations deste ciclo em diante
    .map((f) => ler('supabase', 'migrations', f)).join('\n');
  assert.doesNotMatch(todas, /DROP CONSTRAINT[^;]*contratos_financeiros_deal_id_key/);
  assert.doesNotMatch(todas, /UNIQUE INDEX[^;]*contratos_financeiros\s*\(deal_id\)\s*WHERE/);
  assert.match(corpoFuncao('fin_criar_contrato'), /created_at = now\(\), deleted_at = NULL/, 'ressurreição da linha descartada');
  assert.match(corpoFuncao('fin_registrar_sinal'), /created_at = now\(\), deleted_at = NULL/);
});

test('8. CHECKs ampliados são superset dos antigos', () => {
  assert.match(migA, /entrada_forma IN \('pix','getnet_parcelado',/);
  assert.match(migA, /saldo_forma IN \('pix_avista',[^)]*'getnet_parcelado'/);
  assert.match(migA, /metodo IN \('pix','getnet',/);
  assert.match(migA, /CHECK \(valor >= 0\)/, 'parcela de entrada 0 do código antigo não pode quebrar');
  assert.match(migA, /valor_total >= entrada_valor/);
});

test('9. actions: todo export checa papel; leituras filtram deleted_at', () => {
  const acoes = ler('apps', 'crm', 'src', 'lib', 'actions', 'financeiro-contrato.ts');
  assert.match(acoes, /^"use server";/);
  const exports = [...acoes.matchAll(/export async function (\w+)\(/g)].map((m) => m[1]);
  assert.ok(exports.length >= 10, 'actions sumiram');
  for (const nome of exports) {
    const ini = acoes.indexOf(`export async function ${nome}(`);
    const prox = acoes.indexOf('\nexport ', ini + 10);
    const corpo = acoes.slice(ini, prox === -1 ? undefined : prox);
    assert.match(corpo, /getUserPapel\(\)\) !== "ceo"/, `${nome}: endpoint sem checagem de papel`);
  }
  assert.doesNotMatch(acoes, /^export (const|let|function [^a])/m, 'arquivo "use server" só exporta funções async');
  // Cada SELECT nas tabelas com soft delete precisa do filtro (a policy ALL do
  // CEO enxerga linhas excluídas). Recorta cada consulta até o fim da expressão.
  let leituras = 0;
  for (const bloco of acoes.split(/(?=\.from\(")/).slice(1)) {
    if (!/^\.from\("(contratos_financeiros|parcelas|contrato_itens|despesas)"\)\s*\.select\(/.test(bloco)) continue;
    const corte = bloco.search(/;|,\s*\n\s*supabase\.|\]\);/);
    const consulta = bloco.slice(0, corte === -1 ? undefined : corte);
    leituras++;
    assert.match(consulta, /\.is\("deleted_at", null\)/, `leitura sem deleted_at: ${consulta.slice(0, 90)}…`);
  }
  assert.ok(leituras >= 4, 'leituras financeiras não encontradas — guard desatualizado?');
});

test('10. formulário de contrato: sem componente aninhado e sem Number(e.target.value) em dinheiro', () => {
  const tab = semComentarioTs(ler('apps', 'crm', 'src', 'components', 'pipeline', 'DealContratoTab.tsx'));
  assert.doesNotMatch(tab, /function CreateContratoForm/, 'form declarado dentro do render remonta a cada tecla');
  assert.doesNotMatch(tab, /Number\(e\.target\.value\)/, 'type=number em dinheiro gravou R$ 7,80');
  const money = semComentarioTs(ler('apps', 'crm', 'src', 'components', 'ui', 'MoneyInput.tsx'));
  assert.match(money, /inputMode="decimal"/);
  assert.match(money, /parseValorBRL/);
  assert.doesNotMatch(money, /type="number"/);
});
