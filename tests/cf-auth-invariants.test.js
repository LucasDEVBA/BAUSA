// Guard de invariantes de AUTH das Cloud Functions.
//
// Contexto (2026-07-17): 12 CFs validavam o x-webhook-secret em modo FAIL-OPEN
// (só rejeitavam se o header estivesse PRESENTE e errado). Como todas são
// --allow-unauthenticated (org policy), qualquer chamada anônima da internet
// executava o job completo — incluindo os schedulers de WhatsApp, NPS,
// requalificação Gemini e disparo de re-marketing. Este guard proíbe o padrão
// fail-open em QUALQUER CF, para sempre.
//
// Padrão canônico obrigatório (o mesmo do send-whatsapp):
//   if (!WEBHOOK_SECRET || req.headers['x-webhook-secret'] !== WEBHOOK_SECRET)
//
// Zero dependências (node:test) — roda no CI via `node --test tests/*.test.js`.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const FUNCTIONS_DIR = path.join(__dirname, "..", "functions");

// Assinaturas fail-open proibidas (leitura do header de REQUEST):
//   A) if (WEBHOOK_SECRET && req.headers['x-webhook-secret']) { ... }  → sem header, pula auth
//   B) WEBHOOK_SECRET && req.headers[...] && req.headers[...] !== ...  → idem
//   C) if (WEBHOOK_SECRET && req.headers[...] !== ...)                 → sem env var, pula auth
// (Não confundir com o uso de SAÍDA `headers['x-webhook-secret'] = WEBHOOK_SECRET`,
// que é legítimo — as regexes abaixo casam apenas leituras de req.headers.)
const PADROES_FAIL_OPEN = [
  /if\s*\(\s*WEBHOOK_SECRET\s*&&\s*req\.headers\['x-webhook-secret'\]\s*\)/,
  /WEBHOOK_SECRET\s*&&\s*req\.headers\['x-webhook-secret'\]\s*&&/,
  /if\s*\(\s*WEBHOOK_SECRET\s*&&\s*req\.headers\['x-webhook-secret'\]\s*!==/,
];

const CANONICO = /!WEBHOOK_SECRET\s*\|\|\s*req\.headers\['x-webhook-secret'\]\s*!==\s*WEBHOOK_SECRET/;

// Forma equivalente aceita (qualify-lead/send-whatsapp/sync-leads, pré-existente):
//   if (WEBHOOK_SECRET) { const incoming = req.headers[...]; if (incoming !== WEBHOOK_SECRET) reject }
// Header AUSENTE → incoming undefined ≠ secret → rejeita (fail-closed no caso
// que importa). Difere do canônico só no cenário de env var ausente.
const EQUIVALENTE = /const incoming = req\.headers\['x-webhook-secret'\];\s*\n?\s*if \(incoming !== WEBHOOK_SECRET\)/;

const cfs = fs
  .readdirSync(FUNCTIONS_DIR)
  .filter((d) => fs.existsSync(path.join(FUNCTIONS_DIR, d, "index.js")));

test("nenhuma CF valida o x-webhook-secret em modo fail-open", () => {
  const ofensas = [];
  for (const cf of cfs) {
    const src = fs.readFileSync(path.join(FUNCTIONS_DIR, cf, "index.js"), "utf8");
    for (const padrao of PADROES_FAIL_OPEN) {
      if (padrao.test(src)) ofensas.push(`${cf} (padrão: ${padrao})`);
    }
  }
  assert.deepStrictEqual(
    ofensas,
    [],
    `CFs com auth fail-open (qualquer chamada anônima executa o job): ${ofensas.join("; ")}`,
  );
});

test("toda CF que lê o x-webhook-secret usa o padrão canônico fail-closed", () => {
  const semCanonico = [];
  for (const cf of cfs) {
    const src = fs.readFileSync(path.join(FUNCTIONS_DIR, cf, "index.js"), "utf8");
    // Só CFs que LEEM o header em requests (validação); envio de header em
    // chamadas de SAÍDA não conta.
    if (!/req\.headers\['x-webhook-secret'\]/.test(src)) continue;
    if (!CANONICO.test(src) && !EQUIVALENTE.test(src)) semCanonico.push(cf);
  }
  assert.deepStrictEqual(
    semCanonico,
    [],
    `CFs lendo o secret sem o padrão canônico !WEBHOOK_SECRET || header !== SECRET: ${semCanonico.join(", ")}`,
  );
});

test("scheduler.sh envia o header x-webhook-secret em todos os jobs", () => {
  const sh = fs.readFileSync(path.join(__dirname, "..", "infra", "scheduler.sh"), "utf8");
  const creates = (sh.match(/jobs create http/g) ?? []).length;
  const updates = (sh.match(/jobs update http/g) ?? []).length;
  const headers = (sh.match(/--headers="x-webhook-secret=/g) ?? []).length;
  const updateHeaders = (sh.match(/--update-headers="x-webhook-secret=/g) ?? []).length;
  assert.strictEqual(headers, creates, `todo "jobs create" precisa de --headers (${headers}/${creates})`);
  assert.strictEqual(updateHeaders, updates, `todo "jobs update" precisa de --update-headers (${updateHeaders}/${updates})`);
  assert.match(sh, /WEBHOOK_SECRET não definido/, "guard de WEBHOOK_SECRET obrigatório sumiu do scheduler.sh");
});
