// Guard de invariantes da Observabilidade (Engine).
//
// Contexto (incidente 2026-07-15/17): a Z-API caiu por ~2 dias sem detecção —
// o CAS marca *_sent_at antes do envio, a CF send-whatsapp responde 200 mesmo
// em falha e a Z-API aceita mensagens desconectada. A tela /observabilidade
// nasceu para detectar essa classe de falha. Este guard trava os checks que a
// pegariam, para nenhum refactor futuro removê-los silenciosamente.
//
// Mesma classe do guard dos schedulers (tests/scheduler-eligibility.test.js):
// verificação estática de código, zero dependências, roda no CI via
// `node --test tests/*.test.js`.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const CHECKS_PATH = path.join(
  __dirname,
  "..",
  "apps/crm/src/lib/observabilidade-checks.ts",
);
const src = fs.readFileSync(CHECKS_PATH, "utf8");

test("observabilidade: checa o estado REAL da conexão Z-API (/status)", () => {
  assert.match(src, /zapiRequest\([^)]*"\/status"\)/, "check de /status da Z-API sumiu");
  assert.match(src, /smartphoneConnected/, "verificação de smartphoneConnected sumiu");
});

test("observabilidade: checa a fila interna da Z-API (/queue/count)", () => {
  assert.match(src, /zapiRequest\([^)]*"\/queue\/count"\)/, "check da fila interna sumiu");
});

test("observabilidade: detecta envios marcados sem espelho de entrega", () => {
  assert.match(src, /whatsapp_mensagens/, "consulta ao espelho whatsapp_mensagens sumiu");
  assert.match(src, /from_me/, "filtro from_me (mensagens enviadas) sumiu");
  // As 4 colunas de marcação de envio precisam estar cobertas.
  for (const col of [
    "whatsapp_sent_at",
    "followup_1_sent_at",
    "followup_2_sent_at",
    "scheduled_followup_sent_at",
  ]) {
    assert.ok(src.includes(col), `coluna ${col} saiu do check de espelho`);
  }
});

test("observabilidade: filas presas mantêm o invariante classe QUENTE/MORNO", () => {
  const ocorrencias = src.match(
    /\.in\("qualification_classification", \["QUENTE", "MORNO"\]\)/g,
  );
  assert.ok(
    ocorrencias && ocorrencias.length >= 4,
    `filtro de classe QUENTE/MORNO deve aparecer nas 4 filas (inicial, timing alt, FU1, FU2) — encontrado ${ocorrencias ? ocorrencias.length : 0}x`,
  );
});

test("observabilidade: filas presas mantêm o invariante de timing_status", () => {
  const ideais = src.match(/timing_status\.is\.null,timing_status\.eq\.ideal/g);
  assert.ok(
    ideais && ideais.length >= 3,
    `filtro timing ideal deve aparecer em inicial + FU1 + FU2 — encontrado ${ideais ? ideais.length : 0}x`,
  );
  assert.match(
    src,
    /\.in\("timing_status", \["muito_cedo", "tarde_demais"\]\)/,
    "filtro do bucket de timing alternativo sumiu",
  );
});

test("observabilidade: filas presas respeitam o gate de aprovação humana", () => {
  // Paridade com os schedulers (2026-08-10): lead sem aprovacao_status=aprovado
  // está retido de propósito — contá-lo como "fila presa" é falso-positivo.
  // 3 filas gated: inicial (bucket A), timing alternativo (bucket B) e
  // retomada de novembro. FU1/FU2 dispensam (whatsapp_sent_at implica aprovado).
  const ocorrencias = src.match(/\.eq\("aprovacao_status", "aprovado"\)/g);
  assert.ok(
    ocorrencias && ocorrencias.length >= 3,
    `filtro de aprovação deve aparecer nas filas inicial + timing alt + retomada — encontrado ${ocorrencias ? ocorrencias.length : 0}x`,
  );
});

test("observabilidade: detecta anomalias de timing entre etapas", () => {
  assert.match(src, /followup_1_horas/, "prazo configurável do follow-up 1 sumiu");
  assert.match(src, /followup_2_horas/, "prazo configurável do follow-up 2 sumiu");
  assert.match(src, /sequência inválida/i, "detecção de etapa fora de sequência sumiu");
});

// ─── Lições da revisão adversarial (bugs reais pegos pré-merge) ──────────────

test("observabilidade: form_submissions usa submitted_at (created_at NÃO existe)", () => {
  // PostgREST devolve 400 sem lançar exceção; um filtro em coluna inexistente
  // vira lista vazia silenciosa (foi exatamente assim que o monitor antigo
  // ficou cego). Nenhuma query de form_submissions pode usar created_at —
  // whatsapp_mensagens e automacao_runs TÊM created_at, então a checagem é
  // escopada por cadeia `.from("form_submissions")`.
  const ofensasEmQueriesDeFormSubmissions = (codigo, origem) => {
    const ofensas = [];
    for (const seg of codigo.split('.from("').slice(1)) {
      if (!seg.startsWith('form_submissions"')) continue;
      const cadeia = seg.slice(0, 900); // aproxima o tamanho de uma query chain
      if (
        /\.(gte|lt|lte|order)\("created_at"/.test(cadeia) ||
        /select\("[^"]*\bcreated_at/.test(cadeia)
      ) {
        ofensas.push(origem);
      }
    }
    return ofensas;
  };

  assert.match(src, /submitted_at/, "uso de submitted_at sumiu de observabilidade-checks");
  const srcQueries = fs.readFileSync(
    path.join(__dirname, "..", "apps/crm/src/lib/automacoes-queries.ts"),
    "utf8",
  );
  const ofensas = [
    ...ofensasEmQueriesDeFormSubmissions(src, "observabilidade-checks.ts"),
    ...ofensasEmQueriesDeFormSubmissions(srcQueries, "automacoes-queries.ts"),
  ];
  assert.deepStrictEqual(
    ofensas,
    [],
    `query de form_submissions voltou a usar created_at em: ${ofensas.join(", ")}`,
  );
});

test("observabilidade: erros de query PostgREST são inspecionados (não lançam)", () => {
  assert.match(src, /\.error\b/, "inspeção de res.error sumiu dos checks");
  assert.match(src, /Falha na consulta/, "surfacing de falha de consulta sumiu");
});

test("observabilidade: ping de CF SEMPRE envia secret inválido (nunca sem header)", () => {
  // retry-qualification e send-remarketing são fail-open: sem o header,
  // executam o job real. Com header presente e errado, todas respondem 401.
  assert.match(
    src,
    /"x-webhook-secret":\s*"observability-ping-invalido"/,
    "ping das CFs deixou de enviar o secret deliberadamente inválido",
  );
});

test("observabilidade: espelho correlaciona POR MARCA e por telefone (tails)", () => {
  // tailsDe substitui o tail10 único (2026-08-15): a Z-API espelha número BR
  // ora com, ora sem o nono dígito — as duas grafias precisam casar.
  assert.match(src, /tailsDe\(/, "correlação por tail do telefone sumiu");
  assert.match(src, /athlete_whatsapp/, "telefone do atleta saiu da correlação");
  assert.match(src, /guardian_whatsapp/, "telefone do responsável saiu da correlação");
});
