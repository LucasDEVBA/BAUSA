'use strict';

// Guard — requalificação em massa (mutirão do prompt, 2026-08-25).
//
// O modo 'requalify' da retry-qualification reprocessa a base já qualificada
// com o prompt vigente. Invariantes que NUNCA podem sumir:
//   1. Quem marcou reunião NÃO é requalificado (pedido explícito do CEO:
//      "todos os leads qualificados, que ainda não marcaram reunião").
//   2. Soft delete respeitado.
//   3. O cursor é qualified_at < cutoff — sem ele o lote reprocessaria os
//      mesmos leads para sempre (qualify-lead renova qualified_at ao gravar).
//   4. No qualify-lead, decisão humana (aprovado/reprovado) NUNCA é
//      sobrescrita pela requalificação, QUENTE/MORNO sem decisão entram na
//      fila ('pendente') e FRIO pendente sai da fila (achado ALTO da
//      revisão 2026-08-10 — este guard trava a regra).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const retrySrc = fs.readFileSync(
  path.join(__dirname, '..', 'functions', 'retry-qualification', 'index.js'), 'utf8');
const qualifySrc = fs.readFileSync(
  path.join(__dirname, '..', 'functions', 'qualify-lead', 'index.js'), 'utf8');

test('requalify: filtros de população intactos (sem reunião, sem deletado, com cursor)', () => {
  const m = retrySrc.match(/const requalifyFilters = [\s\S]*?;\n/);
  assert.ok(m, 'requalifyFilters não encontrada — atualize o guard se renomeou');
  const filtros = m[0];
  assert.ok(filtros.includes('qualification_classification=not.is.null'), 'só leads JÁ qualificados');
  assert.ok(filtros.includes('meeting_scheduled=not.is.true'), 'quem marcou reunião fica de fora');
  assert.ok(filtros.includes('deleted_at=is.null'), 'soft delete respeitado');
  assert.ok(filtros.includes('qualified_at=lt.'), 'cursor por qualified_at < cutoff');
});

test('requalify: cutoff é obrigatório e validado (sem ele o modo não roda)', () => {
  assert.match(retrySrc, /Number\.isNaN\(Date\.parse\(cutoff\)\)/, 'validação do cutoff sumiu');
  assert.match(retrySrc, /order=qualified_at\.asc/, 'ordem do cursor sumiu (lote deve andar do mais antigo)');
});

test('qualify-lead: decisão humana nunca é sobrescrita na requalificação', () => {
  assert.match(
    qualifySrc,
    /decisaoHumanaTomada = statusAprovacaoAtual === 'aprovado' \|\| statusAprovacaoAtual === 'reprovado'/,
    'detecção de decisão humana sumiu',
  );
  // QUENTE/MORNO: com decisão tomada → undefined (não tocar); sem → pendente/aprovado (toggle).
  assert.match(
    qualifySrc,
    /decisaoHumanaTomada\s*\?\s*undefined/,
    'requalificação passou a sobrescrever decisão humana — regressão do achado ALTO 2026-08-10',
  );
  // FRIO requalificado sai da fila se estava pendente.
  assert.match(
    qualifySrc,
    /statusAprovacaoAtual === 'pendente' \? null : undefined/,
    'FRIO requalificado deixou de sair da fila de aprovação',
  );
});

test('pipeline: deal de lead pendente fica SUSPENSO do board (representação única)', () => {
  // Ordem do CEO (2026-08-24): lead na fila de aprovação aparece SÓ na
  // coluna "Aguardando aprovação" — o deal dele some das colunas de etapa
  // até a re-decisão (e reaparece intacto ao aprovar; nada é movido).
  const pageSrc = fs.readFileSync(
    path.join(__dirname, '..', 'apps', 'crm', 'src', 'app', '(dashboard)', 'pipeline', 'page.tsx'),
    'utf8',
  );
  assert.match(
    pageSrc,
    /aprovacao_status !== "pendente"/,
    'filtro de suspensão sumiu — lead pendente voltaria a aparecer em dobro no pipeline',
  );
  assert.match(
    pageSrc,
    /row\.etapa === "concluido" \|\| row\.etapa === "perdido"/,
    'etapas finais devem escapar da suspensão (histórico nunca some do board)',
  );
  assert.match(pageSrc, /aprovacao_status, score_financeiro/, 'select do embed perdeu aprovacao_status');
});
