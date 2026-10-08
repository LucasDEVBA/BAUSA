// Guard: a infraestrutura de testes de componente do Engine (Vitest + RTL +
// jest-axe) não pode ficar verde sem rodar nada nem esconder corrida de act.
//
// Três falhas silenciosas que a revisão do PR-05 reproduziu:
//  1. `pnpm --filter <pkg> test` sai com 0 quando o filtro não casa ou o
//     script some → job "Component Tests CRM" verde com 0 testes.
//  2. `include` só com .tsx → um `*.test.ts` passa no tsc/next build e nunca roda.
//  3. Sem `globals`, o RTL não liga IS_REACT_ACT_ENVIRONMENT → o React 19 não
//     emite "not wrapped in act(...)" e o teste fica intermitente sem sinal.
//
// Zero dependências (node:test) — CI roda `node --test tests/*.test.js`.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..");
const ler = (relativo) => fs.readFileSync(path.join(RAIZ, relativo), "utf8");

const CI = ler(".github/workflows/ci.yml");
const CONFIG = ler("apps/crm/vitest.config.mts");
const SETUP = ler("apps/crm/vitest.setup.ts");
const PACOTE = JSON.parse(ler("apps/crm/package.json"));

function blocoDoJob(yaml, nomeDoJob) {
  const inicio = yaml.indexOf(`\n  ${nomeDoJob}:\n`);
  assert.notStrictEqual(inicio, -1, `job ${nomeDoJob} sumiu do ci.yml`);
  const resto = yaml.slice(inicio + 1);
  const proximoJob = resto.slice(1).search(/\n {2}[a-z0-9-]+:\n/);
  return proximoJob === -1 ? resto : resto.slice(0, proximoJob + 1);
}

test("vitest infra: o job de CI roda no diretório do app, sem --filter (fail-closed)", () => {
  const job = blocoDoJob(CI, "component-tests-crm");
  assert.match(job, /working-directory:\s*apps\/crm/, "o passo do Vitest precisa rodar em apps/crm");
  assert.match(job, /run:\s*pnpm run test\s*$/m, "o passo do Vitest precisa ser `pnpm run test` (script ausente = saída 1)");
  assert.doesNotMatch(job, /^\s*(?:-\s*)?run:.*--filter/m, "`pnpm --filter … test` sai com 0 sem casar pacote/script — não usar no job");
});

test("vitest infra: o CI Passed depende do job de testes de componente", () => {
  const job = blocoDoJob(CI, "ci-passed");
  assert.match(job, /-\s*component-tests-crm\b/, "component-tests-crm saiu do needs do CI Passed");
});

test("vitest infra: script test não tolera zero testes", () => {
  assert.strictEqual(PACOTE.scripts?.test, "vitest run", "script test do apps/crm deve ser exatamente `vitest run`");
});

test("vitest infra: include cobre .test.ts e .test.tsx", () => {
  const include = CONFIG.match(/include:\s*\[([^\]]*)\]/);
  assert.ok(include, "include sumiu do vitest.config.mts");
  const padroes = include[1];
  const cobreAmbos =
    /\.test\.\{ts,tsx\}/.test(padroes) || (/\.test\.ts["']/.test(padroes) && /\.test\.tsx["']/.test(padroes));
  assert.ok(cobreAmbos, `include deve cobrir .test.ts e .test.tsx (atual: ${padroes.trim()})`);
});

test("vitest infra: o setup repõe o ambiente de act e o cleanup do RTL", () => {
  assert.match(
    SETUP,
    /beforeAll\([\s\S]*?IS_REACT_ACT_ENVIRONMENT\s*=\s*true/,
    "o setup precisa ligar IS_REACT_ACT_ENVIRONMENT no beforeAll",
  );
  assert.match(SETUP, /afterEach\([\s\S]*?cleanup\(\)/, "o setup precisa chamar cleanup() no afterEach");
});
