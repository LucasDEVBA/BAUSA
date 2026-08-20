'use strict';

// Guard — gamificação (2026-08-19).
//
// Invariantes:
//   1. FAIL-OPEN: registrarEventoGamificacao nunca lança — XP é tempero,
//      jamais pode quebrar uma ação de negócio (aprovar lead, mover deal…).
//   2. Escrita só via admin client (RLS dá SELECT ao authenticated; o client
//      de sessão não inventa ponto).
//   3. Pontos congelados no evento (insert grava `pontos`) — mudar o
//      catálogo não reescreve o histórico.
//   4. XP só por ação HUMANA: nenhuma Cloud Function registra evento de
//      gamificação (automação não pontua).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const lib = fs.readFileSync(
  path.join(__dirname, '..', 'apps', 'crm', 'src', 'lib', 'gamificacao.ts'), 'utf8');

test('gamificação: registrador é fail-open (try/catch, retorno null, sem throw)', () => {
  const corpo = lib.slice(lib.indexOf('export async function registrarEventoGamificacao'));
  assert.match(corpo, /try \{/, 'corpo em try/catch');
  assert.match(corpo, /catch \(e\)/, 'catch presente');
  assert.doesNotMatch(corpo, /\n\s*throw /, 'nunca relança — a ação de negócio segue');
});

test('gamificação: escrita via admin client, leitura de sessão só para o user id', () => {
  assert.match(lib, /createAdminClient/, 'insert de eventos usa service role');
  assert.match(lib, /hasServiceKey\(\)/, 'sem service key = no-op silencioso e seguro');
});

test('gamificação: pontos congelados na linha do evento', () => {
  assert.match(lib, /user_id: userId,\s*\n\s*tipo,\s*\n\s*pontos,/, 'insert grava os pontos do momento');
});

test('gamificação: nenhuma Cloud Function pontua (XP é só de ação humana)', () => {
  const funcoesDir = path.join(__dirname, '..', 'functions');
  for (const dir of fs.readdirSync(funcoesDir)) {
    const idx = path.join(funcoesDir, dir, 'index.js');
    if (!fs.existsSync(idx)) continue;
    const src = fs.readFileSync(idx, 'utf8');
    assert.ok(
      !src.includes('gamificacao_eventos'),
      `${dir} não pode gravar XP — automação não pontua`,
    );
  }
});
