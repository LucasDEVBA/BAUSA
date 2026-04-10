# Ambientes — BAUSA

## Visão geral

O sistema possui **3 ambientes isolados**, cada um com suas próprias Cloud Functions, schema de banco e configuração de Vercel. Nenhuma mudança chega a produção sem passar por UAT e aprovação manual.

```
feature/* ──────────→ develop ──────────→ main
    ↓                    ↓                  ↓
deploy manual         auto-deploy       aprovação manual
   DEV                  UAT                PRD
```

---

## Ambientes

| Ambiente | Branch | Deploy | Supabase Schema | GCP Functions | Aprovação |
|----------|--------|--------|-----------------|---------------|-----------|
| **DEV** | `feature/*` | Manual sob demanda | `dev` | `*-dev` | Nenhuma |
| **UAT** | `develop` | Auto em push | `uat` | `*-uat` | Nenhuma |
| **PRD** | `main` | Auto após aprovação | `public` | sem sufixo | **Obrigatória** |

---

## DEV

**Propósito:** Desenvolvimento local e testes de integração isolados.

**Stack:**
- Frontend: `npm run dev` (localhost:3000) + `.env.dev`
- Supabase schema: `dev` (dados de teste, sem impacto em PRD)
- Cloud Functions: `*-dev` (deploy manual via `gcloud functions deploy`)
- Schedulers: desativados por padrão (teste manual se necessário)

**Variáveis de ambiente (`.env.dev`, não commitar):**
```env
VITE_SUPABASE_URL=https://nikrlikwghqcxcjzthmc.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key — mesma do projeto>
VITE_SUPABASE_SCHEMA=dev
```

**Deploy manual de função DEV:**
```bash
gcloud functions deploy messenger-service-dev \
  --gen2 --runtime=nodejs20 --region=us-central1 \
  --source=functions/send-messages \
  --entry-point=sendMessages \
  --trigger-http --allow-unauthenticated \
  --timeout=120s --memory=256Mi \
  --update-env-vars WEBHOOK_SECRET=$WEBHOOK_SECRET_DEV,SUPABASE_SCHEMA=dev \
  --project=elite-portal-forms
```

---

## UAT (User Acceptance Testing)

**Propósito:** Validação completa antes de PRD. Todo código que vai para `main` deve passar pelo UAT primeiro.

**Stack:**
- Frontend: Vercel preview do branch `develop`
- Supabase schema: `uat`
- Cloud Functions: `*-uat` (deploy automático via `deploy-functions-uat.yml`)
- Schedulers: ativos (`process-whatsapp-job-uat`, `process-followup-job-uat`)

**Variáveis de ambiente (configurar no Vercel para branch `develop`):**
```env
VITE_SUPABASE_URL=https://nikrlikwghqcxcjzthmc.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
VITE_SUPABASE_SCHEMA=uat
# i18n: idioma padrão definido pelo browser (sem variável necessária)
```

**Supabase Webhooks UAT** (configurar manualmente no Dashboard):

| Schema | Tabela | Evento | URL destino | Header |
|--------|--------|--------|-------------|--------|
| `uat` | `form_submissions` | INSERT | `messenger-service-uat` URL | `x-webhook-secret: <WEBHOOK_SECRET_UAT>` |
| `uat` | `form_submissions` | INSERT | `sync-elite-leads-uat` URL | `x-webhook-secret: <WEBHOOK_SECRET_UAT>` |
| `uat` | `form_submissions` | INSERT | `lead-qualifier-uat` URL | `x-webhook-secret: <WEBHOOK_SECRET_UAT>` |

**GitHub Secrets necessários:**
- `WEBHOOK_SECRET_UAT` — gerar com `openssl rand -hex 32`

**Criar schedulers UAT:**
```bash
bash infra/scheduler.sh uat
```

**Configurar env vars nas funções UAT após deploy:**
```bash
gcloud run services update whatsapp-scheduler-uat \
  --update-env-vars SUPABASE_URL=<url>,SUPABASE_SERVICE_KEY=<key>,SEND_WHATSAPP_URL=<url>,SYNC_LEADS_URL=<url>,SUPABASE_SCHEMA=uat \
  --region=us-central1 --project=elite-portal-forms
```

---

## PRD (Produção)

**Propósito:** Ambiente de produção com leads reais. Deploy só ocorre após aprovação manual.

**Stack:**
- Frontend: Vercel produção (branch `main`)
- Supabase schema: `public` (padrão)
- Cloud Functions: sem sufixo (nomes originais)
- Schedulers: `process-whatsapp-job`, `process-followup-job`

**Variáveis de ambiente (Vercel produção):**
```env
VITE_SUPABASE_URL=https://nikrlikwghqcxcjzthmc.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
# VITE_SUPABASE_SCHEMA não definida → usa 'public' por padrão
```

**Aprovação de deploy:**
1. Merge em `main` → GitHub Actions inicia o job mas **pausa**
2. Vai para `github.com/LucasDEVBA/BAUSA/actions`
3. Clica em "Review deployments" → "Approve and deploy"
4. Deploy para PRD é executado

---

## Git Flow

```
1. Criar branch:     git checkout -b feature/minha-feature
2. Desenvolver e abrir PR para develop
3. CI roda (lint + validate)
4. Merge para develop → deploy automático em UAT
5. Validar em UAT
6. Abrir PR de develop para main
7. Merge para main → aprovação manual → deploy PRD
```

**Branch protection rules** (configurar no GitHub):
- `main`: require PR, require CI passing, no direct push
- `develop`: require PR, require CI passing

---

## GitHub Environments

Configurar em `Settings → Environments`:

| Environment | Required reviewers | Deployment branches |
|-------------|-------------------|---------------------|
| `prd` | `LucasDEVBA` (e outros se houver) | `main` |
| `uat` | Nenhum | `develop` |
| `dev` | Nenhum | `feature/*` |

---

## GitHub Secrets

| Secret | Ambientes que usam | Descrição |
|--------|--------------------|-----------|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Todos | WIF path no GCP |
| `GCP_SERVICE_ACCOUNT` | Todos | Service account de deploy |
| `WEBHOOK_SECRET` | PRD | Auth inter-serviços em PRD |
| `WEBHOOK_SECRET_UAT` | UAT | Auth inter-serviços em UAT |
| `WEBHOOK_SECRET_DEV` | DEV | Auth inter-serviços em DEV |
| `SUPABASE_ACCESS_TOKEN` | PRD + UAT | Token CLI Supabase |
| `SUPABASE_PROJECT_ID` | PRD + UAT | `nikrlikwghqcxcjzthmc` |

---

## Isolamento de dados

- **PRD** → `public.form_submissions` — leads reais de clientes
- **UAT** → `uat.form_submissions` — dados de teste, pode ser truncado livremente
- **DEV** → `dev.form_submissions` — dados de desenvolvimento local

Todos os schemas possuem a mesma estrutura incluindo as colunas:
- `followup_1_sent_at`, `followup_2_sent_at`, `meeting_scheduled`, `meeting_scheduled_at` (migration `20260308131630`)
- `address_country` com default `'BR'` (migration `20260314000000`)

Para limpar dados de UAT/DEV:
```sql
-- Limpar UAT (não afeta PRD)
TRUNCATE TABLE uat.form_submissions;

-- Limpar DEV
TRUNCATE TABLE dev.form_submissions;
```

---

## Configuração dos arquivos de ambiente

Os arquivos `infra/config/environments/*.json` documentam a configuração de cada ambiente:

```bash
cat infra/config/environments/prd.json  # PRD
cat infra/config/environments/uat.json  # UAT
cat infra/config/environments/dev.json  # DEV
```
