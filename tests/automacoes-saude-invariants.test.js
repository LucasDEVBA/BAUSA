// Guard da auto-instrumentação das automações (F4).
//
// Invariante de DESIGN travado aqui: a heurística de silêncio (mediana/
// baseline) existe SÓ na tela — o watchdog automático (monitor-health) usa
// apenas regras DETERMINÍSTICAS. Heurística nunca acorda o CEO.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const LIB_PATH = path.join(__dirname, "..", "apps/crm/src/lib/observabilidade-automacoes.ts");
const CF_PATH = path.join(__dirname, "..", "functions/monitor-health/index.js");

const lib = fs.readFileSync(LIB_PATH, "utf8");
const cf = fs.readFileSync(CF_PATH, "utf8");

test("saúde derivada: regras e guardrails presentes na tela", () => {
  assert.match(lib, /SILENCIO_PISO_HORAS = 24/, "piso absoluto de 24h da heurística sumiu");
  assert.match(lib, /SILENCIO_MIN_RUNS = 8/, "amostra mínima da heurística sumiu");
  assert.match(lib, /SILENCIO_BASELINE_MAX_HORAS = 72/, "teto de baseline curta sumiu");
  assert.match(lib, /mediana/, "mediana de intervalos sumiu da heurística");
  assert.match(lib, /sla_horas/, "override sla_horas sumiu da saúde derivada");
  assert.match(lib, /erros consecutivos/i, "regra de erro crônico sumiu");
  // Heurística de evento nunca pode virar crítico
  const trecho = lib.slice(lib.indexOf("Heurística de EVENTO"), lib.indexOf("(d) sem runs"));
  assert.match(trecho, /pior\("atencao"\)/, "heurística de evento deve ser NO MÁXIMO atenção");
  assert.doesNotMatch(trecho, /pior\("critico"\)/, "heurística de evento virou crítico — proibido");
});

test("watchdog: check automacoes_saude é SÓ determinístico (sem heurística)", () => {
  assert.ok(cf.includes("'automacoes_saude'"), "check automacoes_saude sumiu do monitor-health");
  const inicio = cf.indexOf("'automacoes_saude'");
  const fim = cf.indexOf("checkSeguro", inicio + 10);
  const bloco = cf.slice(inicio, fim > inicio ? fim : undefined);
  assert.doesNotMatch(bloco, /mediana|baseline/i, "heurística vazou para o watchdog — o alerta automático NUNCA usa heurística");
  assert.match(bloco, /sla_horas/, "SLA determinístico sumiu do watchdog");
  assert.match(bloco, /agendamento/, "regra determinística de agendamento sumiu do watchdog");
});

test("builder: sla_horas opcional plugado (state + save + form)", () => {
  const shared = fs.readFileSync(path.join(__dirname, "..", "apps/crm/src/components/automacoes/builder-shared.ts"), "utf8");
  assert.match(shared, /slaHoras: number \| null/, "slaHoras sumiu do BuilderState");
  // 2026-08-11: a montagem do payload saiu de client.tsx para builderParaInput
  // (fonte ÚNICA) — a página /automacoes e o modal da coluna do pipeline usam
  // a MESMA função. Duplicar essa lógica já causou bug real (o modal gravava
  // gatilho fixo e apagava o `dias` de automações de tempo).
  assert.match(shared, /export function builderParaInput/, "builderParaInput sumiu — a montagem do payload voltou a ser duplicada");
  assert.match(shared, /gatilhoConfig\.sla_horas = builder\.slaHoras/, "persistência do sla_horas sumiu de builderParaInput()");
  const client = fs.readFileSync(path.join(__dirname, "..", "apps/crm/src/app/(dashboard)/automacoes/client.tsx"), "utf8");
  assert.match(client, /builderParaInput\(builder\)/, "a tela /automacoes deve usar builderParaInput");
  const modal = fs.readFileSync(path.join(__dirname, "..", "apps/crm/src/components/pipeline/EtapaColunaModal.tsx"), "utf8");
  assert.match(modal, /builderParaInput\(builder\)/, "o modal da coluna deve usar builderParaInput (nunca montar gatilho à mão)");
  const forms = fs.readFileSync(path.join(__dirname, "..", "apps/crm/src/components/automacoes/BuilderForms.tsx"), "utf8");
  assert.match(forms, /SLA de silêncio/, "campo de SLA sumiu do form do gatilho");
});

test("deep-link: /observabilidade/automacoes → aba Execuções filtrada", () => {
  const tabs = fs.readFileSync(path.join(__dirname, "..", "apps/crm/src/app/(dashboard)/observabilidade/tabs.ts"), "utf8");
  assert.match(tabs, /\/observabilidade\/automacoes/, "aba Saúde das automações sumiu");
  const client = fs.readFileSync(path.join(__dirname, "..", "apps/crm/src/app/(dashboard)/automacoes/client.tsx"), "utf8");
  assert.match(client, /searchParams\.get\("automacao"\)/, "deep-link do filtro de automação sumiu");
  assert.match(client, /searchParams\.get\("tab"\)/, "deep-link da aba sumiu");
});
