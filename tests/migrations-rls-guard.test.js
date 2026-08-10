// ════════════════════════════════════════════════════════════════════════
// Guard: toda migration que cria tabela DEVE habilitar RLS na mesma migration
// ════════════════════════════════════════════════════════════════════════
//
// Contexto (2026-08-10, migration 20260810201415): uat/dev ganharam
// ALTER DEFAULT PRIVILEGES — tabela futura nasce com privilégios de tabela
// para authenticated/service_role (como o public sempre foi). Com isso, uma
// migration que esqueça ENABLE ROW LEVEL SECURITY deixa de falhar fechada
// (42501) e passa a falhar ABERTA (DML completo via PostgREST) nos 3 schemas.
// Este guard fecha exatamente esse cenário: CREATE TABLE sem RLS não mergeia.
//
// Opt-out consciente (raro, documentar o porquê no próprio arquivo):
//   -- rls-guard: skip <nome_da_tabela>
// ════════════════════════════════════════════════════════════════════════

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');

// CREATE TABLE qualificado (public/uat/dev.nome) ou não-qualificado — cobre
// SQL direto e strings dentro de EXECUTE '...'
const CREATE_TABLE_RE = /CREATE TABLE (?:IF NOT EXISTS )?(?:([a-z_]+)\.)?([a-z_][a-z0-9_]*)/g;
const SKIP_RE = /--\s*rls-guard:\s*skip\s+([a-z_][a-z0-9_]*)/g;

function encontrarViolacoes(sql, file) {
  const violacoes = [];
  const skips = new Set();
  for (const m of sql.matchAll(SKIP_RE)) skips.add(m[1]);

  const criadas = new Set();
  for (const m of sql.matchAll(CREATE_TABLE_RE)) criadas.add(m[2]);

  for (const tabela of criadas) {
    if (skips.has(tabela)) continue;
    // Aceita "ALTER TABLE <schema>.<tabela> ENABLE ROW LEVEL SECURITY"
    // em SQL direto ou dentro de EXECUTE '...'
    const rlsRe = new RegExp(`${tabela}\\s+ENABLE ROW LEVEL SECURITY`);
    if (!rlsRe.test(sql)) {
      violacoes.push(`${file}: tabela "${tabela}" criada sem ENABLE ROW LEVEL SECURITY`);
    }
  }
  return violacoes;
}

test('toda CREATE TABLE em migration habilita ROW LEVEL SECURITY no mesmo arquivo', () => {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  assert.ok(files.length > 0, 'nenhuma migration encontrada — caminho errado?');

  const violacoes = files.flatMap((file) =>
    encontrarViolacoes(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'), file),
  );

  assert.deepStrictEqual(
    violacoes,
    [],
    `Migrations criando tabela SEM RLS (fail-open com default privileges!):\n${violacoes.join('\n')}\n` +
      'Habilite RLS + policies na mesma migration, ou documente um opt-out consciente com "-- rls-guard: skip <tabela>".',
  );
});

test('guard: detecta corretamente CREATE TABLE sem RLS (auto-teste negativo)', () => {
  const semRls = `CREATE TABLE IF NOT EXISTS public.tabela_perigosa (id UUID PRIMARY KEY);`;
  assert.strictEqual(encontrarViolacoes(semRls, 'fake.sql').length, 1, 'deveria acusar tabela sem RLS');

  const comRls =
    semRls + `\nALTER TABLE public.tabela_perigosa ENABLE ROW LEVEL SECURITY;`;
  assert.deepStrictEqual(encontrarViolacoes(comRls, 'fake.sql'), [], 'com RLS não deveria acusar');

  const viaExecute = `DO $$ BEGIN
    EXECUTE 'CREATE TABLE IF NOT EXISTS uat.outra_tabela (id UUID)';
    EXECUTE 'ALTER TABLE uat.outra_tabela ENABLE ROW LEVEL SECURITY';
  END $$;`;
  assert.deepStrictEqual(encontrarViolacoes(viaExecute, 'fake.sql'), [], 'EXECUTE com RLS não deveria acusar');

  const optOut = `-- rls-guard: skip tabela_sem_rls_consciente\nCREATE TABLE public.tabela_sem_rls_consciente (id INT);`;
  assert.deepStrictEqual(encontrarViolacoes(optOut, 'fake.sql'), [], 'opt-out documentado deveria ser aceito');
});
