# CLAUDE.md — BAUSA

> Instruções para o agente Claude Code neste repositório.
> Para contexto completo do produto, ver `CONTEXT.md`.

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
| `functions/process-pending-whatsapp/` | `whatsapp-scheduler` | `whatsapp-scheduler-uat` | Cloud Scheduler (1x/hora) | Processa fila de WhatsApp inicial (22h) |
| `functions/process-followup-whatsapp/` | `followup-scheduler` | `followup-scheduler-uat` | Cloud Scheduler (1x/hora) | Follow-ups 48h e 7 dias sem agendamento |

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

**Regra de negócio — fila WhatsApp inicial (22h):**
```sql
qualification_classification IN ('QUENTE', 'MORNO')
AND qualified_at IS NOT NULL
AND qualified_at < NOW() - INTERVAL '22 hours'
AND whatsapp_sent_at IS NULL
```

**Regra de negócio — follow-up 1 (48h):**
```sql
qualification_classification IN ('QUENTE', 'MORNO')
AND whatsapp_sent_at < NOW() - INTERVAL '48 hours'
AND followup_1_sent_at IS NULL
AND meeting_scheduled IS NOT TRUE
```

**Regra de negócio — follow-up 2 (7 dias):**
```sql
qualification_classification IN ('QUENTE', 'MORNO')
AND whatsapp_sent_at < NOW() - INTERVAL '7 days'
AND followup_1_sent_at IS NOT NULL
AND followup_2_sent_at IS NULL
AND meeting_scheduled IS NOT TRUE
```

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

## Qualificação Gemini — Critérios

| Classe | Critério |
|--------|---------|
| QUENTE | Profissão sustenta claramente a faixa de investimento + dados coerentes |
| MORNO | Profissão insuficiente MAS endereço/escola confirmam alto padrão |
| FRIO | Profissão insuficiente SEM contexto favorável OU dados aleatórios/inconsistentes |

**Regra especial (renda variável):** Profissões como analista, financeiro, gestor, marketing, comercial, consultor, corretor, trader, assessor → em dúvida entre FRIO e MORNO, preferir **MORNO**.

**Regra especial (leads internacionais):** Se `address_country !== 'BR'`, o prompt Gemini adapta os critérios:
- Bloco de endereço exibe país + cidade (sem bairro/CEP/estado)
- Critério MORNO de endereço avalia contexto de cidade/país, não bairro
- Ausência de bairro/CEP não penaliza leads internacionais

**Config Gemini obrigatória:**
```js
temperature: 0.2,
maxOutputTokens: 2048,
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
# Desenvolvimento
npm run dev           # Dev server localhost:3000
npm run build         # Build produção
npm run lint          # ESLint

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
| `deploy-functions.yml` | Push main + functions/** | PRD | **Manual** |
| `deploy-supabase.yml` | Push main + supabase/** | PRD | **Manual** |

**IMPORTANTE:** Usar `--update-env-vars` (nunca `--set-env-vars`) para não sobrescrever variáveis existentes na função.

---

## Variáveis de Ambiente — Referência Rápida

### Frontend (Vercel)
- `VITE_SUPABASE_URL` — URL do projeto Supabase
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Anon key pública
- `VITE_SUPABASE_SCHEMA` — `uat` em UAT, omitir em PRD (usa `public`)

### Cloud Functions (GCP)
- `WEBHOOK_SECRET` — todas as funções (diferente por ambiente: `_UAT`, `_DEV`)
- `SUPABASE_SCHEMA` — `public` em PRD, `uat` em UAT, `dev` em DEV
- `GEMINI_API_KEY` — qualify-lead
- `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` — qualify-lead, process-pending, process-followup
- `SPREADSHEET_ID` + `SERVICE_ACCOUNT_EMAIL` + `SERVICE_ACCOUNT_PRIVATE_KEY` — qualify-lead, sync-leads
- `ZAPI_INSTANCE_ID` + `ZAPI_TOKEN` + `ZAPI_CLIENT_TOKEN` — send-whatsapp
- `RESEND_API_KEY` + `BREVO_API_KEY` + `FROM_EMAIL` + `INTERNAL_EMAIL` + `LOGO_URL` — send-messages
- `SEND_WHATSAPP_URL` + `SYNC_LEADS_URL` — process-pending, process-followup
- `GOOGLE_CALENDAR_ID` + `SERVICE_ACCOUNT_EMAIL` + `SERVICE_ACCOUNT_PRIVATE_KEY` — process-followup

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

| Projeto | Repositório | Propósito |
|---------|-------------|-----------|
| **BAUSA Engine** | `../BAUSA Engine` | CRM frontend (Next.js 16, dark theme, Recharts) — consome o mesmo Supabase |
| **BAUSA** | Este repo | Site público + Cloud Functions + migrations Supabase |

O `BAUSA Engine` é o frontend de gestão usado pelo CEO/Head. Compartilha o mesmo banco Supabase e usa os mesmos server actions. Documentação específica: `../BAUSA Engine/CLAUDE.md`.

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
| 🔜 Monitoramento | Cloud Monitoring dashboards + alertas por ambiente | Não iniciado |
| 🔜 **Next.js** | Migrar frontend público para Next.js em repo `elite-portal-web` | Planejado |
| 🔜 **Services Repo** | Mover Cloud Functions para `elite-portal-services` + libs compartilhadas | Planejado |

---

## CRM — Resumo Técnico

### Tabelas do Banco (20 tabelas CRM + form_submissions)

| Tabela | Descrição | Linhas-chave |
|--------|-----------|-------------|
| `user_profiles` | Perfis e papéis (ceo/head_sucesso/comercial) | papel, ativo |
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
Lead preenche formulário → form_submissions INSERT
  → Cloud Functions processam:
    1. messenger-service → Email confirmação
    2. sync-elite-leads → Google Sheets
    3. qualify-lead → Gemini classifica (QUENTE/MORNO/FRIO)
       → Se QUENTE ou MORNO: AUTO-CRIA atleta + deal (etapa: lead)
       → Popula qualificado_gemini, classificacao_gemini, motivo_gemini
  → 22h depois: whatsapp-scheduler envia WhatsApp inicial
  → process-followup-whatsapp (a cada hora):
    - Verifica Google Calendar para reuniões
    - Se detecta reunião → move deal para reuniao_marcada
    - Popula reuniao_agendada_at, reuniao_data, reuniao_link
    - Se sem reunião: envia follow-up 1 (48h) e follow-up 2 (7 dias)
  → CEO vê tudo no Pipeline (BAUSA Engine) e avança etapas
```

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

### Configuração manual (pós-código)
- [ ] Configurar GitHub Environments `prd`, `uat`, `dev` + required reviewers
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
