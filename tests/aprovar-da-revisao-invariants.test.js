'use strict';

// Guard — Aprovar direto na revisão de Frios/Incompletos (T12, vídeo do CEO
// 28/09, 07h22m56): "não tem sentido revisar e ter que enviar pra fila pra
// aprovar em outro lugar".
//
// Invariantes:
//   1. A action NUNCA grava 'aprovado' por conta própria: faz o CAS do
//      resgate (classe de origem + aprovacao_status NULL + vivo → MORNO
//      provisório + pendente) e delega ao aprovarLead — a elegibilidade dos
//      schedulers (QUENTE/MORNO + timing + aprovado) só nasce lá dentro.
//   2. Origem só FRIO ou INCOMPLETO (nunca INVALIDO/QUENTE/MORNO); gate CEO.
//   3. "Aprovar sem mensagem" fecha inicial+FU1+FU2 no MESMO update do CAS de
//      aprovação (sem janela) e nunca re-arma a reativação; a reversão (deal
//      não garantido) desfaz o carimbo junto.
//   4. Lead excluído nunca é aprovado.
//   5. Posição no arquivo: antes de listarLeadsMuitoCedoDetalhe (o guard
//      pipeline-frios-colunas recorta de ativarLeadMuitoCedo até o FIM).
//   6. UI: Frios/Incompletos ganham "Aprovar lead" + "Aprovar sem mensagem";
//      Muito cedo e a fila de aprovação ficam iguais.
//   7. Faixa "Fora do pipeline" (T13, PLANO L2): FRIO/INCOMPLETO fora da
//      janela, sem decisão e sem deal → "Revisar e aprovar" abre o mesmo modal
//      (garantirId sem janela); decidir chama onAtualizado(item) e não
//      desconta do total da coluna.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), 'utf8');
const src = ler('apps', 'crm', 'src', 'lib', 'actions', 'leads.ts');
const ui = ler('apps', 'crm', 'src', 'components', 'leads', 'AprovacoesLeads.tsx');

const INICIO_NOVA = 'export async function aprovarLeadDaRevisao(';
const fatiar = (inicio, fim) => {
  const i = src.indexOf(inicio);
  assert.ok(i >= 0, `trecho não encontrado: ${inicio}`);
  const j = src.indexOf(fim, i + inicio.length);
  return src.slice(i, j > 0 ? j : undefined);
};
const nova = fatiar(INICIO_NOVA, 'export async function');
const aprovar = fatiar('export async function aprovarLead(', 'export async function reprovarLead');

test('posição: depois do aprovarLead original e antes da revisão Muito cedo', () => {
  const iOriginal = src.indexOf('export async function aprovarLead(');
  const iNova = src.indexOf(INICIO_NOVA);
  const iMuitoCedo = src.indexOf('export async function listarLeadsMuitoCedoDetalhe');
  assert.ok(iOriginal > 0 && iNova > iOriginal, 'aprovarLeadDaRevisao antes do aprovarLead quebra os recortes por indexOf');
  assert.ok(iNova < iMuitoCedo, 'a action caiu no recorte ativarLeadMuitoCedo→FIM do guard pipeline-frios-colunas');
});

test('action: gate CEO e origem restrita a FRIO/INCOMPLETO', () => {
  assert.match(nova, /getUserPapel\(\)\) !== "ceo"/, 'gate CEO sumiu');
  assert.match(src, /const ORIGENS_REVISAO = \["FRIO", "INCOMPLETO"\] as const;/,
    'origem pode virar INVALIDO/QUENTE/MORNO — fora do escopo da revisão');
  assert.match(nova, /aprovarDaRevisaoSchema\.safeParse\(/, 'entrada do endpoint sem validação');
});

test('action: CAS do resgate idêntico (classe de origem + sem decisão + vivo)', () => {
  const cas = nova.slice(nova.indexOf('.from("form_submissions")\n    .update({'), nova.indexOf('.select("id")'));
  assert.match(cas, /qualification_classification: "MORNO"/, 'provisório MORNO sumiu (a fila/schedulers exigem QUENTE/MORNO)');
  assert.match(cas, /aprovacao_status: "pendente"/, 'CAS deve cair em pendente — aprovado só via aprovarLead');
  assert.match(cas, /\.eq\("qualification_classification", origemOk\)/, 'CAS sem a classe de origem');
  assert.match(cas, /\.is\("aprovacao_status", null\)/, 'CAS poderia sobrescrever decisão humana');
  assert.match(cas, /\.is\("deleted_at", null\)/, 'CAS poderia agir sobre lead excluído');
  assert.match(nova, /classe original \$\{origemOk\}/, 'motivo precisa registrar a classe original');
});

test('action: nunca grava aprovado/whatsapp/timing por conta própria; delega ao aprovarLead', () => {
  assert.ok(!/aprovacao_status: "aprovado"/.test(nova), 'a action não pode aprovar sem passar pelo aprovarLead');
  assert.ok(!/whatsapp_sent_at:|followup_1_sent_at:|followup_2_sent_at:/.test(nova),
    'carimbo de mensagem deve ser atômico DENTRO do aprovarLead');
  assert.ok(!/timing_status:/.test(nova), 'timing_status mudaria a elegibilidade dos schedulers');
  assert.match(nova, /await aprovarLead\(parsed\.data\.leadId, \{ semMensagemAutomatica: semMensagem \}\)/,
    'delegação ao aprovarLead sumiu');
  const iCas = nova.indexOf('aprovacao_status: "pendente"');
  const iAprovar = nova.indexOf('await aprovarLead(');
  assert.ok(iCas > 0 && iAprovar > iCas, 'ordem é segurança: resgate (pendente) ANTES de aprovar');
});

test('aprovarLead: "sem mensagem" fecha o ciclo no MESMO update do CAS', () => {
  const cas = aprovar.slice(aprovar.indexOf('const bloquearInicial'), aprovar.indexOf('.eq("aprovacao_status", "pendente")'));
  assert.match(cas, /const fecharCicloSemMensagem = semMensagem && !fsRow\.whatsapp_sent_at;/,
    'fechamento do ciclo só para lead sem histórico');
  assert.match(cas, /aprovacao_status: "aprovado"[\s\S]*fecharCicloSemMensagem\s*\?\s*\{ whatsapp_sent_at: marcaCiclo, followup_1_sent_at: marcaCiclo, followup_2_sent_at: marcaCiclo \}/,
    'carimbo inicial+FU1+FU2 precisa estar no MESMO update da aprovação (atômico)');
  assert.match(cas, /fecharRetomadaSemMensagem \? \{ scheduled_followup_sent_at: marcaCiclo \}/,
    'muito_cedo "sem mensagem" receberia a retomada de novembro');
  assert.match(aprovar, /\.eq\("aprovacao_status", "pendente"\)\s*\.is\("deleted_at", null\)/,
    'CAS da aprovação deve ignorar lead excluído');
  assert.match(aprovar, /if \(fsRow\.deleted_at\) \{/, 'lead excluído não pode ser aprovado');
});

test('aprovarLead: "sem mensagem" nunca re-arma a reativação; reversão desfaz o carimbo', () => {
  const rearme = aprovar.slice(aprovar.indexOf('if (fsRow.whatsapp_sent_at && garantia.rearmavel) {'));
  assert.match(rearme, /^if \(fsRow\.whatsapp_sent_at && garantia\.rearmavel\) \{\s*if \(semMensagem\) \{/,
    'com "sem mensagem" a reabertura seria re-armada');
  const iSem = rearme.indexOf('if (semMensagem)');
  const iReativ = rearme.indexOf('reativacao_em: new Date().toISOString()');
  assert.ok(iSem >= 0 && iReativ > iSem, 're-arme precisa ficar no else do semMensagem');
  const ramo = aprovar.slice(aprovar.indexOf('if (!garantia.ok)'), aprovar.indexOf('const dealId = garantia.dealId'));
  assert.match(ramo, /fecharCicloSemMensagem\s*\?\s*\{ whatsapp_sent_at: null, followup_1_sent_at: null, followup_2_sent_at: null \}/,
    'reversão deve desfazer o fechamento do ciclo (lead volta à fila como estava)');
  assert.match(ramo, /fecharRetomadaSemMensagem \? \{ scheduled_followup_sent_at: null \}/,
    'reversão deve desfazer também o bloqueio da retomada');
  assert.match(aprovar, /garantia\.semConviteInicial && !fecharCicloSemMensagem/,
    'carimbo pós-garantia rodaria em lead já carimbado (aviso falso de falha)');
});

test('UI: Frios/Incompletos com Aprovar + Aprovar sem mensagem; Muito cedo e fila intactos', () => {
  assert.match(ui, /aprovarLeadDaRevisao\(lead\.id, origem, \{ semMensagemAutomatica: semMensagem \}\)/,
    'modal não chama a action nova');
  // Recortes ANCORADOS no rodapé (o header também tem `modo === "muito_cedo" ? (`).
  const iRevisao = ui.indexOf(') : modo === "frios" || modo === "incompletos" ? (');
  const iMuitoCedo = ui.indexOf(') : modo === "muito_cedo" ? (', iRevisao);
  const iFila = ui.indexOf(') : reprovando ? (', iMuitoCedo);
  assert.ok(iRevisao > 0 && iMuitoCedo > iRevisao && iFila > iMuitoCedo, 'estrutura do rodapé mudou — revise o guard');
  const rodapeRevisao = ui.slice(iRevisao, iMuitoCedo);
  assert.match(rodapeRevisao, /Aprovar lead/, 'botão Aprovar lead sumiu da revisão');
  assert.match(rodapeRevisao, /Aprovar sem mensagem/, 'botão Aprovar sem mensagem sumiu da revisão');
  assert.match(rodapeRevisao, /handleAprovarRevisao\(selecionado, true\)/, '"sem mensagem" deve passar true');
  assert.match(rodapeRevisao, /handleAprovarRevisao\(selecionado, false\)/, '"Aprovar lead" deve passar false');
  assert.match(rodapeRevisao, /Enviar p\/ fila/, 'resgate sem decisão continua disponível');
  assert.match(rodapeRevisao, /libera o WhatsApp automático/, 'rodapé precisa avisar que aprovar dispara mensagem');
  const rodapeMuitoCedo = ui.slice(iMuitoCedo, iFila);
  assert.ok(!/handleAprovarRevisao/.test(rodapeMuitoCedo), 'Muito cedo não muda (lead já aprovado)');
  assert.match(rodapeMuitoCedo, /Ativar agora no funil/, 'ação do Muito cedo sumiu');
  assert.match(ui, /onClick=\{\(\) => handleAprovar\(selecionado\)\}/, 'aprovação da fila deve continuar igual');
  // Toasts com o rótulo da coluna, nunca o enum (B8) — inclusive o aviso do aprovarLead
  const handler = ui.slice(ui.indexOf('const handleAprovarRevisao = '), ui.indexOf('const handleResgatar = '));
  assert.match(handler, /deal em \$\{rotuloEtapa\(res\.etapa\)\}/, 'toast de sucesso com a chave do enum');
  assert.match(handler, /res\.aviso\.replaceAll\(`"\$\{etapa\}"`, `"\$\{rotuloEtapa\(etapa\)\}"`\)/,
    'aviso do aprovarLead mostraria "reuniao_marcada" em vez do nome da coluna');
  assert.match(handler, /catch \{[\s\S]*?router\.refresh\(\);/, 'falha de rede ao aprovar sem recarregar o estado real');
});

// ─── Revisão adversarial (2026-10-08) ────────────────────────────────────

test('carimbo "sem envio" nunca cai na janela dos checks de espelho (alerta falso)', () => {
  // monitor-health olha *_sent_at das últimas 6h e /observabilidade das
  // últimas 48h: lead recém-chegado aprovado "sem mensagem" com a data do
  // cadastro viraria "envio SEM espelho" (alerta WhatsApp+e-mail ao CEO).
  const m = src.match(/const IDADE_MIN_CARIMBO_SEM_ENVIO_MS = (\d+) \* 60 \* 60 \* 1000;/);
  assert.ok(m, 'idade mínima do carimbo sem envio sumiu');
  assert.ok(Number(m[1]) > 48, 'idade mínima precisa passar da janela de 48h do /observabilidade');
  const cas = aprovar.slice(aprovar.indexOf('const bloquearInicial'), aprovar.indexOf('.eq("aprovacao_status", "pendente")'));
  assert.match(cas, /Math\.min\(baseCicloMs, tetoCicloMs\)/, 'marcaCiclo deixou de ser limitada pela idade mínima');
});

test('UI: no celular o painel do dossiê encolhe (rodapé de decisão visível)', () => {
  // Corpo vira coluna em < md; sem min-h-0 no painel o rodapé é cortado
  // pelo overflow-hidden do modal (medido em 375px no Chrome headless).
  assert.match(ui, /className="flex min-h-0 flex-1 flex-col md:flex-row"/, 'corpo do modal deixou de ser responsivo');
  assert.match(ui, /\{selecionado && \([\s\S]{0,300}?<div className="flex min-h-0 min-w-0 flex-1 flex-col">/,
    'painel do dossiê sem min-h-0: no celular os botões Aprovar/Reprovar somem');
});

// ─── Integração 08/10 (PLANO L2): aprovar FRIO/INCOMPLETO FORA da janela ──
// A faixa "Fora do pipeline" (T13) achava o lead de mais de 90 dias mas só
// oferecia "Abrir dossiê"/"Enviar p/ fila" — aprovar exigia o caminho longo
// que o T12 quis acabar.

const faixa = ler('apps', 'crm', 'src', 'components', 'pipeline', 'ForaDoPipelineFaixa.tsx');
const board = ler('apps', 'crm', 'src', 'components', 'pipeline', 'PipelineBoard.tsx');

test('faixa: "Revisar e aprovar" só para FRIO/INCOMPLETO fora da janela, sem decisão e sem deal', () => {
  const revisavel = faixa.match(/const revisavel =([\s\S]*?);\n/);
  assert.ok(revisavel, 'condição "revisavel" sumiu da faixa');
  assert.match(revisavel[1], /item\.aprovacao_status === null/, 'lead já decidido não pode ser revisado de novo');
  assert.match(revisavel[1], /"FRIO"[\s\S]*"INCOMPLETO"/, 'revisão é só de FRIO/INCOMPLETO (nunca INVALIDO/reprovado)');
  assert.match(revisavel[1], /!item\.deal_id/, 'lead com deal ativo não entra na revisão');
  assert.match(faixa, /const modoForaDaJanela: ModoRevisao \| null =\s*tipo === "fora_janela" && revisavel\b/,
    '"Revisar e aprovar" precisa ficar restrito a fora_janela + revisável');
  assert.equal((faixa.match(/Revisar e aprovar/g) ?? []).length, 1, '"Revisar e aprovar" deve existir num único ramo');
  const ramo = faixa.slice(faixa.indexOf(') : modoForaDaJanela ? ('), faixa.indexOf('Revisar e aprovar'));
  assert.ok(ramo.length > 0, 'botão fora do ramo modoForaDaJanela');
  assert.match(ramo, /onAbrirRevisao\(modoForaDaJanela, item\.id, \(\) => onAtualizado\(item\)\)/,
    'depois de decidir no modal a faixa precisa chamar onAtualizado(item) (contrato B6)');
});

test('board: decisão de lead aberto pela faixa fora da coluna não desconta do total da coluna', () => {
  assert.match(board, /const abrirRevisao = \(modo: ModoRevisao, leadId: string, aoDecidir\?: \(\) => void\) => \{\s*setRevisaoForaDaColuna\(aoDecidir \? \{ id: leadId, aoDecidir \} : null\);/,
    'board não guarda o callback da faixa');
  for (const [modo, remover] of [['frios', 'frios.remover(id);'], ['incompletos', 'incompletos.remover(id);']]) {
    const iModal = board.indexOf(`modo="${modo}"`);
    assert.ok(iModal > 0, `modal ${modo} sumiu do board`);
    const iDecidido = board.indexOf('onDecidido={(id) => {', iModal);
    const i = board.indexOf(remover, iDecidido);
    assert.ok(iDecidido > 0 && i > iDecidido, `${remover} sumiu do onDecidido do modal ${modo}`);
    assert.match(board.slice(iDecidido, i), /if \(revisaoForaDaColuna\?\.id === id\) \{\s*revisaoForaDaColuna\.aoDecidir\(\);\s*return;\s*\}/,
      `modal ${modo}: lead fora da janela seria descontado do total da coluna`);
  }
  assert.ok((board.match(/setRevisaoForaDaColuna\(null\);/g) ?? []).length >= 2,
    'fechar o modal tem que esquecer o lead da faixa (senão o próximo card da coluna herda o callback)');
});

test('garantirId: lead da faixa entra no modal SEM a janela, mas com classe/sem decisão/sem deal', () => {
  const consulta = src.slice(src.indexOf('function consultarRevisao('), src.indexOf('async function paginaCardsRevisao'));
  assert.match(consulta, /dias: number \| null,/);
  // filtros de elegibilidade valem com ou sem janela (antes do ternário)
  const base = consulta.slice(consulta.indexOf('const recorte = supabase'), consulta.indexOf('const comJanela'));
  for (const f of [/\.eq\("qualification_classification", classe\)/, /\.is\("aprovacao_status", null\)/, /\.eq\("tem_deal_ativo", false\)/]) {
    assert.match(base, f, `filtro ${f} só valeria com a janela`);
  }
  assert.match(consulta, /dias === null \? recorte : recorte\.gte\("submitted_at", /, 'janela deixou de ser aplicada às colunas');
  const detalhe = src.slice(src.indexOf('async function paginaDetalheRevisao'), src.indexOf('export async function listarLeadsFriosCards'));
  assert.match(detalhe, /consultarRevisao\(supabase, classe, dias, "id", true\)\s*\.range\(/, 'página do modal perdeu a janela');
  assert.match(detalhe, /consultarRevisao\(supabase, classe, null, "id, submitted_at", false\)\s*\.eq\("id", garantirId\)/,
    'lead fora da janela aberto pela faixa não carregaria no modal');
  assert.match(detalhe, /foraDoRecorte\.push\(garantirId\)/, 'modal não saberia que o lead não conta no total');
  // A aprovação não depende da janela (CAS só por classe/sem decisão/vivo)
  assert.ok(!/submitted_at/.test(nova), 'aprovarLeadDaRevisao não pode depender da janela de dias');
  // Modal: o lead fora do recorte não mexe no total/offset nem esconde o "Carregar mais"
  const remover = ui.slice(ui.indexOf('const removerDaFila = useCallback('), ui.indexOf('const handleAprovar = '));
  assert.match(remover, /if \(!foraDoRecorte\.has\(id\)\) \{\s*setTotal\(/, 'decidir o lead da faixa descontaria do total da coluna');
  assert.match(ui, /carregadosNoRecorte < total/, '"Carregar mais" sumiria com 1 lead da janela por carregar');
});
