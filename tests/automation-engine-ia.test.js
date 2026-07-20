'use strict';

// ════════════════════════════════════════════════════════════════════════
// GUARD DE INVARIANTE — automation-engine (ação ia_prompt)
// ════════════════════════════════════════════════════════════════════════
//
// A ação ia_prompt gera texto com Gemini a partir do prompt do CEO + contexto
// do registro. Três invariantes de SEGURANÇA/OPERAÇÃO não podem regredir:
//   1. SEM ENVIO EXTERNO: o texto da IA vira notificação/tarefa interna —
//      NUNCA WhatsApp/e-mail direto (a IA escreve, o CEO revisa e envia).
//   2. TETO POR TICK: cada run de IA custa até IA_DEADLINE_MS — sem teto,
//      um lote de runs de IA estoura o timeout da engine (540s).
//   3. FAIL-CLEAR SEM KEY: sem GEMINI_API_KEY o run marca erro com mensagem
//      acionável, sem afetar as demais automações/ações do tick.
//
// Mesmo estilo string-match do tests/automation-engine-eligibility.test.js.
// Execução local:  node --test tests/
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ENGINE_FILE = path.join(__dirname, '..', 'functions', 'automation-engine', 'index.js');

function loadExecutableSource() {
  assert.ok(fs.existsSync(ENGINE_FILE), `Arquivo não encontrado: ${ENGINE_FILE}`);
  const raw = fs.readFileSync(ENGINE_FILE, 'utf8');
  const noBlockComments = raw.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlockComments
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

/** Recorta o bloco executável da ação ia_prompt (até o próximo bloco de ação). */
function blocoIaPrompt(src) {
  const inicio = src.indexOf(`acao.tipo === 'ia_prompt'`);
  assert.ok(
    inicio >= 0,
    `INVARIANTE VIOLADO: a ação ia_prompt deve existir no executeAcao.`,
  );
  const proximoBloco = src.indexOf(`acao.tipo === '`, inicio + 1);
  return proximoBloco > inicio ? src.slice(inicio, proximoBloco) : src.slice(inicio);
}

// ─── Invariante 1: a IA NUNCA envia mensagem externa ─────────────────────
test('automation-engine: ia_prompt não referencia canais de envio externo', () => {
  const src = loadExecutableSource();
  const bloco = blocoIaPrompt(src);
  for (const proibido of ['SEND_WHATSAPP_URL', 'SEND_MESSAGES_URL', 'ZAPI', 'customMessage', 'customEmail']) {
    assert.ok(
      !bloco.includes(proibido),
      `INVARIANTE VIOLADO: o bloco da ação ia_prompt referencia "${proibido}" — ` +
        `a IA NUNCA envia mensagem externa (WhatsApp/e-mail). O texto gerado ` +
        `vira notificação in-app ou tarefa interna: o CEO revisa e envia.`,
    );
  }
  // O resultado permitido é interno: notificações e/ou tarefas.
  assert.ok(
    bloco.includes(`sbPost('notificacoes'`) && bloco.includes(`sbPost('tarefas'`),
    `INVARIANTE VIOLADO: o resultado da ação ia_prompt deve ser gravado como ` +
      `notificação in-app ou tarefa interna (sbPost em notificacoes/tarefas).`,
  );
});

// ─── Invariante 2: teto de execuções de IA por tick ──────────────────────
test('automation-engine: teto de IA por tick (IA_MAX_PER_TICK) com defer sem claim', () => {
  const src = loadExecutableSource();
  assert.ok(
    /IA_MAX_PER_TICK\s*=\s*\d+/.test(src),
    `INVARIANTE VIOLADO: IA_MAX_PER_TICK deve existir — cada run de IA custa ` +
      `até IA_DEADLINE_MS e, sem teto, um lote de runs de IA estoura o ` +
      `timeout da engine (540s).`,
  );
  assert.ok(
    src.includes('IA_MAX_PER_TICK') && src.includes('deferred_ia'),
    `INVARIANTE VIOLADO: o excedente do teto deve ser ADIADO e contabilizado ` +
      `(deferred_ia) para o próximo tick.`,
  );
  // O defer acontece ANTES do claim — o run adiado segue pendente e roda no
  // próximo tick SEM queimar tentativa.
  const idxDefer = src.indexOf('ia_budget_deferred');
  const idxClaim = src.indexOf('await claimRun(run)');
  assert.ok(
    idxDefer >= 0 && idxClaim > idxDefer,
    `INVARIANTE VIOLADO: o defer do teto de IA deve acontecer ANTES do ` +
      `claimRun no loop do tick — depois do claim, o run queimaria tentativa.`,
  );
});

// ─── Invariante 3: fail-clear sem GEMINI_API_KEY ─────────────────────────
test('automation-engine: sem GEMINI_API_KEY o run marca erro claro', () => {
  const src = loadExecutableSource();
  const bloco = blocoIaPrompt(src);
  assert.ok(
    bloco.includes('IA não configurada (GEMINI_API_KEY)'),
    `INVARIANTE VIOLADO: sem GEMINI_API_KEY a ação ia_prompt deve marcar o ` +
      `run como erro com a mensagem "IA não configurada (GEMINI_API_KEY)" — ` +
      `fail-clear, sem afetar as demais automações/ações do tick.`,
  );
  assert.ok(
    bloco.indexOf('GEMINI_API_KEY') < bloco.indexOf('callGeminiWithResilience'),
    `INVARIANTE VIOLADO: a checagem da key deve vir ANTES de qualquer ` +
      `chamada à Gemini.`,
  );
});

// ─── Invariante 4: deadline por run de IA ────────────────────────────────
test('automation-engine: chamada Gemini tem deadline por run (IA_DEADLINE_MS)', () => {
  const src = loadExecutableSource();
  assert.ok(
    /IA_DEADLINE_MS\s*=\s*\d+/.test(src) && src.includes('IA_DEADLINE_MS - (Date.now() - inicio)'),
    `INVARIANTE VIOLADO: callGeminiWithResilience deve impor deadline por ` +
      `run (IA_DEADLINE_MS) — a engine processa vários runs por tick e não ` +
      `pode gastar o tick inteiro numa única chamada de IA.`,
  );
});

// ════════════════════════════════════════════════════════════════════════
// GUARD DE INVARIANTE — passo ia_condicao (IA como CONDIÇÃO / gate) + fluxo
// por PASSOS. A ia_condicao é DECISÓRIA (SIM/NÃO) e fail-closed. Os invariantes:
//   A. GATE fail-closed: TRUE só se a resposta começar com 'SIM'/'YES'; o
//      resto (ou erro) NÃO prossegue (finishRun 'ignorado').
//   B. TETO por tick: ia_condicao consome o MESMO IA_MAX_PER_TICK do ia_prompt
//      (tickState.iaCalls++ + contarChamadasIA conta ia_condicao).
//   C. SEM ENVIO EXTERNO: o gate NUNCA referencia SEND_*/customMessage/
//      customEmail/ZAPI — só decide, não envia.
//   D. BACKWARD-COMPAT: o fluxo por passos SÓ ativa com auto.passos não-vazio;
//      sem passos, o caminho LEGADO (condicoes → ações) fica intacto.
//   E. FAIL-CLEAR SEM KEY: sem GEMINI_API_KEY o passo ia_condicao marca o run
//      com o erro claro "IA não configurada (GEMINI_API_KEY)".
// ════════════════════════════════════════════════════════════════════════

/** Recorta o corpo de avaliarIaCondicao (até o próximo const de nível 0). */
function blocoAvaliarIaCondicao(src) {
  const inicio = src.indexOf('const avaliarIaCondicao = async');
  assert.ok(inicio >= 0, 'INVARIANTE VIOLADO: avaliarIaCondicao deve existir na engine.');
  const fim = src.indexOf('\nconst ', inicio + 1);
  return fim > inicio ? src.slice(inicio, fim) : src.slice(inicio);
}

/** Recorta o corpo de processarPassos (até o próximo const de nível 0). */
function blocoProcessarPassos(src) {
  const inicio = src.indexOf('const processarPassos = async');
  assert.ok(inicio >= 0, 'INVARIANTE VIOLADO: processarPassos deve existir na engine.');
  const fim = src.indexOf('\nconst ', inicio + 1);
  return fim > inicio ? src.slice(inicio, fim) : src.slice(inicio);
}

// ─── Invariante A: gate fail-closed (só 'SIM' prossegue) ─────────────────
test('automation-engine: ia_condicao é um GATE fail-closed (só SIM prossegue)', () => {
  const src = loadExecutableSource();
  const gate = blocoAvaliarIaCondicao(src);
  assert.ok(
    gate.includes(`=== 'SIM'`) && !gate.includes(`startsWith('SIM')`),
    `INVARIANTE VIOLADO: avaliarIaCondicao deve retornar TRUE apenas por ` +
      `IGUALDADE EXATA ('SIM'/'YES') — startsWith abriria falso-positivo ` +
      `('SIMPLESMENTE'). Fail-closed: na dúvida, o fluxo NÃO prossegue.`,
  );
  const passos = blocoProcessarPassos(src);
  // Resposta não-SIM (veredito.passou = false) → run 'ignorado', fluxo para.
  const idxNao = passos.indexOf('if (!veredito.passou)');
  const idxIgnorado = passos.indexOf(`'ignorado'`, idxNao);
  assert.ok(
    idxNao >= 0 && idxIgnorado > idxNao,
    `INVARIANTE VIOLADO: quando a IA NÃO decide SIM (!veredito.passou), o passo ` +
      `ia_condicao deve finalizar o run como 'ignorado' e PARAR o fluxo.`,
  );
  // Erro na chamada de IA é fail-closed: o fluxo NUNCA prossegue com ação após
  // um gate que falhou. Sem ação anterior → retry seguro (não dropa o lead);
  // com ação anterior → 'ignorado' (não re-executa side-effect). Em nenhum
  // caso vira 'sucesso' com ação indevida.
  assert.ok(
    passos.includes('ia_condicao_gate_error'),
    `INVARIANTE VIOLADO: o catch de erro da ia_condicao deve existir e tratar ` +
      `o gate de forma fail-closed (não prosseguir com ação).`,
  );
  assert.ok(
    passos.includes('acaoJaExecutada') && passos.includes('retryOrExhaust'),
    `INVARIANTE VIOLADO: erro transitório no gate SEM ação anterior deve ir p/ ` +
      `retryOrExhaust (não dropar o lead em silêncio); com ação anterior, ` +
      `manter 'ignorado' (não re-executar a ação).`,
  );
});

// ─── Invariante B: ia_condicao conta no teto IA_MAX_PER_TICK ─────────────
test('automation-engine: ia_condicao consome o teto de IA por tick', () => {
  const src = loadExecutableSource();
  const gate = blocoAvaliarIaCondicao(src);
  assert.ok(
    gate.includes('tickState.iaCalls++'),
    `INVARIANTE VIOLADO: avaliarIaCondicao deve incrementar tickState.iaCalls — ` +
      `sem isso a ia_condicao não conta no teto IA_MAX_PER_TICK e um lote ` +
      `estoura o timeout da engine.`,
  );
  assert.ok(
    src.includes('const contarChamadasIA') && src.includes(`p.tipo === 'ia_condicao'`),
    `INVARIANTE VIOLADO: contarChamadasIA deve contar os passos ia_condicao ` +
      `(além de ia_prompt) no defer do teto de IA antes do claim.`,
  );
  // O defer usa contarChamadasIA (que inclui ia_condicao), ANTES do claim.
  const idxContar = src.indexOf('contarChamadasIA(autoDoRun)');
  const idxClaim = src.indexOf('await claimRun(run)');
  assert.ok(
    idxContar >= 0 && idxClaim > idxContar,
    `INVARIANTE VIOLADO: o teto de IA (contarChamadasIA, incl. ia_condicao) ` +
      `deve ser avaliado ANTES do claimRun — depois do claim queimaria tentativa.`,
  );
});

// ─── Invariante C: o gate NUNCA envia mensagem externa ───────────────────
test('automation-engine: ia_condicao não referencia canais de envio externo', () => {
  const src = loadExecutableSource();
  const gate = blocoAvaliarIaCondicao(src);
  for (const proibido of ['SEND_WHATSAPP_URL', 'SEND_MESSAGES_URL', 'ZAPI', 'customMessage', 'customEmail']) {
    assert.ok(
      !gate.includes(proibido),
      `INVARIANTE VIOLADO: o gate ia_condicao referencia "${proibido}" — a IA ` +
        `aqui SÓ decide SIM/NÃO (interno). NUNCA envia WhatsApp/e-mail.`,
    );
  }
});

// ─── Invariante D: passos só ativa com passos não-vazio (legado intacto) ─
test('automation-engine: fluxo por passos só ativa com auto.passos não-vazio', () => {
  const src = loadExecutableSource();
  assert.ok(
    src.includes('Array.isArray(auto.passos) && auto.passos.length > 0') &&
      src.includes('processarPassos(run, auto'),
    `INVARIANTE VIOLADO: processRun só deve rodar o fluxo por passos quando ` +
      `auto.passos é não-vazio — sem passos, cai no fluxo LEGADO (backward-compat).`,
  );
  // O legado (evaluateCondicoes(auto.condicoes) → ações) segue presente.
  assert.ok(
    src.includes('evaluateCondicoes(auto.condicoes'),
    `INVARIANTE VIOLADO: o fluxo LEGADO (evaluateCondicoes(auto.condicoes) → ` +
      `for acao of auto.acoes) NÃO pode ser removido — automações existentes ` +
      `(passos vazio) devem seguir idênticas.`,
  );
  // O branch de passos vem ANTES da avaliação legada de condições.
  const idxPassos = src.indexOf('auto.passos.length > 0');
  const idxLegado = src.indexOf('evaluateCondicoes(auto.condicoes');
  assert.ok(
    idxPassos >= 0 && idxLegado > idxPassos,
    `INVARIANTE VIOLADO: o desvio para o fluxo por passos deve preceder a ` +
      `avaliação legada de condições no processRun.`,
  );
  // Passo de condição usa avaliação POR passo (não a lista legada inteira).
  assert.ok(
    src.includes('evaluateCondicoes([passo.condicao]'),
    `INVARIANTE VIOLADO: a condição de um passo deve ser avaliada isolada ` +
      `(evaluateCondicoes([passo.condicao])) — cada passo para o fluxo por si.`,
  );
});

// ─── Invariante E: fail-clear sem GEMINI_API_KEY no passo ia_condicao ────
test('automation-engine: ia_condicao sem GEMINI_API_KEY marca erro claro', () => {
  const src = loadExecutableSource();
  const passos = blocoProcessarPassos(src);
  assert.ok(
    passos.includes('IA não configurada (GEMINI_API_KEY)'),
    `INVARIANTE VIOLADO: sem GEMINI_API_KEY o passo ia_condicao deve marcar o ` +
      `run com o erro "IA não configurada (GEMINI_API_KEY)" (fail-clear).`,
  );
  // A checagem da key vem ANTES de chamar avaliarIaCondicao. Desde a F5
  // (agents plugáveis) o gate recebe gatePrompt = agent || passo.prompt —
  // o fallback inline é coberto pelo guard tests/agents-invariants.test.js.
  const idxKey = passos.indexOf('!GEMINI_API_KEY');
  const idxChamada = passos.indexOf('avaliarIaCondicao(gatePrompt');
  assert.ok(
    idxKey >= 0 && idxChamada > idxKey,
    `INVARIANTE VIOLADO: a checagem de GEMINI_API_KEY deve vir ANTES da ` +
      `chamada avaliarIaCondicao no passo ia_condicao.`,
  );
});
