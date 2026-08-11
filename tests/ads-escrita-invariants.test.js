// Guard: invariantes das ações de ESCRITA no Meta Ads (A2).
//
// Decisões do CEO (2026-08-10): escrita SÓ CEO/CTO, com confirmação explícita
// na UI, auditada em audit_logs, usando token DEDICADO de gestão
// (META_ACCESS_TOKEN_MANAGE) — nunca o token de leitura do sync/telas.
// Este guard impede que um refactor remova qualquer um desses guardrails.
//
// Zero dependências (node:test) — CI roda `node --test tests/*.test.js`.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ACTIONS = fs.readFileSync(path.join(__dirname, "..", "apps/crm/src/lib/actions/ads.ts"), "utf8");
const LIB = fs.readFileSync(path.join(__dirname, "..", "apps/crm/src/lib/meta-ads-escrita.ts"), "utf8");
const LIB_LEITURA = fs.readFileSync(path.join(__dirname, "..", "apps/crm/src/lib/meta-ads.ts"), "utf8");
const UI = fs.readFileSync(path.join(__dirname, "..", "apps/crm/src/components/ads/AcoesAds.tsx"), "utf8");

test("ads A2: só CEO/CTO executa (gate de papel nas actions)", () => {
  assert.match(ACTIONS, /getUserPapel/, "gate de papel sumiu das actions de ads");
  assert.match(ACTIONS, /!== "ceo"/, "checagem papel === ceo sumiu (cto→ceo é resolvido no getUserPapel)");
});

test("ads A2: escrita usa o token DEDICADO de gestão, nunca o de leitura", () => {
  assert.match(LIB, /META_ACCESS_TOKEN_MANAGE/, "token de gestão sumiu da lib de escrita");
  assert.doesNotMatch(
    LIB,
    /META_ACCESS_TOKEN(?!_MANAGE)/,
    "a lib de ESCRITA referenciou o token de LEITURA — separação de chaves é invariante",
  );
  assert.doesNotMatch(
    LIB_LEITURA,
    /META_ACCESS_TOKEN_MANAGE/,
    "a lib de LEITURA referenciou o token de gestão — separação de chaves é invariante",
  );
});

test("ads A2: toda ação é validada (Zod) e auditada (audit_logs)", () => {
  assert.match(ACTIONS, /safeParse/, "validação Zod sumiu das actions");
  assert.match(ACTIONS, /audit_logs/, "registro em audit_logs sumiu");
  assert.match(ACTIONS, /dados_anteriores/, "estado ANTERIOR deixou de ser registrado no audit");
  assert.match(ACTIONS, /lerEstadoAtual/, "leitura do estado anterior à mudança sumiu");
  assert.match(ACTIONS, /revalidatePath/, "revalidatePath sumiu — UI ficaria stale após a ação");
});

test("ads A2: teto de sanidade no orçamento diário", () => {
  assert.match(ACTIONS, /ORCAMENTO_MAX_BRL/, "teto de orçamento sumiu");
  const m = ACTIONS.match(/ORCAMENTO_MAX_BRL = (\d+)/);
  assert.ok(m && Number(m[1]) <= 10000, "teto de orçamento acima de R$10.000/dia — decisão consciente exigida");
});

test("ads A2: UI exige confirmação explícita antes de executar", () => {
  assert.match(UI, /Confirmar/, "botão de confirmação sumiu da UI de ações");
  assert.match(UI, /setConfirmando\(true\)/, "o clique direto deixou de abrir confirmação (status)");
  assert.match(UI, /aria-modal="true"/, "overlay de confirmação sem semântica de diálogo");
  assert.match(UI, /Reativar pode voltar a gastar/, "aviso de gasto ao reativar sumiu");
});

test("ads A2: token de gestão nunca vai em URL (Authorization header)", () => {
  assert.match(LIB, /Authorization: `Bearer \$\{tokenGestao\(\)\}`/, "Authorization header sumiu da lib de escrita");
  assert.doesNotMatch(LIB, /access_token=/, "token apareceu em querystring na lib de escrita");
});
