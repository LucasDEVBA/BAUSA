'use strict';

// ════════════════════════════════════════════════════════════════════════
// GUARD — infraestrutura de deploy (incidente 17/11/2026)
// ════════════════════════════════════════════════════════════════════════
// No merge do #451, os DOIS deploys de UAT falharam por mudança de fora:
//   1. GCF Gen2 aposentou o nodejs20 → "nodejs20 is not a supported runtime";
//      nenhuma Cloud Function subia desde 09/10 (último deploy verde).
//   2. Supabase CLI `version: latest` virou v3 (16/11), que mira o banco
//      LOCAL por padrão → `db push` com ECONNREFUSED 127.0.0.1:54322.
// O CI não executa os workflows de deploy — só o merge executa. Este guard
// trava runtime suportado, CLI fixado e alvo explícito do push.
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const wf = (nome) => fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', nome), 'utf8');

test('Cloud Functions: runtime suportado pelo GCF Gen2 nos dois deploys', () => {
  for (const nome of ['deploy-functions.yml', 'deploy-functions-uat.yml']) {
    const src = wf(nome);
    assert.match(src, /--gen2 --runtime=nodejs22 /, `${nome}: runtime fora do nodejs22`);
    assert.ok(!/--runtime=nodejs(1\d|20)\b/.test(src), `${nome}: runtime aposentado (nodejs20 ou anterior) voltou`);
  }
});

test('Supabase: CLI fixado (nunca latest) e push no projeto linkado', () => {
  for (const nome of ['deploy-supabase.yml', 'deploy-supabase-uat.yml']) {
    const src = wf(nome);
    assert.match(src, /uses: supabase\/setup-cli@v1\s*\n\s*with:\s*\n\s*version: 2\.\d+\.\d+\n/, `${nome}: CLI tem de ser fixado em 2.x`);
    assert.ok(!/version: latest/.test(src), `${nome}: 'latest' troca de major sem aviso (v3 mira o banco local)`);
    assert.match(src, /supabase db push --linked\n/, `${nome}: push sem alvo explícito`);
    assert.match(src, /supabase functions deploy form-handler --project-ref \$\{\{ secrets\.SUPABASE_PROJECT_ID \}\}/);
  }
});
