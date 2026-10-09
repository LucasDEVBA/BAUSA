'use strict';

// ════════════════════════════════════════════════════════════════════════
// Guard — etapas do pipeline (vídeos do CEO 28/09, T2/T17/T20/T21 + T10)
// ════════════════════════════════════════════════════════════════════════
//
// Invariantes:
//   1. 'plano_escolhido' é etapa PRÓPRIA pós-sinal: enum em migration
//      separada (valor novo não pode ser usado na mesma transação), ordem
//      fixa SQL ⇄ ETAPA_ORDEM idênticas, sinal < plano < admission.
//   2. Retrocesso tem UMA regra: trigger (public.etapa_e_retrocesso) e app
//      (lib/etapas-ordem) comparam na MESMA escala (board quando as duas
//      etapas estão visíveis; senão fixa), com as isenções de sempre.
//      Divergir = o trigger marca retrocesso sem motivo.
//   3. Ganho: plano_escolhido e colunas personalizadas marcadas contam como
//      ganho em TODOS os conjuntos (pipeline, War Room, remarketing
//      fail-closed, desfecho_real, chatbot, automation-engine, handoff).
//   4. Rótulos (T17): modal/toast/aviso mostram o nome da COLUNA.
//   5. Próxima ação (T21): padrão da coluna nunca sobrescreve ação manual e
//      nunca esvazia; trigger de metadados cobre todos os escritores.
//   6. T10: soltar em coluna que pede plano NÃO move antes do modal.
//
// Execução local:  node --test tests/*.test.js
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), 'utf8');
const MIG_DIR = path.join(raiz, 'supabase', 'migrations');
const migs = fs.readdirSync(MIG_DIR);
const migration = (sufixo) => {
  const f = migs.find((n) => n.endsWith(sufixo));
  assert.ok(f, `migration *${sufixo} sumiu`);
  return fs.readFileSync(path.join(MIG_DIR, f), 'utf8');
};
const fatia = (src, inicio, fim) => {
  const i = src.indexOf(inicio);
  assert.ok(i >= 0, `trecho não encontrado: ${inicio}`);
  const j = fim ? src.indexOf(fim, i + inicio.length) : src.length;
  return src.slice(i, j < 0 ? src.length : j);
};
const semComentariosSql = (sql) => sql.replace(/--.*$/gm, '');
const semComentariosJs = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

const migEnum = migration('_status_deal_plano_escolhido.sql');
const migOrdem = migration('_plano_escolhido_ordem_board_retrocesso.sql');
const migMeta = migration('_deals_next_action_meta.sql');
// 124400 (dados de apresentação) entra no PR-2, DEPOIS do vai-pra-prod do
// PR-1 — no PR-1 o arquivo ainda não existe e o teste dele é pulado (antes
// o guard inteiro quebrava no carregamento e derrubava o CI do PR-1).
const migColunaArq = migs.find((n) => n.endsWith('_plano_escolhido_coluna_board.sql'));
const migColuna = migColunaArq ? fs.readFileSync(path.join(MIG_DIR, migColunaArq), 'utf8') : null;
const pipelinesTabSrc = ler('apps', 'crm', 'src', 'components', 'configuracoes', 'PipelinesTab.tsx');

const crmTypes = ler('apps', 'crm', 'src', 'types', 'crm.ts');
const dealTypes = ler('apps', 'crm', 'src', 'types', 'deal.ts');
const etapasDeal = ler('apps', 'crm', 'src', 'lib', 'etapas-deal.ts');
const etapasOrdem = ler('apps', 'crm', 'src', 'lib', 'etapas-ordem.ts');
const proximaAcao = ler('apps', 'crm', 'src', 'lib', 'proxima-acao.ts');
const dealsSrc = ler('apps', 'crm', 'src', 'lib', 'actions', 'deals.ts');
const lerSeExiste = (...p) => (fs.existsSync(path.join(raiz, ...p)) ? ler(...p) : null);
const leadsSrc = ler('apps', 'crm', 'src', 'lib', 'actions', 'leads.ts');
const boardSrc = ler('apps', 'crm', 'src', 'components', 'pipeline', 'PipelineBoard.tsx');
const retroSrc = ler('apps', 'crm', 'src', 'components', 'pipeline', 'RetrocessoModal.tsx');
const sheetSrc = ler('apps', 'crm', 'src', 'components', 'pipeline', 'DealDetailSheet.tsx');
const pageSrc = ler('apps', 'crm', 'src', 'app', '(dashboard)', 'pipeline', 'page.tsx');
const remSrc = ler('apps', 'crm', 'src', 'lib', 'remarketing-queries.ts');
const warSrc = ler('apps', 'crm', 'src', 'lib', 'war-room-queries.ts');
const alertasSrc = ler('apps', 'crm', 'src', 'lib', 'automacoes', 'verificar-alertas.ts');
const chatSrc = semComentariosJs(ler('functions', 'chatbot-autonomo', 'index.js'));
const engineSrc = semComentariosJs(ler('functions', 'automation-engine', 'index.js'));

const mover = fatia(dealsSrc, 'export async function moverDeal', 'export async function customizarValorDeal');

// ─── 1. Enum + ordem fixa ────────────────────────────────────────────────
test('enum: plano_escolhido em migration própria, idempotente, depois de sinal_pago', () => {
  assert.match(migEnum, /ADD VALUE IF NOT EXISTS 'plano_escolhido' AFTER 'sinal_pago'/);
  const exec = semComentariosSql(migEnum);
  assert.ok(!/ordem_etapa|UPDATE |INSERT |CREATE (OR REPLACE )?FUNCTION/i.test(exec),
    'a migration do enum não pode USAR o valor novo (mesma transação) — uso vai na seguinte');
  const fEnum = migs.find((n) => n.endsWith('_status_deal_plano_escolhido.sql'));
  const fOrdem = migs.find((n) => n.endsWith('_plano_escolhido_ordem_board_retrocesso.sql'));
  assert.ok(fEnum < fOrdem, 'a migration do enum precisa rodar ANTES da que usa o valor');
});

test('ordem fixa: public.ordem_etapa_fixa ⇄ ETAPA_ORDEM idênticas', () => {
  const corpo = fatia(migOrdem, 'CREATE OR REPLACE FUNCTION public.ordem_etapa_fixa', '$$;');
  const sql = {};
  for (const m of corpo.matchAll(/WHEN '([a-z_0-9]+)'\s+THEN (\d+)/g)) sql[m[1]] = Number(m[2]);
  const bloco = fatia(crmTypes, 'export const ETAPA_ORDEM', '};');
  const ts = {};
  for (const m of bloco.matchAll(/^\s*([a-z_0-9]+): (\d+),/gm)) ts[m[1]] = Number(m[2]);
  assert.ok(Object.keys(sql).length >= 19, 'CASE da ordem fixa incompleto');
  for (const [etapa, n] of Object.entries(sql)) {
    assert.equal(ts[etapa], n, `ETAPA_ORDEM.${etapa} (${ts[etapa]}) diverge do SQL (${n})`);
  }
  for (const [etapa, n] of Object.entries(ts)) {
    if (etapa.startsWith('custom_')) { assert.equal(n, 0, 'custom_* fica fora da ordem (0)'); continue; }
    assert.equal(sql[etapa], n, `${etapa} existe no TS e não no SQL`);
  }
  assert.ok(sql.sinal_pago < sql.plano_escolhido && sql.plano_escolhido < sql.admission_process,
    'plano_escolhido precisa ficar entre sinal_pago e admission_process');
  assert.match(migOrdem, /public\.ordem_etapa\(p_etapa status_deal\)[\s\S]*?SELECT public\.ordem_etapa_fixa\(p_etapa::text\)/,
    'ordem_etapa(status_deal) deve delegar para ordem_etapa_fixa (fonte única)');
});

test('tipos: plano_escolhido em todas as listas do TS', () => {
  assert.match(crmTypes, /'sinal_pago' \| 'plano_escolhido' \| 'admission_process'/, 'StatusDeal sem plano_escolhido');
  assert.match(dealTypes, /\| "plano_escolhido"/, 'DealStage sem plano_escolhido');
  assert.match(dealTypes, /"sinal_pago",\s*"plano_escolhido",\s*"admission_process"/, 'PIPELINE_STAGE_ORDER sem plano_escolhido');
  const cfg = fatia(dealTypes, '  plano_escolhido: {', '},');
  assert.match(cfg, /isFinancial: true/, 'plano_escolhido é etapa financeira/ganho');
  assert.match(cfg, /ocultaPorPadrao: true/, 'plano_escolhido nasce oculto até a migration de dados');
  assert.match(cfg, /pedePlanoPorPadrao: true/, 'plano_escolhido pede o plano por padrão');
  assert.match(etapasDeal, /plano_escolhido: 97,/, 'fallback de probabilidade ≥ 95 sumiu');
  assert.match(migOrdem, /'\{"plano_escolhido": 97\}'::jsonb \|\| valor/, 'seed de probabilidade sumiu (existente deve vencer)');
});

// ─── 2. Regra única de retrocesso ────────────────────────────────────────
test('retrocesso: trigger usa a regra única com fallback seguro na ordem fixa', () => {
  const trig = fatia(migOrdem, 'CREATE OR REPLACE FUNCTION public.trg_deals_check_etapa', '$$ LANGUAGE plpgsql');
  assert.match(trig, /IF public\.etapa_e_retrocesso\(OLD\.etapa::text, NEW\.etapa::text, v_cfg\) THEN\s*NEW\.flag_retrocedido := true;/,
    'o trigger deve marcar retrocesso SÓ pela regra única');
  assert.ok(!/ordem_etapa\(NEW\.etapa\) < public\.ordem_etapa\(OLD\.etapa\)/.test(trig),
    'comparação direta pela ordem fixa voltou ao trigger (escala diferente do board)');
  assert.match(trig, /EXCEPTION WHEN OTHERS THEN\s*v_cfg := NULL;/,
    'falha ao ler a config deve cair na ordem fixa sem abortar o UPDATE');
  assert.ok(!/flag_retrocedido := false/.test(trig), 'o trigger nunca desliga a flag');
  for (const marco of ['reuniao_realizada_at', 'contrato_enviado_at', 'contrato_assinado_at', 'sinal_pago_at']) {
    assert.match(trig, new RegExp(`NEW\\.${marco} := COALESCE`), `marco ${marco} sumiu do trigger`);
  }
});

test('retrocesso: isenções e mesma escala no SQL e no TS', () => {
  const regra = fatia(migOrdem, 'CREATE OR REPLACE FUNCTION public.etapa_e_retrocesso', '$$;');
  assert.match(regra, /p_para IN \('perdido', 'cancelamento_solicitado', 'projeto_futuro', 'aguardando_timing'\) THEN false/);
  assert.match(regra, /p_de = 'aguardando_timing' THEN false/);
  assert.match(regra, /p_para LIKE 'custom\\_%' OR p_de LIKE 'custom\\_%' THEN false/);
  assert.match(regra, /ELSE public\.ordem_etapa_fixa\(p_para\) < public\.ordem_etapa_fixa\(p_de\)/,
    'sem as duas no board, a comparação é pela ordem fixa para AS DUAS');
  const board = fatia(migOrdem, 'CREATE OR REPLACE FUNCTION public.ordem_etapa_board(p_etapa text, p_cfg jsonb)', '$$;');
  assert.match(board, /\(p_etapa LIKE 'custom\\_%' OR p_etapa = 'plano_escolhido'\)/,
    'default oculto do SQL diverge do TS (isCustomSlot || ocultaPorPadrao)');
  assert.match(board, /p_etapa IN \('cancelamento_solicitado', 'projeto_futuro'\) THEN NULL/);
  assert.match(migOrdem, /ordem_etapa_board\(p_etapa status_deal\)\s*RETURNS numeric\s*LANGUAGE sql\s*STABLE/,
    'a versão que lê tabela precisa ser STABLE (nunca IMMUTABLE)');

  assert.match(etapasOrdem, /ETAPAS_DESTINO_SEM_RETROCESSO: readonly string\[\] = \[\s*"perdido",\s*"cancelamento_solicitado",\s*"projeto_futuro",\s*"aguardando_timing",\s*\]/);
  assert.match(etapasOrdem, /if \(de === "aguardando_timing"\) return false;/);
  assert.match(etapasOrdem, /if \(isColunaPersonalizada\(para\) \|\| isColunaPersonalizada\(de\)\) return false;/);
  assert.match(etapasOrdem, /return etapa\.startsWith\("custom_"\);/);
  assert.match(etapasOrdem, /return compararOrdemBoard\(para, de, config\);/, 'direção fora do núcleo único');
  // núcleo (etapas-deal): mesma escala, fallback fixo, default oculto = SQL
  const nucleo = fatia(etapasDeal, 'export function compararOrdemBoard', '\n}\n');
  assert.match(nucleo, /if \(boardA !== null && boardB !== null && boardA !== boardB\)/);
  assert.match(nucleo, /const fixaA = ordemEtapaFixa\(a\);/);
  assert.match(etapasDeal, /const ETAPAS_FORA_DO_BOARD: readonly string\[\] = \["cancelamento_solicitado", "projeto_futuro"\]/);
  assert.match(etapasDeal, /return c\.ordemConfigurada && !c\.oculta \? c\.order : null;/);
  assert.match(etapasDeal, /: base\.isCustomSlot === true \|\| base\.ocultaPorPadrao === true,/,
    'default oculto do TS diverge do SQL');
  assert.match(etapasDeal, /ordemConfigurada: Boolean\(override && isValidOrder\(override\.order\)\)/,
    'ordem âncora/estática não pode contar como ordem do board');
});

test('retrocesso: moverDeal e gamificação usam a regra única (nunca ETAPA_ORDEM direto)', () => {
  assert.match(mover, /isRetrocessoEtapa\(etapaAtual, novaEtapa, stageMap\)/);
  assert.match(mover, /isAvancoReal\(etapaAtual, novaEtapa, stageMap\)/);
  assert.ok(!/ETAPA_ORDEM/.test(mover), 'moverDeal voltou a comparar ETAPA_ORDEM direto (escala ≠ trigger)');
  assert.match(mover, /\.eq\("etapa", deal\.etapa\)/, 'CAS na etapa lida sumiu do moverDeal');
  assert.match(sheetSrc, /proximaColunaBoard\(deal\.stage, stageConfigMap\)/, 'Avançar do editor lateral fora da ordem do board');
  assert.match(sheetSrc, /colunasAnterioresBoard\(deal\.stage, stageConfigMap\)/, 'Retroceder do editor lateral fora da ordem do board');
});

test('registrar/confirmar o sinal não puxa deal de etapa posterior para trás', () => {
  // Vale para o caminho que existir: confirmarSinalPago (legado, financeiro.ts)
  // e/ou aplicarEfeitosDoSinal (grupo financeiro, lib/financeiro/sinal-deal.ts).
  const caminhos = [
    ['apps', 'crm', 'src', 'lib', 'actions', 'financeiro.ts'],
    ['apps', 'crm', 'src', 'lib', 'financeiro', 'sinal-deal.ts'],
  ];
  let algum = false;
  for (const c of caminhos) {
    const src = lerSeExiste(...c);
    if (!src) continue;
    const moveParaSinal = /etapa: "sinal_pago"|moverDeal\(dealId, "sinal_pago"\)/.test(src);
    if (!moveParaSinal) continue;
    algum = true;
    assert.match(src, /deveMoverParaSinalPago\(/, `${c.join('/')} move para sinal_pago sem checar a ordem do board`);
    assert.ok(!/^\s*etapa: "sinal_pago",\s*$/m.test(src), `${c.join('/')}: etapa: "sinal_pago" incondicional voltou`);
  }
  assert.ok(algum, 'nenhum caminho de sinal encontrado — guard desatualizado');
  assert.match(etapasOrdem, /return compararOrdemBoard\(etapaAtual, "sinal_pago", config\) < 0;/);
});

// ─── 3. Ganho em todos os conjuntos ──────────────────────────────────────
test('ganho: plano_escolhido e colunas personalizadas marcadas em todos os conjuntos', () => {
  assert.match(etapasDeal, /ETAPAS_GANHO_FIXAS: readonly DealStage\[\] = \[\s*"contrato_assinado",\s*"sinal_pago",\s*"plano_escolhido",\s*"admission_process",\s*"concluido",\s*\]/);
  assert.match(etapasDeal, /ETAPAS_GANHO_FIXAS\.includes\(stage\) \|\|\s*\(base\.isCustomSlot === true && regra\?\.ganho === true\)/,
    'ganho = fixas + personalizada marcada (e nunca configurável em etapa fixa)');
  assert.match(etapasDeal, /typeof entry\.ganho === "boolean" && DEAL_STAGE_CONFIG\[key\]\.isCustomSlot === true/,
    'regra ganho só pode valer para slot custom');
  // pipeline
  assert.match(pageSrc, /const etapasDeGanho = etapasGanho\(stageConfig\);/);
  assert.match(pageSrc, /const signedStages: DealStage\[\] = etapasDeGanho;/);
  // remarketing (fail-closed)
  assert.match(remSrc, /getEtapasGanho\(\{ falhaComoGanho: true \}\)/, 'remarketing precisa ser fail-closed');
  assert.ok(!/const ETAPAS_GANHAS = \[/.test(remSrc), 'lista fixa de ganho voltou ao remarketing');
  // War Room
  assert.match(warSrc, /countByEtapa\(sinaisPagos\)/);
  assert.match(warSrc, /\["sinal_pago", "plano_escolhido", "admission_process"\]/);
  // desfecho_real
  assert.match(mover, /stageMap\[novaEtapa\]\?\.ganho\s*\?\s*"fechou"/);
  // alerta "Negociação parada" continua só em negociacao (pré-venda)
  assert.match(alertasSrc, /\.eq\("etapa", "negociacao"\)/);
  assert.ok(!/plano_escolhido/.test(alertasSrc), 'plano_escolhido não pode gerar alerta de negociação');
  // handoff da jornada
  assert.match(migOrdem, /WHEN 'plano_escolhido'\s+THEN 'envio_opcoes'::fase_experiencia/);
});

test('ganho: chatbot autônomo escala plano_escolhido, colunas de ganho e etapa desconhecida', () => {
  const esc = fatia(chatSrc, 'const ESCALACAO_ETAPAS = new Set([', ']);');
  assert.match(esc, /'plano_escolhido'/, 'plano_escolhido fora do escalonamento duro');
  for (const e of ['sinal_pago', 'contrato_assinado', 'admission_process', 'negociacao']) {
    assert.match(esc, new RegExp(`'${e}'`), `${e} saiu do escalonamento duro`);
  }
  const permitida = fatia(chatSrc, 'const ETAPAS_IA_PERMITIDA = new Set([', ']);');
  for (const e of ['sinal_pago', 'plano_escolhido', 'contrato_assinado', 'custom_']) {
    assert.ok(!permitida.includes(`'${e}`), `${e} não pode estar entre as etapas em que a IA responde`);
  }
  assert.match(chatSrc, /return !ETAPAS_IA_PERMITIDA\.has\(etapa\);/, 'etapa desconhecida deve escalar (fail-closed)');
  assert.match(chatSrc, /if \(SLOT_CUSTOM_RE\.test\(etapa\)\) return customGanho\.has\(etapa\);/);
  assert.match(chatSrc, /return new Set\(\['custom_1', 'custom_2', 'custom_3', 'custom_4', 'custom_5', 'custom_6'\]\);/,
    'regras ilegíveis devem escalar todas as personalizadas');
  assert.match(chatSrc, /deveEscalarPorEtapa\(lead\.etapa, config\.customGanho\)/);
});

test('ganho: automation-engine não dispara "deal parado" em ganho (fail-closed)', () => {
  const lista = fatia(engineSrc, 'const ETAPAS_FORA_DEAL_PARADO = [', '];');
  for (const e of ['concluido', 'perdido', 'aguardando_timing', 'sinal_pago', 'plano_escolhido', 'admission_process']) {
    assert.match(lista, new RegExp(`'${e}'`), `${e} voltou a ser elegível a "deal parado"`);
  }
  const fn = fatia(engineSrc, 'const colunasGanhoCustom = async', '};');
  assert.match(fn, /catch \(e\) \{[\s\S]*return SLOTS_CUSTOM;/, 'erro de leitura deve excluir todas as personalizadas');
  assert.match(engineSrc, /&etapa=not\.in\.\(\$\{fora\.join\(','\)\}\)/);
});

// ─── 4. Rótulos (T17) ────────────────────────────────────────────────────
test('rótulos: modal, toast e avisos mostram o nome da coluna', () => {
  assert.match(retroSrc, /labelEtapa\(fromStage, stageConfig\)/);
  assert.match(retroSrc, /labelEtapa\(toStage, stageConfig\)/);
  assert.match(boardSrc, /stageConfig=\{stageConfig\}\s*onCancel=\{\(\) => setPendingMove\(null\)\}/,
    'o board precisa passar o stageConfig ao RetrocessoModal');
  assert.match(boardSrc, /`Movido para \$\{labelEtapa\(novaEtapa, stageConfig\)\}`/);
  const aprovar = fatia(leadsSrc, 'export async function aprovarLead', 'export async function reprovarLead');
  assert.ok(!/"\$\{garantia\.etapa\}"/.test(aprovar), 'aviso da aprovação voltou a mostrar o código da etapa');
  assert.match(aprovar, /getRotulosEtapas\(\)/);
  assert.ok(!/etapa \$\{d\.etapa\}/.test(alertasSrc), 'alerta voltou a mostrar o código da etapa');
});

// ─── 5. Próxima ação (T21) ───────────────────────────────────────────────
test('próxima ação: padrão da coluna aplicado pelo TRIGGER (todos os escritores), nunca sobre manual, nunca vazia', () => {
  const trig = fatia(migMeta, 'CREATE OR REPLACE FUNCTION public.trg_deals_next_action_meta', '$$ LANGUAGE plpgsql');
  // pré-condições da troca: etapa mudou, escritor não mexeu na ação/prazo/autoria, ação de sistema
  for (const re of [
    /NEW\.etapa IS DISTINCT FROM OLD\.etapa/,
    /NEW\.next_action IS NOT DISTINCT FROM OLD\.next_action\b/,
    /NEW\.data_proxima_acao IS NOT DISTINCT FROM OLD\.data_proxima_acao/,
    /NEW\.next_action_manual_em IS NOT DISTINCT FROM OLD\.next_action_manual_em\s+AND NEW\.deleted_at IS NULL/,
    /NEW\.etapa::text <> 'perdido'/,
    /public\.next_action_e_de_sistema\(OLD\.next_action, OLD\.next_action_etapa, OLD\.next_action_manual_em\)/,
  ]) assert.match(trig, re, `pré-condição da ação padrão sumiu: ${re}`);
  assert.match(trig, /c\.chave = 'etapas_deal_regras'/, 'a ação padrão vem de etapas_deal_regras');
  assert.match(trig, /EXCEPTION WHEN OTHERS THEN\s*v_acao := NULL;/, 'config ilegível não pode abortar o UPDATE');
  assert.match(trig, /length\(btrim\(v_acao ->> 'texto'\)\) BETWEEN 3 AND 120/, 'texto padrão inválido nunca é aplicado');
  assert.ok(!/NEW\.next_action\s*:=\s*(NULL|'')/.test(trig), 'o trigger nunca esvazia a próxima ação (Regra 2)');
  assert.match(trig, /NEW\.next_action_manual_em IS NOT DISTINCT FROM OLD\.next_action_manual_em THEN\s*NEW\.next_action_manual_em := NULL;/,
    'reescrita por outro escritor deve perder a marca manual');
  assert.match(trig, /WHEN current_user = 'authenticated' THEN NULL/,
    'escrita do Engine sem autoria declarada não pode ser carimbada como sistema (rollout/código antigo)');
  assert.match(migMeta, /BEFORE INSERT OR UPDATE ON public\.deals/);
  // moverDeal NÃO aplica por conta própria (fonte única = trigger) e não esvazia
  assert.ok(!/updateData\.next_action\b/.test(mover), 'moverDeal voltou a gravar next_action (duas fontes da regra)');
  assert.ok(!/next_action\s*[:=]\s*null/.test(mover), 'moverDeal não pode esvaziar a próxima ação (Regra 2)');
  assert.match(mover, /\.select\("id, next_action"\)/, 'moverDeal precisa ler a ação aplicada pelo trigger (toast)');
  const atualizar = fatia(dealsSrc, 'export async function atualizarDeal');
  assert.match(atualizar, /payload\.next_action_manual_em = new Date\(\)\.toISOString\(\);/,
    'edição manual da ação precisa ganhar a marca manual');
  assert.match(atualizar, /for \(const campo of CAMPOS_EDITAVEIS_DEAL\)/, 'whitelist do atualizarDeal sumiu');
  assert.match(proximaAcao, /if \(meta\.next_action_manual\) return true;/);
  assert.match(proximaAcao, /return acaoSistemaLegada\(meta\.next_action\) === null;/,
    'legado: texto desconhecido precisa contar como manual (conservador)');
});

test('próxima ação: textos de sistema idênticos no TS (exibição) e no SQL (troca)', () => {
  const norm = (re) => re.replace(/\\d\{4\}/g, '[0-9]{4}').replace(/\\\//g, '/').toLowerCase();
  const bloco = fatia(proximaAcao, 'const ACOES_SISTEMA_LEGADAS', '];');
  const ts = [...bloco.matchAll(/re: \/(.+?)\/i,/g)].map((m) => norm(m[1]));
  const fn = fatia(migMeta, 'CREATE OR REPLACE FUNCTION public.next_action_e_de_sistema', '$$;');
  const sql = [...fn.matchAll(/'(\^[^']+)'/g)].map((m) => norm(m[1]));
  assert.ok(ts.length >= 10, 'lista TS de textos de sistema incompleta');
  assert.deepEqual(sql, ts, 'lista de textos de sistema divergiu entre proxima-acao.ts e next_action_e_de_sistema');
  // mesma ordem de decisão do isAcaoManual: vazio → sistema; manual → não; carimbada → sistema
  assert.match(fn, /WHEN p_texto IS NULL OR btrim\(p_texto\) = '' THEN true\s*WHEN p_manual_em IS NOT NULL THEN false\s*WHEN p_etapa IS NOT NULL THEN true/);
});

// ─── 6. T10 + migration de dados ─────────────────────────────────────────
test('pede plano: o card não se move antes da escolha do plano', () => {
  const drag = fatia(boardSrc, 'const handleDragEnd', 'const concluirPlanoPendente');
  const iPlano = drag.indexOf('colunaPedePlano(stageConfig[newStage])');
  const iMove = drag.lastIndexOf('performMove(');
  assert.ok(iPlano > 0 && iMove > iPlano, 'checagem de plano tem de vir ANTES do move');
  assert.match(drag, /setPlanoPendente\(\{[\s\S]*?\}\);\s*return;/, 'sem return: o card moveria antes do modal');
  assert.match(boardSrc, /onCancel=\{\(\) => setPlanoPendente\(null\)\}/, 'cancelar não pode mover');
});

test('migration de dados: move o rótulo sem apagar as outras colunas', { skip: migColuna ? false : 'PR-2 (124400) ainda não mergeado' }, () => {
  assert.match(migColuna, /v_cfg := v_cfg \|\| jsonb_build_object\(/, 'merge com || (preserva as demais chaves)');
  assert.ok(!/SET valor = '\{/.test(migColuna), 'a migration não pode sobrescrever a config inteira');
  assert.match(migColuna, /'plano escolhido'/, 'gatilho da migração é negociacao rotulada "Plano escolhido"');
  assert.match(migColuna, /jsonb_build_object\('oculta', true, 'order'/, 'negociacao volta a ser pré-venda oculta');
});

test('visibilidade: quem grava etapas_deal_config inteira preserva coluna visível de padrão oculto', () => {
  // Slots custom e plano_escolhido nascem ocultos: sem gravar `oculta:false`
  // explícito, salvar a aba Pipelines escondia Admitido/Valor total pago/Plano escolhido.
  assert.match(pipelinesTabSrc, /const ocultaPorPadrao = base\.isCustomSlot === true \|\| base\.ocultaPorPadrao === true;\s*if \(row\.oculta !== ocultaPorPadrao\) override\.oculta = row\.oculta;/);
  assert.ok(!/if \(row\.oculta\) override\.oculta = true;/.test(pipelinesTabSrc), 'regra antiga (só grava oculta:true) voltou');
});
