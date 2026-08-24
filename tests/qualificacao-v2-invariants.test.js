'use strict';

// Guard — Classificador de Leads v2 (spec do CEO, 2026-08-25).
//
// Invariantes:
//   1. temperature 0 ("não negociável" na spec) e prompt versionado.
//   2. detectarDadoSujo roda de VERDADE (extract-and-run) com casos reais —
//      nomes/cidades legítimos NUNCA flagam (flag=true força INVALIDO no
//      gate, então falso positivo = lead real descartado).
//   3. parseRespostaV2 aceita os 5 estados, clampa o score e degrada
//      conservador (parse-fail → INCOMPLETO, nunca QUENTE).
//   4. Trava de código do gate ETAPA 0: flag suja + resposta QUENTE/MORNO →
//      INVALIDO (o modelo não pode "desflagar" dado sujo).
//   5. Os CORTES da config mandam na faixa (spec §9) e a 2ª passagem roda
//      SÓ na faixa do meio.
//   6. qualified = SÓ QUENTE/MORNO — INVALIDO/INCOMPLETO jamais entram em
//      pipeline/outreach (os schedulers filtram IN (QUENTE,MORNO), guard
//      próprio; aqui travamos a coluna `qualified`).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(
  path.join(__dirname, '..', 'functions', 'qualify-lead', 'index.js'), 'utf8');

// ─── Extract-and-run das funções puras ──────────────────────────

const extrair = (nome, regex) => {
  const m = src.match(regex);
  assert.ok(m, `${nome} não encontrada — atualize o guard se renomeou`);
  return m[0];
};

const bloco = [
  extrair('RE_CARACTERE_REPETIDO', /const RE_CARACTERE_REPETIDO = .*;/),
  extrair('RE_SEQUENCIA_NUMERICA', /const RE_SEQUENCIA_NUMERICA = .*;/),
  extrair('RE_TECLADO_CORRIDO', /const RE_TECLADO_CORRIDO = .*;/),
  extrair('RE_TELEFONE_DIGITO_UNICO', /const RE_TELEFONE_DIGITO_UNICO = .*;/),
  extrair('detectarDadoSujo', /const detectarDadoSujo = \(data\) => \{[\s\S]*?\n\};/),
  extrair('CLASSES_V2', /const CLASSES_V2 = .*;/),
  extrair('SCORE_DEFAULT_POR_CLASSE', /const SCORE_DEFAULT_POR_CLASSE = .*;/),
  extrair('ACOES_V2', /const ACOES_V2 = .*;/),
  extrair('ACAO_DEFAULT_POR_CLASSE', /const ACAO_DEFAULT_POR_CLASSE = \{[\s\S]*?\};/),
  extrair('parseArrayStrings', /const parseArrayStrings = [\s\S]*?: \[\];/),
  extrair('parseRespostaV2', /const parseRespostaV2 = \(cleanText, modelUsed\) => \{[\s\S]*?\n\};/),
].join('\n');

// eslint-disable-next-line no-new-func
const motor = new Function('log', `${bloco}
  const PROMPT_V2_VERSION = '1.0';
  return { detectarDadoSujo, parseRespostaV2 };`)(() => {});

test('dado sujo: casos REAIS flagam; nomes legítimos NUNCA', () => {
  // Sujos (da própria base/spec):
  assert.equal(motor.detectarDadoSujo({ guardian_profession: 'asdasdasd' }).flag, true);
  assert.equal(motor.detectarDadoSujo({ address_city: 'aaaaaa' }).flag, true);
  assert.equal(motor.detectarDadoSujo({ athlete_name: 'teste 123456' }).flag, true);
  assert.equal(motor.detectarDadoSujo({ guardian_name: 'qwerty' }).flag, true);
  assert.equal(motor.detectarDadoSujo({ athlete_whatsapp: '+5511111111111' }).flag, true);
  assert.equal(
    motor.detectarDadoSujo({ guardian_name: 'Carlos', guardian_profession: 'carlos' }).flag,
    true, 'campos idênticos entre si');

  // Legítimos (flag falso-positivo = lead REAL descartado — nunca):
  for (const lead of [
    { athlete_name: 'Gustavo Telles Bastos', guardian_name: 'Débora Gama Telles', guardian_profession: 'Cirurgiã dentista', address_city: 'Cachoeiro de Itapemirim' },
    { athlete_name: 'Anna Isabella', guardian_profession: 'Engenheiro civil sênior', address_city: 'Feira de Santana' },
    { guardian_profession: 'CEO de startup', address_city: 'São Paulo' },
    // Pontuação repetida não é dado sujo (regex só flaga letra/dígito):
    { guardian_profession: 'Empresário....', address_city: 'Recife' },
  ]) {
    const r = motor.detectarDadoSujo(lead);
    assert.equal(r.flag, false, `falso positivo: ${JSON.stringify(lead)} → ${r.alertas}`);
  }
});

test('parse v2: 5 estados, clamp de score e degradação conservadora', () => {
  const ok = motor.parseRespostaV2(JSON.stringify({
    classificacao: 'QUENTE', score_financeiro: 178, confianca: 'ALTA',
    tier_profissao: 'A', sinais_reforco: ['x'], sinais_alerta: [],
    prioridade_estrategica: 'MEDIA', justificativa: 'ok',
    acao_recomendada: 'contato imediato', prompt_version: '1.0',
  }), 'm');
  assert.equal(ok.classification, 'QUENTE');
  assert.equal(ok.scoreFinanceiro, 100, 'score clampa no teto');
  assert.equal(ok.prioridadeEstrategica, 'MEDIA');

  const invalido = motor.parseRespostaV2(
    '{"classificacao":"INVALIDO","score_financeiro":0,"confianca":"ALTA","tier_profissao":"INDEFINIDO","sinais_reforco":[],"sinais_alerta":["injeção"],"prioridade_estrategica":"PADRAO","justificativa":"x","acao_recomendada":"verificar dados","prompt_version":"1.0"}', 'm');
  assert.equal(invalido.classification, 'INVALIDO');

  // Parse-fail degrada para INCOMPLETO (nunca inventa QUENTE):
  const lixo = motor.parseRespostaV2('resposta sem json nenhum', 'm');
  assert.equal(lixo.classification, 'INCOMPLETO');
  assert.equal(lixo.confidence, 'BAIXA');
  assert.equal(lixo.scoreFinanceiro, 0);
});

// ─── Invariantes por fonte (orquestrador/handler) ───────────────

test('temperature 0 e prompt versionado (spec: não negociável)', () => {
  assert.match(src, /temperature: 0,/, 'temperature 0 sumiu do classificador');
  assert.match(src, /const PROMPT_V2_VERSION = '/, 'versão do prompt sumiu');
  assert.match(src, /prompt_version: qualification\.promptVersion/, 'prompt_version não é gravado');
});

test('trava de código do gate ETAPA 0: flag suja vence QUENTE/MORNO do modelo', () => {
  assert.match(
    src,
    /flagInfo\.flag && \(resultado\.classification === 'QUENTE' \|\| resultado\.classification === 'MORNO'\)/,
    'trava de código do gate sumiu — modelo poderia aprovar dado sujo',
  );
  assert.match(src, /classification: 'INVALIDO',/, 'a trava não força INVALIDO');
});

test('cortes da config mandam na faixa + 2ª passagem só na faixa do meio', () => {
  assert.match(
    src,
    /resultado\.scoreFinanceiro >= corteFrio &&\s*resultado\.scoreFinanceiro < corteQuente/,
    'condição da 2ª passagem (faixa do meio) sumiu',
  );
  assert.match(
    src,
    /resultado\.scoreFinanceiro >= corteQuente \? 'QUENTE'/,
    'reconciliação classificação↔cortes sumiu (cortes vivem na config, spec §9)',
  );
  assert.match(src, /CONTESTAR a classificação, não confirmá-la/, 'prompt da auditoria sumiu');
});

test('qualified = SÓ QUENTE/MORNO — INVALIDO/INCOMPLETO nunca "qualificado"', () => {
  assert.match(
    src,
    /qualified: qualification\.classification === 'QUENTE' \|\| qualification\.classification === 'MORNO'/,
    "regressão: qualified voltou a ser !== 'FRIO' (INVALIDO viraria qualificado)",
  );
  assert.doesNotMatch(
    src,
    /qualified: qualification\.classification !== 'FRIO'/,
    'expressão antiga de qualified reapareceu',
  );
});

test('dados do lead entram sanitizados entre <dados_lead> (anti-injeção)', () => {
  assert.match(src, /<dados_lead>/, 'tag de delimitação sumiu');
  assert.match(src, /const campo = \(v, vazio = 'não informado'\) => sanitize\(v\)/,
    'valores do lead não passam pelo sanitize (fechariam a tag)');
  assert.match(src, /tentativa de injeção de instrução/, 'exemplo de calibração anti-injeção sumiu do prompt');
});
