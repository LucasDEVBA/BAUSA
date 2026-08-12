#!/bin/bash
set -euo pipefail

# ─── Ambiente ──────────────────────────────────────────────────
# Uso: bash infra/scheduler.sh [dev|uat|prd]
# Sem argumento → prd (retrocompatível)
ENV="${1:-prd}"

PROJECT_ID="elite-portal-forms"
REGION="us-central1"

case "$ENV" in
  dev)
    SUFFIX="-dev"
    JOB_WA="process-whatsapp-job-dev"
    JOB_FU="process-followup-job-dev"
    ;;
  uat)
    SUFFIX="-uat"
    JOB_WA="process-whatsapp-job-uat"
    JOB_FU="process-followup-job-uat"
    ;;
  prd)
    SUFFIX=""
    JOB_WA="process-whatsapp-job"
    JOB_FU="process-followup-job"
    ;;
  *)
    echo "ENV inválido: $ENV. Use dev, uat ou prd." >&2
    exit 1
    ;;
esac

# URL das funções — sobrescrevível via variável de ambiente
WHATSAPP_SCHEDULER_URL="${WHATSAPP_SCHEDULER_URL:-https://whatsapp-scheduler${SUFFIX}-222577494676.us-central1.run.app}"
FOLLOWUP_SCHEDULER_URL="${FOLLOWUP_SCHEDULER_URL:-https://followup-scheduler${SUFFIX}-222577494676.us-central1.run.app}"

# Auth dos jobs: TODAS as CFs são fail-closed — o header x-webhook-secret é
# obrigatório em todo job. Exporte o secret do ambiente antes de rodar:
#   WEBHOOK_SECRET=... bash infra/scheduler.sh <env>
if [ -z "${WEBHOOK_SECRET:-}" ]; then
  echo "ERRO: WEBHOOK_SECRET não definido — os jobs ficariam sem auth e as CFs (fail-closed) rejeitariam os ticks." >&2
  exit 1
fi

echo "Configurando Cloud Scheduler para ambiente: ${ENV}"

# ─── Job 1: WhatsApp inicial (22h após qualificação) ───────────
gcloud scheduler jobs create http "${JOB_WA}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="0 * * * *" \
  --uri="${WHATSAPP_SCHEDULER_URL}" \
  --http-method=POST \
  --headers="x-webhook-secret=${WEBHOOK_SECRET}" \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=960s \
  2>/dev/null || \
gcloud scheduler jobs update http "${JOB_WA}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="0 * * * *" \
  --uri="${WHATSAPP_SCHEDULER_URL}" \
  --http-method=POST \
  --update-headers="x-webhook-secret=${WEBHOOK_SECRET}" \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=960s

echo "✓ ${JOB_WA} configurado"

# ─── Job 2: Follow-up WhatsApp (48h e 72h sem agendamento) ─────
gcloud scheduler jobs create http "${JOB_FU}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="0 * * * *" \
  --uri="${FOLLOWUP_SCHEDULER_URL}" \
  --http-method=POST \
  --headers="x-webhook-secret=${WEBHOOK_SECRET}" \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=960s \
  2>/dev/null || \
gcloud scheduler jobs update http "${JOB_FU}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="0 * * * *" \
  --uri="${FOLLOWUP_SCHEDULER_URL}" \
  --http-method=POST \
  --update-headers="x-webhook-secret=${WEBHOOK_SECRET}" \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=960s

echo "✓ ${JOB_FU} configurado"

# ─── Job 3: Renovar Calendar Watch (a cada 6 dias) ────────────
JOB_CW="renew-calendar-watch-job${SUFFIX}"
RENEW_WATCH_URL="${RENEW_WATCH_URL:-https://renew-calendar-watch${SUFFIX}-222577494676.us-central1.run.app}"

gcloud scheduler jobs create http "${JOB_CW}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="0 3 */6 * *" \
  --uri="${RENEW_WATCH_URL}" \
  --http-method=POST \
  --headers="x-webhook-secret=${WEBHOOK_SECRET}" \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=120s \
  2>/dev/null || \
gcloud scheduler jobs update http "${JOB_CW}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="0 3 */6 * *" \
  --uri="${RENEW_WATCH_URL}" \
  --http-method=POST \
  --update-headers="x-webhook-secret=${WEBHOOK_SECRET}" \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=120s

echo "✓ ${JOB_CW} configurado"

# ─── Job 3b: Reconciliar reuniões do Calendar (de hora em hora) ──
# Rede de segurança do push do Google: o webhook só enxerga o que mudou
# nos últimos 10 minutos, então uma notificação perdida sumia para
# sempre. Em 12/08/2026 uma reunião com lead QUENTE ficou 12 dias fora
# do CRM por isso. A varredura relê a janela e vincula o que faltou —
# sem notificar ninguém (mensagem de reunião já ocorrida seria pior).
JOB_RC="calendar-reconcile-job${SUFFIX}"
CALENDAR_WEBHOOK_URL="${CALENDAR_WEBHOOK_URL:-https://calendar-webhook${SUFFIX}-222577494676.us-central1.run.app}"
RECONCILE_URI="${CALENDAR_WEBHOOK_URL}?action=reconcile"

gcloud scheduler jobs create http "${JOB_RC}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="20 * * * *" \
  --uri="${RECONCILE_URI}" \
  --http-method=POST \
  --headers="x-webhook-secret=${WEBHOOK_SECRET}" \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=300s \
  2>/dev/null || \
gcloud scheduler jobs update http "${JOB_RC}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="20 * * * *" \
  --uri="${RECONCILE_URI}" \
  --http-method=POST \
  --update-headers="x-webhook-secret=${WEBHOOK_SECRET}" \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=300s

echo "✓ ${JOB_RC} configurado"

# ─── Job 4: Relatório semanal (segunda 08:00 BRT) ─────────────
JOB_WR="weekly-report-job${SUFFIX}"
WEEKLY_REPORT_URL="${WEEKLY_REPORT_URL:-https://weekly-report${SUFFIX}-222577494676.us-central1.run.app}"

gcloud scheduler jobs create http "${JOB_WR}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="0 8 * * 1" \
  --uri="${WEEKLY_REPORT_URL}" \
  --http-method=POST \
  --headers="x-webhook-secret=${WEBHOOK_SECRET}" \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=120s \
  2>/dev/null || \
gcloud scheduler jobs update http "${JOB_WR}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="0 8 * * 1" \
  --uri="${WEEKLY_REPORT_URL}" \
  --http-method=POST \
  --update-headers="x-webhook-secret=${WEBHOOK_SECRET}" \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=120s

echo "✓ ${JOB_WR} configurado"

# ─── Job 5: Re-marketing — continua campanhas em andamento (a cada 15min) ─
# A CF respeita horário seguro (9-20h) e limite diário internamente; o cron
# só re-invoca para processar o próximo batch das campanhas 'enviando'.
JOB_RM="send-remarketing-job${SUFFIX}"
SEND_REMARKETING_URL="${SEND_REMARKETING_URL:-https://send-remarketing${SUFFIX}-222577494676.us-central1.run.app}"

gcloud scheduler jobs create http "${JOB_RM}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="*/15 * * * *" \
  --uri="${SEND_REMARKETING_URL}" \
  --http-method=POST \
  --headers="x-webhook-secret=${WEBHOOK_SECRET}" \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=600s \
  2>/dev/null || \
gcloud scheduler jobs update http "${JOB_RM}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="*/15 * * * *" \
  --uri="${SEND_REMARKETING_URL}" \
  --http-method=POST \
  --update-headers="x-webhook-secret=${WEBHOOK_SECRET}" \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=600s

echo "✓ ${JOB_RM} configurado"

# ─── Job 6: CAC — sync de gasto da Meta Ads (diário 06h BRT) ──────────
JOB_MS="sync-meta-spend-job${SUFFIX}"
SYNC_META_SPEND_URL="${SYNC_META_SPEND_URL:-https://sync-meta-spend${SUFFIX}-222577494676.us-central1.run.app}"

gcloud scheduler jobs create http "${JOB_MS}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="0 6 * * *" \
  --uri="${SYNC_META_SPEND_URL}" \
  --http-method=POST \
  --headers="x-webhook-secret=${WEBHOOK_SECRET}" \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=320s \
  2>/dev/null || \
gcloud scheduler jobs update http "${JOB_MS}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="0 6 * * *" \
  --uri="${SYNC_META_SPEND_URL}" \
  --http-method=POST \
  --update-headers="x-webhook-secret=${WEBHOOK_SECRET}" \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=320s

echo "✓ ${JOB_MS} configurado"

# ─── Job 7: Engine de automações (1x/hora, minuto 30 p/ não competir
#            com os schedulers de mensageria do minuto 0) ────────────
JOB_AE="automation-engine-job${SUFFIX}"
AUTOMATION_ENGINE_URL="${AUTOMATION_ENGINE_URL:-https://automation-engine${SUFFIX}-222577494676.us-central1.run.app}"

gcloud scheduler jobs create http "${JOB_AE}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="30 * * * *" \
  --uri="${AUTOMATION_ENGINE_URL}" \
  --http-method=POST \
  --headers="x-webhook-secret=${WEBHOOK_SECRET}" \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=600s \
  2>/dev/null || \
gcloud scheduler jobs update http "${JOB_AE}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="30 * * * *" \
  --uri="${AUTOMATION_ENGINE_URL}" \
  --http-method=POST \
  --update-headers="x-webhook-secret=${WEBHOOK_SECRET}" \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=600s

echo "✓ ${JOB_AE} configurado"

# ─── Job 8: Transcrições do Google Meet (a cada 2h, minuto 15) ────────
# A CF só processa reuniões já detectadas (deals.google_calendar_event_id)
# sem transcrição capturada; anexo ausente = pula silencioso (próximo tick).
JOB_MT="meeting-transcripts-job${SUFFIX}"
MEETING_TRANSCRIPTS_URL="${MEETING_TRANSCRIPTS_URL:-https://meeting-transcripts${SUFFIX}-222577494676.us-central1.run.app}"

gcloud scheduler jobs create http "${JOB_MT}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="15 */2 * * *" \
  --uri="${MEETING_TRANSCRIPTS_URL}" \
  --http-method=POST \
  --headers="x-webhook-secret=${WEBHOOK_SECRET}" \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=300s \
  2>/dev/null || \
gcloud scheduler jobs update http "${JOB_MT}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="15 */2 * * *" \
  --uri="${MEETING_TRANSCRIPTS_URL}" \
  --http-method=POST \
  --update-headers="x-webhook-secret=${WEBHOOK_SECRET}" \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=300s

echo "✓ ${JOB_MT} configurado"

# ─── Job 9: Régua de cobrança (diário 09:00 BRT) ──────────────────────
# Percorre parcelas previsto/atrasado e dispara 1 marco por parcela/tick
# (D-3 a D+15), com CAS por marco. Nasce PAUSADA — ativar após revisar
# o texto (config regua_mensagens) e configurar SEND_MESSAGES_URL.
JOB_BR="billing-reminders-job${SUFFIX}"
BILLING_REMINDERS_URL="${BILLING_REMINDERS_URL:-https://billing-reminders${SUFFIX}-222577494676.us-central1.run.app}"

gcloud scheduler jobs create http "${JOB_BR}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="0 9 * * *" \
  --uri="${BILLING_REMINDERS_URL}" \
  --http-method=POST \
  --headers="x-webhook-secret=${WEBHOOK_SECRET}" \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=600s \
  2>/dev/null || \
gcloud scheduler jobs update http "${JOB_BR}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="0 9 * * *" \
  --uri="${BILLING_REMINDERS_URL}" \
  --http-method=POST \
  --update-headers="x-webhook-secret=${WEBHOOK_SECRET}" \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=600s

echo "✓ ${JOB_BR} configurado"

# ─── Job 10: Monitor de saúde do funil (a cada 30 min) ────────────────
# Watchdog: qualificação travada, fila WhatsApp presa, erros de automação.
# Alerta o CEO (WhatsApp + in-app) com cooldown de 6h por check. A instância
# UAT roda em modo dry (só a PRD alerta) — seguro criar o job nos 2 ambientes.
JOB_MH="monitor-health-job${SUFFIX}"
MONITOR_HEALTH_URL="${MONITOR_HEALTH_URL:-https://monitor-health${SUFFIX}-222577494676.us-central1.run.app}"

gcloud scheduler jobs create http "${JOB_MH}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="*/30 * * * *" \
  --uri="${MONITOR_HEALTH_URL}" \
  --http-method=POST \
  --headers="x-webhook-secret=${WEBHOOK_SECRET}" \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=120s \
  2>/dev/null || \
gcloud scheduler jobs update http "${JOB_MH}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="*/30 * * * *" \
  --uri="${MONITOR_HEALTH_URL}" \
  --http-method=POST \
  --update-headers="x-webhook-secret=${WEBHOOK_SECRET}" \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=120s

echo "✓ ${JOB_MH} configurado"

# ─── Job 11: Pós-venda — NPS 6 meses + alerta de inatividade (diário 10:00 BRT) ─
# NPS: WhatsApp único por família (CAS nps_enviado_at) às famílias embarcadas
# há 180+ dias. Alerta: notificação Head/CEO + tarefa p/ Head, cooldown 7 dias.
# ⚠️ O job de PRD deve nascer PAUSADO — é outreach a famílias clientes; o CEO
# ativa quando quiser (mesmo racional do billing-reminders):
#   gcloud scheduler jobs pause experiencia-scheduler-job --location=us-central1 --project=elite-portal-forms
JOB_ES="experiencia-scheduler-job${SUFFIX}"
EXPERIENCIA_SCHEDULER_URL="${EXPERIENCIA_SCHEDULER_URL:-https://experiencia-scheduler${SUFFIX}-222577494676.us-central1.run.app}"

gcloud scheduler jobs create http "${JOB_ES}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="0 10 * * *" \
  --uri="${EXPERIENCIA_SCHEDULER_URL}" \
  --http-method=POST \
  --headers="x-webhook-secret=${WEBHOOK_SECRET}" \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=300s \
  2>/dev/null || \
gcloud scheduler jobs update http "${JOB_ES}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="0 10 * * *" \
  --uri="${EXPERIENCIA_SCHEDULER_URL}" \
  --http-method=POST \
  --update-headers="x-webhook-secret=${WEBHOOK_SECRET}" \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=300s

echo "✓ ${JOB_ES} configurado"

# ─── Job 12: Chatbot AUTÔNOMO de WhatsApp (a cada 2 min) ──────────────
# A CF `chatbot-autonomo` acorda a cada ~2min e, SÓ se o modo global for
# sombra/ativo (configuracoes_sistema.chatbot_autonomo.modo), decide responder
# leads. NASCE DESLIGADO (modo=off) → o tick não faz nada até o CEO ligar.
# Header x-webhook-secret OBRIGATÓRIO: a CF nega (401) sem ele. O segredo vem do
# ambiente (nunca hardcode) — exporte WEBHOOK_SECRET antes de rodar o script:
#   WEBHOOK_SECRET=... bash infra/scheduler.sh <env>
JOB_CB="chatbot-autonomo-job${SUFFIX}"
CHATBOT_AUTONOMO_URL="${CHATBOT_AUTONOMO_URL:-https://chatbot-autonomo${SUFFIX}-222577494676.us-central1.run.app}"

gcloud scheduler jobs create http "${JOB_CB}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="*/2 * * * *" \
  --uri="${CHATBOT_AUTONOMO_URL}" \
  --http-method=POST \
  --headers="x-webhook-secret=${WEBHOOK_SECRET:-}" \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=120s \
  2>/dev/null || \
gcloud scheduler jobs update http "${JOB_CB}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="*/2 * * * *" \
  --uri="${CHATBOT_AUTONOMO_URL}" \
  --http-method=POST \
  --update-headers="x-webhook-secret=${WEBHOOK_SECRET:-}" \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=120s

echo "✓ ${JOB_CB} configurado"
# ─── Job 13: Retry de qualificação Gemini (diário 08:00 BRT) ──────────
# Job já existia em PRD (criado ad hoc) mas faltava aqui — codificado.
JOB_RQ="retry-qualification-daily${SUFFIX}"
RETRY_QUALIFICATION_URL="${RETRY_QUALIFICATION_URL:-https://retry-qualification${SUFFIX}-222577494676.us-central1.run.app}"

gcloud scheduler jobs create http "${JOB_RQ}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="0 8 * * *" \
  --uri="${RETRY_QUALIFICATION_URL}" \
  --http-method=POST \
  --headers="x-webhook-secret=${WEBHOOK_SECRET}" \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=540s \
  2>/dev/null || \
gcloud scheduler jobs update http "${JOB_RQ}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="0 8 * * *" \
  --uri="${RETRY_QUALIFICATION_URL}" \
  --http-method=POST \
  --update-headers="x-webhook-secret=${WEBHOOK_SECRET}" \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=540s

echo "✓ ${JOB_RQ} configurado"

# ─── Job 14: Retomada de novembro — scheduled_return (diário 08:00 BRT) ─
# Job já existia (PRD/UAT) mas faltava aqui — codificado.
JOB_SF="process-scheduled-followups-daily${SUFFIX}"
SCHEDULED_FOLLOWUPS_URL="${SCHEDULED_FOLLOWUPS_URL:-https://process-scheduled-followups${SUFFIX}-222577494676.us-central1.run.app}"

gcloud scheduler jobs create http "${JOB_SF}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="0 8 * * *" \
  --uri="${SCHEDULED_FOLLOWUPS_URL}" \
  --http-method=POST \
  --headers="x-webhook-secret=${WEBHOOK_SECRET}" \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=540s \
  2>/dev/null || \
gcloud scheduler jobs update http "${JOB_SF}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="0 8 * * *" \
  --uri="${SCHEDULED_FOLLOWUPS_URL}" \
  --http-method=POST \
  --update-headers="x-webhook-secret=${WEBHOOK_SECRET}" \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=540s

echo "✓ ${JOB_SF} configurado"

echo "Cloud Scheduler [${ENV}] configurado com sucesso"
