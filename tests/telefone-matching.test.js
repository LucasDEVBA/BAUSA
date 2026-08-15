// Guard do matching de telefone (incidente 2026-08-15, duas caras):
//
// 1. FALSO POSITIVO no envios_sem_espelho: a Z-API espelha número BR ora com,
//    ora sem o nono dígito (5548999202289 no cadastro vs 554899202289 no
//    SentCallback). Comparar um único tail-10 nunca casava → 5 leads
//    alertados como "sem espelho" com a mensagem ENTREGUE.
// 2. FALHA REAL silenciosa no send-whatsapp: o piso fixo de 12 dígitos
//    rejeitava todo lead internacional (EUA +1 e Austrália +61 têm 11) com
//    invalid_phone — e o scheduler marcava *_sent_at mesmo assim (anti-loop),
//    então o lead nunca recebia NADA e nada acusava.
//
// Lição do incidente do calendar (2026-08-12): testar o parser com os
// formatos REAIS de produção, extraindo a função do código real — nunca uma
// cópia do teste. Zero dependências (node:test) — CI roda
// `node --test tests/*.test.js`.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const lerFn = (arquivo, regex, nome) => {
  const src = fs.readFileSync(path.join(__dirname, "..", arquivo), "utf8");
  const m = src.match(regex);
  assert.ok(m, `${nome} não encontrada em ${arquivo} — se renomeou, atualize este guard`);
  // eslint-disable-next-line no-new-func
  return new Function(`${m[0]}; return ${nome};`)();
};

// ─── tailsDe (monitor-health) — as duas grafias do nono dígito ───────────────

const tailsDe = lerFn(
  "functions/monitor-health/index.js",
  /const tailsDe = \(phone\) => \{[\s\S]*?\n\};/,
  "tailsDe",
);

test("tailsDe: cadastro com 9 casa com espelho Z-API sem 9 (caso Luana)", () => {
  const cadastro = tailsDe("+5548999202289");
  const espelho = tailsDe("554899202289");
  assert.ok(cadastro.some((t) => espelho.includes(t)), `${cadastro} vs ${espelho}`);
});

test("tailsDe: espelho com 9 também casa com cadastro sem 9", () => {
  const cadastro = tailsDe("+554899202289");
  const espelho = tailsDe("5548999202289");
  assert.ok(cadastro.some((t) => espelho.includes(t)));
});

test("tailsDe: internacional casa consigo mesmo e NÃO ganha variante BR", () => {
  assert.deepStrictEqual(tailsDe("+13214405556"), ["3214405556"]);
  assert.deepStrictEqual(tailsDe("+61451004010"), ["1451004010"]);
});

test("tailsDe: DDDs diferentes não colidem pela variante", () => {
  const luana = tailsDe("+5548999202289"); // DDD 48
  const outro = tailsDe("+5547999202289"); // DDD 47, mesmo número local
  assert.ok(!luana.some((t) => outro.includes(t)));
});

test("tailsDe: entrada inválida devolve lista vazia", () => {
  assert.deepStrictEqual(tailsDe(null), []);
  assert.deepStrictEqual(tailsDe("abc"), []);
  assert.deepStrictEqual(tailsDe("123"), []);
});

// A tela /observabilidade tem a MESMA correlação — paridade das duas grafias.
test("tela /observabilidade mantém as duas grafias do nono dígito", () => {
  const tela = fs.readFileSync(
    path.join(__dirname, "..", "apps/crm/src/lib/observabilidade-checks.ts"),
    "utf8",
  );
  assert.ok(/\^55\\d\{2\}9\\d\{8\}\$/.test(tela), "variante com 9 sumiu da tela");
  assert.ok(/\^55\\d\{10\}\$/.test(tela), "variante sem 9 sumiu da tela");
});

// ─── formatPhone (send-whatsapp) — E.164 internacional aceito ────────────────

const formatPhone = lerFn(
  "functions/send-whatsapp/index.js",
  /const formatPhone = \(phone\) => \{[\s\S]*?\n\};/,
  "formatPhone",
);

test("formatPhone: EUA +1 (11 dígitos) é aceito — caso Felipe", () => {
  assert.strictEqual(formatPhone("+13214405556"), "13214405556");
});

test("formatPhone: Austrália +61 (11 dígitos) é aceito — caso Benjamin", () => {
  assert.strictEqual(formatPhone("+61451004010"), "61451004010");
});

test("formatPhone: BR E.164 segue funcionando", () => {
  assert.strictEqual(formatPhone("+5548999202289"), "5548999202289");
});

test("formatPhone: BR legado sem DDI ganha o 55", () => {
  assert.strictEqual(formatPhone("11999999999"), "5511999999999");
});

test("formatPhone: curto demais ou longo demais é rejeitado", () => {
  assert.strictEqual(formatPhone("+123"), null);
  assert.strictEqual(formatPhone("+1234567890123456"), null); // 16 > E.164
  assert.strictEqual(formatPhone(""), null);
});
