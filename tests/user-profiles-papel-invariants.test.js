'use strict';

// ════════════════════════════════════════════════════════════════════════
// GUARD — ninguém se auto-promove a CEO (revisão de segurança 17/11/2026)
// ════════════════════════════════════════════════════════════════════════
// A policy de UPDATE de user_profiles deixa o usuário editar a PRÓPRIA linha
// (nome/foto). RLS não restringe coluna: sem trava, um PATCH com
// {"papel":"ceo"} pelo próprio token virava CEO em todo o RLS e no Engine.
// O trigger user_profiles_trava_papel_ativo barra papel/ativo para quem não
// é CEO/CTO; este guard trava o trigger e o app que mexe nessas colunas.
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migDir = path.join(__dirname, '..', 'supabase', 'migrations');
const nome = fs.readdirSync(migDir).find((f) => f.endsWith('_user_profiles_trava_papel_ativo.sql'));

test('trigger barra mudança de papel/ativo por quem não é CEO/CTO', () => {
  assert.ok(nome, 'migration da trava de papel sumiu');
  const sql = fs.readFileSync(path.join(migDir, nome), 'utf8');
  assert.match(sql, /IF current_user <> 'authenticated' THEN\s*\n\s*RETURN NEW;/, 'servidor (service_role) e migrations têm de passar');
  assert.match(sql, /NEW\.papel IS DISTINCT FROM OLD\.papel OR NEW\.ativo IS DISTINCT FROM OLD\.ativo/);
  assert.match(sql, /coalesce\(public\.get_user_papel\(\), ''\) <> 'ceo'/, 'cto→ceo vem do get_user_papel');
  assert.match(sql, /BEFORE UPDATE ON public\.user_profiles/, 'BEFORE: get_user_papel lê a linha ANTIGA');
  assert.match(sql, /RAISE EXCEPTION/);
});

test('self-update do app só manda nome/foto; papel/ativo só pela ação do CEO', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'apps', 'crm', 'src', 'lib', 'actions', 'usuarios.ts'), 'utf8');
  const meu = src.slice(src.indexOf('export async function atualizarMeuPerfil'), src.indexOf('export async function criarUsuario'));
  assert.ok(!/update\.(papel|ativo)/.test(meu), 'atualizarMeuPerfil passou a mexer em papel/ativo');
  const ceo = src.slice(src.indexOf('export async function atualizarUsuario'), src.indexOf('export async function atualizarMeuPerfil'));
  assert.match(ceo, /if \(!me \|\| !isCeoLevel\(me\.papel\)\) return \{ success: false, error: "Acesso restrito ao CEO\." \};/);
});
