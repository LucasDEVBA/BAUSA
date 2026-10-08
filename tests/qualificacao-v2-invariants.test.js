'use strict';

// Guard — Classificador de Leads v2 (spec do CEO, 2026-08-25).
//
// Invariantes:
//   1. temperature 0 ("não negociável" na spec) e prompt versionado.
//   2. detectarDadoSujo roda de VERDADE (extract-and-run) com casos reais —
//      nomes/cidades legítimos NUNCA flagam (flag=true força INVALIDO no
//      gate, então falso positivo = lead real descartado).
//   3. parseRespostaV2 aceita os 5 estados, clampa o score e, sem JSON,
//      lê SÓ o campo "classificacao"; sem o campo LANÇA (lead vai a pendente
//      p/ retry) — nunca inventa classe, nunca INCOMPLETO silencioso (T19).
//   4. Trava de código do gate ETAPA 0: flag suja + resposta QUENTE/MORNO →
//      INVALIDO (o modelo não pode "desflagar" dado sujo).
//   5. Os CORTES da config mandam na faixa (spec §9) e a 2ª passagem roda
//      SÓ na faixa do meio.
//   6. qualified = SÓ QUENTE/MORNO — INVALIDO/INCOMPLETO jamais entram em
//      pipeline/outreach (os schedulers filtram IN (QUENTE,MORNO), guard
//      próprio; aqui travamos a coluna `qualified`).
//   7. (T19) Gate determinístico de completude: profissão/faixa ausente →
//      INCOMPLETO; presentes → NUNCA INCOMPLETO (vira FRIO com score abaixo
//      do corte). Aplicado antes e depois da 2ª passagem.
//   8. (T23) Idade incoerente com a série é ALERTA em código — o modelo não
//      recebe a idade nesse caso (não pode usá-la para INVALIDO).

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
  extrair('ErroRespostaNaoParseavel', /class ErroRespostaNaoParseavel extends Error \{[\s\S]*?\n\}/),
  extrair('RE_CAMPO_CLASSIFICACAO', /const RE_CAMPO_CLASSIFICACAO = .*;/),
  extrair('RE_CAMPO_SCORE', /const RE_CAMPO_SCORE = .*;/),
  extrair('parseArrayStrings', /const parseArrayStrings = [\s\S]*?: \[\];/),
  extrair('parseRespostaV2', /const parseRespostaV2 = \(cleanText, modelUsed\) => \{[\s\S]*?\n\};/),
  extrair('FAIXA_IDADE_POR_SERIE', /const FAIXA_IDADE_POR_SERIE = \{[\s\S]*?\n\};/),
  extrair('FAIXA_IDADE_ABSOLUTA', /const FAIXA_IDADE_ABSOLUTA = .*;/),
  extrair('avaliarIdadeAtleta', /const avaliarIdadeAtleta = \(data, referencia\) => \{[\s\S]*?\n\};/),
  extrair('FAIXAS_INVESTIMENTO_VALIDAS', /const FAIXAS_INVESTIMENTO_VALIDAS = .*;/),
  extrair('RE_TEM_LETRAS', /const RE_TEM_LETRAS = .*;/),
  extrair('avaliarCompletude', /const avaliarCompletude = \(data\) => \{[\s\S]*?\n\};/),
  extrair('ALERTA_INCOMPLETO_COM_DADOS', /const ALERTA_INCOMPLETO_COM_DADOS = .*;/),
  extrair('aplicarGateCompletude', /const aplicarGateCompletude = \(resultado, completude, corteFrio\) => \{[\s\S]*?\n\};/),
].join('\n');

// eslint-disable-next-line no-new-func
const motor = new Function('log', `${bloco}
  const PROMPT_V2_VERSION = '1.0';
  return {
    detectarDadoSujo, parseRespostaV2, ErroRespostaNaoParseavel,
    avaliarIdadeAtleta, avaliarCompletude, aplicarGateCompletude,
  };`)(() => {});

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

  // T19: sem JSON e sem o campo "classificacao" → LANÇA (nunca INCOMPLETO
  // silencioso, nunca QUENTE inventado). O handler marca pendente.
  assert.throws(
    () => motor.parseRespostaV2('resposta sem json nenhum', 'm'),
    (e) => e instanceof motor.ErroRespostaNaoParseavel,
  );
  // Eco do schema ("QUENTE | MORNO | ...") NÃO vira classe:
  assert.throws(
    () => motor.parseRespostaV2('{"classificacao": "QUENTE | MORNO | FRIO | INVALIDO | INCOMPLETO"', 'm'),
    (e) => e instanceof motor.ErroRespostaNaoParseavel,
  );
  // JSON truncado que ainda traz o campo → usa o campo, confiança BAIXA:
  const truncado = motor.parseRespostaV2(
    '{"classificacao":"FRIO","score_financeiro":12,"confianca":"ALTA","justificativa":"Categoria profissional não com', 'm');
  assert.equal(truncado.classification, 'FRIO');
  assert.equal(truncado.scoreFinanceiro, 12);
  assert.equal(truncado.confidence, 'BAIXA');
  assert.ok(truncado.sinaisAlerta.some((a) => a.includes('truncada')));
});

test('T19 completude: profissão (1º ou 2º responsável, ≥2 letras) E faixa válida', () => {
  const ok = { guardian_profession: 'Empresário', investment_range: '15k-20k' };
  assert.equal(motor.avaliarCompletude(ok).completo, true);
  assert.equal(motor.avaliarCompletude({ ...ok, guardian_profession: '', guardian_profession_2: 'Médica' }).completo, true);
  for (const semProf of ['', '   ', '-', 'x', '12', null, undefined]) {
    const r = motor.avaliarCompletude({ guardian_profession: semProf, investment_range: '20k-30k' });
    assert.equal(r.completo, false, `profissão ${JSON.stringify(semProf)} não conta como preenchida`);
    assert.deepEqual(r.faltando, ['profissão do responsável']);
  }
  for (const semFaixa of ['', null, 'qualquer', '15k']) {
    const r = motor.avaliarCompletude({ guardian_profession: 'Advogado', investment_range: semFaixa });
    assert.deepEqual(r.faltando, ['faixa de investimento']);
  }
});

test('T19 gate: dados presentes NUNCA saem INCOMPLETO; ausentes SEMPRE saem INCOMPLETO', () => {
  const base = {
    classification: 'INCOMPLETO', scoreFinanceiro: 0, confidence: 'ALTA', reason: 'abaixo do piso',
    sinaisAlerta: [], acaoRecomendada: 'verificar dados',
  };
  const completo = { completo: true, faltando: [] };
  const incompleto = { completo: false, faltando: ['profissão do responsável'] };

  // Caso Arthur cascone: dados completos, 15k-20k, modelo disse INCOMPLETO.
  const frio = motor.aplicarGateCompletude(base, completo, 40);
  assert.equal(frio.classification, 'FRIO');
  assert.equal(frio.reason, 'abaixo do piso', 'motivo do modelo é preservado');
  assert.equal(frio.acaoRecomendada, 'nutricao');
  assert.ok(frio.sinaisAlerta.some((a) => a.includes('INCOMPLETO do modelo com profissão e faixa presentes')));
  // Score do modelo preservado, mas com teto < corte_frio (nunca vira MORNO/fila).
  assert.equal(motor.aplicarGateCompletude({ ...base, scoreFinanceiro: 25 }, completo, 40).scoreFinanceiro, 25);
  assert.equal(motor.aplicarGateCompletude({ ...base, scoreFinanceiro: 55 }, completo, 40).scoreFinanceiro, 39);

  // Faltou dado: QUENTE/MORNO/FRIO do modelo → INCOMPLETO forçado.
  for (const classe of ['QUENTE', 'MORNO', 'FRIO']) {
    const r = motor.aplicarGateCompletude({ ...base, classification: classe, scoreFinanceiro: 80 }, incompleto, 40);
    assert.equal(r.classification, 'INCOMPLETO');
    assert.equal(r.scoreFinanceiro, 0);
    assert.ok(r.sinaisAlerta.some((a) => a.includes('ausente → INCOMPLETO')));
  }
  // INVALIDO (dado sujo/injeção) precede a completude.
  assert.equal(motor.aplicarGateCompletude({ ...base, classification: 'INVALIDO' }, incompleto, 40).classification, 'INVALIDO');
  // Classes válidas com dado completo passam intactas.
  const morno = { ...base, classification: 'MORNO', scoreFinanceiro: 45 };
  assert.deepEqual(motor.aplicarGateCompletude(morno, completo, 40), morno);
  // Idempotente (aplicado antes e depois da 2ª passagem).
  const duas = motor.aplicarGateCompletude(motor.aplicarGateCompletude(base, incompleto, 40), incompleto, 40);
  assert.equal(duas.sinaisAlerta.length, 1);
  const duasF = motor.aplicarGateCompletude(motor.aplicarGateCompletude(base, completo, 40), completo, 40);
  assert.equal(duasF.classification, 'FRIO');
  assert.equal(duasF.sinaisAlerta.length, 1);
});

test('T19 orquestrador: gate antes e depois da 2ª passagem; auditoria INCOMPLETO descartada', () => {
  const orq = src.slice(src.indexOf('const qualifyWithGemini'), src.indexOf('// ─── Atualizar Supabase'));
  const ocorrencias = orq.match(/resultado = aplicarGateCompletude\(resultado, completude, corteFrio\);/g) || [];
  assert.equal(ocorrencias.length, 2, 'o gate deve rodar antes da auditoria E na saída final');
  assert.ok(
    orq.indexOf('aplicarGateCompletude') < orq.indexOf('auditarFaixaDoMeio('),
    'o 1º gate precisa vir antes da 2ª passagem',
  );
  const aud = src.slice(src.indexOf('const auditarFaixaDoMeio'), src.indexOf('// ─── Orquestrador v2'));
  assert.match(aud, /segunda\.classification === 'INCOMPLETO'[\s\S]{0,300}return primeira;/,
    'INCOMPLETO da 2ª passagem precisa ser descartado (mantém a 1ª)');
  // O fallback por substring (raiz do INCOMPLETO silencioso) não pode voltar.
  assert.doesNotMatch(src, /CLASSES_V2\.find\(\(c\) => cleanText\.includes\(c\)\)/,
    'fallback por substring voltou — classe inventada/INCOMPLETO silencioso');
  // Erro de parse vira pendente (handler), com motivo distinto nas Execuções.
  assert.match(src, /geminiErr instanceof ErroRespostaNaoParseavel/);
});

test('T19 notificação de pendência usa o schema REAL de notificacoes (antes falhava 100%)', () => {
  const fn = src.slice(src.indexOf('const notifyQualificationPending'), src.indexOf('const notifyAprovacaoPendente'));
  assert.match(fn, /destinatario_id: user\.id/);
  assert.match(fn, /mensagem,/);
  assert.match(fn, /severidade: 'media'/);
  assert.match(fn, /on_conflict=destinatario_id,dedupe_key/);
  assert.match(fn, /papel=in\.\(ceo,cto\)/, 'o aviso leva ao War Room (CEO-only) — destinatários CEO/CTO');
  assert.doesNotMatch(fn, /user_id: |descricao,|modulo_origem: |severidade: 'aviso'/, 'payload antigo (colunas inexistentes) voltou');
});

test('T23 idade × série: incoerente vira ALERTA e a idade NÃO vai para o modelo', () => {
  const ref = new Date('2026-09-28T12:00:00Z');
  // Samuel: seletor do celular no ano corrente → idade 0 no 9º ano.
  const samuel = motor.avaliarIdadeAtleta({ birth_date: '2026-07-31', school_year: '9th_grade', age: -1 }, ref);
  assert.equal(samuel.coerente, false);
  assert.match(samuel.alerta, /não invalida o lead/);
  // Data do responsável (1972) no 9º ano.
  assert.equal(motor.avaliarIdadeAtleta({ birth_date: '1972-04-26', school_year: '9th_grade' }, ref).coerente, false);
  // Ano de 5 dígitos: cai no campo age do navegador (negativo) → incoerente.
  assert.equal(motor.avaliarIdadeAtleta({ birth_date: '20001-06-02', school_year: 'hs_1st', age: -17975 }, ref).coerente, false);
  // Coerentes.
  assert.equal(motor.avaliarIdadeAtleta({ birth_date: '2011-01-08', school_year: 'hs_1st' }, ref).coerente, true);
  assert.equal(motor.avaliarIdadeAtleta({ birth_date: '2004-07-01', school_year: 'hs_3rd' }, ref).coerente, true);
  // Sem data nenhuma: não é gate (idade não pontua).
  const sem = motor.avaliarIdadeAtleta({ school_year: 'hs_1st' }, ref);
  assert.equal(sem.idade, null);
  assert.equal(sem.coerente, true);
  // Série em texto livre (legado) usa a faixa absoluta.
  assert.equal(motor.avaliarIdadeAtleta({ birth_date: '2010-01-01', school_year: '2 ano EM' }, ref).coerente, true);

  assert.match(src, /idade_atleta: \$\{idadeInfo && !idadeInfo\.coerente \? 'não informado' : campo\(data\.age\)\}/,
    'com idade incoerente o modelo NÃO pode receber a idade (usaria para INVALIDO)');
  assert.match(src, /const userMessage = montarDadosLeadV2\(leadData, flagInfo, idadeInfo\);/);
  assert.match(src, /idadeInfo\.alerta && !resultado\.sinaisAlerta\.includes\(idadeInfo\.alerta\)/,
    'o alerta de idade é escrito em código no resultado');
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
