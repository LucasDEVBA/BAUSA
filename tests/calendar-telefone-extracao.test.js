const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Guard: extração do telefone da descrição do evento do Calendar.
 *
 * Origem (12/08/2026): uma reunião com lead QUENTE e aprovado ficou 12 dias
 * fora do CRM. O lead existia, o telefone no cadastro estava certo — mas o
 * evento trazia `(27)999182178` e os padrões exigiam dígitos contíguos, então
 * a extração devolvia null e o matching nunca acontecia. Silencioso: nenhum
 * erro, nenhum alerta, só a reunião faltando na tela.
 *
 * Estes casos são os formatos REAIS vistos em produção.
 */

// Reexecuta a função da CF sem carregar o módulo inteiro (que exige env do GCP).
const SRC = fs.readFileSync(
  path.join(__dirname, '..', 'functions', 'calendar-webhook', 'index.js'),
  'utf8',
);
const corpo = SRC.slice(
  SRC.indexOf('const extractPhoneFromEvent'),
  SRC.indexOf('// ─── Buscar lead por email ou telefone'),
);
// eslint-disable-next-line no-new-func
const extractPhoneFromEvent = new Function(`${corpo}; return extractPhoneFromEvent;`)();

const descricaoBooking = (telefone) =>
  `<b>Reservado por</b>\nFulano de Tal\nfulano@exemplo.com\n${telefone}\n<br><b>Qual o nome do seu filho(a)?</b>\nCriança\n`;

test('telefone com DDD entre parênteses colados — o caso que causou o incidente', () => {
  assert.strictEqual(
    extractPhoneFromEvent({ description: descricaoBooking('(27)999182178') }),
    '27999182178',
  );
});

test('telefone só com dígitos (11 dígitos)', () => {
  assert.strictEqual(
    extractPhoneFromEvent({ description: descricaoBooking('47988083780') }),
    '47988083780',
  );
});

test('telefone local sem DDD (9 dígitos)', () => {
  assert.strictEqual(
    extractPhoneFromEvent({ description: descricaoBooking('981059839') }),
    '981059839',
  );
});

test('formatos com espaço, hífen e DDI', () => {
  const casos = {
    '(27) 99918-2178': '27999182178',
    '27 99918-2178': '27999182178',
    '+55 27 99918-2178': '5527999182178',
    '+5527999182178': '5527999182178',
  };
  for (const [entrada, esperado] of Object.entries(casos)) {
    assert.strictEqual(
      extractPhoneFromEvent({ description: descricaoBooking(entrada) }),
      esperado,
      `falhou para ${entrada}`,
    );
  }
});

test('rótulo explícito continua funcionando', () => {
  assert.strictEqual(
    extractPhoneFromEvent({ description: 'Contato\nTelefone: (11) 98888-7777\n' }),
    '11988887777',
  );
});

test('NÃO confunde data, CEP ou id com telefone', () => {
  // Um falso positivo aqui vincularia a reunião ao lead ERRADO — pior que
  // não vincular. Por isso a linha precisa ser só o telefone.
  const naoTelefone = [
    'Reunião em 12/08/2026 às 19:00 sobre o processo',
    'CEP 29102-000 na rua tal, número 1234',
    'Pedido 000123456789 confirmado pelo sistema',
    '',
  ];
  for (const d of naoTelefone) {
    assert.strictEqual(
      extractPhoneFromEvent({ description: d }),
      null,
      `extraiu telefone de: "${d}"`,
    );
  }
});

test('descrição sem telefone devolve null', () => {
  assert.strictEqual(extractPhoneFromEvent({ description: '<b>Reservado por</b>\nFulano\n' }), null);
  assert.strictEqual(extractPhoneFromEvent({}), null);
});
