'use strict';

// ════════════════════════════════════════════════════════════════════════
// Guard — a MESMA regra de colunas em todas as telas (auditoria 09/10/2026)
// ════════════════════════════════════════════════════════════════════════
//
// Três lacunas confirmadas pela auditoria das 23 tarefas (PRs #431–#443):
//
//   A. T17/T2/T20 — o editor do deal FORA do board (dossiê de /leads, faixa
//      "Fora do pipeline", /remarketing) abria sem a config das colunas e
//      caía no default estático: "Coluna personalizada 2", "Avançar" para o
//      slot oculto e sem nome custom_3 (deal saía das métricas de ganho) e,
//      de Sinal pago, pulava "Plano escolhido".
//      Invariantes: (1) todo render do editor recebe `stageConfig`, que é
//      prop OBRIGATÓRIA (sem default estático); (2) a config vem da mesma
//      mescla do board (overrides + regras); (3) Avançar/Retroceder só
//      oferecem colunas VISÍVEIS na ordem do board — sem fallback estático;
//      (4) coluna que pede plano abre o PlanoEscolhidoModal ANTES de mover.
//   B. T21 — a Visão Executiva pintava de vermelho "Próxima ação atrasada"
//      para ação HERDADA de etapa anterior, e o contador "Ações atrasadas"
//      do /pipeline a contava. Regra única: isAcaoAtrasadaDaEtapa.
//   C. T20 — "Contratos Assinados"/"Contratos/Mês" do War Room somavam
//      contrato_enviado + negociacao e ignoravam o que veio DEPOIS da
//      assinatura (sinal, plano, admissão, colunas de ganho). Regra única:
//      etapas de GANHO (getEtapasGanho), como /pipeline, funil e relatórios.
//
// 2ª rodada (revisão do fix, 09/10/2026):
//   A'. A etapa atual OCULTA (aguardando_timing, admission_process) entrava
//      no editor pela posição do board (depois de Perdido): sem "Avançar" e
//      com todo o funil como "Retroceder". Agora entra pela ORDEM FIXA, como
//      o servidor a compara; justificativa só quando o servidor marca
//      retrocesso. A fila de aprovação (AprovacaoLeadsModal) e a /agenda
//      também usam a config do board.
//   B'. "Próximas Ações" do War Room pintava herdada de "ATRASADO".
//   C'. A meta MENSAL "Contratos/Mês" comparava o ESTOQUE de ganhos (batida
//      para sempre); agora usa a ENTRADA em ganho no mês. "Propostas" do
//      funil inclui negociação/contrato enviado (sumiam de todos os baldes).
//
// O comportamento (próxima/anterior coluna, atraso) é EXECUTADO no Vitest:
// apps/crm/src/lib/etapas-ordem.test.ts — este guard trava que ele exista.
//
// Execução local:  node --test tests/*.test.js
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const CRM_SRC = path.join(raiz, 'apps', 'crm', 'src');
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), 'utf8');
const lerCrm = (...p) => ler('apps', 'crm', 'src', ...p);
const fatia = (src, inicio, fim) => {
  const i = src.indexOf(inicio);
  assert.ok(i >= 0, `trecho não encontrado: ${inicio}`);
  const j = fim ? src.indexOf(fim, i + inicio.length) : src.length;
  return src.slice(i, j < 0 ? src.length : j);
};

function arquivosTsx(dir) {
  const out = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entrada.name);
    if (entrada.isDirectory()) out.push(...arquivosTsx(p));
    else if (entrada.name.endsWith('.tsx') && !entrada.name.endsWith('.test.tsx')) out.push(p);
  }
  return out;
}

/** Texto de cada `<Nome …>` / `<Nome … />` (atributos com `{…}` balanceados). */
function rendersDe(src, nome) {
  const re = new RegExp(`<${nome}(?=[\\s/>])`, 'g');
  const tags = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    let profundidade = 0;
    let fim = -1;
    for (let i = m.index + 1; i < src.length; i++) {
      const c = src[i];
      if (c === '{') profundidade++;
      else if (c === '}') profundidade--;
      else if (c === '>' && profundidade === 0) {
        fim = i;
        break;
      }
    }
    assert.ok(fim > 0, `tag <${nome}> sem fechamento`);
    tags.push(src.slice(m.index, fim + 1));
  }
  return tags;
}

// Componentes que abrem (ou SÃO) o editor do deal e precisam da config.
const EDITORES = [
  { nome: 'DealDetailModal', arquivo: ['components', 'pipeline', 'DealDetailModal.tsx'], minimo: 2 },
  { nome: 'DealDetailSheet', arquivo: ['components', 'pipeline', 'DealDetailSheet.tsx'], minimo: 2 },
  { nome: 'LeadOrDealSheet', arquivo: ['components', 'leads', 'LeadOrDealSheet.tsx'], minimo: 1 },
  { nome: 'DossieLeadView', arquivo: ['components', 'leads', 'DossieLead.tsx'], minimo: 2 },
  { nome: 'RemarketingLeadSheet', arquivo: ['components', 'remarketing', 'RemarketingLeadSheet.tsx'], minimo: 1 },
  { nome: 'VisaoExecutivaPanel', arquivo: ['components', 'pipeline', 'panels', 'VisaoExecutivaPanel.tsx'], minimo: 1 },
  { nome: 'LeadsTable', arquivo: ['components', 'leads', 'LeadsTable.tsx'], minimo: 1 },
  { nome: 'RemarketingClient', arquivo: ['app', '(dashboard)', 'remarketing', 'client.tsx'], minimo: 1 },
  { nome: 'PipelineBoard', arquivo: ['components', 'pipeline', 'PipelineBoard.tsx'], minimo: 1 },
  // Fila de aprovação/revisão: toasts e avisos citam a coluna (T17).
  { nome: 'AprovacaoLeadsModal', arquivo: ['components', 'leads', 'AprovacoesLeads.tsx'], minimo: 6 },
];

// ─── A. Editor do deal com a config do board em TODO lugar ────────────────
test('A: nenhum render do editor do deal (nem de quem o abre) sem stageConfig', () => {
  const fontes = arquivosTsx(CRM_SRC).map((f) => ({ f: path.relative(raiz, f), src: fs.readFileSync(f, 'utf8') }));
  for (const { nome, minimo } of EDITORES) {
    let achados = 0;
    for (const { f, src } of fontes) {
      for (const tag of rendersDe(src, nome)) {
        achados++;
        assert.match(tag, /\bstageConfig=\{/, `${f}: <${nome}> renderizado sem stageConfig (cai no default estático)`);
        assert.ok(!/stageConfig=\{DEFAULT_DEAL_STAGE_DISPLAY\}/.test(tag),
          `${f}: <${nome}> recebe o default estático em vez da config do board`);
      }
    }
    assert.ok(achados >= minimo, `<${nome}>: esperava ≥ ${minimo} render(s), achei ${achados} — guard desatualizado?`);
  }
});

test('A: stageConfig é prop OBRIGATÓRIA (sem default estático) nos editores', () => {
  for (const { nome, arquivo } of EDITORES) {
    const src = lerCrm(...arquivo);
    assert.match(src, /\bstageConfig: DealStageConfigMap;/, `${nome}: stageConfig precisa ser obrigatória`);
    assert.ok(!/\bstageConfig\?: DealStageConfigMap/.test(src), `${nome}: stageConfig voltou a ser opcional`);
    assert.ok(!/stageConfig(?:: \w+)? = DEFAULT_DEAL_STAGE_DISPLAY/.test(src),
      `${nome}: default estático no lugar da config do board`);
  }
  const visao = lerCrm('components', 'pipeline', 'panels', 'VisaoExecutivaPanel.tsx');
  assert.ok(!/DEAL_STAGE_CONFIG\[/.test(visao), 'Visão Executiva voltou ao rótulo estático da etapa');
  const tabela = lerCrm('components', 'leads', 'LeadsTable.tsx');
  assert.ok(!/DEAL_STAGE_CONFIG\[/.test(tabela), '/leads voltou ao rótulo estático da coluna');
  assert.match(tabela, /getStageDisplay\(stageConfig, lead\.pipeline_stage\)/);
});

test('A: a config vem da MESMA mescla do board (overrides + regras)', () => {
  const cfg = lerCrm('lib', 'actions', 'configuracoes.ts');
  const fn = fatia(cfg, 'export async function getStageConfigDeal', '\n}');
  assert.match(fn, /const cfg = await getConfigEtapasDeal\(\);/);
  assert.match(fn, /return mergeDealStageConfig\(cfg\.overrides, cfg\.regras\);/, 'sem regras = sem ganho/pede plano');
  const pipeline = lerCrm('app', '(dashboard)', 'pipeline', 'page.tsx');
  assert.match(pipeline, /const stageConfig = mergeDealStageConfig\(cfgEtapas\.overrides, cfgEtapas\.regras\);/);
  for (const rota of ['leads', 'remarketing']) {
    const page = lerCrm('app', '(dashboard)', rota, 'page.tsx');
    assert.match(page, /getStageConfigDeal\(\)/, `/${rota} não busca a config das colunas`);
    assert.match(page, /stageConfig=\{stageConfig\}/, `/${rota} não repassa a config das colunas`);
  }
  const board = lerCrm('components', 'pipeline', 'PipelineBoard.tsx');
  assert.match(fatia(board, '<DossieLeadView', '/>'), /stageConfig=\{stageConfig\}/,
    'a faixa "Fora do pipeline" abre o editor sem a config do board');
});

test('A: Avançar/Retroceder só por colunas VISÍVEIS, na ordem do board (sem fallback estático)', () => {
  const ordem = lerCrm('lib', 'etapas-ordem.ts');
  const bloco = fatia(ordem, 'function colunasDoEditor', 'export function proximaColunaBoard');
  assert.match(bloco, /const board = orderedKanbanStages\(config\);/, 'o editor precisa partir da ordem do board');
  assert.match(bloco, /!config\[s\]\.oculta && s !== "perdido"/, 'o editor só oferece colunas visíveis (sem Perdido)');
  // A' — etapa atual oculta entra pela escala do SERVIDOR (ordem fixa), não
  // pela posição do board (depois de Perdido → sem Avançar, tudo Retroceder).
  assert.match(bloco, /ordemEtapaBoard\(atual, config\) !== null \|\| isColunaPersonalizada\(atual\)/,
    'só a atual com ordem de board (ou coluna personalizada) usa a posição do board');
  assert.match(bloco, /ordemEtapaFixa\(s\) < fixaAtual/, 'atual oculta tem de entrar pela ordem fixa, como no servidor');
  const prox = fatia(ordem, 'export function proximaColunaBoard', 'export function colunasAnterioresBoard');
  const ant = fatia(ordem, 'export function colunasAnterioresBoard');
  for (const [nome, src] of [['proximaColunaBoard', prox], ['colunasAnterioresBoard', ant]]) {
    assert.match(src, /colunasDoEditor\(atual, config\)/, `${nome} fora da ordem do board`);
    assert.ok(!/PIPELINE_STAGE_ORDER/.test(src), `${nome}: fallback pela ordem estática voltou (oferecia coluna oculta)`);
  }
  const sheet = lerCrm('components', 'pipeline', 'DealDetailSheet.tsx');
  assert.match(sheet, /proximaColunaBoard\(deal\.stage, stageConfigMap\)/);
  assert.match(sheet, /colunasAnterioresBoard\(deal\.stage, stageConfigMap\)/);
  // A' — justificativa e "Retrocedido" só quando o SERVIDOR marca retrocesso
  // (sair de Aguardando timing / coluna personalizada é isento: o motivo
  // seria descartado e o toast mentiria).
  assert.match(sheet, /const retrocessoExigeMotivo =\s*!retrocederStage \|\| isRetrocessoEtapa\(deal\.stage, retrocederStage, stageConfigMap\);/);
  assert.match(sheet, /if \(retrocessoExigeMotivo && !retrocederMotivo\.trim\(\)\)/);
  assert.match(sheet, /retrocessoReal \? `Retrocedido para \$\{destinoLabel\}` : `Movido para \$\{destinoLabel\}`/);
  // O comportamento é executado no Vitest (config real de PRD).
  const vitest = lerCrm('lib', 'etapas-ordem.test.ts');
  for (const caso of [
    'Valor total pago (custom_2) não avança para o slot oculto e sem nome custom_3',
    'Sinal pago avança para Plano escolhido',
    'nunca oferece coluna oculta nem Perdido como destino',
    'etapa atual OCULTA entra pela ordem fixa, como no servidor: aguardando_timing avança para Reunião marcada',
    'admission_process oculta avança para Admitido',
    'paridade com o servidor: Avançar nunca é retrocesso e Retroceder nunca é avanço',
  ]) {
    assert.ok(vitest.includes(caso), `caso de comportamento sumiu do Vitest: "${caso}"`);
  }
});

test("A': fila de aprovação e /agenda com a config do board (nunca o rótulo estático)", () => {
  const aprov = lerCrm('components', 'leads', 'AprovacoesLeads.tsx');
  assert.ok(!/DEFAULT_DEAL_STAGE_DISPLAY/.test(aprov), 'fila de aprovação voltou ao default estático das colunas');
  // Wrapper: página passa a config; o ícone do Header busca a mesma mescla.
  assert.match(aprov, /\{ variant\?: "button"; count: number; stageConfig: DealStageConfigMap \}/,
    'AprovacoesLeads (botão) precisa exigir stageConfig');
  assert.match(fatia(aprov, 'const carregar = async', 'void carregar();'), /await getStageConfigDeal\(\)/,
    'o ícone do Header precisa buscar a config das colunas');
  const fontes = arquivosTsx(CRM_SRC).map((f) => ({ f: path.relative(raiz, f), src: fs.readFileSync(f, 'utf8') }));
  let wrappers = 0;
  for (const { f, src } of fontes) {
    for (const tag of rendersDe(src, 'AprovacoesLeads')) {
      wrappers++;
      assert.ok(/\bstageConfig=\{/.test(tag) || /variant="icon"/.test(tag), `${f}: <AprovacoesLeads> sem stageConfig`);
    }
  }
  assert.ok(wrappers >= 3, `esperava ≥ 3 <AprovacoesLeads> (Header, /leads, /war-room), achei ${wrappers}`);
  const warPage = lerCrm('app', '(dashboard)', 'war-room', 'page.tsx');
  assert.match(warPage, /getStageConfigDeal\(\)/);

  const agenda = lerCrm('app', '(dashboard)', 'agenda', 'client.tsx');
  assert.ok(!/DEAL_STAGE_CONFIG\[/.test(agenda), '/agenda voltou ao rótulo estático da etapa');
  assert.equal(agenda.split('getStageDisplay(stageConfig,').length - 1, 3, '/agenda: os 3 rótulos de etapa pela config');
  assert.match(lerCrm('app', '(dashboard)', 'agenda', 'page.tsx'), /getStageConfigDeal\(\)/);
});

test('A: editor lateral abre a escolha do plano ANTES de mover (contrato B1)', () => {
  const sheet = lerCrm('components', 'pipeline', 'DealDetailSheet.tsx');
  const avancar = fatia(sheet, 'const handleAdvance', 'const handleRetroceder');
  const iPlano = avancar.indexOf('colunaPedePlano(stageConfigMap[nextStage])');
  const iMove = avancar.lastIndexOf('executarAvanco(nextStage)');
  assert.ok(iPlano > 0 && iMove > iPlano, 'Avançar: checagem do plano tem de vir ANTES do move');
  assert.match(avancar, /setPlanoPara\(\{ etapa: nextStage \}\);\s*return;/, 'sem return: o deal moveria antes do modal');
  const retro = fatia(sheet, 'const handleRetroceder', 'const executarRetrocesso');
  assert.match(retro, /colunaPedePlano\(stageConfigMap\[retrocederStage as DealStage\]\)\) \{\s*setPlanoPara\([^)]*\);\s*return;/,
    'Retroceder para coluna que pede plano tem de abrir o modal antes');
  assert.match(sheet, /onCancel=\{\(\) => setPlanoPara\(null\)\}/, 'cancelar o plano não pode mover');
  assert.match(sheet, /onConfirmed=\{concluirPlano\}/);
});

// ─── B. Ação herdada nunca é "atrasada" (T21) ─────────────────────────────
test('B: regra única de atraso — só ação da etapa atual (ou manual)', () => {
  const pa = lerCrm('lib', 'proxima-acao.ts');
  const fn = fatia(pa, 'export function isAcaoAtrasadaDaEtapa', '\n}');
  assert.match(fn, /return !isAcaoDeOutraEtapa\(deal, etapaAtual\);/, 'herdada voltou a contar como atraso');
  assert.match(fn, /if \(!prazo \|\| prazo >= hoje\) return false;/);

  const card = lerCrm('components', 'pipeline', 'DealCard.tsx');
  assert.match(card, /const isOverdue = isAcaoAtrasadaDaEtapa\(deal, deal\.stage, hojeIsoUtc\(\)\);/);

  const visao = lerCrm('components', 'pipeline', 'panels', 'VisaoExecutivaPanel.tsx');
  const vermelho = fatia(visao, 'if (isAcaoAtrasadaDaEtapa(deal, deal.stage, hojeIsoUtc()))', '} else if (isAcaoDeOutraEtapa(deal, deal.stage))');
  assert.match(vermelho, /Próxima ação atrasada em/);
  assert.match(vermelho, /tone: "red"/);
  assert.equal(visao.split('Próxima ação atrasada').length - 1, 1, 'outro "Próxima ação atrasada" fora da regra única');
  const herdada = fatia(visao, '} else if (isAcaoDeOutraEtapa(deal, deal.stage))', '\n  }\n');
  assert.match(herdada, /tone: "neutral"/, 'ação herdada tem de aparecer neutra (como no card)');
  assert.match(herdada, /labelEtapa\(origem, stageConfig\)/, 'etapa de origem pelo nome da coluna do CEO');

  const tabela = lerCrm('components', 'pipeline', 'PipelineTableView.tsx');
  assert.match(tabela, /d\.next_action_date && !acaoHerdada/);

  // B' — "Próximas Ações" do War Room: mesma regra (herdada nunca é ATRASADO).
  const war = lerCrm('lib', 'war-room-queries.ts');
  const prox = fatia(war, 'export async function fetchUpcomingActions', '// ─── Financial Summary');
  assert.match(prox, /next_action_etapa, next_action_manual_em/, 'sem os metadados a herdada não é reconhecida');
  assert.match(prox, /is_overdue: isAcaoAtrasadaDaEtapa\(meta, etapa, hoje\),/);
  assert.ok(!/is_overdue: dateStr < hoje/.test(prox), 'atraso por data pura (conta herdada) voltou');
  const secao = lerCrm('components', 'war-room', 'UpcomingActionsSection.tsx');
  assert.match(secao, /action\.herdada_de \? "text-label-tertiary"/, 'herdada tem de aparecer neutra');
});

test('B: contador "Ações atrasadas" do /pipeline não conta herdada e diz isso', () => {
  const page = lerCrm('app', '(dashboard)', 'pipeline', 'page.tsx');
  assert.match(page, /const acoesAtrasadas = activeDeals\.filter\(\(d\) => isAcaoAtrasadaDaEtapa\(d, d\.stage, hoje\)\)\.length;/);
  assert.ok(!/new Date\(d\.next_action_date\)\.getTime\(\) < now/.test(page), 'contador antigo (conta herdada) voltou');
  assert.match(page, /acoesHerdadasVencidas,/);
  const barra = lerCrm('components', 'pipeline', 'PipelineMetricsBar.tsx');
  const chip = fatia(barra, 'label: "Ações atrasadas"', '}');
  assert.match(chip, /hint: hintHerdadas/, 'o chip precisa explicar que herdada não conta');
  assert.match(barra, /Só da etapa atual/);
});

// ─── C. Contratos assinados = assinado EM DIANTE (T20) ────────────────────
test('C: War Room conta contrato assinado em diante (ganho), nunca enviado/negociação', () => {
  const war = lerCrm('lib', 'war-room-queries.ts');
  const funil = fatia(war, 'export async function fetchCommercialFunnel', 'export async function fetchCashFlow');
  assert.match(funil, /const contratosAssinados: DealStage\[\] = etapasGanho;/);
  assert.match(funil, /countByEtapa\(contratosAssinados\)/);
  assert.match(funil, /contracts_signed: contratos,/);
  // C' — pós-proposta não ganho (inclui contrato enviado/negociação) no balde Propostas.
  assert.match(funil, /countByEtapa\(\[\.\.\.ETAPAS_POS_PROPOSTA\]\)/, 'contrato enviado/negociação sumiram do funil');
  for (const etapa of ['contrato_enviado', 'negociacao']) {
    assert.ok(!new RegExp(`countByEtapa\\(\\[[^\\]]*"${etapa}"`).test(funil),
      `${etapa} voltou a contar como contrato assinado`);
  }
  // Sinais pagos ⊂ contratos assinados (mesmo conjunto de ganho).
  assert.match(funil, /const sinaisPagos = etapasGanho\.filter\(/);

  // C' — meta MENSAL = entrada em ganho NO MÊS; o estoque do funil nunca.
  const page = lerCrm('app', '(dashboard)', 'war-room', 'page.tsx');
  assert.match(page, /const contratosMes = funil\.contracts_signed_month;/);
  assert.match(page, /pctSeguro\(contratosMes, METAS_BAUSA\.contratos_por_mes\)/);
  assert.ok(!/pctSeguro\(funil\.contracts_signed,/.test(page), 'meta mensal comparando o ESTOQUE de ganhos (batida para sempre)');
  assert.ok(!/funil\.contracts_signed >= METAS_BAUSA/.test(page), 'cor da meta mensal pelo estoque de ganhos');
  assert.match(funil, /contracts_signed_month: contratosMes,/);
  const mes = fatia(war, 'async function contarContratosFechadosNoMes', '\n}\n');
  assert.match(mes, /\.from\("audit_logs"\)/, 'entrada em ganho vem da trilha de etapa');
  assert.match(mes, /\.gte\("created_at", inicioMesBrtIso\(\)\)/, 'corte do mês em BRT');
  assert.match(mes, /linha\.operacao === "INSERT" \|\| !ganho\.has\(linha\.etapa_de \?\? ""\)/, 'só ENTRADA em ganho (não troca entre colunas de ganho)');
  assert.match(mes, /\.filter\(\(d\) => ganho\.has\(d\.etapa\)\)/, 'só quem segue em ganho');

  // Mesma regra no /pipeline, no funil de conversão e nos relatórios.
  assert.match(lerCrm('app', '(dashboard)', 'pipeline', 'page.tsx'), /const signedStages: DealStage\[\] = etapasDeGanho;/);
  assert.match(war, /const contratos = deals\.filter\(\(d\) => ganho\.has\(d\.etapa\)\)\.length;/);
  assert.match(lerCrm('app', '(dashboard)', 'relatorios', 'page.tsx'), /const contratos = allDeals\.filter\(\(d\) => etapasGanho\.has\(d\.etapa\)\)\.length;/);

  // Ganho nunca inclui pré-assinatura.
  const etapasDeal = lerCrm('lib', 'etapas-deal.ts');
  const ganhoFixas = fatia(etapasDeal, 'export const ETAPAS_GANHO_FIXAS', '];');
  assert.ok(!/contrato_enviado|negociacao/.test(ganhoFixas), 'pré-assinatura entrou no ganho');
});
