# ATIVAÇÃO & GO-LIVE — BAUSA

> Runbook único de tudo que falta para deixar **todas as features 100% funcionais** em UAT e PRD.
> Gerado após o deploy do PR #200 (CAC granular + Insights IA + contraste + encurtador UTM + deep-linking + financeiro exato).

## Como usar este documento

- **Legenda de responsável:** 🧑‍💼 **VOCÊ** (config/segredo/acesso externo) · 🤖 **CLAUDE** (código, já feito ou a fazer) · ⏳ **automático** (roda no deploy).
- **Segredos NUNCA em chat.** Você configura direto no **Vercel**, **GCP** (`gcloud --update-env-vars`) ou **GitHub Secrets**. Só me passe **confirmação** de que setou, ou valores **não-sensíveis** (IDs de conta, decisões).
- **Ambientes:** UAT = branch `develop` (schema `uat`, funções `*-uat`, Vercel Preview). PRD = branch `main` (schema `public`, funções sem sufixo, Vercel Production). Replique a config nos dois.
- **Ordem sugerida:** faça as seções **1 → 4** primeiro (destravam o que já está no ar). As demais são features que nascem pausadas/pendentes.

---

## 0. Contas & acessos externos a obter (pré-requisito)

| # | O quê | Onde obter | Usado por |
|---|---|---|---|
| 0.1 | 🧑‍💼 **Gemini API key** | Google AI Studio (aistudio.google.com → API keys) | Insights de IA (CAC), qualify-lead, meeting-transcripts |
| 0.2 | 🧑‍💼 **Meta System User token** (permissão `ads_read`) + **Ad Account ID** (`act_...`) | Meta Business Suite → Configurações → Usuários do sistema → gerar token que **não expira** | sync-meta-spend (CAC por campanha) |
| 0.3 | 🧑‍💼 **Z-API** (instância + token + client-token) | painel Z-API | send-whatsapp, calendar-webhook, send-remarketing |
| 0.4 | 🧑‍💼 **Resend** + **Brevo** API keys | resend.com / brevo.com | send-messages, send-remarketing, weekly-report |
| 0.5 | 🧑‍💼 **Service Account** GCP (email + private key) com **Sheets**, **Calendar** e **Drive** habilitados | GCP IAM → Service Accounts | qualify-lead, sync-leads, calendar-webhook, meeting-transcripts |
| 0.6 | 🧑‍💼 **APIs GCP habilitadas** no projeto `elite-portal-forms`: **Google Drive API**, Google Sheets API, Google Calendar API, Cloud Functions, Cloud Scheduler | GCP → APIs & Services → Enable | várias |

---

## 1. Insights de IA (Gemini) — CAC · **prioridade**

Sem `GEMINI_API_KEY`, o botão "Gerar insights" mostra "IA não configurada".

- [ ] 🧑‍💼 **Vercel → projeto `bolsa-atleta-crm` → Settings → Environment Variables**
  - `GEMINI_API_KEY = <chave 0.1>` — marcar **Preview** (UAT) **e** **Production** (PRD).
- [ ] 🧑‍💼 Redeploy do CRM (ou aguardar o próximo push).
- [x] 🤖 Código pronto (`src/lib/gemini.ts`, action `gerarInsightsCac`, degradação graciosa).

**Validar:** Analytics → CAC → "Gerar insights".

---

## 2. Meta Ads granular (ROI exato por campanha) — CAC · **prioridade**

Sem credenciais Meta, a seção "ROI exato por campanha" fica em "Sem dados de campanha".

- [ ] 🧑‍💼 **Env vars na CF `sync-meta-spend-uat`** (e depois `sync-meta-spend` em PRD):
  ```bash
  gcloud functions deploy sync-meta-spend-uat --gen2 --region=us-central1 \
    --source=functions/sync-meta-spend --entry-point=syncMetaSpend \
    --trigger-http --allow-unauthenticated --runtime=nodejs20 \
    --update-env-vars \
META_ACCESS_TOKEN=<token 0.2>,META_AD_ACCOUNT_ID=act_<id 0.2>,META_GRAPH_VERSION=v21.0,META_SYNC_MESES=2,\
SUPABASE_URL=<url>,SUPABASE_SERVICE_KEY=<service key>,SUPABASE_SCHEMA=uat,WEBHOOK_SECRET=<secret_uat> \
    --project=elite-portal-forms
  ```
- [ ] 🧑‍💼 **Agendar o job diário (06h BRT):** `bash infra/scheduler.sh uat` (cria/atualiza `sync-meta-spend-job-uat`). Repetir `prd` no go-live.
- [x] 🤖 Migration `meta_ads_campanha` ⏳ já aplicada em UAT; CF `sync-meta-spend-uat` ⏳ já deployada.

**Observações:**
- A conta Meta é assumida em **BRL** (loga aviso se ≠ BRL).
- O `campaign.id` do Meta precisa bater com o `utm_id` (`{{campaign.id}}`) nos links das campanhas para o ROI cruzar — confira os UTMs dos anúncios.

**Validar:** rodar a CF manualmente (`curl` no trigger com header `x-webhook-secret`) e conferir a tabela `uat.meta_ads_campanha` + a tela de CAC.

---

## 3. Encurtador de UTM — validar o redirect

- [x] 🤖 Migration `links_curtos` + RPC ⏳ aplicadas em UAT; route `apps/web /l/[slug]` no ar.
- [ ] 🧑‍💼 Confirmar que o Vercel **`bausa-web`** (branch `develop`) tem: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_SCHEMA=uat`.
- **Nuance de UAT:** o link gerado aponta para `bolsaatletausa.com/l/xxx` (domínio de PRD). Em UAT o route está no **preview do Vercel** — para testar, troque o domínio pelo preview (`https://<preview>/l/<slug>`). Em **PRD** funciona direto.

**Validar:** gerar um link curto no gerador de UTM → abrir → deve redirecionar 302 com as UTMs.

---

## 4. Deep-linking, contraste, financeiro exato, modal de Experiência

- [x] 🤖 100% frontend/lógica — **já funcionam em UAT** sem config.
- [ ] 🧑‍💼 **Validação funcional sua no Engine de UAT** (precisa de login + dados reais):
  - Clicar numa **notificação** (escalonamento/pagamento) → abre a modal/linha certa.
  - **Famílias (gerencial)** → clicar família/onboarding abre a modal; nome do atleta aparece.
  - **Experiência** → clicar família abre o **modal detalhado** (não sidebar).
  - **Financeiro** → notificação de pagamento destaca o contrato (`?deal`).

---

## 5. Régua de cobrança (`billing-reminders`) — **nasce pausada**

- [ ] 🧑‍💼 Env vars na CF `billing-reminders-uat` / `billing-reminders`:
  `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_SCHEMA`, `WEBHOOK_SECRET`, `SEND_WHATSAPP_URL`, `SEND_MESSAGES_URL`.
- [ ] 🧑‍💼 Agendar (diário 09h BRT): `bash infra/scheduler.sh uat` (job `billing-reminders-job`, já incluído no script).
- [ ] 🧑‍💼 **Ativar** (nasce pausada): despausar o Cloud Scheduler job quando quiser ligar.
- [ ] 🧑‍💼 Requer **consentimento** dos responsáveis (`aceite_whatsapp`/`aceite_email`) e textos em `regua_mensagens`.

---

## 6. Automações (`automation-engine`) — engine do BAU Engine

- [ ] 🧑‍💼 Env vars na CF `automation-engine-uat` / `automation-engine`:
  `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_SCHEMA`, `WEBHOOK_SECRET`, `SEND_WHATSAPP_URL`, `SEND_MESSAGES_URL`.
- [ ] 🧑‍💼 Agendar (1x/h, min 30): `bash infra/scheduler.sh uat` (job `automation-engine-job`).
- [x] 🤖 Código + migration + guard de CI prontos.

---

## 7. Transcrição do Meet (`meeting-transcripts`)

- [ ] 🧑‍💼 Env vars na CF `meeting-transcripts-uat` / `meeting-transcripts`:
  `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_SCHEMA`, `SERVICE_ACCOUNT_EMAIL`, `SERVICE_ACCOUNT_PRIVATE_KEY`, `GOOGLE_CALENDAR_ID`, `GEMINI_API_KEY` (opcional — liga o resumo).
- [ ] 🧑‍💼 **Habilitar a Google Drive API** no projeto GCP (0.6).
- [ ] 🧑‍💼 **Compartilhar a pasta "Meet Recordings"** do Drive do CEO com o e-mail da service account (`SERVICE_ACCOUNT_EMAIL`) como **Leitor** — sem isso a CF loga `transcript_access_denied` e pula.
- [ ] 🧑‍💼 Agendar (a cada 2h, min 15): `bash infra/scheduler.sh uat` (job `meeting-transcripts-job`).

---

## 8. Weekly report (`weekly-report`)

- [ ] 🧑‍💼 Env vars: `SUPABASE_*`, `WEBHOOK_SECRET`, `RESEND_API_KEY`, `BREVO_API_KEY`, `FROM_EMAIL`, `ENGINE_URL` (URL do Engine para os links do e-mail).
- [ ] 🧑‍💼 Agendar (seg 08h): `bash infra/scheduler.sh uat` (job `weekly-report-job`).

---

## 9. Re-marketing (`send-remarketing`) + WhatsApp

- [ ] 🧑‍💼 Env vars: `SUPABASE_*`, `WEBHOOK_SECRET`, `RESEND_API_KEY`, `BREVO_API_KEY`, `FROM_EMAIL`, `LOGO_URL`, `UNSUBSCRIBE_URL`, `ZAPI_INSTANCE_ID`/`ZAPI_TOKEN`/`ZAPI_CLIENT_TOKEN`, e os limites `REMKTG_*` (throttle/limite diário — têm default).
- [ ] 🧑‍💼 Agendar (a cada 15min): `bash infra/scheduler.sh uat` (job `send-remarketing-job`).
- [ ] 🧑‍💼 **Templates WhatsApp aprovados na Meta** (1–4 semanas) para envios em produção.

---

## 10. Calendar webhook + renovação de watch

- [ ] 🧑‍💼 Env vars `calendar-webhook`: `SUPABASE_*`, `WEBHOOK_SECRET`, `SERVICE_ACCOUNT_*`, `GOOGLE_CALENDAR_ID`, `CEO_WHATSAPP`, `ZAPI_*`, `SEND_WHATSAPP_URL`, `SYNC_LEADS_URL`.
- [ ] 🧑‍💼 Env vars `renew-calendar-watch`: `SERVICE_ACCOUNT_*`, `GOOGLE_CALENDAR_ID`, `CALENDAR_WEBHOOK_URL` (URL do calendar-webhook).
- [ ] 🧑‍💼 Agendar (renova a cada 6 dias): `bash infra/scheduler.sh uat` (job `renew-calendar-watch-job`).

---

## 11. Supabase (config única)

- [ ] 🧑‍💼 Criar **`user_profiles`** para CEO e Head (papel + ativo) — sem isso o login RBAC não resolve papel.
- [ ] 🧑‍💼 Configurar os **3 webhooks de INSERT** em `form_submissions` para o schema `uat` (apontando para `messenger-service-uat`, `sync-elite-leads-uat`, `lead-qualifier-uat`).
- [x] 🤖 Migrations aplicadas ⏳ (UAT no merge; PRD no go-live).

---

## 12. GitHub Secrets (CI/CD)

- [ ] 🧑‍💼 Confirmar que existem: `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`, `WEBHOOK_SECRET`, `WEBHOOK_SECRET_UAT`, `WEBHOOK_SECRET_DEV`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`.

---

## 13. Matriz de env vars por Cloud Function (referência)

> `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` + `SUPABASE_SCHEMA` + `WEBHOOK_SECRET` são comuns à maioria — abaixo listo os **específicos**.

| Função | Env vars específicas (além dos comuns) |
|---|---|
| `qualify-lead` | `GEMINI_API_KEY`, `SPREADSHEET_ID`, `SERVICE_ACCOUNT_EMAIL`, `SERVICE_ACCOUNT_PRIVATE_KEY` |
| `sync-leads` | `SPREADSHEET_ID`, `SERVICE_ACCOUNT_EMAIL`, `SERVICE_ACCOUNT_PRIVATE_KEY` |
| `send-messages` | `RESEND_API_KEY`, `BREVO_API_KEY`, `FROM_EMAIL`, `INTERNAL_EMAIL`, `LOGO_URL` |
| `send-whatsapp` | `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN` |
| `process-pending-whatsapp` | `SEND_WHATSAPP_URL`, `SEND_MESSAGES_URL`, `SYNC_LEADS_URL` |
| `process-followup-whatsapp` | `SEND_WHATSAPP_URL`, `SYNC_LEADS_URL`, `GOOGLE_CALENDAR_ID`, `SERVICE_ACCOUNT_*` |
| `process-scheduled-followups` | `SEND_WHATSAPP_URL`, `SEND_MESSAGES_URL`, `SYNC_LEADS_URL` |
| `retry-qualification` | `QUALIFY_LEAD_URL` (+ opcionais `COOLDOWN_HOURS`, `MAX_*`) |
| `calendar-webhook` | `SERVICE_ACCOUNT_*`, `GOOGLE_CALENDAR_ID`, `CEO_WHATSAPP`, `ZAPI_*`, `SEND_WHATSAPP_URL`, `SYNC_LEADS_URL` |
| `renew-calendar-watch` | `SERVICE_ACCOUNT_*`, `GOOGLE_CALENDAR_ID`, `CALENDAR_WEBHOOK_URL` |
| `meeting-transcripts` | `SERVICE_ACCOUNT_*`, `GOOGLE_CALENDAR_ID`, `GEMINI_API_KEY` (opcional) |
| `automation-engine` | `SEND_WHATSAPP_URL`, `SEND_MESSAGES_URL` |
| `billing-reminders` | `SEND_WHATSAPP_URL`, `SEND_MESSAGES_URL` |
| `sync-meta-spend` | `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `META_GRAPH_VERSION`, `META_SYNC_MESES` |
| `send-remarketing` | `ZAPI_*`, `RESEND_API_KEY`, `BREVO_API_KEY`, `FROM_EMAIL`, `LOGO_URL`, `UNSUBSCRIBE_URL`, `REMKTG_*` |
| `weekly-report` | `RESEND_API_KEY`, `BREVO_API_KEY`, `FROM_EMAIL`, `ENGINE_URL` |

> 💡 Dica: existe `infra/sync-env-uat.py` para sincronizar env vars nas funções de UAT em lote — vale usar em vez de `gcloud` uma a uma.

---

## 14. Vercel (frontend)

| Projeto | Ambiente | Env vars |
|---|---|---|
| `bolsa-atleta-crm` (Engine) | Preview (UAT) + Production (PRD) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_SCHEMA` (`uat` no Preview / omitir no PRD), **`GEMINI_API_KEY`** (novo), `SUPABASE_SERVICE_KEY`, `SEND_WHATSAPP_URL`, `WEBHOOK_SECRET`, `SERVICE_ACCOUNT_*`, `GOOGLE_CALENDAR_ID`, `CEO_WHATSAPP`, `NEXT_PUBLIC_GTM_ID` |
| `bausa-web` (site) | Preview (UAT) + Production (PRD) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_SCHEMA`, `SUPABASE_SERVICE_ROLE_KEY` (redirect `/l/[slug]` + webhooks) |

---

## 15. Promoção para PRODUÇÃO (PRD)

Só quando você validar UAT e disser **"vai pra prod"**:
- [ ] 🤖 Abro PR `develop → main` (**sem `--delete-branch`** — regra crítica).
- [ ] ⏳ Merge → deploy PRD automático (migrations no schema `public` + functions sem sufixo).
- [ ] 🧑‍💼 Replicar credenciais (GEMINI, META, etc.) nos ambientes de **produção** (Vercel Production + funções sem sufixo).
- [ ] 🧑‍💼 `bash infra/scheduler.sh prd` — cria os schedulers de produção.

---

## Resumo — o que só depende de VOCÊ (top 5 para o essencial rodar)

1. **`GEMINI_API_KEY`** no Vercel do CRM → Insights de IA.
2. **Meta token + Ad Account ID** na CF `sync-meta-spend` + `scheduler.sh` → ROI por campanha.
3. **Validar UAT** (clicar notificações/famílias/financeiro logado).
4. **Drive API + compartilhar "Meet Recordings"** → transcrições.
5. Dizer **"vai pra prod"** quando aprovar UAT.
