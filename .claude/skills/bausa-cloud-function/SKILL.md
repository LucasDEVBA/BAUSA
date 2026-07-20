---
name: bausa-cloud-function
description: Use ao criar ou editar qualquer Google Cloud Function em functions/ do projeto BAUSA (schedulers, webhooks, qualify-lead, send-messages, send-whatsapp, sync, etc). Garante padrão Gen2/Node20, log estruturado, CAS atômico, env vars seguras, deploy via workflow, e o checklist anti-regressão derivado dos incidentes de produção.
---

# BAUSA — Cloud Functions (GCP Gen2)

## Contexto

Todas as funções: **Gen2, Node.js 20, us-central1, 256Mi, `--allow-unauthenticated`** (org policy obriga). Trigger HTTP (schedulers são acionados por Cloud Scheduler chamando a URL). Auth entre serviços: header `x-webhook-secret`.

JS puro (não TypeScript). Validar SEMPRE com `node --check index.js` antes de commit — não há `tsc` para pegar erros.

## Anatomia de uma função (espelhar uma existente)

Referências canônicas:
- Scheduler com CAS: `functions/process-pending-whatsapp/index.js`
- Cron simples: `functions/process-scheduled-followups/index.js`
- Webhook: `functions/calendar-webhook/index.js`
- Email: `functions/send-messages/index.js`

Estrutura padrão:
```js
const functions = require('@google-cloud/functions-framework');
const https = require('https');

// Env vars (NUNCA hardcode)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_SCHEMA = process.env.SUPABASE_SCHEMA || 'public'; // public=PRD, uat, dev

// Log estruturado SEMPRE (telemetria + monitoramento)
const log = (level, action, details = {}) => {
  console.log(JSON.stringify({ level, action, ...details }));
};

// httpRequest helper com timeout (copiar de uma função existente)
// ...

functions.http('nomeDaFuncao', async (req, res) => {
  // 1. Auth
  if (WEBHOOK_SECRET && req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
    log('WARN', 'auth_failed'); return res.status(401).send({ success: false });
  }
  try {
    // 2. lógica
    // 3. log de sucesso com contadores
    return res.status(200).send({ success: true, processed: n });
  } catch (e) {
    log('ERROR', 'unhandled', { error: e.message });
    return res.status(500).send({ success: false, error: e.message });
  }
});
```

## Regras de Supabase REST (PostgREST)

- GET usa header `Accept-Profile: ${SUPABASE_SCHEMA}`; PATCH/POST usa `Content-Profile: ${SUPABASE_SCHEMA}`.
- Filtro cirúrgico por `id=eq.${id}` (preferir a `email=ilike`).
- **CAS atômico** (exactly-once em cron): incluir `&coluna=is.null` na URL do PATCH e `Prefer: return=representation`. Se a resposta vier vazia, outra instância venceu → PULAR. Marcar ANTES de enviar (não depois) para que falha posterior não cause reprocessamento.

## ⛔ Checklist anti-regressão (OBRIGATÓRIO — lições de incidentes reais)

- [ ] **Sinal observável declarado.** Toda CF nova define QUAL coluna/chave do banco prova que ela executou (ex.: `*_sent_at` CAS, `configuracoes_sistema.<x>_state`, heartbeat `<x>_last_tick_at`) e ganha um check consumidor na CF `monitor-health` + na tela `/observabilidade` (paridade travada por `tests/monitor-health-invariants.test.js`). Fluxo sem sinal = incidente invisível (lição Z-API 2026-07-15/17: a falha não gera erro nenhum). Escritores de sinal são FAIL-OPEN (telemetria nunca quebra a função).
- [ ] **Auth fail-closed canônica:** `if (!WEBHOOK_SECRET || req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) return 401` — NUNCA o padrão fail-open `if (WEBHOOK_SECRET && header)` (12 CFs corrigidas em 2026-07-19; guard `tests/cf-auth-invariants.test.js`). Job do scheduler SEMPRE com `--headers x-webhook-secret`.

- [ ] **`SELECT *` quando o registro será reescrito inteiro.** Incidente `calendar-webhook`: SELECT parcial → sync ao Sheets sobrescreveu linha com `undefined`, data loss em 43 leads. Se você lê para depois reescrever/sincronizar, leia TUDO.
- [ ] **Toda variável referenciada existe no escopo.** Incidente `send-messages`: `payload?.messageType` mas só `req.body` existia → `ReferenceError` → 100% dos emails travados 12 dias. `node --check` + ler o escopo.
- [ ] **Ausência de erro ≠ funcionando.** Se a função tem volume esperado (emails/dia, WhatsApps/dia), o sucesso é silencioso e a falha também. Logar contadores (`action=email_sent`) para monitoramento poder alertar.
- [ ] **Idempotência:** re-execução não duplica (CAS para envios, upsert `onConflict` para dados).
- [ ] **Schedulers de mensageria:** ver skill `bausa-scheduler-safety` (filtros classe+timing são invariantes de CI).
- [ ] **Timeout adequado:** schedulers que iteram leads usam 900s; webhooks/qualificação 120s-540s. Ver mapa no workflow.
- [ ] **Erro em operação secundária não derruba a principal:** se a função faz a coisa-crítica + side-effects (notificação, sheets), envolver os side-effects em try/catch próprio para não abortar o crítico.

## Deploy (nunca manual em PRD, exceto emergência documentada)

Para adicionar função NOVA, editar **ambos** os workflows `.github/workflows/deploy-functions.yml` e `deploy-functions-uat.yml`:
1. Adicionar a pasta ao array `matrix.function`
2. Adicionar linha no `case`:
   ```
   minha-funcao) echo "entry=minhaFuncao" >> "$GITHUB_OUTPUT"; echo "name=minha-funcao" >> "$GITHUB_OUTPUT"; echo "timeout=120s" >> "$GITHUB_OUTPUT" ;;
   ```
   (`entry` = nome em `functions.http('...')`; `name` = nome do serviço GCP; UAT usa sufixo `-uat`)

   ⛔ **NUNCA remova o `esac`** ao inserir a linha nova (incidente 2026-06-05: o `esac` do `-uat.yml` foi removido ao adicionar uma função → `case` aberto → `syntax error: unexpected end of file` → **todo deploy UAT de funções quebrou silenciosamente por dias**). A inserção vai ANTES do `esac`, nunca substituindo-o. Validar: `grep -c esac` deve igualar `grep -c 'case "'`.

   ⚠️ **O CI NÃO testa o YAML do workflow de deploy** (só roda `node --check` no código). O deploy só executa no MERGE. Por isso: **após mergear uma função nova, confirmar que ela subiu** — `gcloud functions describe <name>-uat --gen2 --region=us-central1 --project=elite-portal-forms`. 404 = deploy falhou, investigar o run de "Deploy Cloud Functions — UAT".
3. Cron: adicionar job em `infra/scheduler.sh` (aceita prd/uat/dev) com `--time-zone="America/Sao_Paulo"`
4. Secrets: via GitHub Secrets + `--update-env-vars` no deploy. **NUNCA `--set-env-vars`** (apaga as existentes). Versões `_UAT` e `_DEV` dos secrets.

Emergência PRD (só se CI indisponível): `gcloud functions deploy <name> --gen2 --runtime=nodejs20 --region=us-central1 --source=functions/<pasta> --entry-point=<entry> --trigger-http --allow-unauthenticated --timeout=<t> --memory=256Mi --update-env-vars KEY=VAL --project=elite-portal-forms`

## Validação antes de commit
```bash
node --check functions/<pasta>/index.js   # sintaxe JS
# Se tem package.json novo: cd functions/<pasta> && npm install && node --check index.js
```

CI valida via job `Validate <função>` (matrix) — adicionar a função nova ao job se aplicável.
