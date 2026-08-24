# CLAUDE.md — BAUSA

> Instruções para o agente Claude Code neste repositório.
> Para contexto completo do produto, ver `CONTEXT.md`.

---

## ⚙️ Disciplina de Engenharia (LEIA ANTES DE CODAR)

**Princípio nº 1: Regression-safe by default** — tudo que está funcional DEVE continuar funcional, provado por checklist + guard de CI.

As **skills do Claude Code** em `.claude/skills/` são carregadas automaticamente conforme o tipo de tarefa e contêm os padrões + checklists anti-regressão obrigatórios:

| Skill | Quando usar |
|---|---|
| `bausa-cloud-function` | Criar/editar função em `functions/` |
| `bausa-supabase-migration` | Criar migration em `supabase/migrations/` |
| `bausa-crm-page` | Criar/editar página/action em `apps/crm/` |
| `bausa-scheduler-safety` | Tocar em scheduler de mensageria |
| `bausa-remarketing-dispatch` | Mexer na feature de re-marketing (aba `/remarketing`, CF `send-remarketing`, tabelas `remarketing_*`) |
| `bausa-gitflow-deploy` | Commit, PR, merge, deploy |

**Índice + princípios + runbook de incidentes:** `docs/ENGINEERING.md`. **Roadmap de features:** task list do projeto + `docs/ROADMAP.md`.

---

## Identidade do Projeto

**Produto:** Bolsa Atleta USA — assessoria exclusiva para bolsas esportivas em instituições americanas.
**URL:** https://bolsaatletausa.com
**Repositório:** https://github.com/LucasDEVBA/BAUSA
**Branch principal:** `main` (nunca commitar direto — sempre feature branches)

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 |
| Componentes | shadcn/ui + Radix UI + Framer Motion |
| Formulários | React Hook Form + Zod |
| Estado servidor | TanStack Query |
| BaaS | Supabase (PostgreSQL + RLS + Webhooks) |
| Backend | Google Cloud Functions Gen2 (Node.js 20) |
| IA | Google Gemini 2.5 Flash |
| WhatsApp | Z-API |
| E-mail | Resend (primário) + Brevo (fallback) |
| CI/CD | GitHub Actions + Workload Identity Federation |
| Hospedagem | Vercel (frontend) + GCP us-central1 (functions) |

---

## Regras Inegociáveis

### Package manager
- Usar **pnpm** — monorepo com Turborepo. Não usar npm, yarn ou bun.

### TypeScript
- **strict mode está DESABILITADO** neste projeto (legado). Não habilitar sem alinhamento explícito com o usuário.
- Ainda assim, evitar `any` desnecessário.

### Git
- Conventional Commits: `feat:`, `fix:`, `style:`, `refactor:`, `perf:`, `test:`, `chore:`, `ci:`, `docs:`
- Nunca commitar direto na `main` ou `develop`
- Nunca commitar: `.env`, `.env.uat`, `.env.dev`, segredos, `node_modules`, build artifacts

### Segredos
- **NUNCA** hardcodar credenciais, API keys ou tokens
- Toda variável sensível via `.env` (frontend) ou `--update-env-vars` no deploy GCP

---

## Ambientes: DEV / UAT / PRD

```
feature/* ──────────→ develop ──────────→ main
    ↓                    ↓                  ↓
deploy manual         auto-deploy       aprovação manual
   DEV                  UAT                PRD
```

| Ambiente | Branch | Supabase Schema | GCP Functions | Vercel |
|----------|--------|-----------------|---------------|--------|
| **DEV** | `feature/*` | `dev` | `*-dev` | Preview local |
| **UAT** | `develop` | `uat` | `*-uat` | Preview Vercel |
| **PRD** | `main` | `public` | sem sufixo | Production |

**Detalhes completos:** `docs/ENVIRONMENTS.md`

---

## Git Flow

```
1. Criar branch:     git checkout -b feature/minha-feature
2. Desenvolver
3. Abrir PR para develop (CI: lint + validate)
4. Merge para develop → deploy automático em UAT
5. Validar em UAT (formulário, Cloud Functions, Sheets, WhatsApp)
6. Abrir PR de develop para main
7. Merge para main → aguardar aprovação manual em Actions
8. Aprovar → deploy PRD
```

---

## Arquitetura: Cloud Functions

Todas as funções: **Gen2**, **Node.js 20**, **us-central1**, **256Mi**, **--allow-unauthenticated** (org policy obriga).

| Pasta local | Nome PRD | Nome UAT | Trigger | Responsabilidade |
|-------------|----------|----------|---------|-----------------|
| `functions/send-messages/` | `messenger-service` | `messenger-service-uat` | Webhook Supabase INSERT | E-mails de confirmação (Resend/Brevo) |
| `functions/sync-leads/` | `sync-elite-leads` | `sync-elite-leads-uat` | Webhook Supabase INSERT | Sync → Google Sheets (cols A–BG) |
| `functions/qualify-lead/` | `lead-qualifier` | `lead-qualifier-uat` | Webhook Supabase INSERT | Qualificação IA via Gemini |
| `functions/send-whatsapp/` | `send-whatsapp` | `send-whatsapp-uat` | HTTP POST | Envio WhatsApp via Z-API (initial/followup_1/followup_2) |
| `functions/process-pending-whatsapp/` | `whatsapp-scheduler` | `whatsapp-scheduler-uat` | Cloud Scheduler (1x/hora) | Fila WhatsApp inicial — Bucket A ideal (22h, `initial`) + Bucket B timing alt (48h, `early_potential`/`late_timing`) |
| `functions/process-followup-whatsapp/` | `followup-scheduler` | `followup-scheduler-uat` | Cloud Scheduler (1x/hora) | Follow-ups 48h e 7 dias **só timing ideal** (fallback sem agendamento) |
| `functions/process-scheduled-followups/` | `process-scheduled-followups` | `process-scheduled-followups-uat` | Cloud Scheduler (diário 08:00 BRT) | Retomada `scheduled_return` em novembro p/ leads `muito_cedo` |
| `functions/retry-qualification/` | `retry-qualification` | `retry-qualification-uat` | Cloud Scheduler (diário) + HTTP `lead_id` | Reprocessa qualificação Gemini pendente/falha (também usado p/ recuperar lead órfão) |
| `functions/calendar-webhook/` | `calendar-webhook` | `calendar-webhook-uat` | Google Calendar Push Notification | Detecção instantânea de reunião + WhatsApp confirmação lead + CEO |
| `functions/renew-calendar-watch/` | `renew-calendar-watch` | `renew-calendar-watch-uat` | Cloud Scheduler (cada 6 dias) | Renova watch channel do Google Calendar |
| `functions/automation-engine/` | `automation-engine` | `automation-engine-uat` | Cloud Scheduler (1x/hora, min 30) | Engine das automações do BAU Engine (`/automacoes`): materializa gatilhos de tempo + executa runs (tarefa/notificação/WhatsApp/deal/IA) com CAS e retry. Ação `ia_prompt` (Gemini resiliente, teto 10/tick, resultado SÓ interno — notificação/tarefa) requer `GEMINI_API_KEY` (config manual). Guards CI: `tests/automation-engine-eligibility.test.js` + `tests/automation-engine-ia.test.js` |
| `functions/meeting-transcripts/` | `meeting-transcripts` | `meeting-transcripts-uat` | Cloud Scheduler (a cada 2h, min 15) | Captura a transcrição nativa do Google Meet: acha o Doc anexado ao evento do Calendar (`deals.google_calendar_event_id`), exporta via Drive API (`drive.readonly`), resume via Gemini (opcional) e grava em `reunioes_transcricoes` (idempotente por `UNIQUE(google_event_id)`). Exibida no detalhe do lead/deal no Engine |
| `functions/sync-meta-spend/` | `sync-meta-spend` | `sync-meta-spend-uat` | Cloud Scheduler (diário 06:00 BRT) | Ingestão do gasto de Meta Ads (Marketing API, `level=campaign` + `time_increment=1`, com paginação). Grava **detalhe por campanha/dia** em `meta_ads_campanha` (UNIQUE data,campanha_id) + **rollup mensal** em `investimentos_marketing` (canal=meta, source=meta_api) — fonte única dos TOTAIS do CAC/DRE. `campanha_id` cruza com `form_submissions.utm_id` p/ ROI exato. Env vars: `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `META_GRAPH_VERSION`, `META_SYNC_MESES`, `SUPABASE_*`. **Config manual** (credenciais Meta não estão em secrets). Assume conta BRL. |
| `functions/billing-reminders/` | `billing-reminders` | `billing-reminders-uat` | Cloud Scheduler (diário 09:00 BRT) | Régua de cobrança (D-3 a D+15) sobre `parcelas` previsto/atrasado de contrato ativo. 1 marco por parcela/tick, CAS por coluna `regua_<marco>_at` (idempotente). **NÃO é outreach de lead** — não usa classe Gemini; elegibilidade = parcela em aberto + contrato ativo + marco não enviado. Texto editável em `regua_mensagens`. Envia via `send-whatsapp` (custom) + `send-messages` (customEmail); notifica CEO no D+7/D+15. Guard CI: `tests/billing-reminders-invariants.test.js`. **Nasce pausada.** |
| `functions/calendar-lead-events/` | `calendar-lead-events` | `calendar-lead-events-uat` | HTTP POST (Engine, `x-webhook-secret` obrigatório) | **Read-only** (`calendar.readonly`): lista os eventos do Calendar do CEO que casam com UM lead (attendee por e-mail OU telefone tail-10 na descrição — mesmo matching do `calendar-webhook`), janela −180d/+120d, flag `temTranscricaoAnexada`. Usado pela UI de **relink** da aba Reunião (`reunioes-relink.ts`): CEO enxerga todas as reuniões do lead e religa o deal ao evento correto pós-remarcação. Env vars Google = **config manual pós-1º deploy** (copiar da `calendar-webhook`). Engine: `CALENDAR_LEAD_EVENTS_URL` no Vercel. |
| `functions/fluxo-engine/` | `fluxo-engine` | `fluxo-engine-uat` | HTTP POST (borda: `zapi-inbox`/`instagram-webhook`) + Cloud Scheduler (1x/hora) | Motor dos **Fluxos** (`/fluxos` — o "ManyChat próprio"). Canal-agnóstico: o mesmo fluxo roda WhatsApp e Instagram. Casa o gatilho, cria/retoma execução com CAS (`lock_until` + `UNIQUE(fluxo_id, contato_id, dedupe_key)`), executa a cadeia de blocos e grava tudo em `fluxo_eventos` (fonte única das métricas). **Duas travas independentes de envio:** (1) `CANAIS_ENVIO` derivado da presença das env vars — sem `INSTAGRAM_TOKEN` o canal IG não envia; (2) gate `fluxos_escopo` em `configuracoes_sistema` (`desligado`/`lista`/`global`), **fail-closed** — erro de leitura = desligado. Guard CI: `tests/fluxo-engine-invariants.test.js` |
| `functions/instagram-webhook/` | `instagram-webhook` | `instagram-webhook-uat` | Webhook Meta (GET handshake + POST assinado) | Borda de entrada do Instagram. **Público por exigência da Meta** (não pode ter secret na URL) — a assinatura **HMAC SHA-256 sobre o corpo CRU** (`req.rawBody`, `timingSafeEqual`) é a única prova de origem, **fail-closed sem `INSTAGRAM_APP_SECRET`**. Traduz comentário/DM/story/menção em evento e repassa ao `fluxo-engine`. **Nunca envia mensagem** (quem envia é a engine, que tem os dois gates). Ignora eventos da própria conta (anti-loop). Guard CI: `tests/instagram-webhook-invariants.test.js` |

**Auth entre serviços:** header `x-webhook-secret` em todos os webhooks.

**Schema por ambiente:** `SUPABASE_SCHEMA` env var nas funções: `public` (PRD), `uat` (UAT), `dev` (DEV).
- Headers REST: `Accept-Profile` para GETs, `Content-Profile` para PATCHes.

**Padrão de log:** JSON estruturado em todas as funções:
```js
console.log({ level: 'info', action: 'qualify_lead', submissionId, classification })
```

---

## Banco de Dados: `form_submissions`

**Schemas:** `public` (PRD), `uat` (UAT), `dev` (DEV) — mesma estrutura em todos.
**Chave única:** `UNIQUE(email, athlete_name)` — mesmo atleta não duplica.

**Colunas de qualificação críticas:**
- `qualified` (boolean)
- `qualification_classification` — `QUENTE`, `MORNO` ou `FRIO`
- `qualification_reason` — justificativa 2–4 frases
- `qualified_at` (timestamptz)
- `whatsapp_sent_at` (timestamptz) — preenchido mesmo em falha (evita loop infinito)

**Colunas de follow-up (migration `20260308131630`):**
- `followup_1_sent_at` (timestamptz) — quando o follow-up de 48h foi enviado
- `followup_2_sent_at` (timestamptz) — quando o follow-up de 7 dias foi enviado
- `meeting_scheduled` (boolean) — reunião detectada via Google Calendar API
- `meeting_scheduled_at` (timestamptz) — quando a reunião foi detectada

**Coluna internacional (migration `20260314000000`):**
- `address_country` (text, default `'BR'`) — país do lead (código ISO 3166-1 alfa-2)

**Colunas de timing (migration `20260515000000`):**
- `timing_status` — `ideal` (default), `muito_cedo` (`school_year=before_7th`) ou `tarde_demais` (`school_year=graduated_2plus`)
- `scheduled_followup_at` (timestamptz) — só `muito_cedo`: 1º nov do ano civil seguinte (retoma contato)
- `scheduled_followup_sent_at` (timestamptz) — quando o `scheduled_return` foi enviado
- Enum `status_deal` ganhou valor `aguardando_timing` (entre `lead` e `reuniao_marcada`)

**Colunas de aprovação manual (migration `20260810193531`):**
- `aprovacao_status` — `pendente` | `aprovado` | `reprovado` (NULL = FRIO ou pré-feature)
- `aprovacao_decidida_por` (uuid), `aprovacao_decidida_em` (timestamptz), `aprovacao_motivo` (text)
- **Gate humano (2026-08-10):** QUENTE/MORNO nascem `pendente` na CF `qualify-lead` (sem auto-promoção)
  e só entram no pipeline + outreach após `aprovarLead` no Engine (fila no War Room/Leads).
  Reprovado = sem pipeline, sem mensagens. Toggle `aprovacao_manual` em /automacoes
  (desligado = fluxo 100% automático antigo). FRIO nunca entra na fila.

> ⚠️ **INVARIANTE CRÍTICO (incidentes 2026-05-15/18):** todo scheduler de
> elegibilidade DEVE filtrar `qualification_classification IN (QUENTE,MORNO)`
> **E** o `timing_status` correto **E** (desde 2026-08-10) `aprovacao_status = 'aprovado'`
> nos buckets de outreach inicial/retomada. O guard `tests/scheduler-eligibility.test.js`
> (job CI `Scheduler Eligibility Invariants`) bloqueia o merge se um filtro sumir.
> Fluxo `ideal` ≠ fluxo `muito_cedo`/`tarde_demais` — nunca devem se misturar.

**Regra de negócio — fila WhatsApp inicial — Bucket A timing ideal (22h):**
```sql
qualification_classification IN ('QUENTE', 'MORNO')
AND qualified_at IS NOT NULL
AND qualified_at < NOW() - INTERVAL '22 hours'
AND whatsapp_sent_at IS NULL
AND (timing_status IS NULL OR timing_status = 'ideal')   -- template: initial
AND aprovacao_status = 'aprovado'                        -- gate humano
```

**Regra de negócio — fila WhatsApp — Bucket B timing alternativo (48h):**
```sql
qualification_classification IN ('QUENTE', 'MORNO')   -- FRIO nunca recebe
AND qualified_at < NOW() - INTERVAL '48 hours'
AND whatsapp_sent_at IS NULL
AND timing_status IN ('muito_cedo', 'tarde_demais')
AND aprovacao_status = 'aprovado'                     -- gate humano
-- muito_cedo  → template early_potential + deal etapa aguardando_timing
-- tarde_demais → template late_timing  + deal etapa perdido (motivo_perda=timing)
```

**Regra de negócio — follow-up 1 (48h):**
```sql
qualification_classification IN ('QUENTE', 'MORNO')
AND whatsapp_sent_at < NOW() - INTERVAL '48 hours'
AND followup_1_sent_at IS NULL
AND meeting_scheduled IS NOT TRUE
AND (timing_status IS NULL OR timing_status = 'ideal')   -- timing alt NÃO recebe follow-up
```

**Regra de negócio — follow-up 2 (7 dias):**
```sql
qualification_classification IN ('QUENTE', 'MORNO')
AND whatsapp_sent_at < NOW() - INTERVAL '7 days'
AND followup_1_sent_at IS NOT NULL
AND followup_2_sent_at IS NULL
AND meeting_scheduled IS NOT TRUE
AND (timing_status IS NULL OR timing_status = 'ideal')
```

**Regra de negócio — scheduled_return (retomada em novembro, só `muito_cedo`):**
```sql
timing_status = 'muito_cedo'
AND scheduled_followup_at <= NOW()
AND scheduled_followup_sent_at IS NULL
AND aprovacao_status = 'aprovado'   -- gate humano
-- cron process-scheduled-followups-daily → template scheduled_return
```

> Follow-ups 1/2 não filtram `aprovacao_status` diretamente: exigem
> `whatsapp_sent_at IS NOT NULL`, que só acontece após aprovação.

---

## Google Sheets — Layout (Página1, colunas A–BG)

Colunas críticas para matching de linha (identificação de duplicatas):
- **Col E (índice 4):** `athlete_name` ⭐
- **Col I (índice 8):** `email` ⭐

Colunas de qualificação (preenchidas por `qualify-lead`):
- **Col A (índice 0):** Qualificado SIM/NÃO
- **Col B (índice 1):** Motivo da qualificação

Colunas de endereço:
- **Cols AG–AM:** CEP, Rua, Número, Complemento, Bairro, Cidade, UF
- **Col AV:** País (`address_country`, ISO 3166-1 alfa-2, default `BR`)

Colunas de status de comunicação:
- **Col AN:** WhatsApp enviado SIM/NÃO | **Col AO:** Data envio WhatsApp
- **Col AP:** Follow-up 1 enviado SIM/NÃO | **Col AQ:** Data Follow-up 1
- **Col AR:** Follow-up 2 enviado SIM/NÃO | **Col AS:** Data Follow-up 2
- **Col AT:** Reunião agendada SIM/NÃO | **Col AU:** Data detecção reunião

Colunas de tracking e atribuição (preenchidas pelo formulário):
- **Col AW:** UTM Source | **Col AX:** UTM Medium | **Col AY:** UTM Campaign
- **Col AZ:** UTM Content | **Col BA:** UTM Term
- **Col BB:** Referrer URL | **Col BC:** Landing URL
- **Col BD:** Session ID | **Col BE:** CTA Source (hero/final/header)
- **Col BF:** Device Type (mobile/tablet/desktop) | **Col BG:** Form Started At

---

## Frontend: Páginas

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/Index.tsx` | Landing page — 13 seções com lazy loading, totalmente traduzida (PT/EN/ES) |
| `src/pages/Forms.tsx` | Formulário multi-etapas (~1450 linhas, 14 steps, Zod, suporte internacional) |
| `src/pages/Links.tsx` | Hub de links (Instagram, YouTube, etc.), traduzida (PT/EN/ES) |
| `src/pages/NotFound.tsx` | Página 404 |

**Internacionalização (i18n):**
- Sistema próprio via React Context: `src/i18n/index.tsx` + `LanguageProvider`
- 3 idiomas: PT 🇧🇷, EN 🇺🇸, ES 🇪🇸 — arquivos `src/i18n/translations/{pt,en,es}.ts`
- Hook `useLanguage()` + função `t("chave.aninhada")` em todos os componentes
- `LanguageSelector` no Header (desktop + mobile) e no Forms

**Ordem das seções em Index.tsx:**
Header → HeroSection → UniversityCarousel → WhatIsEEISection → SAFEMethodSection → TestimonialsCarousel → WhyHighSchoolSection → HowWeWorkSection → FounderSection → InstitutionalRecognitionSection → ParentTestimonialsSection → FinalCTA → Footer

**Formulário (Forms.tsx — 14 steps):**
- Step 0: Intro Stage 1
- Step 1: Dados atleta (nome/data/whatsapp/série) — WhatsApp via `FormPhoneInput` (internacional)
- Step 2: Escola (escola/cidade/modelo)
- Step 3: Esporte (posição/clubes/conquistas/instagram/vídeo)
- Step 4–5: Auto-advance (momento início, direção projeto)
- Step 6: Intro Stage 2
- Step 7: Acadêmico (desempenho/inglês)
- Step 8–11: Auto-advance (comportamental, comprometimento, decisão familiar, investimento)
- Step 12: Dados responsável — Telefone via `FormPhoneInput` (internacional)
- Step 13: Endereço — `CountrySelect` + fluxo BR (CEP/ViaCEP) ou internacional (cidade + postal code opcional)

**Padrões do formulário:**
- Estado salvo em localStorage: chave `bolsa_atleta_form_draft_v2`
- Supabase client importado dinamicamente dentro do `onSubmit` (evita erro de hydration)
- Schema-awareness: `VITE_SUPABASE_SCHEMA` determina schema usado no upsert
- Upsert com `onConflict: 'email,athlete_name'`
- Campo `country` (default `'BR'`) com validação condicional via Zod `superRefine`
- `address_country` enviado ao Supabase em todos os casos

---

## Qualificação Gemini — Classificador v2 (2026-08-25)

Spec "Classificador Automático de Leads v1.0" — prompt VERSIONADO no código
(`SYSTEM_PROMPT_V2` em `functions/qualify-lead`, `prompt_version`), score
auditável 0-100 por **TIER de profissão** (A=70 / B=45 / C=20) + sinais de
reforço/alerta, **5 estados** de classificação e **segunda passagem**
adversarial na faixa do meio. Guard: `tests/qualificacao-v2-invariants.test.js`.

| Estado | Significado |
|--------|-------------|
| QUENTE | score ≥ corte_quente (default 70) |
| MORNO | corte_frio ≤ score < corte_quente (passa por auditoria adversarial) |
| FRIO | score < corte_frio (default 40) — pessoa real, baixa plausibilidade |
| INVALIDO | dado sujo (regex em código = gate duro) ou injeção de prompt |
| INCOMPLETO | profissão/faixa ausentes |

- **INVALIDO/INCOMPLETO nunca são "qualificados"** (`qualified` = só QUENTE/
  MORNO) e ficam fora de pipeline/outreach (schedulers filtram IN (QUENTE,MORNO)).
- **Prioridade estratégica** (ALTA/MEDIA/PADRAO) é eixo ESPORTIVO independente —
  nunca altera o score financeiro (lead FRIO + prio ALTA = rota bolsa/parceria).
- Campos gravados: `score_financeiro`, `tier_profissao`, `sinais_reforco`,
  `sinais_alerta`, `prioridade_estrategica`, `acao_recomendada`,
  `prompt_version`, `desfecho_real` (loop de aprendizado — setado pelo
  moverDeal em contrato_assinado+/perdido).
- **Config `qualificacao_v2`** (editável em /automacoes): `cotacao_usd`
  (atualizar semanalmente), `renda_minima_mensal`, `corte_ibge`,
  `corte_quente`, `corte_frio`, `system_prompt` (override; vazio = código).
  Os CORTES mandam na faixa — funil ajustável sem mexer em prompt.
- Dados do lead entram sanitizados entre `<dados_lead>` (anti-injeção;
  tentativa de instrução → INVALIDO).
- **Requalificação em massa**: `retry-qualification` modo
  `{mode:'requalify', cutoff:ISO, limit}` — cursor por `qualified_at`,
  retomável; decisão humana (aprovado/reprovado) NUNCA sobrescrita.

**Config Gemini obrigatória (v2):**
```js
temperature: 0,          // spec: não negociável
maxOutputTokens: 2048,   // 600 da spec truncaria (thinking do 2.5-flash)
responseMimeType: 'application/json'
```

---

## Faixas de Investimento — Mapeamento

| Código | Valor formatado |
|--------|----------------|
| `15k-20k` | US$ 15.000 a US$ 20.000/ano ≈ R$ 7.500 a R$ 10.000/mês |
| `20k-30k` | US$ 20.000 a US$ 30.000/ano ≈ R$ 10.000 a R$ 15.000/mês |
| `30k-40k` | US$ 30.000 a US$ 40.000/ano ≈ R$ 15.000 a R$ 20.000/mês |
| `40k-50k` | US$ 40.000 a US$ 50.000/ano ≈ R$ 20.000 a R$ 25.000/mês |
| `50k-70k` | US$ 50.000 a US$ 70.000/ano ≈ R$ 25.000 a R$ 35.000/mês |
| `over-70k` | Acima de US$ 70.000/ano ≈ acima de R$ 35.000/mês |

---

## Comandos Úteis

```bash
# Desenvolvimento (monorepo pnpm + Turborepo)
pnpm dev              # Dev server ambos os apps
pnpm dev:web          # Só site público (localhost:3000)
pnpm dev:engine       # Só BAUSA Engine
pnpm build            # Build produção
pnpm lint             # ESLint

# Supabase
supabase link --project-ref nikrlikwghqcxcjzthmc
supabase db push
supabase functions deploy form-handler

# Cloud Scheduler (aceita dev, uat, prd — sem argumento = prd)
bash infra/scheduler.sh prd   # PRD (produção)
bash infra/scheduler.sh uat   # UAT (staging)
bash infra/scheduler.sh dev   # DEV (testes)

# Deploy manual de emergência — Cloud Function PRD
gcloud functions deploy lead-qualifier \
  --gen2 --runtime=nodejs20 --region=us-central1 \
  --source=functions/qualify-lead \
  --entry-point=qualifyLead \
  --trigger-http --allow-unauthenticated \
  --timeout=120s --memory=256Mi \
  --update-env-vars WEBHOOK_SECRET=$WEBHOOK_SECRET \
  --project=elite-portal-forms

# Pausar/reativar schedulers de produção (emergência)
gcloud scheduler jobs pause process-followup-job --location=us-central1 --project=elite-portal-forms
gcloud scheduler jobs pause process-whatsapp-job --location=us-central1 --project=elite-portal-forms
gcloud scheduler jobs resume process-followup-job --location=us-central1 --project=elite-portal-forms
gcloud scheduler jobs resume process-whatsapp-job --location=us-central1 --project=elite-portal-forms

# SQL — resetar fila WhatsApp (emergência)
# UPDATE public.form_submissions SET whatsapp_sent_at = NOW()
# WHERE whatsapp_sent_at IS NULL AND qualified_at IS NOT NULL
# AND qualification_classification IN ('QUENTE', 'MORNO');

# Limpar dados de UAT/DEV (sem impacto em PRD)
# TRUNCATE TABLE uat.form_submissions;
# TRUNCATE TABLE dev.form_submissions;
```

---

## Deploy CI/CD

| Workflow | Trigger | Ambiente | Aprovação |
|----------|---------|----------|-----------|
| `ci.yml` | PR para main/develop | — | Auto |
| `deploy-functions-uat.yml` | Push develop + functions/** | UAT | Auto |
| `deploy-supabase-uat.yml` | Push develop + supabase/** | UAT | Auto |
| `deploy-functions.yml` | Push main + functions/** | PRD | Auto (branch policy: só `main`) |
| `deploy-supabase.yml` | Push main + supabase/** | PRD | Auto (branch policy: só `main`) |

> **Branch policy (2026-05-18):** environment `prd` só deploya de `main`, `uat` só de `develop`. **Não há required reviewers** (decisão consciente — ver Pendências). O gate de qualidade é o CI + review de PR + validação UAT.

> **Gitflow — nunca use `--delete-branch` em PR `develop→main`** (a flag deleta a HEAD do PR, que é `develop`, branch permanente — incidente 2026-05-17, develop foi restaurado de main). `--delete-branch` só em feature branches.

### Guard de invariantes dos schedulers (anti-regressão)

Job CI **`Scheduler Eligibility Invariants`** (`tests/scheduler-eligibility.test.js`, `node:test` zero-deps) bloqueia o merge se `process-pending-whatsapp` ou `process-followup-whatsapp` deixar de filtrar `qualification_classification IN (QUENTE,MORNO)` ou o `timing_status` correto. Criado após 2 incidentes da mesma classe (filtro de elegibilidade ausente). Rodar local: `node --test tests/*.test.js`.

**IMPORTANTE:** Usar `--update-env-vars` (nunca `--set-env-vars`) para não sobrescrever variáveis existentes na função.

---

## Variáveis de Ambiente — Referência Rápida

### Frontend (Vercel — bausa-web)
- `NEXT_PUBLIC_SUPABASE_URL` — URL do projeto Supabase
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Anon key pública
- `NEXT_PUBLIC_SUPABASE_SCHEMA` — `uat` em Preview, omitir em PRD (usa `public`)
- `NEXT_PUBLIC_GTM_ID` — Google Tag Manager (`GTM-5J87JXSR`)
- `SERVICE_ACCOUNT_EMAIL` + `SERVICE_ACCOUNT_PRIVATE_KEY` — Google Calendar API (agendamento)
- `GOOGLE_CALENDAR_ID` — Calendar do CEO
- `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` — API route /agendar (server-side)
- `SEND_WHATSAPP_URL` + `WEBHOOK_SECRET` — Envio WhatsApp via Cloud Function
- `MEETING_TRANSCRIPTS_URL` — CF meeting-transcripts (transcrição sob demanda na aba Reunião; sem ela a UI degrada com erro claro)
- `CEO_WHATSAPP` — Número do CEO para notificações (`5571991461565`)

### Cloud Functions (GCP)
- `WEBHOOK_SECRET` — todas as funções (diferente por ambiente: `_UAT`, `_DEV`)
- `SUPABASE_SCHEMA` — `public` em PRD, `uat` em UAT, `dev` em DEV
- `GEMINI_API_KEY` — qualify-lead; automation-engine (opcional — habilita a ação de IA `ia_prompt`; sem ela o run marca erro claro)
- `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` — qualify-lead, process-pending, process-followup, calendar-webhook, meeting-transcripts
- `SPREADSHEET_ID` + `SERVICE_ACCOUNT_EMAIL` + `SERVICE_ACCOUNT_PRIVATE_KEY` — qualify-lead, sync-leads, calendar-webhook, renew-calendar-watch
- `ZAPI_INSTANCE_ID` + `ZAPI_TOKEN` + `ZAPI_CLIENT_TOKEN` — send-whatsapp, calendar-webhook
- `RESEND_API_KEY` + `BREVO_API_KEY` + `FROM_EMAIL` + `INTERNAL_EMAIL` + `LOGO_URL` — send-messages
- `SEND_WHATSAPP_URL` + `SYNC_LEADS_URL` — process-pending, process-followup, calendar-webhook
- `GOOGLE_CALENDAR_ID` + `SERVICE_ACCOUNT_EMAIL` + `SERVICE_ACCOUNT_PRIVATE_KEY` — process-followup, calendar-webhook, renew-calendar-watch, meeting-transcripts (+ `GEMINI_API_KEY` opcional p/ resumo)
- `CEO_WHATSAPP` — calendar-webhook (notificação ao CEO)
- `CALENDAR_WEBHOOK_URL` — renew-calendar-watch (URL do webhook para registrar no Google)
- `FLUXO_ENGINE_URL` — zapi-inbox, instagram-webhook (borda → motor de fluxos)
- `INSTAGRAM_TOKEN` + `INSTAGRAM_APP_SECRET` + `IG_USER_ID` + `INSTAGRAM_VERIFY_TOKEN` — instagram-webhook, fluxo-engine. **Config manual** (dependem do App Review + geração de token no console da Meta). **Ausentes = canal IG não envia** — é o gate de canal, não um bug.
  - `IG_USER_ID` aceita **lista separada por vírgula** e deve conter os **dois** ids da conta: o profissional (`user_id`, ex. `17841453972885804`) e o de escopo de app (`id`, ex. `28151758617769310`). Pegue os dois de uma vez: `GET graph.instagram.com/v23.0/me?fields=id,user_id`. A doc da Meta se contradiz sobre qual chega em `entry.id` — por isso aceitamos os dois.
  - ⚠️ **Sem `IG_USER_ID` o webhook descarta todo evento** (fail-closed do anti-loop, log `ig_user_id_ausente`). É proposital: sem saber quem somos, qualquer evento pode ser o eco da nossa própria mensagem e a conta passa a conversar sozinha. Mas **é config obrigatória em PRD** — o CI não injeta essa env var.

### GitHub Secrets
- `GCP_WORKLOAD_IDENTITY_PROVIDER` + `GCP_SERVICE_ACCOUNT` — deploy WIF
- `WEBHOOK_SECRET` — PRD
- `WEBHOOK_SECRET_UAT` — UAT
- `WEBHOOK_SECRET_DEV` — DEV
- `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_ID` — migrations

---

## Infraestrutura

| Item | Valor |
|------|-------|
| GCP Project ID | `elite-portal-forms` |
| Região GCP | `us-central1` |
| Supabase Project ID | `nikrlikwghqcxcjzthmc` |
| Frontend | Vercel (free tier) |

## Projetos Relacionados

| Projeto | Localização | Propósito |
|---------|-------------|-----------|
| **BAUSA Engine** | `apps/crm` | Plataforma de operações (Next.js 16, dark theme, Recharts) — consome o mesmo Supabase |
| **Site Público** | `apps/web` | Landing page + Formulário + i18n (PT/EN/ES) |
| **Cloud Functions** | `functions/` | 8 funções GCP Gen2 (emails, sheets, qualificação, WhatsApp, calendar webhook) |
| **Database** | `packages/database` | Tipos, actions e auth compartilhados |

O BAUSA Engine é a plataforma de operações usada pelo CEO/Head. Compartilha o mesmo banco Supabase e usa os mesmos server actions. Documentação específica: `apps/crm/CLAUDE.md`.

---

## Roadmap — Status Atual

**Ver `docs/ROADMAP.md` para detalhes completos de cada fase.**

| Fase | Descrição | Status |
|------|-----------|--------|
| ✅ DEV/UAT/PRD | Ambientes isolados com schemas Supabase + aprovação PRD | Implementado 2026-03-09 |
| ✅ **i18n PT/EN/ES** | Sistema completo de internacionalização no frontend | Implementado 2026-03-14 |
| ✅ **Suporte Internacional** | Formulário com telefone E.164, country select e endereço adaptativo | Implementado 2026-03-14 |
| ✅ **CRM Fase 1 — Base** | Auth RBAC, schema CRM (20 migrations), audit trail, configurações | Implementado 2026-04-01 |
| ✅ **CRM Fase 2 — Comercial** | Lead Score, Pipeline Kanban, Contratos, Tarefas, Notificações | Implementado 2026-04-01 |
| ✅ **CRM Fase 3 — Experiência** | CRM pós-venda, handoff automático, temperatura, escalonamento | Implementado 2026-04-01 |
| ✅ **CRM Fase 4 — Inteligência** | Banco de Escolas, Motor de Match SQL, estratégias por atleta | Implementado 2026-04-01 |
| ✅ **CRM Fase 5 — War Room** | Dashboard executivo, KPIs, alertas automáticos, relatórios | Implementado 2026-04-01 |
| ✅ **CRM Fase 6 — Integrações** | WhatsApp manual, convite reunião, calendário, estrutura completa | Implementado 2026-04-01 |
| ✅ **CRM Fase 7 — Complementos** | Documentos, FAQ (10 artigos seed), indicações, configurações admin | Implementado 2026-04-01 |
| ✅ **Tracking & Pixels** | GTM + GA4 + Meta Pixel + UTM capture + form events + CTA tracking | Implementado 2026-04-10 |
| ✅ **SEO Multilíngue** | Metadata traduzida PT/EN/ES, og:locale, hreflang, BreadcrumbList JSON-LD | Implementado 2026-04-10 |
| ✅ **Lead Attribution** | 11 colunas tracking no Supabase + Sheets (AW-BG), analytics no Engine | Implementado 2026-04-10 |
| ✅ **Calendar Webhook** | Detecção instantânea de reunião + WhatsApp confirmação lead + CEO | Implementado 2026-04-10 |
| ✅ **UTM Generator** | Gerador de links UTM no Engine com 10 presets | Implementado 2026-04-10 |
| ✅ **Classificação por Timing** | 3 fluxos por `school_year`: ideal (normal), `muito_cedo` (early_potential + retomada nov), `tarde_demais` (late_timing + perdido). Coluna `aguardando_timing` no Pipeline | Implementado 2026-05-15 |
| ✅ **Guard anti-regressão schedulers** | CI `node:test` que bloqueia merge se filtro classe/timing sumir dos schedulers (após 2 incidentes) | Implementado 2026-05-18 |
| ✅ **Engine: Design System Apple + Meu Perfil + Gestão de Usuários** | Tema claro/escuro + liquid glass; `/perfil` (nome/senha/foto via Storage `avatars`); aba Usuários em Configurações (CEO cria/edita papel/ativo) | Implementado 2026-06 |
| ✅ **Papel `cto` (= CEO)** | Papel RBAC com permissões idênticas ao CEO — `getUserPapel()`/`get_user_papel()` resolvem `cto→ceo`; distinto só na exibição (migration `20260619034922`) | Implementado 2026-06-19 |
| ✅ **Redesign2 premium (todas as telas)** | Design system v2 light-first (brandbook BAU) propagado a TODAS as telas do Engine: PageHeader (dense+HeaderMenu ⋯ nas dashboards), StatCard, Card glass, ScrollList (listas em card de altura fixa), hub `/sistema`, tipografia −2px/spacing enxuto | Implementado 2026-07 (PRs #157–#168) |
| ✅ **Automações (builder + engine + runs)** | `/automacoes`: builder gatilho→condições→ações (CEO); CF `automation-engine` (Cloud Scheduler 1x/h min 30) executa com CAS duplo (run + lead `*_sent_at`), retry/backoff, órfãos/zumbis, anti-ban, loop-guard; aba Execuções com KPIs + replay. Migration `20260703232151` (+ fix latente do `audit.log_change` p/ tabelas sem `id`). Guard CI `tests/automation-engine-eligibility.test.js` | Implementado 2026-07-04 (PRs #169–#172); pendente UAT: env vars da CF + `scheduler.sh uat` |
| ✅ **Observabilidade TOTAL** | Pós-incidente Z-API 2026-07-15/17 ("ausência de erro ≠ funcionando"): tela `/observabilidade` (3 abas: Monitor de filas, Geral, Saúde das automações), CF `monitor-health` v2 (18 checks automáticos 30min, paridade travada por guard, alerta WhatsApp+in-app+**E-MAIL** independente da Z-API), sinais novos (`calendar_watch_state`, `form_submissions.sheets_synced_at` CAS, `weekly_report_state`, `billing_last_tick_at`), **dead-man's switch** (`.github/workflows/deadman-monitor.yml` — vigia o vigia via anon key + policy restrita; ativa na main), **auto-instrumentação** (criar automação = nascer vigiada; `sla_horas` opcional). Supressão consciente via `monitor_checks_desativados`. Guards: `monitor-health/deadman/automacoes-saude/observabilidade-invariants` | Implementado 2026-07-20 (PRs #279–#286) |
| ✅ **Plataforma de Agents (UI)** | Tabela `agents` (capacidades: conversa/automacao/analise/chatbot_autonomo; prompt 10-4000; RLS ceo+head select, ceo write), CRUD em `/agents` ("Seus agents"), 4 integrações com fallback garantido: copiloto de conversa selecionável, análise sob demanda (CEO), `agent_id` em `ia_prompt`/`ia_condicao` (prompt inline continua OBRIGATÓRIO = fallback), agent por conversa no chatbot autônomo (**substitui SÓ a persona — critério de segurança global intocável**). Guard `tests/agents-invariants.test.js` | Implementado 2026-07-20 (PRs #283, #287) |
| ✅ **Fluxos — o "ManyChat próprio"** | `/fluxos`: motor canal-agnóstico (11 gatilhos × 12 tipos de bloco), builder de perguntas encadeadas, métricas derivadas de `fluxo_eventos` (append-only), sugestão/diagnóstico por IA, agents plugáveis. CFs `fluxo-engine` + `instagram-webhook`; entrada WhatsApp pelo `zapi-inbox`. **Métrica-rei = captura** (o ManyChat deles tinha 213 disparos e 0 capturas). WhatsApp ativo; Instagram atrás do App Review. Guards `tests/fluxo-engine-invariants.test.js` + `tests/instagram-webhook-invariants.test.js` | Implementado 2026-08-13 (PRs #326–#329) |
| 🔜 **CAC Meta API** | Custo de Aquisição via Meta Marketing API | Planejado (ver `docs/IMPROVEMENTS.md`) |
| 🔜 **next/image** | Migrar `<img>` para `next/image` (Core Web Vitals) | Planejado |

---

## CRM — Resumo Técnico

### Tabelas do Banco (20 tabelas CRM + form_submissions)

| Tabela | Descrição | Linhas-chave |
|--------|-----------|-------------|
| `user_profiles` | Perfis e papéis (ceo/cto/head_sucesso/comercial; `cto` = mesmas permissões de `ceo`) | papel, ativo |
| `audit_logs` | Trail imutável (sem UPDATE/DELETE) | tabela, operacao, dados_anteriores/novos |
| `configuracoes_sistema` | Configurações CEO (17 chaves seed) | chave, valor (JSONB) |
| `responsaveis` | Responsáveis financeiros (dedup por whatsapp) | whatsapp UNIQUE, profissao |
| `enderecos` | Endereços (BR + internacional) | pais, cep, cidade, estado |
| `atletas` | Leads CRM com score automático (0-100) + qualificação Gemini separada | lead_score, lead_classificacao, form_submission_id |
| | ↳ Campos Gemini: `qualificado_gemini`, `classificacao_gemini`, `motivo_gemini` | |
| `deals` | Pipeline com 16 etapas + dados de reunião | etapa, next_action, data_proxima_acao, motivo_perda |
| | ↳ Campos reunião: `reuniao_agendada_at`, `reuniao_link`, `reuniao_data` | |
| `contratos_financeiros` | Contratos (1:1 com deal) | plano, valor_total, saldo_remanescente (GENERATED) |
| `parcelas` | Parcelas de pagamento | vencimento, status, metodo |
| `crm_experiencia` | Experiência pós-venda (1:1 com atleta) | temperatura (auto), ansiedade, satisfacao |
| `contatos_experiencia` | Timeline de contatos família | tipo, resumo, proximo_contato |
| `escolas` | Banco de escolas USA (40+ campos) | taxa_aceitacao (GENERATED), temperatura_relacionamento |
| `estrategia_escolas` | Match por par atleta-escola | match_score, resultado |
| `historico_contatos_escola` | Timeline contatos com escolas | tipo, resumo |
| `tarefas` | Tarefas com prioridade | prazo, prioridade, criada_automaticamente |
| `notificacoes` | Notificações in-app | severidade, lida, espelhada ao CEO |
| `documentos_atleta` | Checklist de documentos | status workflow (5 etapas) |
| `faq_artigos` | Base de conhecimento (10 seed) | categoria, acessos |
| `indicacoes` | Programa de indicação | recompensa_devida, recompensa_entregue |
| `fluxos` | Fluxos de conversa (`/fluxos`) | canal, gatilho, `ativo` (nasce FALSE), limite_hora, reentrada_horas |
| `fluxo_blocos` | Nós do fluxo (perguntas encadeadas) | tipo, conteudo (JSONB), proximo_id, ramos |
| `fluxo_contatos` | Contatos por canal (WhatsApp/IG) | externo_id, tags, campos |
| `fluxo_execucoes` | Uma por contato que entrou | status, bloco_atual_id, `lock_until` (CAS), UNIQUE(fluxo_id, contato_id, dedupe_key) |
| `fluxo_eventos` | Trilha append-only | **fonte única das métricas** — funil por bloco sai daqui |

> ⚠️ **DUAS travas independentes de envio nos Fluxos.** (1) `fluxos.ativo` — nasce
> `FALSE`, como as automações. (2) Gate global `fluxos_escopo` em
> `configuracoes_sistema`: `desligado` (padrão) → `lista` (só os IDs listados) →
> `global`. A leitura é **fail-closed**: erro ao ler o gate = `desligado`.
> Ligar o fluxo **não** basta; ligar o escopo **não** basta. Isso é de propósito —
> o CEO pediu explicitamente controle de "quando eu quiser, chat/grupo específico
> ou global". Nunca "simplifique" removendo uma das duas.

### Funções SQL Críticas

| Função | Propósito |
|--------|-----------|
| `calcular_lead_score(atleta_id)` | Score 0-100 com 7 critérios ponderados |
| `calcular_match_score(atleta_id, escola_id)` | Match 0-100 com filtros eliminatórios + scoring |
| `sugerir_escolas(atleta_id, limite)` | Top N escolas por score |
| `familias_em_alerta_inatividade()` | Famílias excedendo threshold por fase |
| `trg_experiencia_temperatura()` | Auto-calcula verde/amarelo/vermelho |
| `trg_deals_check_etapa()` | Detecta retrocesso + seta timestamps |
| `audit.log_change()` | Trigger genérico de auditoria em 17 tabelas |

### Páginas CRM (14 rotas)

| Rota | Acesso | Componentes Principais |
|------|--------|----------------------|
| `/crm/war-room` | CEO | MetricCard, GoalProgressCard, AlertsPanel, WarRoomSectionCard |
| `/crm/relatorios` | CEO | Tabs (Comercial/Financeiro/Experiência/Escolas) |
| `/crm/leads` | CEO | LeadsTable, LeadStatusBadge, detail sheet |
| `/crm/pipeline` | CEO | KanbanBoard, KanbanColumn, DealCard, DealModal |
| `/crm/financeiro` | CEO | MetricCard, ContratoPanel |
| `/crm/escolas` | CEO | EscolasList, EscolaModal |
| `/crm/matching` | CEO | Tabelas de estratégia + grid de atletas |
| `/crm/experiencia` | CEO + Head | ExperienciaDashboard, FamiliaModal |
| `/crm/tarefas` | Todos | TarefasList |
| `/crm/faq` | CEO + Head | FaqSearch |
| `/crm/indicacoes` | CEO | IndicacoesList |
| `/crm/configuracoes` | CEO | ConfiguracoesForm (7 abas) |

### Fluxo Automatizado Lead → Pipeline

```
Lead preenche formulário → form_submissions INSERT (com UTM, referrer, session_id, device)
  → Cloud Functions processam:
    1. messenger-service → Email confirmação
    2. sync-elite-leads → Google Sheets (colunas A–BG incluindo tracking)
    3. qualify-lead → Gemini classifica (QUENTE/MORNO/FRIO)
       → Se QUENTE ou MORNO: AUTO-CRIA atleta + deal (etapa: lead)
       → Popula qualificado_gemini, classificacao_gemini, motivo_gemini
  → 22h depois: whatsapp-scheduler envia WhatsApp inicial (link /agendar)
  → Lead agenda reunião no Google Calendar:
    → calendar-webhook (push notification INSTANTÂNEA):
      - Detecta evento por email OU telefone (últimos 10 dígitos, qualquer DDI)
      - Envia WhatsApp confirmação ao lead (com link Meet + preview)
      - Envia WhatsApp notificação ao CEO (com dados + link Meet + preview)
      - Marca meeting_scheduled = true no Supabase
      - Move deal para reuniao_marcada no pipeline
      - Sincroniza Google Sheets
    → Fallback: process-followup-whatsapp (a cada hora):
      - Se sem reunião: envia follow-up 1 (48h) e follow-up 2 (7 dias)
  → CEO vê tudo no Pipeline (BAUSA Engine) e avança etapas
  → CEO analisa atribuição em Analytics → Atribuição (6 gráficos)
  → CEO gera links UTM em Analytics → Gerador UTM (10 presets)
```

### Tracking & Pixels (implementado 2026-04-10)

**GTM** (`GTM-5J87JXSR`) carrega automaticamente e gerencia:
- **GA4** (`G-3GP7EFN0P9`) — page views, eventos customizados, conversões
- **Meta Pixel** (`1521863919289394`) — PageView, Lead (form_submit), remarketing

**Eventos rastreados via dataLayer → GTM:**
- `form_start` — quando lead inicia o formulário
- `form_step_completed` — cada step (14 steps com nome)
- `form_submit` — formulário enviado com sucesso
- `form_error` — erro no envio
- `cta_click` — clique em CTA (hero/final/header) com source

**Atribuição capturada no form_submissions (11 colunas):**
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` — first-touch
- `referrer_url`, `landing_url` — de onde veio
- `session_id` (sessionStorage), `cta_source` — jornada
- `device_type` — mobile/tablet/desktop
- `form_started_at` — quando iniciou o form

**BAUSA Engine — Analytics:**
- `/analytics/atribuicao` — 6 gráficos (fonte, dispositivo, meio, CTA, campanha, taxa conversão)
- `/analytics/utm-builder` — gerador de links UTM com 10 presets

**Separação Lead Score vs Qualificação Gemini:**
- `qualificado_gemini` (boolean) — fixo, classificação da IA na entrada
- `lead_score` (0-100) — dinâmico, recalculado conforme dados são preenchidos
- `lead_classificacao` (hot/warm/cold) — derivado do lead_score pelo trigger

### Design System CRM

O CRM usa **light theme** com design tokens em `app/crm.css`:
- **Surfaces**: `--crm-bg` (#f3f5fa), `--crm-surface` (#ffffff)
- **Texto**: `--crm-text-primary` (#0c1527), `--crm-text-secondary` (#3b4a68), `--crm-text-tertiary` (#697b9a)
- **Brand**: BAU Blue (#476bc0), BAU Burgundy (#8e1824), BAU Gold (#9a7010)
- **Gradientes**: `--crm-gradient-brand` (burgundy → blue), `--crm-gradient-accent` (blue → dark blue)
- **Classes utilitárias**: `.crm-card`, `.crm-badge-*`, `.crm-btn-*`, `.crm-input`, `.crm-table`, `.crm-avatar-*`, `.crm-glass`

---

## Pendências Conhecidas (2026-04)

### ⚠️ Rearmar o alerta meta_frescor (pós-vai-pra-prod do meta_frescor v2)
O check `meta_frescor` está **suprimido** em `public.configuracoes_sistema.monitor_checks_desativados`
(2026-08-10 — o check antigo media idade do GASTO e alertava falso com campanhas pausadas).
O v2 (heartbeat `meta_sync_last_tick_at`) corrige o diagnóstico, mas **PRD só ganha o check novo
no vai-pra-prod**. Sequência OBRIGATÓRIA para rearmar (fora de ordem = alerta falso OU cobertura zero silenciosa):
1. Merge em develop (UAT) → 2. vai-pra-prod (main) → 3. rodar/aguardar o job `sync-meta-spend-job` (06h BRT)
→ 4. **confirmar o tick**: tela `/observabilidade` mostrando "Sync Meta vivo" (ou `valor` não-vazio em
`public.configuracoes_sistema` chave `meta_sync_last_tick_at`) → 5. SÓ ENTÃO remover `meta_frescor`
de `monitor_checks_desativados`. Remover antes do passo 4 = se o heartbeat não estiver gravando,
o check fica "pulado" para sempre (cobertura zero achando que armou).

### Configuração manual (pós-código)
- [x] GitHub Environments `prd`/`uat` com **branch policy** (2026-05-18): `prd` só aceita deploy de `main`, `uat` só de `develop`. Decisão consciente: **sem required reviewers** (repo solo — gate manual atrapalha hotfix; controle de qualidade fica no CI + review de PR + UAT). Revisar se o time crescer (revisor ≠ autor).
- [ ] Adicionar secrets `WEBHOOK_SECRET_UAT` e `WEBHOOK_SECRET_DEV` no GitHub
- [ ] Configurar Vercel branch `develop` com `VITE_SUPABASE_SCHEMA=uat`
- [ ] Configurar 3 webhooks Supabase para schema `uat`
- [ ] Configurar env vars nas funções UAT após primeiro deploy
- [ ] `bash infra/scheduler.sh uat` — criar scheduler jobs de UAT

### Configuração externa CRM
- [ ] Criar user_profiles no Supabase para CEO e Head
- [ ] Configurar Z-API para WhatsApp (instância, token, client_token)
- [ ] Configurar Calendly webhook (se disponível)
- [ ] Submeter templates WhatsApp para aprovação Meta (1-4 semanas)

### Configuração externa CRM — Deploy pendente
- [ ] Deploy qualify-lead com auto-promoção (nova versão com autoPromoteToCRM)
- [ ] Deploy process-followup-whatsapp com atualização de deals

### Transcrição do Meet (meeting-transcripts) — Config pendente
- [ ] Env vars da CF `meeting-transcripts` (por ambiente): `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_SCHEMA`, `SERVICE_ACCOUNT_EMAIL`, `SERVICE_ACCOUNT_PRIVATE_KEY`, `GOOGLE_CALENDAR_ID`, `GEMINI_API_KEY` (opcional — habilita o resumo)
- [ ] **Passo manual (Drive):** compartilhar a pasta **"Meet Recordings"** do Drive do CEO com o e-mail da service account (`SERVICE_ACCOUNT_EMAIL`) como **Leitor** — sem isso a CF loga `transcript_access_denied` e pula (não quebra o tick)
- [ ] Habilitar a **Drive API** no projeto GCP `elite-portal-forms` (a SA usa scope `drive.readonly` para exportar o Doc)
- [ ] `bash infra/scheduler.sh <env>` — cria/atualiza o job `meeting-transcripts-job{-uat|-dev}` (cron `15 */2 * * *`, deadline 300s)

### Backlog técnico
- [ ] Rate limiting no formulário (proteção anti-spam)
- [ ] Monitoramento Cloud Monitoring para erros críticos
- [ ] Testes automatizados (Vitest + Playwright)
- [ ] Geração de types Supabase (`supabase gen types`)
- [ ] Filtro por safra no Pipeline e War Room
- [ ] Régua de cobrança automática (D-3 a D+15)
- [ ] Merge de duplicados na UI
- [ ] Realtime subscriptions para Pipeline e Notificações

---

---

## Antes de Qualquer Tarefa do CRM, Leia:

| Documento | Conteúdo |
|---|---|
| [`docs/BUSINESS_RULES.md`](docs/BUSINESS_RULES.md) | 10 regras invioláveis, Lead Score, Motor de Match, temperatura CRM, pipeline, duplicados, cobrança |
| [`docs/SPEC.md`](docs/SPEC.md) | Especificação completa: campos, tipos, automações, fluxos por módulo |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | Schema implementado: 20 tabelas + campos Gemini/reunião, colunas, tipos, enums, triggers, RLS, funções SQL |
| [`docs/MODULES.md`](docs/MODULES.md) | 14 módulos implementados: rotas, componentes, server actions, permissões |
| [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) | Integrações externas: payloads, ações, fallbacks, templates WhatsApp |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | 7 fases implementadas em 2026-04-01 com status, dívida técnica e próximos passos |
| [`docs/CRM_ARCHITECTURE.md`](docs/CRM_ARCHITECTURE.md) | Arquitetura técnica: schema completo, ADRs, fluxos de dados, migrations, stack |

> ⚠️ Não implemente funcionalidades do CRM sem consultar `BUSINESS_RULES.md` e `SPEC.md`.

---

> Para contexto completo do produto, fluxos detalhados e histórico de decisões, consultar `CONTEXT.md`.
> Para guia de ambientes: `docs/ENVIRONMENTS.md`
> Para roadmap do CRM: `docs/ROADMAP.md`
