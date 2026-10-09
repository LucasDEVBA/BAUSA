'use strict';

// Guard — Contratos totalmente customizáveis (ordem do CEO, 2026-09-10).
// ATUALIZADO 2026-10 (T6/T9/T10): a criação/edição saiu de financeiro.ts
// (criarContrato, N requests sem transação) para as RPCs fin_* + schemas.ts.
// As MESMAS regras continuam travadas, agora onde elas vivem:
//
//   1. Regra 3 (BUSINESS_RULES): valor fora da tabela do plano — ou plano
//      personalizado — EXIGE justificativa, gravada em
//      valor_customizado/justificativa_customizacao (banco) e validada no form.
//   2. Plano personalizado exige valor negociado explícito.
//   3. Entrada nunca excede o valor total; parcelas >= 1.
//   4. Refazer/descartar contrato só sem NENHUM pagamento: entrada_paga false
//      E zero parcelas recebidas, com CAS — histórico financeiro real nunca se apaga.
//   5. Migration do enum plano_tipo é idempotente (ADD VALUE IF NOT EXISTS).

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


const finSrc = ler('apps', 'crm', 'src', 'lib', 'actions', 'financeiro.ts');
const rpcs = lerMigration('_financeiro_rpcs.sql');
const migFlex = lerMigration('_financeiro_contrato_flexivel.sql');
const schemas = ler('apps', 'crm', 'src', 'lib', 'financeiro', 'schemas.ts');
const migSrc = ler('supabase', 'migrations', '20260910120000_plano_personalizado.sql');

test('contratos: customização exige justificativa (Regra 3) e grava no audit', () => {
  // banco (criar e escolher/editar)
  assert.match(rpcs, /v_custom := v_tabela IS NULL OR v_base <> v_tabela;/, 'cálculo de customizado sumiu');
  assert.match(rpcs, /IF v_custom AND char_length\(v_just\) < 5 THEN/, 'gate da justificativa (criar) sumiu');
  assert.match(rpcs, /IF \(v_custom OR NOT v_primeira_escolha\) AND char_length\(v_just\) < 5 THEN/,
    'gate da justificativa (editar) sumiu — edição de contrato exige justificativa sempre');
  // Regra 3 completa: itens (serviço/desconto/ajuste) e sinal à parte também tiram o total da tabela.
  assert.equal((rpcs.match(/v_negociado := v_custom OR v_itens <> 0 OR \(NOT v_abatido AND v_ent_valor > 0\);/g) || []).length, 2,
    'criar e salvar condições precisam tratar itens/sinal à parte como negociação (Regra 3)');
  assert.equal((rpcs.match(/IF v_negociado AND char_length\(v_just\) < 5 THEN/g) || []).length, 2, 'gate da justificativa das condições negociadas sumiu');
  assert.match(rpcs, /valor_customizado = CASE WHEN v_negociado THEN v_total ELSE NULL END/, 'valor_customizado deixou de ser gravado');
  assert.match(rpcs, /justificativa_customizacao = CASE WHEN v_negociado THEN v_just ELSE NULL END/, 'justificativa deixou de ser gravada');
  // preço de tabela = fonte única configuracoes_sistema.planos (mudar preço ≠ customizado)
  assert.match(rpcs, /FROM configuracoes_sistema WHERE chave = 'planos'/);
  // form (client e server action usam o mesmo schema)
  assert.match(schemas, /\(negociado \|\| v\.exigirJustificativa\) && v\.justificativa\.length < JUSTIFICATIVA_MIN/);
  // edição (T9): o servidor decide pelo banco, nunca pelo client
  const acoes = ler('apps', 'crm', 'src', 'lib', 'actions', 'financeiro-contrato.ts');
  assert.match(acoes, /exigirJustificativa: atual\.contrato\.plano !== null/);
});

test('contratos: personalizado exige valor; entrada e parcelas validadas', () => {
  assert.match(rpcs, /IF v_base IS NULL OR v_base <= 0/, 'plano personalizado sem valor passaria');
  assert.match(rpcs, /IF v_total < v_ent_valor OR v_total <= 0 THEN/, 'entrada maior que o total passaria');
  assert.match(migFlex, /valor_total >= entrada_valor/, 'CHECK do banco contra saldo negativo sumiu');
  assert.match(rpcs, /inclui_psicologa = COALESCE\(\(p_dados ->> 'inclui_psicologa'\)::boolean/,
    'toggle de psicóloga voltou a ser ignorado');
  assert.match(schemas, /quantidade: z\.number\(\)\.int\(\)\.min\(1\)/, 'parcelas >= 1');
});

test('contratos: descartar só sem nenhum pagamento, atômico (lock + checagem + soft delete na mesma transação)', () => {
  const refazer = finSrc.slice(finSrc.indexOf('export async function excluirContratoSemPagamento'));
  assert.match(refazer, /"fin_descartar_contrato"/, 'descarte voltou a ser N requests sem transação');
  const ini = rpcs.indexOf('FUNCTION public.fin_descartar_contrato(');
  assert.ok(ini >= 0, 'RPC fin_descartar_contrato sumiu');
  const corpo = rpcs.slice(ini, rpcs.indexOf('$$;', ini));
  assert.match(corpo, /PERFORM fin_exigir_ceo\(\)/);
  assert.match(corpo, /FOR UPDATE/, 'sem lock: baixa concorrente apagaria contrato pago');
  assert.match(corpo, /IF c\.entrada_paga OR EXISTS \(\s*SELECT 1 FROM parcelas WHERE contrato_id = c\.id AND status = 'recebido' AND deleted_at IS NULL\)/,
    'contrato com pagamento poderia ser descartado');
  assert.match(corpo, /UPDATE parcelas SET deleted_at = now\(\)/, 'exclusão deixou de ser soft delete');
  assert.doesNotMatch(corpo, /DELETE FROM/, 'histórico financeiro nunca é apagado de verdade');
});

test('contratos: migration do plano personalizado é idempotente', () => {
  assert.match(migSrc, /ADD VALUE IF NOT EXISTS 'personalizado'/,
    'ADD VALUE idempotente sumiu da migration');
});

// ─── 2026-09-11: customização de VALOR DO DEAL (modal) + coluna que faltava ──
// (inalterado)

test('deal: customizar valor grava justificativa + flag (coluna criada na 20260911120000)', () => {
  const dealsSrc2 = ler('apps', 'crm', 'src', 'lib', 'actions', 'deals.ts');
  const fn = dealsSrc2.slice(dealsSrc2.indexOf('export async function customizarValorDeal'));
  assert.match(fn, /flag_valores_customizados: true/, 'flag de customização sumiu');
  // T3 (2026-10-08): validação migrou para zod (customizarValorSchema) — a
  // justificativa continua obrigatória (trim + min 1) e gravada no deal.
  assert.match(fn, /justificativa_customizacao: dados\.justificativa/, 'justificativa deixou de ser gravada no deal');
  assert.match(dealsSrc2, /justificativa: z\s*\.string\(\)\s*\.trim\(\)\s*\.min\(1, "Justificativa obrigatória\."\)/,
    'justificativa deixou de ser obrigatória');
  const mig = ler('supabase', 'migrations', '20260911120000_deals_justificativa_customizacao.sql');
  assert.match(mig, /ADD COLUMN IF NOT EXISTS justificativa_customizacao TEXT/,
    'migration da coluna do deal sumiu — o PATCH voltaria a quebrar (bug 2026-09-11)');
});

test('form: segundo responsável é Sim/Não — "sim" exige os 4 dados, "não" nada', () => {
  const formSrc = ler('apps', 'web', 'src', 'components', 'forms', 'FormsPage.tsx');
  assert.match(formSrc, /hasSecondGuardian: z\.string\(\)\.min\(1/,
    'pergunta Sim/Não do segundo responsável sumiu do schema');
  // "Sim" → mesmos dados do responsável principal (ordem do CEO, 2026-09-11)
  for (const campo of ['guardianName2', 'guardianProfession2', 'guardianWhatsapp2', 'guardianEmail2']) {
    assert.match(formSrc, new RegExp(`path: \\["${campo}"\\]`),
      `${campo} deixou de ser exigido quando "sim"`);
    assert.match(formSrc, new RegExp(`setValue\\("${campo}", ""`),
      `marcar "não" deixou de limpar ${campo} — família voltaria a explicar ausência`);
  }
  assert.match(formSrc, /isValidPhoneNumber\(data\.guardianWhatsapp2\)/,
    'WhatsApp do 2º responsável deixou de ser validado');
  assert.match(formSrc, /guardian_name_2: data\.guardianName2\?\.trim\(\) \|\| null/,
    'payload do 2º responsável sumiu do envio');
  assert.match(formSrc, /watch\("hasSecondGuardian"\) === "sim" && \(/,
    'bloco condicional do 2º responsável sumiu do JSX');
});
