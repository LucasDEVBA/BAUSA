// ════════════════════════════════════════════════════════════════════════
// Guard anti-drift: defaults do prompt de qualificação (CF ↔ UI)
// ════════════════════════════════════════════════════════════════════════
//
// Os defaults das seções editáveis do prompt Gemini existem em DOIS lugares:
//   • functions/qualify-lead/index.js (PROMPT_DEFAULTS — fallback em runtime)
//   • apps/crm/src/lib/automacoes/qualificacao-prompt-defaults.ts
//     (QUALIFICACAO_PROMPT_DEFAULTS — o que a UI exibe quando a config está vazia)
// Se divergirem, a UI mostraria um texto diferente do que a CF realmente usa.
// Este guard compara os dois objetos byte a byte e bloqueia o merge.
//
// Extração: regex ancorada na declaração + eval do literal (objetos puros de
// strings/template literals SEM interpolação — o {criterio_endereco} é texto).
// ════════════════════════════════════════════════════════════════════════

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const extrairObjeto = (arquivo, declaracao) => {
  const src = fs.readFileSync(path.join(__dirname, '..', arquivo), 'utf8');
  // Captura do `= {` até a PRIMEIRA linha que fecha o objeto na coluna 0 (`};`
  // ou `} as const;`) — os template literals internos nunca têm `}` na coluna 0.
  const re = new RegExp(`${declaracao}\\s*=\\s*(\\{[\\s\\S]*?\\n\\})(?: as const)?;`);
  const m = src.match(re);
  assert.ok(m, `${arquivo}: declaração "${declaracao}" não encontrada`);
  // eslint-disable-next-line no-eval
  return eval(`(${m[1]})`);
};

test('defaults do prompt: CF e UI byte-idênticos (anti-drift)', () => {
  const cf = extrairObjeto('functions/qualify-lead/index.js', 'const PROMPT_DEFAULTS');
  const ui = extrairObjeto(
    'apps/crm/src/lib/automacoes/qualificacao-prompt-defaults.ts',
    'export const QUALIFICACAO_PROMPT_DEFAULTS',
  );

  const chavesCf = Object.keys(cf).sort();
  const chavesUi = Object.keys(ui).sort();
  assert.deepStrictEqual(chavesUi, chavesCf, 'conjuntos de seções divergem entre CF e UI');

  for (const chave of chavesCf) {
    assert.strictEqual(
      ui[chave],
      cf[chave],
      `seção "${chave}" divergiu entre a CF (fonte da verdade) e a UI — sincronize os dois arquivos`,
    );
  }
});

test('defaults do prompt: criterio_morno contém o placeholder {criterio_endereco}', () => {
  const cf = extrairObjeto('functions/qualify-lead/index.js', 'const PROMPT_DEFAULTS');
  assert.ok(
    cf.criterio_morno.includes('{criterio_endereco}'),
    'o default do criterio_morno deve conter {criterio_endereco} (substituído pela variante BR/internacional)',
  );
});
