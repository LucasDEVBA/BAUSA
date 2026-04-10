# Variáveis de Ambiente — BAUSA

## Frontend (Vercel)

Configuradas no painel Vercel em `Settings > Environment Variables`:

| Variável | Descrição |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase (ex: `https://nikrlikwghqcxcjzthmc.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Chave pública anon do Supabase |

## Cloud Functions (GCP)

Configuradas diretamente em cada função no GCP. **Nunca commitar no repositório.**

Para atualizar env vars sem fazer redeploy de código:
```bash
gcloud run services update NOME_DA_FUNCAO \
  --update-env-vars CHAVE=VALOR \
  --region=us-central1 \
  --project=elite-portal-forms
```

---

### send-messages (`messenger-service`)

| Variável | Descrição |
|---|---|
| `WEBHOOK_SECRET` | Secret compartilhado para autenticar chamadas do Supabase |
| `RESEND_API_KEY` | Chave de API do Resend (provider primário de email) |
| `BREVO_API_KEY` | Chave de API do Brevo (provider fallback de email) |
| `FROM_EMAIL` | Endereço de envio (ex: `Bolsa Atleta USA <noreply@bolsaatletausa.com>`) |
| `INTERNAL_EMAIL` | Email interno para notificações (ex: `contato@bolsaatletausa.com`) |
| `LOGO_URL` | URL da logo para template de email |

---

### sync-leads (`sync-elite-leads`)

| Variável | Descrição |
|---|---|
| `WEBHOOK_SECRET` | Secret compartilhado para autenticar chamadas do Supabase |
| `SPREADSHEET_ID` | ID da planilha Google Sheets |
| `SERVICE_ACCOUNT_EMAIL` | Email da Service Account com acesso à planilha |
| `SERVICE_ACCOUNT_PRIVATE_KEY` | Chave privada da Service Account (formato PEM) |

---

### qualify-lead (`lead-qualifier`)

| Variável | Descrição |
|---|---|
| `WEBHOOK_SECRET` | Secret compartilhado para autenticar chamadas do Supabase |
| `GEMINI_API_KEY` | Chave de API do Google Gemini 2.5 Flash |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_KEY` | Service Role Key do Supabase (acesso total ao banco) |
| `SPREADSHEET_ID` | ID da planilha Google Sheets |
| `SERVICE_ACCOUNT_EMAIL` | Email da Service Account |
| `SERVICE_ACCOUNT_PRIVATE_KEY` | Chave privada da Service Account |

---

### send-whatsapp

| Variável | Descrição |
|---|---|
| `WEBHOOK_SECRET` | Secret compartilhado para autenticar chamadas internas |
| `ZAPI_INSTANCE_ID` | ID da instância Z-API |
| `ZAPI_TOKEN` | Token de autenticação Z-API |
| `ZAPI_CLIENT_TOKEN` | Client Token Z-API (enviado no header `Client-Token`) |

---

### process-pending-whatsapp (`whatsapp-scheduler`)

| Variável | Descrição |
|---|---|
| `WEBHOOK_SECRET` | Secret compartilhado (opcional — permite chamadas autenticadas) |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_KEY` | Service Role Key do Supabase |
| `SEND_WHATSAPP_URL` | URL completa da Cloud Function `send-whatsapp` |
| `SYNC_LEADS_URL` | URL completa da Cloud Function `sync-elite-leads` — sincroniza whatsapp_sent_at no Sheets |

---

### process-followup-whatsapp (`followup-scheduler`)

| Variável | Descrição |
|---|---|
| `WEBHOOK_SECRET` | Secret compartilhado (opcional — permite chamadas autenticadas) |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_KEY` | Service Role Key do Supabase |
| `SEND_WHATSAPP_URL` | URL completa da Cloud Function `send-whatsapp` |
| `SYNC_LEADS_URL` | URL completa da Cloud Function `sync-elite-leads` — sincroniza followup e reunião no Sheets |
| `SERVICE_ACCOUNT_EMAIL` | Email da Service Account (usado para autenticar na Calendar API) |
| `SERVICE_ACCOUNT_PRIVATE_KEY` | Chave privada da Service Account (formato PEM) |
| `GOOGLE_CALENDAR_ID` | ID do calendário a verificar reuniões agendadas (ex: `leandro.ribeiro@bolsaatletausa.com`) |

> **Nota:** `GOOGLE_CALENDAR_ID` é o email/ID do Google Calendar do consultor. A Service Account precisa ter acesso de leitura a esse calendário.

---

## Banco de dados — Colunas da tabela `form_submissions`

### Colunas de qualificação

| Coluna | Tipo | Descrição |
|---|---|---|
| `qualified` | boolean | Lead qualificado pela IA? |
| `qualification_classification` | text | `QUENTE`, `MORNO` ou `FRIO` |
| `qualification_reason` | text | Justificativa 2–4 frases gerada pelo Gemini |
| `qualified_at` | timestamptz | Timestamp da qualificação |
| `whatsapp_sent_at` | timestamptz | Timestamp do envio do WhatsApp inicial |

### Colunas de follow-up (migration `20260308131630`)

| Coluna | Tipo | Descrição |
|---|---|---|
| `followup_1_sent_at` | timestamptz | Timestamp do follow-up de 48h enviado |
| `followup_2_sent_at` | timestamptz | Timestamp do follow-up de 7 dias enviado |
| `meeting_scheduled` | boolean | Reunião detectada via Google Calendar API |
| `meeting_scheduled_at` | timestamptz | Timestamp de quando a reunião foi detectada |

---

## Supabase Edge Function (form-handler)

> **Nota:** O formulário atual submete diretamente ao Supabase via client JS (sem edge function intermediária). As variáveis abaixo são injetadas automaticamente pelo runtime do Supabase caso a edge function seja usada.

| Variável | Descrição |
|---|---|
| `SUPABASE_URL` | URL do projeto (auto-injetada) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key (auto-injetada) |

---

## Webhooks Supabase → Cloud Functions

Configurados em `Supabase > Database > Webhooks`:

| Evento | Tabela | URL destino | Header obrigatório |
|---|---|---|---|
| INSERT | `form_submissions` | `https://messenger-service-222577494676.us-central1.run.app` | `x-webhook-secret: <WEBHOOK_SECRET>` |
| INSERT | `form_submissions` | `https://sync-elite-leads-222577494676.us-central1.run.app` | `x-webhook-secret: <WEBHOOK_SECRET>` |
| INSERT | `form_submissions` | `https://lead-qualifier-222577494676.us-central1.run.app` | `x-webhook-secret: <WEBHOOK_SECRET>` |
