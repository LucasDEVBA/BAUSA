'use strict';

// ════════════════════════════════════════════════════════════════════════
// GUARD — conector do Claude (MCP remoto do Engine, 17/11/2026)
// ════════════════════════════════════════════════════════════════════════
// O Claude lê o CRM pelo /api/mcp com o token OAuth do PRÓPRIO usuário
// (servidor OAuth 2.1 do Supabase Auth, consentimento em /oauth/consent).
// Invariantes:
//   1. Só leitura — nenhuma ferramenta escreve no banco (v1).
//   2. Auth: Bearer obrigatório, token de OAuth (client_id), papel CEO/CTO
//      ativo, 401 com resource_metadata (o Claude segue esse link).
//   3. Consentimento: aprovar exige CEO/CTO E destino oficial do Claude (com
//      registro dinâmico, qualquer app pode pedir — phishing).
//   4. Middleware: /api/mcp e /.well-known públicos (a rota se protege);
//      /oauth/ volta ao consentimento depois do login; os 2 middlewares iguais.
//   5. Login só aceita `next` para o consentimento (sem open redirect).
// O comportamento é EXECUTADO no Vitest (src/lib/mcp/*.test.ts).
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const crm = (...p) => fs.readFileSync(path.join(__dirname, '..', 'apps', 'crm', ...p), 'utf8');
const ferramentas = crm('src', 'lib', 'mcp', 'ferramentas.ts');
const auth = crm('src', 'lib', 'mcp', 'auth.ts');
const rota = crm('src', 'app', 'api', 'mcp', 'route.ts');
const acao = crm('src', 'lib', 'actions', 'oauth-consentimento.ts');
const consent = crm('src', 'app', '(auth)', 'oauth', 'consent', 'page.tsx');

test('1: ferramentas do conector são SÓ leitura', () => {
  for (const [nome, src] of [['ferramentas.ts', ferramentas], ['auth.ts', auth], ['route.ts', rota]]) {
    assert.ok(!/\.(insert|update|upsert|delete)\(/.test(src), `${nome}: escrita no banco pelo conector`);
    assert.ok(!/\.rpc\(/.test(src), `${nome}: RPC pode escrever — fora do v1 do conector`);
    assert.ok(!/supabase-admin|SUPABASE_SERVICE_KEY/.test(src), `${nome}: service role ignora RLS`);
  }
  const registros = ferramentas.match(/server\.registerTool\(/g) ?? [];
  const leitura = ferramentas.match(/annotations: \{ readOnlyHint: true, openWorldHint: false \}/g) ?? [];
  assert.equal(registros.length, 5, 'ferramenta nova? revise este guard (e a tela de consentimento)');
  assert.equal(leitura.length, registros.length, 'toda ferramenta declara readOnlyHint');
});

test('2: auth exige Bearer OAuth (client_id), emissor do projeto e papel CEO/CTO ativo', () => {
  assert.match(auth, /const \{ data, error \} = await supabase\.auth\.getClaims\(token\);/, 'assinatura/expiração validadas pelo JWKS');
  assert.match(auth, /claims\.iss === emissorOAuth\(\)/);
  assert.match(auth, /audienciaInclui\(claims\.aud, "authenticated"\)/);
  assert.match(auth, /typeof clientId === "string" &&\s*\n\s*clientId\.length > 0/, 'token de sessão do navegador viraria credencial');
  assert.match(auth, /const PAPEIS_PERMITIDOS = new Set\(\["ceo", "cto"\]\);/);
  assert.match(auth, /perfil\.data\.ativo === false/, 'usuário desativado continuaria lendo o CRM');
  assert.match(auth, /global: \{ headers: \{ Authorization: `Bearer \$\{token\}` \} \}/, 'consultas têm de rodar com o token do usuário (RLS)');
  assert.match(auth, /`Bearer resource_metadata="\$\{urlMetadadosRecurso\(origem\)\}"`/, 'sem o desafio o Claude não descobre o OAuth');
  assert.match(auth, /if \(cabecalho\?\.alg !== ALG_ESPERADO \|\| typeof cabecalho\.kid !== "string"/, 'token forjado forçaria ida à rede a cada request');
  assert.match(auth, /if \(error && ehFalhaTransitoria\(error\)\) return \{ ok: false, resposta: respostaIndisponivel\(\) \};/, 'pane do Supabase viraria "refaça o login"');
  // Stateless e só POST.
  assert.match(rota, /sessionIdGenerator: undefined,/);
  assert.match(rota, /const auth = await autenticarMcp\(req, origem\);\s*\n\s*if \(!auth\.ok\) return auth\.resposta;/);
  assert.ok(rota.indexOf('autenticarMcp(') < rota.indexOf('criarServidorMcp('), 'servidor montado antes de autenticar');
  // Metadados RFC 9728 nos dois caminhos que o Claude tenta.
  for (const p of [['route.ts'], ['api', 'mcp', 'route.ts']]) {
    const src = crm('src', 'app', '.well-known', 'oauth-protected-resource', ...p);
    assert.match(src, /metadadosRecursoProtegido\(new URL\(req\.url\)\.origin\)/);
  }
});

test('3: aprovar exige CEO/CTO ATIVO e destino oficial do Claude — na action E na tela', () => {
  const aprovar = acao.slice(acao.indexOf('if (decisao === "aprovar") {'));
  assert.ok(aprovar.length > 0, 'ramo de aprovação sumiu');
  const iPapel = aprovar.indexOf('if (perfil.ativo === false || !isCeoLevel(perfil.papel)) voltarComErro(id, "papel");');
  const iDestino = aprovar.indexOf('if (!destinoOficial) voltarComErro(id, "destino");');
  const iAprova = aprovar.indexOf('approveAuthorization(');
  assert.ok(iPapel > 0 && iDestino > 0 && iAprova > iPapel && iAprova > iDestino, 'papel/ativo e destino conferidos ANTES de aprovar');
  assert.match(acao, /const destinoOficial = redirectPermitidoParaConsentimento\(pedido\.redirect_uri\);/);
  assert.match(aprovar, /!redirectPermitidoParaConsentimento\(r\.data\.redirect_url, \{ comParametros: true \}\)/, 'o redirect final também é conferido');
  assert.ok(!/try \{[^}]*redirect\(/.test(acao), 'redirect() dentro de try engole o NEXT_REDIRECT');
  assert.match(consent, /const nivelCeo = perfil\.ativo !== false && isCeoLevel\(perfil\.papel\);/);
  assert.match(consent, /const podeAprovar = nivelCeo && destinoOficial;/);
  // Já autorizado: pede clique (link aberto por engano não completa a conexão).
  const jaAutorizado = consent.slice(consent.indexOf('if (!("authorization_id" in detalhes.data)) {'), consent.indexOf('const pedido = detalhes.data;'));
  assert.ok(!/redirect\(/.test(jaAutorizado), 'conexão já autorizada voltou a redirecionar sem clique');
  assert.match(jaAutorizado, /<a href=\{destino\}/);
  assert.match(crm('src', 'components', 'auth', 'BotoesConsentimento.tsx'), /disabled=\{pending\}/, 'duplo clique aprovaria duas vezes');
  const allow = crm('src', 'lib', 'mcp', 'redirect-consentimento.ts');
  assert.match(allow, /"https:\/\/claude\.ai\/api\/mcp\/auth_callback"/);
  assert.match(allow, /return DESTINOS_HTTPS\.has\(`\$\{u\.origin\}\$\{u\.pathname\}`\);/, 'comparar por prefixo deixaria claude.ai.evil.com passar');
  assert.match(allow, /u\.pathname === CAMINHO_LOOPBACK/, 'loopback em qualquer caminho vaza o código por open redirect local');
});

test('4: middleware — conector público (se protege sozinho) e consentimento volta após login', () => {
  const raiz = crm('middleware.ts');
  const src = crm('src', 'middleware.ts');
  assert.equal(raiz, src, 'os dois middlewares do Engine divergiram (qual vale depende do build)');
  assert.match(src, /const PUBLIC_ROUTES_EXATAS = \["\/api\/mcp"\];/, '/api/mcp tem de ser EXATO (rota nova não fica pública sem querer)');
  assert.match(src, /PUBLIC_ROUTES_EXATAS\.includes\(pathname\)/);
  assert.ok(src.includes('"/.well-known/",'), 'descoberta OAuth caindo no /login quebra o Claude');
  assert.ok(!/PUBLIC_ROUTES = \[[^\]]*"\/oauth/.test(src), 'consentimento NÃO pode ser público');
  assert.match(src, /const VOLTA_APOS_LOGIN = \["\/oauth\/"\];/);
  assert.match(src, /loginUrl\.searchParams\.set\("next", `\$\{pathname\}\$\{request\.nextUrl\.search\}`\);/);
  assert.match(src, /response\.headers\.set\("Content-Security-Policy", "frame-ancestors 'none'"\);/, 'consentimento em iframe = clickjacking');
});

test('5: login só honra `next` do consentimento (sem open redirect)', () => {
  const login = crm('src', 'app', '(auth)', 'login', 'page.tsx');
  assert.match(login, /const PREFIXOS_NEXT_PERMITIDOS = \["\/oauth\/consent"\];/);
  assert.match(login, /!next\.startsWith\("\/"\) \|\| next\.startsWith\("\/\/"\)/, '//evil.com sairia do domínio');
  assert.match(login, /router\.push\(destinoAposLogin\(\)\);/);
});

test('6: token do conector é SOMENTE LEITURA no banco (policy restritiva por client_id)', () => {
  const migDir = path.join(__dirname, '..', 'supabase', 'migrations');
  const arquivos = fs.readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
  const base = arquivos.find((f) => f.endsWith('_conector_claude_somente_leitura.sql'));
  assert.ok(base, 'migration da trava de escrita do conector sumiu');
  const sql = fs.readFileSync(path.join(migDir, base), 'utf8');
  assert.match(sql, /condicao constant text := '\(\(auth\.jwt\(\) ->> ''client_id''\) IS NULL\)';/);
  for (const cmd of ['INSERT TO authenticated WITH CHECK %s', 'UPDATE TO authenticated USING %s WITH CHECK %s', 'DELETE TO authenticated USING %s']) {
    assert.ok(sql.includes(`AS RESTRICTIVE FOR ${cmd}`), `policy restritiva de ${cmd.split(' ')[0]} sumiu`);
  }
  assert.match(sql, /SELECT public\.conector_somente_leitura_aplicar\('public'\);/);
  // Tabela NOVA depois desta migration tem de receber a trava também.
  for (const f of arquivos.filter((a) => a > base)) {
    const conteudo = fs.readFileSync(path.join(migDir, f), 'utf8');
    if (/CREATE TABLE (IF NOT EXISTS )?(public\.)?\w+/i.test(conteudo) && /ENABLE ROW LEVEL SECURITY/i.test(conteudo)) {
      assert.match(conteudo, /conector_somente_leitura_aplicar\(/, `${f}: tabela nova sem a trava de escrita do conector do Claude`);
    }
  }
});
