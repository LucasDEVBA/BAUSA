// Guard de invariantes do monitor-health v2 (watchdog automático).
//
// Contexto (incidente 2026-07-15/17): a Z-API caiu 2 dias sem detecção — o
// watchdog só tinha 3 checks e alertava pela própria Z-API monitorada. O v2
// ganhou os checks anti-incidente, canal de e-mail independente e o heartbeat
// do dead-man's switch. Este guard trava tudo isso + a PARIDADE com a tela
// /observabilidade (mesma lógica nos dois lados), para nenhum refactor
// remover a detecção silenciosamente.
//
// Zero dependências (node:test) — CI roda `node --test tests/*.test.js`.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const CF_PATH = path.join(__dirname, "..", "functions/monitor-health/index.js");
const TELA_PATH = path.join(__dirname, "..", "apps/crm/src/lib/observabilidade-checks.ts");
const MIGRATION_DIR = path.join(__dirname, "..", "supabase/migrations");

const cf = fs.readFileSync(CF_PATH, "utf8");
const tela = fs.readFileSync(TELA_PATH, "utf8");

// Chaves que o watchdog AUTOMÁTICO precisa verificar a cada 30min.
const CHAVES_CF = [
  "qualificacao_travada",
  "fila_whatsapp_presa",
  "runs_erro",
  "zapi_conexao",
  "envios_sem_espelho",
  "entrada_zero",
  "chatbot_erro",
  "remarketing_presa",
  "regua_cobranca",
  "experiencia_nps",
  "meta_frescor",
  "transcricao_faltante",
  "runs_presos",
  // Sinais criados na F2 (fluxos que antes não deixavam rastro)
  "calendar_watch_expirando",
  "sheets_sync_pendente",
  "weekly_report_atrasado",
  "billing_tick_atrasado",
];

test("monitor-health: todos os checks do watchdog presentes", () => {
  for (const chave of CHAVES_CF) {
    assert.ok(
      cf.includes(`'${chave}'`),
      `check '${chave}' sumiu do watchdog automático (monitor-health)`,
    );
  }
});

test("monitor-health: checks anti-incidente buscam sinais POSITIVOS de vida", () => {
  assert.match(cf, /smartphoneConnected/, "verificação do estado real da Z-API sumiu");
  assert.match(cf, /whatsapp_mensagens/, "consulta ao espelho de mensagens sumiu");
  assert.match(cf, /from_me/, "filtro from_me do espelho sumiu");
  for (const col of [
    "whatsapp_sent_at",
    "followup_1_sent_at",
    "followup_2_sent_at",
    "scheduled_followup_sent_at",
  ]) {
    assert.ok(cf.includes(col), `coluna ${col} saiu do check de espelho da CF`);
  }
});

test("monitor-health: canal de e-mail independente da Z-API (Resend E Brevo)", () => {
  assert.match(cf, /api\.resend\.com/, "canal Resend sumiu — sem e-mail o alerta morre junto com a Z-API");
  assert.match(cf, /api\.brevo\.com/, "fallback Brevo sumiu");
  assert.match(cf, /sendEmailWithFallback/, "envio de e-mail com fallback sumiu do fluxo de alerta");
});

test("monitor-health: heartbeat do dead-man com gate de produção e campos seguros", () => {
  assert.match(cf, /monitor_last_tick_at/, "gravação do heartbeat sumiu — o dead-man ficaria cego");
  assert.match(
    cf,
    /SUPABASE_SCHEMA !== 'public' \|\| dryRun/,
    "gate de produção do tick sumiu — UAT/dry poderia mascarar um monitor morto",
  );
  // O valor do tick é legível por anon (policy do dead-man): SÓ campos agregados.
  const inicio = cf.indexOf("const registrarTick");
  const fim = cf.indexOf("\n};", inicio);
  assert.ok(inicio >= 0 && fim > inicio, "função registrarTick sumiu");
  const bloco = cf.slice(inicio, fim);
  assert.match(bloco, /at: new Date\(\)\.toISOString\(\)/, "campo at do tick sumiu");
  assert.doesNotMatch(bloco, /athlete|email|phone|whatsapp_sent/, "o tick NÃO pode carregar dados de leads (é legível por anon)");
});

test("monitor-health: supressão consciente ANTES do cooldown + cooldown por chave", () => {
  assert.match(cf, /monitor_checks_desativados/, "supressão de checks pausados de propósito sumiu");
  assert.match(cf, /ultimo\[c\.chave\]/, "cooldown keyed por chave sumiu");
});

test("monitor-health: link do alerta aponta para a tela nova", () => {
  assert.match(cf, /\/observabilidade/, "link /observabilidade sumiu do alerta");
  assert.doesNotMatch(cf, /link: '\/automacoes-monitor'/, "link in-app voltou para a rota antiga");
});

test("monitor-health: auth fail-closed preservada", () => {
  assert.match(
    cf,
    /!WEBHOOK_SECRET \|\| req\.headers\['x-webhook-secret'\] !== WEBHOOK_SECRET/,
    "auth fail-closed sumiu do monitor-health",
  );
});

test("paridade: os checks novos existem TAMBÉM na tela /observabilidade", () => {
  for (const token of [
    "entrada_zero",
    "chatbot_erro",
    "remarketing_presa",
    "regua_cobranca",
    "experiencia_nps",
    "meta_frescor",
    "transcricao_faltante",
    "runs_presos",
    "chatbot_autonomo_log",
    "remarketing_campanhas",
    "meta_ads_campanha",
    "reunioes_transcricoes",
    "regua_dneg3_at",
    "calendar_watch_state",
    "sheets_synced_at",
    "weekly_report_state",
    "billing_last_tick_at",
    "REMARKETING_UNSUBSCRIBE_URL",
  ]) {
    assert.ok(tela.includes(token), `paridade quebrada: '${token}' sumiu da tela /observabilidade`);
  }
});

test("F2: escritores de sinal presentes nas CFs (fail-open)", () => {
  const renew = fs.readFileSync(path.join(__dirname, "..", "functions/renew-calendar-watch/index.js"), "utf8");
  assert.match(renew, /calendar_watch_state/, "renew-calendar-watch deixou de gravar o watch_state");
  assert.match(renew, /watch_state_save_failed/, "fail-open do watch_state sumiu");

  const sync = fs.readFileSync(path.join(__dirname, "..", "functions/sync-leads/index.js"), "utf8");
  assert.match(sync, /sheets_synced_at=is\.null/, "CAS do sheets_synced_at sumiu do sync-leads");
  assert.match(sync, /marcarSheetsSynced/, "carimbo de sync sumiu do sync-leads");

  const weekly = fs.readFileSync(path.join(__dirname, "..", "functions/weekly-report/index.js"), "utf8");
  assert.match(weekly, /weekly_report_state/, "weekly-report deixou de gravar o state");
  assert.match(weekly, /if \(sent > 0\)/, "state do weekly-report deve ser gravado SÓ com sent>0");

  const billing = fs.readFileSync(path.join(__dirname, "..", "functions/billing-reminders/index.js"), "utf8");
  assert.match(billing, /billing_last_tick_at/, "heartbeat da régua sumiu do billing-reminders");
});

test("F2: migration dos sinais existe (coluna + backfill + seeds)", () => {
  const arquivos = fs.readdirSync(MIGRATION_DIR).filter((f) => f.includes("sinais_observabilidade"));
  assert.ok(arquivos.length >= 1, "migration sinais_observabilidade sumiu");
  const sql = fs.readFileSync(path.join(MIGRATION_DIR, arquivos[0]), "utf8");
  assert.match(sql, /ADD COLUMN IF NOT EXISTS sheets_synced_at/, "coluna sheets_synced_at sumiu");
  assert.match(sql, /SET sheets_synced_at = submitted_at/, "backfill do sheets_synced_at sumiu");
  for (const chave of ["calendar_watch_state", "weekly_report_state", "billing_last_tick_at"]) {
    assert.ok(sql.includes(chave), `seed da chave ${chave} sumiu`);
  }
});

test("migration: seeds das chaves do monitor v2 existem", () => {
  const arquivos = fs.readdirSync(MIGRATION_DIR).filter((f) => f.includes("monitor_v2_config_keys"));
  assert.ok(arquivos.length >= 1, "migration de seeds do monitor v2 sumiu");
  const sql = fs.readFileSync(path.join(MIGRATION_DIR, arquivos[0]), "utf8");
  assert.match(sql, /monitor_last_tick_at/, "seed do heartbeat sumiu da migration");
  assert.match(sql, /monitor_checks_desativados/, "seed da supressão sumiu da migration");
  assert.match(sql, /ON CONFLICT \(chave\) DO NOTHING/, "seeds precisam ser idempotentes");
});

test("fetchMonitorData: thresholds configuráveis + filtro de timing (anti falso-positivo)", () => {
  const queries = fs.readFileSync(
    path.join(__dirname, "..", "apps/crm/src/lib/automacoes-queries.ts"),
    "utf8",
  );
  assert.match(queries, /scheduler_intervalos/, "fetchMonitorData voltou aos thresholds hardcoded");
  const ocorrenciasTiming = queries.match(/timing_status\.is\.null,timing_status\.eq\.ideal/g);
  assert.ok(
    ocorrenciasTiming && ocorrenciasTiming.length >= 4,
    `filtro de timing deve estar nas 4 filas (inicial, FU1, FU2, trancados) — encontrado ${ocorrenciasTiming ? ocorrenciasTiming.length : 0}x`,
  );
  assert.doesNotMatch(queries, /horasAtras\(22\)|horasAtras\(48\)/, "threshold hardcoded voltou ao fetchMonitorData");
});
