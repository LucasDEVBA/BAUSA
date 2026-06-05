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
echo "Cloud Scheduler [${ENV}] configurado com sucesso"
