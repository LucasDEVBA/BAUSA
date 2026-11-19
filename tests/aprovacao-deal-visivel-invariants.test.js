'use strict';

// Guard — Aprovação sempre deixa um deal ATIVO e VISÍVEL, e nunca dispara
// mensagem indevida (bug 2026-10-05).
//
// Leads resgatados (INVALIDO falso positivo, Frios/Incompletos, re-filas)
// podem já ter atleta com deal 'perdido' (mutirão 24/08), só deals
// excluídos, ou deal AVANÇADO (caso real: cliente em admission_process
// re-enfileirado pela requalificação). Antes, aprovarLead devolvia o deal
// como estava e re-armava a reativação com qualquer histórico: família em
// admissão receberia o convite de "novo ciclo"; lead em Perdido receberia
// WhatsApp com o deal escondido.
//
// Invariantes:
//   1. Garantia do deal DEPOIS do CAS de aprovação e ANTES do re-arme.
//   2. Garantia falhou → a aprovação é DESFEITA (CAS reverso) — nenhuma
//      mensagem sai com o deal escondido, nem a inicial.
//   3. Re-arme só com `rearmavel`: timing ideal + deal pré-reunião.
//   4. Reabertura com CAS; o flag de falso retrocesso só é limpo com CAS
//      sobre a própria transição perdido→lead.
//   5. Criar e reabrir usam a MESMA ramificação por timing do promoverLeadCore.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(
  path.join(__dirname, '..', 'apps', 'crm', 'src', 'lib', 'actions', 'leads.ts'), 'utf8');

// '(' no fim: 'aprovarLead' é prefixo de 'aprovarLeadDaRevisao' (T12) — o
// recorte precisa ancorar na função ORIGINAL, não na primeira ocorrência.
const aprovar = src.slice(
  src.indexOf('export async function aprovarLead('),
  src.indexOf('export async function reprovarLead'));
const helper = src.slice(
  src.indexOf('async function garantirDealAtivoNaAprovacao'),
  src.indexOf('export async function aprovarLead('));

test('garantia do deal fica entre o CAS e o re-arme da reativação', () => {
  const iCas = aprovar.indexOf('aprovacao_status: "aprovado"');
  const iGarantia = aprovar.indexOf('garantirDealAtivoNaAprovacao(');
  const iRearme = aprovar.indexOf('reativacao_em: new Date().toISOString()');
  assert.ok(iCas > 0 && iGarantia > 0 && iRearme > 0, 'trechos esperados sumiram do aprovarLead');
  assert.ok(iCas < iGarantia, 'garantia só DEPOIS do CAS (lead reprovado em outra aba não reabre deal)');
  assert.ok(iGarantia < iRearme, 'garantia ANTES do re-arme — senão a mensagem sai com o deal escondido');
});

test('garantia falhou → aprovação desfeita, nenhuma mensagem liberada', () => {
  const ramo = aprovar.slice(aprovar.indexOf('if (!garantia.ok)'), aprovar.indexOf('const dealId = garantia.dealId'));
  assert.match(ramo, /aprovacao_status: "pendente"/, 'falha da garantia deixou de devolver o lead à fila');
  assert.match(ramo, /\.eq\("aprovacao_status", "aprovado"\)/, 'reversão sem CAS');
  assert.match(ramo, /success: false/, 'falha da garantia não pode reportar sucesso');
});

test('re-arme só quando rearmavel (timing ideal + deal pré-reunião)', () => {
  assert.match(aprovar, /if \(fsRow\.whatsapp_sent_at && garantia\.rearmavel\)/,
    're-arme deixou de exigir deal rearmável — cliente em admissão receberia convite de novo ciclo');
  assert.match(src, /const ETAPAS_REARMAVEIS = \["contato_feito", "lead"\];/,
    'etapas rearmáveis mudaram — confira que nenhuma etapa pós-reunião entrou');
  assert.match(helper, /rearmavel:\s*timingIdeal && [^;]*ETAPAS_REARMAVEIS\.includes\(etapa\)/,
    'rearmavel deixou de exigir timing ideal (muito_cedo é manual; tarde_demais não volta ao ciclo)');
});

test('reabertura com CAS; flag de retrocesso limpo só na transição perdido→lead', () => {
  assert.match(helper, /\.eq\("etapa", "perdido"\)/, 'CAS da reabertura sumiu');
  assert.match(helper, /\.is\("deleted_at", null\)/, 'reabertura poderia reviver deal excluído');
  const limpeza = helper.slice(helper.indexOf('flag_retrocedido: false'));
  assert.match(limpeza, /\.eq\("etapa_anterior", "perdido"\)/,
    'limpeza do flag sem CAS poderia apagar retrocesso legítimo de outra aba');
  assert.match(limpeza, /\.eq\("flag_retrocedido", true\)/, 'limpeza do flag sem CAS');
});

test('criar e reabrir usam a mesma ramificação por timing', () => {
  // Lead Cedo usa a etapa do ideal (2026-11-19); tarde_demais segue a
  // ramificação por timing (perdido/timing) — nunca a coluna Lead.
  assert.match(helper, /dealCamposPorTiming\(etapaComoIdeal \? "ideal" : timingStatus, probabilidadePorEtapa\)/,
    'helper divergiu da ramificação por timing (tarde_demais cairia na coluna Lead)');
  assert.ok(!/etapaComoIdeal = [^;]*tarde_demais/.test(helper), 'tarde_demais não pode seguir a etapa do ideal');
  const core = src.slice(src.indexOf('async function promoverLeadCore'), src.indexOf('export async function promoverLead'));
  assert.match(core, /\.\.\.dealCamposPorTiming\(timingStatus, probabilidadePorEtapa\)/,
    'promoverLeadCore deixou de usar a fonte única de campos por timing');
  const ramoPerdido = helper.slice(helper.indexOf('const perdido = ativos[0]'));
  assert.match(ramoPerdido, /if \(timingStatus === "tarde_demais"\) \{\s*return resultado\(perdido\.id, "perdido"/,
    'tarde_demais com deal perdido deve continuar em perdido/timing');
});

// ─── 2ª revisão (2026-10-05): reunião, muito_cedo e reversão honesta ─────

test('reunião já detectada: convite inicial bloqueado no MESMO update da aprovação', () => {
  // Ancorado DEPOIS do bloquearInicial: o fechamento dos FUs do "sem
  // mensagem" (T12) tem o próprio CAS em pendente antes da promoção.
  const iBloquear = aprovar.indexOf('const bloquearInicial');
  const cas = aprovar.slice(iBloquear, aprovar.indexOf('.eq("aprovacao_status", "pendente")', iBloquear));
  assert.match(cas, /fsRow\.meeting_scheduled === true && !fsRow\.whatsapp_sent_at/,
    'gate da reunião detectada sumiu — família que já se reuniu receberia "agende sua reunião"');
  assert.match(cas, /aprovacao_status: "aprovado"[\s\S]*whatsapp_sent_at:/,
    'carimbo anti-convite precisa estar no MESMO update do CAS (atômico)');
  assert.match(helper, /etapa: "reuniao_marcada"/, 'lead com reunião detectada deve nascer em Reunião marcada');
});

test('rearmavel exige ausência de reunião (formulário ou histórico do deal)', () => {
  assert.match(helper, /timingIdeal && !reuniaoNoFormulario && !houveReuniao && ETAPAS_REARMAVEIS\.includes\(etapa\)/,
    'rearmavel deixou de excluir reunião — família que desistiu após reunião receberia reativação');
  assert.match(helper, /const houveReuniao =\s*dealTeveReuniao\(perdido\)/,
    'histórico de reunião do deal perdido deixou de ser considerado');
});

test('muito_cedo aprovado entra no FUNIL — nunca estacionado (ordem do CEO 2026-11-19)', () => {
  // Antes (regra de 2026-09-08) o lead "Cedo" aprovado ia para Aguardando
  // timing (coluna oculta) e precisava de um 2º clique ("Ativar agora").
  const ramoVisivel = helper.slice(helper.indexOf('const visivel = ativos.find'), helper.indexOf('const perdido = ativos[0]'));
  assert.ok(!/dealCamposPorTiming\("muito_cedo"/.test(helper), 'a aprovação voltou a estacionar lead Cedo em Aguardando timing');
  assert.match(helper, /const etapaComoIdeal = timingIdeal \|\| timingStatus === "muito_cedo";/);
  assert.match(ramoVisivel, /if \(timingStatus === "muito_cedo" && visivel\.etapa === "aguardando_timing"\) \{/,
    'o deal que o promoverLeadCore cria estacionado tem de sair para Lead na aprovação');
  assert.match(ramoVisivel, /\["aguardando_timing"\]\);/, 'a saída do estacionamento tem de ser CAS a partir de aguardando_timing');
  assert.match(helper, /comAcaoCedo\(dealCamposPorTiming\(etapaComoIdeal \? "ideal" : timingStatus, probabilidadePorEtapa\)\)/,
    'deal novo/reaberto de lead Cedo tem de nascer em Lead');
  // ETAPA como ideal, MENSAGEM não: convite/reativação seguem só para timing ideal.
  assert.match(helper, /rearmavel:\s*\n\s*timingIdeal && !reuniaoNoFormulario/, 'lead Cedo receberia reativação automática');
  assert.match(helper, /semConviteInicial:\s*\n\s*timingIdeal && /);
  assert.match(helper, /reuniaoNoFormulario \|\| dealTeveReuniao\(visivel\)/,
    'sinal de reunião deve somar formulário e histórico do deal');
  assert.match(helper, /reuniao_realizada_at \|\| d\.reuniao_data \|\| d\.reuniao_agendada_at/,
    'detector de reunião do deal perdeu algum campo');
});

test('timing ideal + reunião + deal pré-reunião (inclusive recém-criado) → Reunião marcada', () => {
  const ramoVisivel = helper.slice(helper.indexOf('const visivel = ativos.find'), helper.indexOf('const perdido = ativos[0]'));
  assert.match(ramoVisivel, /if \(etapaComoIdeal && sinalReuniao && ETAPAS_PRE_REUNIAO\.includes\(visivel\.etapa\)\)/,
    'o deal criado pelo promoverLeadCore em lead ficaria em Lead mesmo com reunião (caso Samuel)');
  assert.match(ramoVisivel, /camposReuniao\(/, 'transição para Reunião marcada sumiu do ramo visível');
});

test('convite inicial bloqueado também pelo histórico do deal / deal avançado', () => {
  const pos = aprovar.slice(aprovar.indexOf('const dealId = garantia.dealId'));
  assert.match(pos, /!bloquearInicial && !fsRow\.whatsapp_sent_at && garantia\.semConviteInicial/,
    'carimbo pós-garantia sumiu — lead com reunião no histórico receberia o convite inicial');
  assert.match(pos, /\.is\("whatsapp_sent_at", null\)/, 'carimbo pós-garantia sem CAS');
  assert.match(pos, /whatsapp_sent_at: marca, followup_1_sent_at: marca, followup_2_sent_at: marca/,
    'carimbo precisa fechar o ciclo inteiro — senão o FU1 "agende sua reunião" sai 48h depois');
  assert.match(helper, /semConviteInicial:\s*timingIdeal && \(reuniaoNoFormulario \|\| houveReuniao \|\| !ETAPAS_PRE_REUNIAO\.includes\(etapa\)\)/,
    'critério do semConviteInicial mudou');
});

test('reversão confirmada: nunca diz "desfeita" sem ter desfeito', () => {
  const ramo = aprovar.slice(aprovar.indexOf('if (!garantia.ok)'), aprovar.indexOf('const dealId = garantia.dealId'));
  assert.match(ramo, /await reverter\.select\("id"\)/, 'reversão sem conferência de linhas');
  assert.match(ramo, /NÃO pôde ser desfeita/, 'falha da reversão precisa ser reportada como tal');
});
