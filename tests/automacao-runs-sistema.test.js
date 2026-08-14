// ════════════════════════════════════════════════════════════════════════
// Guard: registro das execuções de SISTEMA em automacao_runs
// ════════════════════════════════════════════════════════════════════════
//
// As CFs de sistema registram cada execução em automacao_runs (aba Execuções
// de /automacoes) apontando para âncoras com UUIDs FIXOS semeados pela
// migration 20260709220205_automacoes_sistema_runs.sql.
//
// INVARIANTES protegidos:
//   1. Cada CF instrumentada referencia a(s) âncora(s) esperada(s) E grava o
//      run em estado TERMINAL — literal `ok ? 'sucesso' : 'erro'` (aspas
//      simples ou duplas). Um run 'pendente'/'executando' entraria na fila da
//      automation-engine, que NÃO sabe executar automações de sistema.
//   2. Nenhuma CF cria run de sistema com status 'pendente'.
//   3. Todo UUID de âncora usado nas CFs existe na migration (CF ↔ migration
//      nunca divergem).
//
// Mesmo padrão zero-deps dos demais guards: análise estática por substring
// literal sobre o fonte sem comentários. Roda no CI via `node --test tests/`.
// ════════════════════════════════════════════════════════════════════════

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');

const lerFonte = (fn) =>
  stripComments(
    fs.readFileSync(path.join(__dirname, '..', 'functions', fn, 'index.js'), 'utf8'),
  );

const MIGRATION = fs.readFileSync(
  path.join(__dirname, '..', 'supabase', 'migrations', '20260709220205_automacoes_sistema_runs.sql'),
  'utf8',
);

// CF instrumentada → âncoras esperadas (UUIDs fixos da migration)
const ANCORAS = {
  'process-pending-whatsapp': [
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000002',
  ],
  'process-followup-whatsapp': [
    'a0000000-0000-4000-8000-000000000003',
    'a0000000-0000-4000-8000-000000000004',
  ],
  'process-scheduled-followups': ['a0000000-0000-4000-8000-000000000005'],
  'qualify-lead': ['a0000000-0000-4000-8000-000000000006'],
  'calendar-webhook': ['a0000000-0000-4000-8000-000000000007'],
  'send-messages': ['a0000000-0000-4000-8000-000000000008'],
};

// Estado terminal obrigatório — aceita aspas simples (padrão) e duplas
// (send-messages usa double quotes em todo o arquivo).
const STATUS_TERMINAL = ["ok ? 'sucesso' : 'erro'", 'ok ? "sucesso" : "erro"'];

for (const [fn, uuids] of Object.entries(ANCORAS)) {
  test(`${fn}: registra run de sistema nas âncoras esperadas em estado TERMINAL`, () => {
    const src = lerFonte(fn);

    for (const uuid of uuids) {
      assert.ok(
        src.includes(uuid),
        `${fn} deve referenciar a âncora ${uuid} (migration 20260709220205)`,
      );
    }

    assert.ok(
      STATUS_TERMINAL.some((literal) => src.includes(literal)),
      `${fn} deve gravar o run em estado terminal com o literal ` +
        `"ok ? 'sucesso' : 'erro'" — runs de sistema NUNCA nascem pendentes`,
    );

    assert.ok(
      src.includes('registrarRunSistema'),
      `${fn} deve conter o helper registrarRunSistema`,
    );
  });
}

test('nenhuma CF instrumentada cria run de sistema com status pendente', () => {
  for (const fn of Object.keys(ANCORAS)) {
    const src = lerFonte(fn);
    assert.ok(
      !src.includes("status: 'pendente'") && !src.includes('status: "pendente"'),
      `${fn} não pode inserir automacao_runs com status 'pendente' — a fila ` +
        'da automation-engine executaria um run que ela não sabe processar',
    );
  }
});

test('todo UUID de âncora usado nas CFs é semeado por ALGUMA migration', () => {
  // Migrations são forward-only: uma âncora nova entra por migration nova, e
  // não editando a de 2026-07. O guard varre todas — o que ele protege é que
  // a CF não use um id que ninguém semeia (run órfão, invisível na tela).
  const dir = path.join(__dirname, '..', 'supabase', 'migrations');
  const todasMigrations = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n');

  const uuidRegex = /a0000000-0000-4000-8000-[0-9a-f]{12}/g;
  for (const fn of Object.keys(ANCORAS)) {
    const src = lerFonte(fn);
    const usados = [...new Set(src.match(uuidRegex) || [])];
    assert.ok(usados.length > 0, `${fn} deve usar ao menos 1 UUID de âncora`);
    for (const uuid of usados) {
      assert.ok(
        todasMigrations.includes(uuid),
        `${fn} usa a âncora ${uuid}, que NENHUMA migration semeia — ` +
          'a execução ficaria órfã e não apareceria em /automacoes',
      );
    }
  }
});

test('migration semeia as 8 âncoras com gatilho sistema e ativo=FALSE', () => {
  for (let i = 1; i <= 8; i++) {
    const uuid = `a0000000-0000-4000-8000-00000000000${i}`;
    assert.ok(MIGRATION.includes(uuid), `migration deve semear a âncora ${uuid}`);
  }
  assert.ok(
    MIGRATION.includes("'sistema', FALSE"),
    "âncoras devem nascer com gatilho='sistema' e ativo=FALSE (fora da engine)",
  );
});
