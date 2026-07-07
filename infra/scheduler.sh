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

echo "Configurando Cloud Scheduler para ambiente: ${ENV}"

# ─── Job 1: WhatsApp inicial (22h após qualificação) ───────────
gcloud scheduler jobs create http "${JOB_WA}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="0 * * * *" \
  --uri="${WHATSAPP_SCHEDULER_URL}" \
  --http-method=POST \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=960s \
  2>/dev/null || \
gcloud scheduler jobs update http "${JOB_WA}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="0 * * * *" \
  --uri="${WHATSAPP_SCHEDULER_URL}" \
  --http-method=POST \
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
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=960s \
  2>/dev/null || \
gcloud scheduler jobs update http "${JOB_FU}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="0 * * * *" \
  --uri="${FOLLOWUP_SCHEDULER_URL}" \
  --http-method=POST \
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
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=120s \
  2>/dev/null || \
gcloud scheduler jobs update http "${JOB_CW}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="0 3 */6 * *" \
  --uri="${RENEW_WATCH_URL}" \
  --http-method=POST \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=120s

echo "✓ ${JOB_CW} configurado"

# ─── Job 4: Relatório semanal (segunda 08:00 BRT) ─────────────
JOB_WR="weekly-report-job${SUFFIX}"
WEEKLY_REPORT_URL="${WEEKLY_REPORT_URL:-https://weekly-report${SUFFIX}-222577494676.us-central1.run.app}"

gcloud scheduler jobs create http "${JOB_WR}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="0 8 * * 1" \
  --uri="${WEEKLY_REPORT_URL}" \
  --http-method=POST \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=120s \
  2>/dev/null || \
gcloud scheduler jobs update http "${JOB_WR}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="0 8 * * 1" \
  --uri="${WEEKLY_REPORT_URL}" \
  --http-method=POST \
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
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=600s \
  2>/dev/null || \
gcloud scheduler jobs update http "${JOB_RM}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="*/15 * * * *" \
  --uri="${SEND_REMARKETING_URL}" \
  --http-method=POST \
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
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=320s \
  2>/dev/null || \
gcloud scheduler jobs update http "${JOB_MS}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="0 6 * * *" \
  --uri="${SYNC_META_SPEND_URL}" \
  --http-method=POST \
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
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=600s \
  2>/dev/null || \
gcloud scheduler jobs update http "${JOB_AE}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="30 * * * *" \
  --uri="${AUTOMATION_ENGINE_URL}" \
  --http-method=POST \
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
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=300s \
  2>/dev/null || \
gcloud scheduler jobs update http "${JOB_MT}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="15 */2 * * *" \
  --uri="${MEETING_TRANSCRIPTS_URL}" \
  --http-method=POST \
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
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=600s \
  2>/dev/null || \
gcloud scheduler jobs update http "${JOB_BR}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="0 9 * * *" \
  --uri="${BILLING_REMINDERS_URL}" \
  --http-method=POST \
  --time-zone="America/Sao_Paulo" \
  --attempt-deadline=600s

echo "✓ ${JOB_BR} configurado"
echo "Cloud Scheduler [${ENV}] configurado com sucesso"
