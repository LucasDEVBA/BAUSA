'use strict';

// ════════════════════════════════════════════════════════════════════════
// GUARD DE INVARIANTE — Pós-venda (experiencia-scheduler)
// ════════════════════════════════════════════════════════════════════════
//
// O experiencia-scheduler NÃO é outreach de lead (não usa classificação
// Gemini/timing — esses invariantes não se aplicam). Mas ele manda WhatsApp
// a FAMÍLIAS CLIENTES e abre tarefas/notificações internas: precisa dos SEUS
// próprios invariantes, verificados estaticamente para impedir regressão:
//
//   1. NPS só para famílias embarcadas: fase IN (embarcado_inicial,
//      acompanhamento) — nunca em admissão/pré-embarque/encerrado.
//   2. NPS aos 6 meses: corte de 180 dias sobre created_at.
//   3. CAS atômico ANTES do envio: PATCH com `nps_enviado_at=is.null`;
//      se não venceu a corrida (`!won`), pula — nunca duplica a pesquisa.
//   4. Alerta de inatividade com cooldown de 7 dias por família (CAS via
//      ultimo_alerta_inatividade_at nulo OU mais antigo que o corte).
//   5. Texto do WhatsApp vem de config editável (nps_mensagem) com default
//      no código ({{responsavel}}/{{atleta}}) — config ausente não cala nem
//      quebra o envio.
//
// Execução local: node --test tests/
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function loadExecutableSource(functionName) {
  const file = path.join(__dirname, '..', 'functions', functionName, 'index.js');
  assert.ok(fs.existsSync(file), `Arquivo não encontrado: ${file}`);
  const raw = fs.readFileSync(file, 'utf8');
  const noBlock = raw.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlock
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

const src = loadExecutableSource('experiencia-scheduler');

test('experiencia-scheduler: NPS só para fases embarcado_inicial/acompanhamento', () => {
  assert.match(
    src,
    /fase=in\.\(embarcado_inicial,acompanhamento\)/,
    'A busca de elegíveis ao NPS DEVE filtrar fase=in.(embarcado_inicial,acompanhamento) — família em admissão/pré-embarque/encerrado nunca recebe a pesquisa.',
  );
});

test('experiencia-scheduler: NPS respeita os 6 meses (180 dias sobre created_at)', () => {
  assert.match(
    src,
    /NPS_MIN_DIAS\s*=\s*180/,
    'O corte da pesquisa DEVE ser NPS_MIN_DIAS = 180 (6 meses de jornada).',
  );
  assert.match(
    src,
    /created_at=lt\./,
    'A busca DEVE filtrar created_at=lt.<corte de 180 dias> — sem o filtro, TODA família embarcada receberia a pesquisa no 1º tick.',
  );
});

test('experiencia-scheduler: CAS atômico do NPS com filtro =is.null antes do envio', () => {
  // Ancorado na URL do PATCH (id=eq.<id>&nps_enviado_at=is.null) — o mesmo
  // filtro também existe no SELECT de elegibilidade, e um regex solto seria
  // tautológico (removê-lo só do CAS não quebraria o teste).
  assert.match(
    src,
    /id=eq\.\$\{experienciaId\}[^;]*nps_enviado_at=is\.null/,
    'A URL do PATCH do CAS DEVE incluir `id=eq.<id>` + `nps_enviado_at=is.null` (só o primeiro marca — atomicidade; envio único por família).',
  );
  assert.match(
    src,
    /Prefer:\s*'return=representation'/,
    'O CAS DEVE usar Prefer return=representation — resposta vazia = outra instância venceu.',
  );
  assert.match(
    src,
    /if\s*\(\s*!won\s*\)/,
    'Se o CAS não venceu a corrida (!won), DEVE pular — evita pesquisa duplicada.',
  );
});

test('experiencia-scheduler: payload do WhatsApp carrega record.athlete_name', () => {
  // O handler do send-whatsapp valida data.athlete_name ANTES do branch
  // custom — sem record.athlete_name, 100% dos envios morrem com 400 e o
  // CAS já consumiu o marco (incidente pego em revisão adversarial).
  assert.match(
    src,
    /record:\s*\{\s*athlete_name:/,
    'O payload do send-whatsapp DEVE incluir record.athlete_name (o handler exige antes do caminho custom).',
  );
});

test('experiencia-scheduler: alerta de inatividade com cooldown de 7 dias (CAS)', () => {
  assert.match(
    src,
    /ALERTA_COOLDOWN_DIAS\s*=\s*7/,
    'O cooldown do alerta DEVE ser ALERTA_COOLDOWN_DIAS = 7 — 1 alerta por família/semana, sem spam interno.',
  );
  assert.match(
    src,
    /ultimo_alerta_inatividade_at\.is\.null,ultimo_alerta_inatividade_at\.lt\./,
    'O CAS do alerta DEVE filtrar or=(ultimo_alerta_inatividade_at.is.null,...lt.<corte 7d>) — cooldown embutido na escrita atômica.',
  );
});

test('experiencia-scheduler: texto do NPS editável em config com default no código', () => {
  assert.match(
    src,
    /nps_mensagem/,
    'O texto DEVE ser lido da config nps_mensagem (editável em /automacoes).',
  );
  assert.match(
    src,
    /NPS_MENSAGEM_DEFAULT/,
    'DEVE existir um default hardcoded (NPS_MENSAGEM_DEFAULT) — config ausente/vazia não cala o envio.',
  );
  for (const placeholder of ['{{responsavel}}', '{{atleta}}']) {
    assert.ok(
      src.includes(placeholder),
      `O default DEVE conter o placeholder ${placeholder} (personalização da mensagem).`,
    );
  }
});

test('experiencia-scheduler: dados do Engine sempre em public (hardcode)', () => {
  assert.match(
    src,
    /DATA_SCHEMA\s*=\s*'public'/,
    'Os headers Accept/Content-Profile DEVEM usar DATA_SCHEMA hardcoded public — o Engine lê public em todo ambiente (padrão monitor-health).',
  );
});
