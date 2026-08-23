'use strict';

// Guard — cura de DDI ausente (incidente Gustavo Telles, 2026-08-23).
//
// O formulário deixava passar E.164 quebrado ("+28999711222" = DDD 28 com o
// "+" colado, sem o 55) e o send-whatsapp confiava no "+" — o responsável
// nunca recebeu o link de agendamento enquanto o atleta recebia follow-ups.
// 69 leads afetados na varredura.
//
// Invariantes:
//   1. healBrDdiAusente cura o padrão inequívoco BR (testado com números
//      REAIS da varredura) e NUNCA reescreve número internacional legítimo.
//   2. A lista de DDDs é IDÊNTICA nos 3 espelhos (send-whatsapp,
//      monitor-health, telefone-analise.ts do Engine).
//   3. Os checks de espelho correlacionam POR DESTINATÁRIO — o espelho do
//      atleta nunca mais mascara a falha do responsável.
//   4. O formulário valida com isValidPhoneNumber nos DOIS telefones.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sendSrc = fs.readFileSync(
  path.join(__dirname, '..', 'functions', 'send-whatsapp', 'index.js'), 'utf8');
const monitorSrc = fs.readFileSync(
  path.join(__dirname, '..', 'functions', 'monitor-health', 'index.js'), 'utf8');
const analiseSrc = fs.readFileSync(
  path.join(__dirname, '..', 'apps', 'crm', 'src', 'lib', 'telefone-analise.ts'), 'utf8');
const telaSrc = fs.readFileSync(
  path.join(__dirname, '..', 'apps', 'crm', 'src', 'lib', 'observabilidade-checks.ts'), 'utf8');
const formSrc = fs.readFileSync(
  path.join(__dirname, '..', 'apps', 'web', 'src', 'components', 'forms', 'FormsPage.tsx'), 'utf8');

// ─── Extrai a cura REAL da CF (roda de verdade, não só grep) ────────────

const mDdd = sendSrc.match(/const DDD_VALIDOS = new Set\(\[[\s\S]*?\]\);/);
assert.ok(mDdd, 'DDD_VALIDOS não encontrado no send-whatsapp');
const mHeal = sendSrc.match(/const healBrDdiAusente = \(phone, addressCountry\) => \{[\s\S]*?\n\};/);
assert.ok(mHeal, 'healBrDdiAusente não encontrada — atualize o guard se renomeou');
// eslint-disable-next-line no-new-func
const heal = new Function('log', `${mDdd[0]}; ${mHeal[0]}; return healBrDdiAusente;`)(() => {});

test('heal: números REAIS da varredura são curados para +55', () => {
  // Gustavo Telles — o caso reportado (DDD 28 do ES, responsável Débora):
  assert.equal(heal('+28999711222', 'BR'), '+5528999711222');
  // Casos que pareciam DDI REAL de outro país (o pior modo de falha):
  assert.equal(heal('+49999539001', 'BR'), '+5549999539001'); // parecia Alemanha; é DDD 49
  assert.equal(heal('+27992236379', 'BR'), '+5527992236379'); // parecia África do Sul; é DDD 27
  assert.equal(heal('+21997661479', 'BR'), '+5521997661479'); // DDI 21 nem existe; é DDD 21
  assert.equal(heal('+51981240727', 'BR'), '+5551981240727'); // parecia Peru; é DDD 51
  // 10 dígitos (fixo/celular antigo sem o 9):
  assert.equal(heal('+1992601176', 'BR'), '+551992601176'); // DDD 19 + 8 dígitos
  // address_country NULL = default BR do formulário:
  assert.equal(heal('+28999711222', null), '+5528999711222');
  assert.equal(heal('+28999711222', undefined), '+5528999711222');
});

test('heal: número internacional legítimo NUNCA é reescrito', () => {
  // País declarado ≠ BR: o DDI do lead é dele (celular peruano real +51 9…
  // tem a MESMA forma do padrão quebrado — o país é o desempate):
  assert.equal(heal('+51987654321', 'OTHER'), '+51987654321');
  assert.equal(heal('+16492477571', 'OTHER'), '+16492477571'); // Turks and Caicos
  assert.equal(heal('+971521513618', 'OTHER'), '+971521513618'); // Emirados
  // País BR mas SEM a forma de celular BR (3º dígito ≠ 9): número US real
  // de brasileiro morando fora — intocado (caso José Guilherme, +1 305):
  assert.equal(heal('+13054409250', 'BR'), '+13054409250');
  // +55 válido (12–13 dígitos) jamais entra na regra:
  assert.equal(heal('+5528999301515', 'BR'), '+5528999301515');
  assert.equal(heal('+551133334444', 'BR'), '+551133334444');
  // Caminho legado sem "+" fica para o formatPhone (que adiciona 55):
  assert.equal(heal('11999999999', 'BR'), '11999999999');
  // Vazio/ausente passa intacto:
  assert.equal(heal(undefined, 'BR'), undefined);
  assert.equal(heal(null, 'BR'), null);
});

test('heal: aplicada aos DOIS números na ENTRADA do handler', () => {
  assert.match(
    sendSrc,
    /data\.athlete_whatsapp = healBrDdiAusente\(data\.athlete_whatsapp, data\.address_country\)/,
    'cura do telefone do atleta sumiu do handler',
  );
  assert.match(
    sendSrc,
    /data\.guardian_whatsapp = healBrDdiAusente\(data\.guardian_whatsapp, data\.address_country\)/,
    'cura do telefone do responsável sumiu do handler',
  );
});

test('paridade: lista de DDDs idêntica nos 3 espelhos (CF envio, watchdog, Engine)', () => {
  const extrairDdds = (src, arquivo) => {
    const m = src.match(/DDD_VALIDOS = new Set\(\[([\s\S]*?)\]\)/);
    assert.ok(m, `DDD_VALIDOS sumiu de ${arquivo}`);
    return (m[1].match(/\d{2}/g) || []).join(',');
  };
  const doEnvio = extrairDdds(sendSrc, 'send-whatsapp');
  assert.equal(extrairDdds(monitorSrc, 'monitor-health'), doEnvio, 'monitor-health divergiu');
  assert.equal(extrairDdds(analiseSrc, 'telefone-analise.ts'), doEnvio, 'Engine divergiu');
});

test('espelho POR DESTINATÁRIO: atleta não mascara mais a falha do responsável', () => {
  // Tela /observabilidade: a marca carrega destinatários separados e o
  // suspeito nomeia QUEM ficou sem espelho.
  assert.match(telaSrc, /papel: "atleta"|papel: "responsável"/, 'tela perdeu a separação por destinatário');
  assert.match(telaSrc, /sem espelho para \$\{semEspelho\.join\(" e "\)\}/, 'tela não nomeia o destinatário sem espelho');
  assert.doesNotMatch(
    telaSrc,
    /\[\.\.\.tailsDe\(row\.athlete_whatsapp\), \.\.\.tailsDe\(row\.guardian_whatsapp\)\]/,
    'a UNIÃO de tails voltou à tela — era exatamente o ponto cego do incidente',
  );
  // Watchdog (monitor-health): mesma regra.
  assert.match(monitorSrc, /papel: 'atleta'|papel: 'responsável'/, 'watchdog perdeu a separação por destinatário');
  assert.doesNotMatch(
    monitorSrc,
    /\[\.\.\.tailsDe\(row\.athlete_whatsapp\), \.\.\.tailsDe\(row\.guardian_whatsapp\)\]/,
    'a UNIÃO de tails voltou ao watchdog',
  );
});

test('check telefone_invalido registrado na tela E no watchdog (paridade)', () => {
  assert.match(telaSrc, /seguro\("telefone_invalido"/, 'check não registrado em runChecksFilas');
  assert.match(monitorSrc, /checkSeguro\('telefone_invalido'/, 'check não registrado no monitor-health');
  // Elegibilidade do check espelha a dos schedulers (classe QUENTE/MORNO):
  assert.match(telaSrc, /\.in\("qualification_classification", \["QUENTE", "MORNO"\]\)/);
  assert.match(monitorSrc, /qualification_classification=in\.\(QUENTE,MORNO\)/);
});

test('detecção do watchdog casa com a cura (mesmos casos reais)', () => {
  const mProb = monitorSrc.match(/const telefoneProblema = \(phone, addressCountry\) => \{[\s\S]*?\n\};/);
  assert.ok(mProb, 'telefoneProblema não encontrada no monitor-health');
  const mDddM = monitorSrc.match(/const DDD_VALIDOS = new Set\(\[[\s\S]*?\]\);/);
  // eslint-disable-next-line no-new-func
  const problema = new Function(`${mDddM[0]}; ${mProb[0]}; return telefoneProblema;`)();

  assert.equal(problema('+28999711222', 'BR'), 'ddi_ausente_br'); // Gustavo
  assert.equal(problema('+1992601176', 'BR'), 'ddi_ausente_br');
  assert.equal(problema('+31', 'OTHER'), 'invalido'); // resp do lead Sami
  assert.equal(problema('+5528999301515', 'BR'), null); // válido
  assert.equal(problema('+13054409250', 'BR'), null); // US real de residente BR
  assert.equal(problema('', 'BR'), null); // sem telefone ≠ telefone quebrado
});

test('formulário valida os DOIS telefones com isValidPhoneNumber (origem)', () => {
  assert.match(formSrc, /import \{ isValidPhoneNumber \} from "react-phone-number-input"/);
  const refines = formSrc.match(/\.refine\(isValidPhoneNumber/g) || [];
  assert.ok(refines.length >= 2, `esperados 2 refines de telefone, achados ${refines.length}`);
});
