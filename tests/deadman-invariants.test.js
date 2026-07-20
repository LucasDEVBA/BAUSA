// Guard do dead-man's switch (F3): quem vigia o vigia não pode ser
// desmontado em silêncio. Trava o workflow (fail-closed em toda anomalia)
// e a policy anon restrita à chave do heartbeat.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const WF_PATH = path.join(__dirname, "..", ".github/workflows/deadman-monitor.yml");
const MIGRATION_DIR = path.join(__dirname, "..", "supabase/migrations");

test("dead-man: workflow existe, agenda a cada 30min e é fail-closed", () => {
  assert.ok(fs.existsSync(WF_PATH), "workflow deadman-monitor.yml sumiu");
  const wf = fs.readFileSync(WF_PATH, "utf8");
  assert.match(wf, /cron: "\*\/30 \* \* \* \*"/, "cron de 30min sumiu");
  assert.match(wf, /monitor_last_tick_at/, "leitura do heartbeat sumiu");
  assert.match(wf, /Accept-Profile: public/, "leitura deve ser do schema public");
  // Fail-closed: os 4 caminhos anômalos precisam de exit 1
  const exits = wf.match(/exit 1/g);
  assert.ok(exits && exits.length >= 4, `fail-closed enfraquecido — esperado ≥4 'exit 1', encontrado ${exits ? exits.length : 0}`);
  assert.match(wf, /SUPABASE_ANON_KEY/, "anon key (menor privilégio) sumiu — NUNCA usar service key aqui");
  assert.doesNotMatch(wf, /SERVICE_KEY|SERVICE_ROLE/i, "service key detectada no workflow — blast radius proibido (decisão D2)");
  assert.match(wf, /permissions:\s*\n\s*contents: none/, "workflow não precisa de NENHUMA permissão no repo");
});

test("dead-man: policy anon restrita à chave do heartbeat existe", () => {
  const arquivos = fs.readdirSync(MIGRATION_DIR).filter((f) => f.includes("deadman_anon_tick_policy"));
  assert.ok(arquivos.length >= 1, "migration da policy do dead-man sumiu");
  const sql = fs.readFileSync(path.join(MIGRATION_DIR, arquivos[0]), "utf8");
  assert.match(sql, /FOR SELECT TO anon/, "policy deve ser SELECT-only para anon");
  assert.match(sql, /chave = 'monitor_last_tick_at'/, "policy deve ser restrita EXATAMENTE à chave do tick (sem LIKE)");
  assert.doesNotMatch(sql, /LIKE/i, "policy com LIKE ampliaria a exposição — proibido");
});
