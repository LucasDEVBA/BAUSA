// Guard: invariantes do A4-Planner (planejador de campanhas com IA).
//
// Decisões do CEO (2026-08-11):
// 1. Badges de confiança são DETERMINÍSTICOS (regras sobre massa de dados,
//    ads-confianca.ts) — a IA NUNCA se autoavalia para o badge.
// 2. Cérebro que aprende: ads_aprendizados alimenta o prompt do planner E
//    dos insights de CAC; cada plano gerado vira aprendizado.
// 3. O planner NUNCA cria campanha via API — briefing é para preenchimento
//    manual no Gerenciador de Anúncios.
//
// Zero dependências (node:test) — CI roda `node --test tests/*.test.js`.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ler = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const ACTION = ler("apps/crm/src/lib/actions/ads-planner.ts");
const CONFIANCA = ler("apps/crm/src/lib/ads-confianca.ts");
const BRIEFING = ler("apps/crm/src/components/ads/BriefingView.tsx");
const CAC_INSIGHTS = ler("apps/crm/src/lib/actions/cac-insights.ts");

test("planner: confiança vem do motor determinístico, nunca da IA", () => {
  assert.match(ACTION, /calcularConfianca/, "cálculo determinístico de confiança sumiu da action");
  assert.match(ACTION, /CONFIANÇA POR DIMENSÃO \(calculada por regras/, "o prompt deixou de INFORMAR a confiança calculada à IA");
  // A view renderiza badges SÓ do mapa do server (prop confianca), nunca de campo vindo do LLM
  assert.match(BRIEFING, /ConfiancaBadge/, "badge de confiança sumiu da view do briefing");
  assert.doesNotMatch(BRIEFING, /plano\.(confianca|nivel)/, "a view leu confiança de dentro do plano da IA — badge deve vir do mapa determinístico");
});

test("planner A4.1: plano vira entidade salva, editável só nos campos-chave, UTM intocável", () => {
  assert.match(ACTION, /from\("ads_planos"\)/, "persistência do plano em ads_planos sumiu");
  assert.match(ACTION, /atualizarPlanoAds/, "action de personalização do plano sumiu");
  assert.match(ACTION, /UTM_BLOCO_CANONICO/, "o UTM canônico compartilhado sumiu da action");
  // A personalização NÃO pode permitir editar o bloco de UTM nem o checklist
  assert.doesNotMatch(ACTION, /utmBloco.*optional|checklistMeta.*optional/, "campos intocáveis (UTM/checklist) viraram editáveis");
  // UTM em destaque no TOPO da view (decisão do CEO: primordial)
  assert.match(BRIEFING, /UtmDestaque/, "o destaque de UTM sumiu da view");
  assert.match(BRIEFING, /PRIMORDIAL/, "o selo PRIMORDIAL do UTM sumiu");
});

test("planner: níveis e limiares documentados no motor de confiança", () => {
  for (const nivel of ["assertiva", "parcial", "sugestiva"]) {
    assert.ok(CONFIANCA.includes(`"${nivel}"`), `nível ${nivel} sumiu do motor`);
  }
  assert.match(CONFIANCA, /LEADS_ASSERTIVA/, "limiar de leads p/ assertiva sumiu");
  assert.match(CONFIANCA, /leadsAtribuidos/, "evidência de atribuição sumiu do motor");
});

test("planner: cérebro alimenta os prompts e cresce a cada plano", () => {
  assert.match(ACTION, /ads_aprendizados/, "leitura de aprendizados sumiu do planner");
  assert.match(ACTION, /APRENDIZADOS ANTERIORES/, "bloco de aprendizados sumiu do prompt do planner");
  assert.match(ACTION, /tipo: "plano_gerado"/, "o plano gerado deixou de virar aprendizado (cérebro parou de crescer)");
  assert.match(CAC_INSIGHTS, /ads_aprendizados/, "insights de CAC deixaram de consultar o cérebro");
  assert.match(CAC_INSIGHTS, /APRENDIZADOS ANTERIORES DE ADS/, "bloco de aprendizados sumiu do prompt do cac-insights");
});

test("planner: NUNCA cria campanha via API (só briefing manual)", () => {
  assert.doesNotMatch(ACTION, /meta-ads-escrita/, "o planner importou a lib de ESCRITA — planner é somente análise");
  assert.doesNotMatch(ACTION, /alterarStatus|alterarOrcamento/, "o planner referenciou ações de escrita");
});

test("planner: UTM dinâmico correto (fecha a atribuição via campaign.id)", () => {
  const utm = ler("apps/crm/src/lib/ads-utm.ts");
  assert.match(utm, /utm_id=\{\{campaign\.id\}\}/, "o bloco de UTM perdeu o utm_id dinâmico — o ROI exato depende dele");
  // A IA já inventou UTMs próprios no checklist (sem utm_id → atribuição quebra).
  // O pós-processamento determinístico que os substitui é invariante.
  assert.match(ACTION, /plano\.checklistMeta = plano\.checklistMeta\.map/, "sanitizador de UTMs inventados no checklist sumiu");
});

test("planner: só CEO/CTO + saída da IA validada por Zod", () => {
  assert.match(ACTION, /getUserPapel/, "gate de papel sumiu");
  assert.match(ACTION, /planoSchema\.parse/, "validação Zod da resposta da IA sumiu");
  assert.match(ACTION, /GeminiNotConfiguredError/, "degradação sem GEMINI_API_KEY sumiu");
});
