'use strict';

// ════════════════════════════════════════════════════════════════════════
// GUARD — API de Conversões do Meta (CF meta-capi, evento LeadQualificado)
// ════════════════════════════════════════════════════════════════════════
// 17/11/2026: o CEO quer ensinar o algoritmo do Meta o que é lead BOM. A CF
// manda LeadQualificado só para QUENTE/MORNO. Invariantes travados aqui:
//   1. Só QUENTE/MORNO saem (FRIO/INVALIDO/INCOMPLETO nunca).
//   2. Dados de MENOR (atleta) nunca saem — só responsáveis, com hash.
//   3. Normalização + SHA-256 no formato que o Meta exige (senão não casa).
//   4. Exatamente-uma-vez: CAS em meta_capi_lq_sent_at ANTES do envio.
//   5. UAT/DEV nunca mandam evento real (exigem test_event_code).
//   6. Token fora da URL e do log; auth fail-closed; sinal observável.
// O núcleo (capi.js) é EXECUTADO; o handler (index.js) é checado por fonte.
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), 'utf8');
const capi = require('../functions/meta-capi/capi.js');
const indexSrc = ler('functions', 'meta-capi', 'index.js');

const sha = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
const AGORA = Date.parse('2026-11-17T18:00:00.000Z');

const leadBase = (extra = {}) => ({
  id: '7f3a1c2e-4b5d-4e6f-8a9b-0c1d2e3f4a5b',
  qualification_classification: 'QUENTE',
  qualified_at: '2026-11-17T17:00:00.000Z',
  submitted_at: '2026-11-17T16:55:00.000Z',
  email: ' Maria.Silva@Exemplo.com ',
  guardian_email: ' Maria.Silva@Exemplo.com ',
  guardian_email_2: null,
  guardian_name: 'José da Silva',
  guardian_whatsapp: '+55 (11) 99999-8888',
  guardian_whatsapp_2: null,
  athlete_whatsapp: '+55 11 98888-7777',
  athlete_name: 'Atleta Menor',
  birth_date: '2011-03-02',
  address_city: 'São Paulo',
  address_state: 'SP',
  address_cep: '01310-100',
  address_country: 'BR',
  landing_url: 'https://www.bolsaatletausa.com/forms?mcp_token=abc&fbclid=xyz',
  user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
  ip_address: '177.10.20.30',
  meta_fbp: 'fb.1.1731860000000.1234567890',
  meta_fbc: 'fb.1.1731860000000.IwAR0abc_DEF-123',
  meta_capi_lq_tentativas: 0,
  ...extra,
});

// ─── 1. Só QUENTE/MORNO, com valor por classe ───────────────────────────
test('1: só QUENTE/MORNO geram evento, com valor 300/100 em BRL', () => {
  assert.deepEqual(capi.CLASSES_QUALIFICADAS, ['QUENTE', 'MORNO']);
  for (const classe of ['FRIO', 'INVALIDO', 'INCOMPLETO', null]) {
    assert.equal(capi.montarEvento(leadBase({ qualification_classification: classe }), AGORA).erro, 'classe_nao_qualificada');
  }
  const quente = capi.montarEvento(leadBase(), AGORA).evento;
  assert.deepEqual(quente.custom_data, { lead_quality: 'quente', value: 300, currency: 'BRL' });
  const morno = capi.montarEvento(leadBase({ qualification_classification: 'MORNO' }), AGORA).evento;
  assert.deepEqual(morno.custom_data, { lead_quality: 'morno', value: 100, currency: 'BRL' });
  assert.equal(quente.event_name, 'LeadQualificado');
  assert.equal(quente.action_source, 'website');
  assert.equal(quente.event_id, 'lq_7f3a1c2e-4b5d-4e6f-8a9b-0c1d2e3f4a5b', 'event_id estável = dedup no Meta');
  assert.equal(quente.event_time, Math.floor(Date.parse('2026-11-17T17:00:00.000Z') / 1000));
});

// ─── 2. Nenhum dado do atleta (menor de idade) ──────────────────────────
test('2: nenhum dado do atleta sai — nem quando o telefone do responsável é o do atleta', () => {
  const { evento } = capi.montarEvento(leadBase(), AGORA);
  const json = JSON.stringify(evento);
  for (const dado of ['Atleta Menor', '2011-03-02', sha('atletamenor'), sha('5511988887777')]) {
    assert.ok(!json.includes(dado), `dado do atleta vazou no evento: ${dado}`);
  }
  // Formulário usa o WhatsApp do atleta como fallback do responsável.
  const fallback = capi.montarEvento(leadBase({ guardian_whatsapp: '+55 11 98888-7777' }), AGORA).evento;
  assert.equal(fallback.user_data.ph, undefined, 'telefone do atleta (fallback) não pode ir como do responsável');
  assert.ok(fallback.user_data.em, 'sem o telefone, o e-mail do responsável segue');

  const cols = indexSrc.slice(indexSrc.indexOf('const COLUNAS = ['), indexSrc.indexOf('].join', indexSrc.indexOf('const COLUNAS = [')));
  for (const proibida of ['athlete_name', 'birth_date', 'age', 'instagram', 'current_school', 'video_highlights']) {
    assert.ok(!cols.includes(`'${proibida}'`), `a CF não pode ler ${proibida} (dado do atleta)`);
  }
});

// ─── 3. Normalização + hash no formato do Meta ──────────────────────────
test('3: normalização e SHA-256 no formato que o Meta casa', () => {
  const ud = capi.montarEvento(leadBase(), AGORA).evento.user_data;
  assert.deepEqual(ud.em, [sha('maria.silva@exemplo.com')]);
  assert.deepEqual(ud.ph, [sha('5511999998888')]);
  assert.deepEqual(ud.fn, [sha('jose')]);
  assert.deepEqual(ud.ln, [sha('silva')]);
  assert.deepEqual(ud.ct, [sha('saopaulo')]);
  assert.deepEqual(ud.st, [sha('sp')]);
  assert.deepEqual(ud.zp, [sha('01310100')]);
  assert.deepEqual(ud.country, [sha('br')]);
  assert.deepEqual(ud.external_id, [sha('7f3a1c2e-4b5d-4e6f-8a9b-0c1d2e3f4a5b')]);
  // Sem hash (exigência do Meta)
  assert.equal(ud.fbp, 'fb.1.1731860000000.1234567890');
  assert.equal(ud.fbc, 'fb.1.1731860000000.IwAR0abc_DEF-123');
  assert.equal(ud.client_ip_address, '177.10.20.30');
  assert.match(ud.client_user_agent, /^Mozilla/);

  assert.equal(capi.normalizarTelefone('11999998888'), '5511999998888', 'BR sem DDI ganha 55');
  assert.equal(capi.normalizarTelefone('+1 (305) 555-1234'), '13055551234', 'E.164 internacional mantém o DDI');
  assert.equal(capi.normalizarTelefone('123'), null);
  assert.equal(capi.normalizarEmail('sem-arroba'), null);
  assert.equal(capi.urlDoEvento('https://www.bolsaatletausa.com/forms?mcp_token=abc#x'), 'https://www.bolsaatletausa.com/forms',
    'query (mcp_token, fbclid) não pode ir no event_source_url');
  assert.equal(capi.urlDoEvento('https://site-de-terceiro.com/forms'), capi.EVENT_SOURCE_URL_PADRAO);

  // Sinais malformados (vindos do navegador) são descartados, não enviados.
  const lixo = capi.montarEvento(leadBase({ meta_fbp: 'x', meta_fbc: 'fb.1.abc', ip_address: '1.2.3.4; DROP' }), AGORA).evento;
  assert.equal(lixo.user_data.fbp, undefined);
  assert.equal(lixo.user_data.fbc, undefined);
  assert.equal(lixo.user_data.client_ip_address, undefined);
});

test('3b: erros permanentes — fora da janela de 7 dias, sem user agent, sem contato', () => {
  const oitoDias = new Date(AGORA - 8 * 86400000).toISOString();
  assert.equal(capi.montarEvento(leadBase({ qualified_at: oitoDias }), AGORA).erro, 'fora_da_janela_7d');
  assert.equal(capi.montarEvento(leadBase({ user_agent: '  ' }), AGORA).erro, 'sem_user_agent');
  assert.equal(
    capi.montarEvento(leadBase({ email: null, guardian_email: null, guardian_whatsapp: null }), AGORA).erro,
    'sem_email_e_telefone_do_responsavel',
  );
  assert.ok(capi.JANELA_MAX_MS < 7 * 86400000, 'a janela tem de ficar DENTRO dos 7 dias do Meta');
  // Requalificação em massa renova qualified_at de cadastro ANTIGO: não é lead novo.
  const antigo = capi.montarEvento(leadBase({ submitted_at: '2026-06-01T12:00:00.000Z' }), AGORA);
  assert.equal(antigo.erro, 'cadastro_antigo', 'requalificação dispararia LeadQualificado de cadastro de meses atrás');
  assert.ok(capi.MOTIVOS_ADIAR.has('qualified_at_no_futuro'), 'relógio adiantado é transitório, não descarte');
  assert.equal(capi.PREFIXO_DESCARTE, 'descartado:');
});

test('3c: erro do Meta classificado — credencial/Pixel e pane NÃO gastam tentativa do lead', () => {
  const corpo = (error) => JSON.stringify({ error });
  assert.equal(capi.classificarErroMeta(400, corpo({ code: 190, message: 'Invalid OAuth access token' })), 'config');
  assert.equal(capi.classificarErroMeta(403, corpo({ code: 200 })), 'config');
  assert.equal(capi.classificarErroMeta(400, corpo({ code: 100, error_subcode: 33 })), 'config', 'Pixel inexistente');
  assert.equal(capi.classificarErroMeta(500, '{}'), 'transitorio');
  assert.equal(capi.classificarErroMeta(429, '{}'), 'transitorio');
  assert.equal(capi.classificarErroMeta(400, corpo({ code: 4, is_transient: true })), 'transitorio');
  assert.equal(capi.classificarErroMeta(400, corpo({ code: 100, error_subcode: 2804003 })), 'dado');
  // IP: só endereço de verdade (o anon controla esta coluna).
  assert.equal(capi.ipValido('177.10.20.30'), true);
  assert.equal(capi.ipValido('2001:db8::1'), true);
  for (const lixo of ['1.2.3', '::::', 'fff', '1.2.3.4; DROP', null]) assert.equal(capi.ipValido(lixo), false, String(lixo));
  // Cookie do Meta com sufixo (Parameter Builder) passa — o Meta pede para repassar como está.
  const comSufixo = capi.montarEvento(leadBase({ meta_fbc: 'fb.1.1731860000000.IwAR0abc.AbCd' }), AGORA).evento;
  assert.equal(comSufixo.user_data.fbc, 'fb.1.1731860000000.IwAR0abc.AbCd');
});

// ─── 4. Exatamente-uma-vez ──────────────────────────────────────────────
test('4: CAS em meta_capi_lq_sent_at ANTES do envio; retomada de marca órfã; só recusa do DADO gasta tentativa', () => {
  const busca = indexSrc.slice(indexSrc.indexOf('const buscarCandidatos'), indexSrc.indexOf('const enviarEvento'));
  assert.match(busca, /qualification_classification=in\.\(\$\{CLASSES_QUALIFICADAS\.join\(','\)\}\)/);
  assert.match(busca, /filtroLivre\(agoraMs\)/);
  assert.match(busca, /&meta_capi_lq_tentativas=lt\.\$\{MAX_TENTATIVAS\}/);
  assert.match(busca, /&deleted_at=is\.null/);
  assert.match(busca, /&qualified_at=gte\./, 'sem janela, lead de 8+ dias entraria (o Meta recusa)');
  assert.match(busca, /&submitted_at=gte\./, 'sem janela no ENVIO, requalificação mandaria cadastro antigo');
  assert.match(indexSrc, /`&or=\(meta_capi_lq_sent_at\.is\.null,and\(meta_capi_lq_erro\.eq\.\$\{EM_ENVIO\},`/,
    'marca em_envio de execução morta tem de ser retomada');
  assert.match(indexSrc, /const RETOMADA_MS = 15 \* 60 \* 1000;/);

  const proc = indexSrc.slice(indexSrc.indexOf('const processarLead'), indexSrc.indexOf("functions.http('metaCapi'"));
  const iCas = proc.indexOf('{ meta_capi_lq_sent_at: new Date().toISOString(), meta_capi_lq_erro: EM_ENVIO }');
  const iEnvio = proc.indexOf('await enviarEvento(evento)');
  assert.ok(iCas > 0 && iEnvio > iCas, 'a marca (CAS) tem de vir ANTES do envio');
  assert.match(proc.slice(0, iEnvio), /`\$\{filtroLivre\(agoraMs\)\}&meta_capi_lq_tentativas=lt\.\$\{MAX_TENTATIVAS\}`/);
  assert.match(proc, /if \(tomado\.length === 0\) \{/, 'CAS perdido tem de PULAR o lead');
  // Disjuntor: credencial/Pixel/pane devolvem SEM gastar e param o tick.
  const disjuntor = proc.slice(proc.indexOf("if (r.tipo === 'config' || r.tipo === 'transitorio')"));
  assert.match(disjuntor, /^if \(r\.tipo === 'config' \|\| r\.tipo === 'transitorio'\) \{\s*\n\s*\/\/[^\n]*\n\s*await devolverSemGastar\(lead\.id, r\.erro\);/,
    'pane do Meta queimaria a fila inteira em ~2h');
  assert.match(disjuntor, /return \{ resultado: 'falha', interromper: r\.tipo, erro: r\.erro \};/);
  assert.match(proc, /meta_capi_lq_sent_at: null,\s*\n\s*meta_capi_lq_tentativas: tentativas,/, 'recusa do dado volta à fila com +1');
  const handler = indexSrc.slice(indexSrc.indexOf("functions.http('metaCapi'"));
  assert.match(handler, /if \(r\.interromper\) \{/, 'o tick tem de PARAR no disjuntor');
  assert.match(handler, /if \(Date\.now\(\) - inicio > ORCAMENTO_MS\) \{/, 'sem orçamento a CF morre no meio e deixa marca órfã');
  assert.match(indexSrc, /const MAX_TENTATIVAS = 5;/);
  // Descarte permanente marca o prefixo (o monitor separa de "queimado").
  assert.match(proc, /meta_capi_lq_erro: `\$\{PREFIXO_DESCARTE\}\$\{erro\}`/);
});

test('4b: modo TESTE nunca consome o lead (tirar o código de teste manda os reais da janela)', () => {
  const proc = indexSrc.slice(indexSrc.indexOf('const processarLead'), indexSrc.indexOf("functions.http('metaCapi'"));
  const teste = proc.slice(proc.indexOf('if (r.ok && META_TEST_EVENT_CODE) {'));
  assert.ok(teste.length > 0, 'ramo do modo teste sumiu');
  assert.match(teste, /^if \(r\.ok && META_TEST_EVENT_CODE\) \{\s*\n\s*\/\/[^\n]*\n\s*await devolverSemGastar\(lead\.id, TESTE_ENVIADO\);/);
  assert.ok(proc.indexOf('if (r.ok && META_TEST_EVENT_CODE)') < proc.indexOf('if (r.ok) {'), 'o ramo de teste vem antes do de sucesso real');
});

// ─── 5. UAT/DEV nunca mandam evento real ────────────────────────────────
test('5: fora de PRD só envia com test_event_code; sem Pixel/token não envia nada', () => {
  assert.match(indexSrc, /if \(SUPABASE_SCHEMA !== 'public' && !META_TEST_EVENT_CODE\) \{/);
  assert.match(indexSrc, /if \(META_TEST_EVENT_CODE\) corpo\.test_event_code = META_TEST_EVENT_CODE;/);
  assert.match(indexSrc, /const configurado = Boolean\(META_PIXEL_ID && META_CAPI_TOKEN/);
  const handler = indexSrc.slice(indexSrc.indexOf("functions.http('metaCapi'"));
  assert.ok(handler.indexOf('if (!configurado)') < handler.indexOf('buscarCandidatos('), 'sem config, nem busca candidatos');
  assert.ok(
    handler.indexOf("SUPABASE_SCHEMA !== 'public'") < handler.indexOf('buscarCandidatos('),
    'a trava de ambiente vem antes de qualquer envio',
  );
});

// ─── 6. Token, auth e sinal observável ──────────────────────────────────
test('6: token só no header, auth fail-closed, heartbeat sem dado de lead', () => {
  assert.ok(!/access_token=/.test(indexSrc), 'token na URL vaza em log de proxy/erro');
  assert.match(indexSrc, /Authorization: `Bearer \$\{META_CAPI_TOKEN\}`/);
  assert.ok(!/log\([^)]*META_CAPI_TOKEN/.test(indexSrc), 'token não pode ir para o log');
  assert.match(indexSrc, /!WEBHOOK_SECRET \|\| req\.headers\['x-webhook-secret'\] !== WEBHOOK_SECRET/);
  const tick = indexSrc.slice(indexSrc.indexOf('const registrarTick'), indexSrc.indexOf('const processarLead'));
  assert.match(tick, /configuracoes_sistema\?chave=eq\.meta_capi_last_tick_at/);
  assert.doesNotMatch(tick, /email|whatsapp|guardian|athlete/, 'heartbeat carrega só agregados');
  const resumoErro = capi.resumirErroMeta(400, JSON.stringify({ error: { message: 'Invalid parameter', code: 100 } }));
  assert.equal(resumoErro, 'HTTP 400 · code 100 · Invalid parameter');

  // Seed do heartbeat (PATCH sem seed = no-op silencioso) + monitor nos 2 lados.
  const mig = fs.readdirSync(path.join(raiz, 'supabase', 'migrations')).find((f) => f.endsWith('_meta_capi_lead_qualificado.sql'));
  assert.ok(mig, 'migration da CAPI sumiu');
  assert.match(ler('supabase', 'migrations', mig), /'meta_capi_last_tick_at'/);
  const monitor = ler('functions', 'monitor-health', 'index.js');
  const tela = ler('apps', 'crm', 'src', 'lib', 'observabilidade-checks.ts');
  assert.match(monitor, /checkSeguro\('meta_capi_frescor'/);
  assert.match(tela, /seguro\("meta_capi_frescor"/);
  // Monitor não pode ficar cego: config que SUMIU, credencial recusada e fila queimada.
  for (const [lado, src] of [['monitor-health', monitor], ['tela', tela]]) {
    assert.ok(src.includes('ja_configurado === true'), `${lado}: config que sumiu viraria "pulado" para sempre`);
    assert.ok(src.includes("interrompido === 'config'") || src.includes('interrompido === "config"'), `${lado}: credencial recusada sem alerta`);
    assert.ok(/descartado:\*/.test(src), `${lado}: fila queimada (5 recusas) invisível`);
    assert.ok(/submitted_at/.test(src.slice(src.indexOf('meta_capi_frescor'))), `${lado}: janela por submitted_at (paridade com a CF)`);
  }
  assert.match(indexSrc, /ja_configurado: anterior\.ja_configurado === true \|\| resumo\.configurado === true,/);
});

// ─── 7. Deploy e agendamento registrados ────────────────────────────────
test('7: CF registrada no CI, nos 2 workflows de deploy e no scheduler', () => {
  assert.match(ler('.github', 'workflows', 'ci.yml'), /\n\s+- meta-capi\n/);
  assert.match(ler('.github', 'workflows', 'deploy-functions.yml'), /meta-capi\)\s+echo "entry=metaCapi".*echo "name=meta-capi"/);
  assert.match(ler('.github', 'workflows', 'deploy-functions-uat.yml'), /meta-capi\)\s+echo "entry=metaCapi".*echo "name=meta-capi-uat"/);
  for (const wf of ['deploy-functions.yml', 'deploy-functions-uat.yml']) {
    const src = ler('.github', 'workflows', wf);
    assert.equal((src.match(/\besac\b/g) || []).length, (src.match(/case "/g) || []).length, `${wf}: case sem esac`);
  }
  const sched = ler('infra', 'scheduler.sh');
  const bloco = sched.slice(sched.indexOf('JOB_MC="meta-capi-job${SUFFIX}"'), sched.indexOf('echo "✓ ${JOB_MC} configurado"'));
  assert.match(bloco, /--headers="x-webhook-secret=\$\{WEBHOOK_SECRET\}"/, 'job sem secret = 401 em todo tick');
});

// ─── 8. Site: captura fail-soft, sem quebrar o cadastro ─────────────────
test('8: formulário captura fbp/fbc/IP sem nunca bloquear o envio', () => {
  const meta = ler('apps', 'web', 'src', 'lib', 'tracking', 'meta.ts');
  assert.match(meta, /signal: AbortSignal\.timeout\(IP_TIMEOUT_MS\)/, 'busca do IP sem timeout atrasaria o envio');
  assert.match(meta, /const FBCLID_VALIDADE_MS = 90 \* 24 \* 60 \* 60 \* 1000;/, 'fbclid sem validade atribuiria clique de meses atrás');
  assert.match(meta, /return `fb\.1\.\$\{guardado\.at\}\.\$\{guardado\.fbclid\}`|fbc = `fb\.1\.\$\{guardado\.at\}\.\$\{guardado\.fbclid\}`/);
  const form = ler('apps', 'web', 'src', 'components', 'forms', 'FormsPage.tsx');
  assert.match(form, /meta_fbp: sinaisMeta\.meta_fbp,/);
  assert.match(form, /ip_address: clientIp,/);
  assert.match(form, /clientIpRef\.current = fetchClientIp\(\);/, 'o IP tem de ser pedido na abertura, não no clique de enviar');
  assert.match(form, /corpoErro\.includes\('PGRST204'\)/, 'coluna ausente no schema tem de reenviar SEM a CAPI, não perder o lead');
  const rota = ler('apps', 'web', 'app', 'api', 'client-context', 'route.ts');
  assert.match(rota, /"Cache-Control": "no-store"/, 'IP de um visitante não pode ficar em cache para outro');
  assert.match(rota, /isIP\(bruto\) !== 0/, 'rota devolveria lixo como IP');
});
