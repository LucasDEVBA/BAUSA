'use strict';

// ════════════════════════════════════════════════════════════════════════
// GUARD DE INVARIANTE — chatbot-autonomo (a IA responde leads SOZINHA)
// ════════════════════════════════════════════════════════════════════════
//
// Esta é a feature MAIS sensível do sistema: em modo `ativo` a IA envia
// mensagem a um lead sem humano no loop. Cinco invariantes de SEGURANÇA não
// podem regredir — este guard falha o CI (mesmo estilo string-match dos
// tests/automation-engine-*.test.js):
//   1. NASCE off: modo === 'off' → early-return sem enviar nada.
//   2. FAIL-CLOSED: só resultado.segura === true (igualdade estrita) prossegue
//      para resposta; qualquer outra coisa NÃO envia.
//   3. sombra NUNCA envia ao lead (não referencia o envio) — só loga/notifica.
//   4. Escalonamento duro (ESCALACAO_ETAPAS) + loop-guard (MAX_RESPOSTAS_DIA).
//   5. Idempotência: marca ultimo_tratado_message_id (CAS antes do envio).
//
// Execução local:  node --test tests/
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CF_FILE = path.join(__dirname, '..', 'functions', 'chatbot-autonomo', 'index.js');

function loadExecutableSource() {
  assert.ok(fs.existsSync(CF_FILE), `Arquivo não encontrado: ${CF_FILE}`);
  const raw = fs.readFileSync(CF_FILE, 'utf8');
  const noBlockComments = raw.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlockComments
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

// ─── Invariante 1: NASCE off → early-return sem enviar ───────────────────
test('chatbot-autonomo: modo off retorna cedo sem processar/enviar', () => {
  const src = loadExecutableSource();
  const idxOff = src.indexOf(`modo === 'off'`);
  assert.ok(
    idxOff >= 0,
    `INVARIANTE VIOLADO: o tick deve checar modo === 'off' e não fazer NADA — ` +
      `o chatbot NASCE desligado.`,
  );
  // O return do off vem ANTES do laço que processa conversas.
  const idxLoop = src.indexOf('for (let i = 0; i < elegiveis.length');
  assert.ok(idxLoop > idxOff, 'INVARIANTE VIOLADO: o laço de conversas deve existir DEPOIS da checagem de off.');
  const idxReturn = src.indexOf('return', idxOff);
  assert.ok(
    idxReturn >= 0 && idxReturn < idxLoop,
    `INVARIANTE VIOLADO: modo === 'off' deve retornar (early-return) ANTES de ` +
      `qualquer processamento de conversa.`,
  );
  assert.ok(
    /processed:\s*0/.test(src.slice(idxOff, idxLoop)),
    `INVARIANTE VIOLADO: o retorno do modo off deve reportar processed: 0.`,
  );
});

// ─── Invariante 2: FAIL-CLOSED — só segura === true (estrito) prossegue ──
test('chatbot-autonomo: fail-closed exige segura === true (igualdade estrita)', () => {
  const src = loadExecutableSource();
  assert.ok(
    src.includes('resultado.segura === true'),
    `INVARIANTE VIOLADO: a decisão de responder deve exigir resultado.segura === true ` +
      `(igualdade ESTRITA). Comparação frouxa (== / truthy) abriria a porta a ` +
      `respostas indevidas — na dúvida, NÃO envia.`,
  );
  // O ramo inseguro (!segura) deve escalar/parar antes de qualquer envio.
  assert.ok(
    src.includes('if (!segura)'),
    `INVARIANTE VIOLADO: deve haver um ramo fail-closed (if (!segura)) que NÃO ` +
      `envia — escala ao humano.`,
  );
  // Erro de IA (parse/indisponibilidade) NÃO envia — vira decisao 'erro'.
  assert.ok(
    src.includes(`decisao: 'erro'`) && src.includes('classificarEGerar'),
    `INVARIANTE VIOLADO: falha de IA deve virar decisao 'erro' (sem envio), não ` +
      `prosseguir para resposta.`,
  );
});

// ─── Invariante 3: sombra NUNCA envia ao lead ────────────────────────────
test('chatbot-autonomo: modo sombra NUNCA chama o envio ao lead', () => {
  const src = loadExecutableSource();
  const idxSombra = src.indexOf(`modoEfetivo === 'sombra'`);
  assert.ok(idxSombra >= 0, `INVARIANTE VIOLADO: o ramo modoEfetivo === 'sombra' deve existir.`);
  // O bloco sombra vai até o início do ramo ativo (const hoje = todayBRT()).
  const idxAtivo = src.indexOf('const hoje = todayBRT()', idxSombra);
  assert.ok(idxAtivo > idxSombra, 'INVARIANTE VIOLADO: o ramo ativo (loop-guard) deve vir depois do sombra.');
  const blocoSombra = src.slice(idxSombra, idxAtivo);
  for (const proibido of ['enviarRespostaAoLead', 'postSendWhatsapp', 'SEND_WHATSAPP_URL']) {
    assert.ok(
      !blocoSombra.includes(proibido),
      `INVARIANTE VIOLADO: o ramo sombra referencia "${proibido}" — sombra NUNCA ` +
        `envia ao lead. Deve apenas gerar rascunho, notificar o CEO e logar.`,
    );
  }
  assert.ok(
    blocoSombra.includes(`decisao: 'sombra'`) && blocoSombra.includes('enviado: false'),
    `INVARIANTE VIOLADO: o ramo sombra deve logar decisao 'sombra' com enviado: false.`,
  );
});

// ─── Invariante 4: escalonamento duro + loop-guard ───────────────────────
test('chatbot-autonomo: escalonamento duro (etapas) + loop-guard diário', () => {
  const src = loadExecutableSource();
  // Escalonamento duro por etapa de dinheiro/negociação/contrato.
  assert.ok(
    src.includes('ESCALACAO_ETAPAS') && src.includes('ESCALACAO_ETAPAS.has'),
    `INVARIANTE VIOLADO: deve existir um conjunto ESCALACAO_ETAPAS e a checagem ` +
      `ESCALACAO_ETAPAS.has(etapa) — dinheiro/negociação/contrato SEMPRE escala, ` +
      `nunca responde.`,
  );
  for (const etapa of ['negociacao', 'proposta_enviada', 'contrato_enviado']) {
    assert.ok(
      src.includes(`'${etapa}'`),
      `INVARIANTE VIOLADO: ESCALACAO_ETAPAS deve conter a etapa sensível '${etapa}'.`,
    );
  }
  // Loop-guard diário por conversa.
  assert.ok(
    /MAX_RESPOSTAS_DIA_CONVERSA\s*=\s*\d+/.test(src),
    `INVARIANTE VIOLADO: MAX_RESPOSTAS_DIA_CONVERSA (loop-guard diário) deve existir.`,
  );
  assert.ok(
    src.includes('countHoje >= MAX_RESPOSTAS_DIA_CONVERSA') && src.includes('respostas_no_dia'),
    `INVARIANTE VIOLADO: ao atingir MAX_RESPOSTAS_DIA_CONVERSA a conversa deve ` +
      `ESCALAR em vez de enviar (loop-guard), usando o contador respostas_no_dia.`,
  );
  // Teto de IA por tick (protege o timeout do job).
  assert.ok(
    /IA_MAX_POR_TICK\s*=\s*\d+/.test(src) && src.includes('iaCalls'),
    `INVARIANTE VIOLADO: deve haver teto de chamadas de IA por tick (IA_MAX_POR_TICK).`,
  );
});

// ─── Invariante 5: idempotência (CAS de ultimo_tratado antes do envio) ───
test('chatbot-autonomo: marca ultimo_tratado_message_id (CAS antes do envio)', () => {
  const src = loadExecutableSource();
  assert.ok(
    src.includes('ultimo_tratado_message_id'),
    `INVARIANTE VIOLADO: a idempotência depende de ultimo_tratado_message_id — ` +
      `não responder 2x a mesma mensagem.`,
  );
  assert.ok(
    src.includes('claimConversa'),
    `INVARIANTE VIOLADO: deve haver um claim (claimConversa) que marca a mensagem ` +
      `como tratada com CAS.`,
  );
  // O claim (marcação) acontece ANTES do envio ao lead.
  const idxClaim = src.indexOf('claimConversa');
  const idxSend = src.indexOf('enviarRespostaAoLead');
  assert.ok(
    idxClaim >= 0 && idxSend > idxClaim,
    `INVARIANTE VIOLADO: a marcação de idempotência (claimConversa) deve preceder ` +
      `o envio ao lead (enviarRespostaAoLead) — marcar antes evita reenvio em reprocesso.`,
  );
  // O envio ao lead é a ÚNICA porta de saída externa ao lead e é gateado por CAS.
  assert.ok(
    src.includes('if (!(await claimConversa'),
    `INVARIANTE VIOLADO: o envio deve ser condicionado ao sucesso do CAS ` +
      `(if (!(await claimConversa(...))) return) — perdeu o CAS, não envia.`,
  );
});
