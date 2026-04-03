# Deploy — Elite Portal USA

## Pré-requisitos

- Node.js 18+
- `gcloud` CLI autenticado (`gcloud auth login`)
- Supabase CLI (`npm install -g supabase`)
- Acesso ao projeto GCP `elite-portal-forms`

## Deploy automático (CI/CD)

O deploy acontece automaticamente via GitHub Actions quando há push na branch `main`:

| Trigger | Workflow | O que faz |
|---|---|---|
| Push em `main` com mudanças em `functions/**` | `deploy-functions.yml` | Deploy das Cloud Functions modificadas |
| Push em `main` com mudanças em `supabase/**` | `deploy-supabase.yml` | Deploy da Edge Function + migrations |
| PR para `main` ou `develop` | `ci.yml` | Lint, type check e validação das functions |

### Fluxo de branches

```
feature/... → develop → main → deploy automático
```

1. Abrir PR de `feature/...` → `develop`
2. CI roda (lint + validação)
3. Merge para `develop`
4. Abrir PR de `develop` → `main`
5. Merge para `main` → deploy automático

## Deploy manual (emergência)

```bash
# Autenticar
gcloud auth login
gcloud config set project elite-portal-forms

# Deploy de uma function específica (ex: followup-scheduler)
gcloud functions deploy followup-scheduler \
  --gen2 --runtime=nodejs20 --region=us-central1 \
  --source=functions/process-followup-whatsapp \
  --entry-point=processFollowupWhatsApp \
  --trigger-http --allow-unauthenticated \
  --timeout=900s --memory=256Mi \
  --update-env-vars WEBHOOK_SECRET=$WEBHOOK_SECRET \
  --project=elite-portal-forms

# Deploy Supabase migrations
supabase link --project-ref nikrlikwghqcxcjzthmc
supabase db push
```

> **IMPORTANTE:** Sempre usar `--update-env-vars` (nunca `--set-env-vars`) para não sobrescrever variáveis existentes na função.

## Atualizando variáveis de ambiente (sem redeploy de código)

Para Cloud Functions Gen2, use `gcloud run services update` — não faz novo deploy de código, apenas atualiza a configuração:

```bash
gcloud run services update followup-scheduler \
  --update-env-vars GOOGLE_CALENDAR_ID=leandro.ribeiro@bolsaatletausa.com \
  --region=us-central1 \
  --project=elite-portal-forms
```

## Habilitando Google Calendar API (obrigatório para followup-scheduler)

A função `process-followup-whatsapp` usa a Google Calendar API para detectar se o lead já agendou reunião antes de enviar follow-ups.

```bash
# Habilitar a API no projeto GCP
gcloud services enable calendar-json.googleapis.com --project=elite-portal-forms
```

A autenticação usa a Service Account (`SERVICE_ACCOUNT_EMAIL` + `SERVICE_ACCOUNT_PRIVATE_KEY`) com escopo `calendar.readonly`. O calendário verificado é o definido por `GOOGLE_CALENDAR_ID`.

> O calendário precisa ser **compartilhado com a Service Account** com permissão de leitura (ou visibilidade pública para a organização).

## Cloud Scheduler

Para criar ou atualizar ambos os jobs de scheduler:

```bash
bash infra/scheduler.sh
```

O script cria (ou atualiza se já existir):

| Job | Função | Horário | Descrição |
|---|---|---|---|
| `process-whatsapp-job` | `whatsapp-scheduler` | Toda hora | WhatsApp inicial 22h após qualificação |
| `process-followup-job` | `followup-scheduler` | Toda hora | Follow-ups 48h e 7 dias sem agendamento |

### Pausar/Reativar schedulers manualmente

```bash
# Pausar
gcloud scheduler jobs pause process-followup-job --location=us-central1 --project=elite-portal-forms
gcloud scheduler jobs pause process-whatsapp-job --location=us-central1 --project=elite-portal-forms

# Reativar
gcloud scheduler jobs resume process-followup-job --location=us-central1 --project=elite-portal-forms
gcloud scheduler jobs resume process-whatsapp-job --location=us-central1 --project=elite-portal-forms

# Invocar manualmente (teste)
gcloud scheduler jobs run process-followup-job --location=us-central1 --project=elite-portal-forms
```

## Setup Workload Identity Federation (GCP)

Execute no Cloud Shell do projeto `elite-portal-forms`:

```bash
# 0. Habilitar APIs necessárias (obrigatório na primeira vez)
gcloud services enable \
  cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  cloudresourcemanager.googleapis.com \
  calendar-json.googleapis.com \
  --project=elite-portal-forms

# 1. Criar Workload Identity Pool
gcloud iam workload-identity-pools create "github-pool" \
  --project="elite-portal-forms" \
  --location="global" \
  --display-name="GitHub Actions Pool"

# 2. Criar Provider
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --project="elite-portal-forms" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='LucasDEVBA/elite-portal-usa'" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# 3. Criar Service Account
gcloud iam service-accounts create github-actions \
  --project="elite-portal-forms" \
  --display-name="GitHub Actions Deploy"

# 4. Permissões
gcloud projects add-iam-policy-binding elite-portal-forms \
  --member="serviceAccount:github-actions@elite-portal-forms.iam.gserviceaccount.com" \
  --role="roles/cloudfunctions.developer"

gcloud projects add-iam-policy-binding elite-portal-forms \
  --member="serviceAccount:github-actions@elite-portal-forms.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding elite-portal-forms \
  --member="serviceAccount:github-actions@elite-portal-forms.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding elite-portal-forms \
  --member="serviceAccount:github-actions@elite-portal-forms.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

# 5. Permitir GitHub Actions
gcloud iam service-accounts add-iam-policy-binding \
  github-actions@elite-portal-forms.iam.gserviceaccount.com \
  --project="elite-portal-forms" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/222577494676/locations/global/workloadIdentityPools/github-pool/attribute.repository/LucasDEVBA/elite-portal-usa"
```

## GitHub Secrets necessários

Configure em `Settings > Secrets and variables > Actions` do repositório:

| Secret | Valor |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/222577494676/locations/global/workloadIdentityPools/github-pool/providers/github-provider` |
| `GCP_SERVICE_ACCOUNT` | `github-actions@elite-portal-forms.iam.gserviceaccount.com` |
| `SUPABASE_ACCESS_TOKEN` | Token pessoal do Supabase CLI (`supabase login`) |
| `SUPABASE_PROJECT_ID` | Ref do projeto Supabase: `nikrlikwghqcxcjzthmc` |
| `WEBHOOK_SECRET` | String aleatória para autenticar chamadas aos webhooks GCP |

### Gerando o WEBHOOK_SECRET

```bash
openssl rand -hex 32
```

Cole o valor gerado como secret `WEBHOOK_SECRET` no GitHub **e** nos webhooks do Supabase.

### Configurando o header nos webhooks do Supabase

Para cada webhook em `Supabase > Database > Webhooks`, adicione o header:

| Header | Valor |
|---|---|
| `x-webhook-secret` | O mesmo valor do secret `WEBHOOK_SECRET` |
