const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Guard: canais de notificação do monitor.
 *
 * Origem: todo alerta saía por WhatsApp E e-mail. O CEO parou de ler, e
 * alerta não lido não protege nada. Agora cada evento declara seus canais.
 * Estes testes impedem que a regressão volte silenciosamente.
 */

const SRC = fs.readFileSync(
  path.join(__dirname, '..', 'functions', 'monitor-health', 'index.js'),
  'utf8',
);

test('o envio respeita os canais configurados, não manda para todos', () => {
  assert.match(SRC, /lerConfig\('notificacoes_canais'\)/, 'a CF deve ler notificacoes_canais');
  assert.match(SRC, /cfg\.whatsapp === true/, 'WhatsApp só sai com o canal explicitamente ligado');
  assert.match(SRC, /cfg\.email === true/, 'e-mail só sai com o canal explicitamente ligado');
});

test('severidade separa crítico de atenção', () => {
  assert.match(SRC, /lerConfig\('monitor_severidades'\)/, 'a CF deve ler monitor_severidades');
  assert.match(
    SRC,
    /severidades\[c\.chave\] === 'critico'/,
    'a classificação por check governa o grupo de canais',
  );
});

test('a fila de aprovação tem aviso próprio e sai do bolo do monitor', () => {
  // Sem isto o CEO recebia o mesmo fato duas vezes, com textos diferentes.
  assert.match(SRC, /const alertarAprovacaoPendente = async/, 'o aviso dedicado sumiu');
  assert.match(
    SRC,
    /c\.chave !== 'aprovacao_pendente_antiga'/,
    'aprovacao_pendente_antiga não pode entrar no alerta genérico',
  );
});

test('o aviso de aprovação leva NOME e link — não só a contagem', () => {
  const corpo = SRC.slice(
    SRC.indexOf('const alertarAprovacaoPendente'),
    SRC.indexOf('const runChecks'),
  );
  assert.match(corpo, /athlete_name/, 'precisa buscar os nomes dos leads');
  assert.match(corpo, /ENGINE_URL/, 'precisa montar o link para o sistema');
  assert.match(corpo, /aprovacoes=1/, 'o link deve abrir a fila de aprovação');
});

test('o e-mail usa o template, não HTML cru', () => {
  assert.match(SRC, /require\('\.\/templates'\)/, 'templates.js deve ser usado');
  assert.doesNotMatch(
    SRC,
    /`<h2>⚠️ Monitor BAUSA/,
    'o HTML cru antigo não pode voltar',
  );
});

test('o template escapa conteúdo dinâmico', () => {
  const tpl = require(path.join(__dirname, '..', 'functions', 'monitor-health', 'templates.js'));
  const html = tpl.emailMonitor({ critico: true, itens: ['<script>alert(1)</script>'] });
  assert.ok(html.includes('&lt;script&gt;'), 'itens precisam ser escapados');
  assert.ok(!html.includes('<script>alert'), 'script não pode passar cru');
});
