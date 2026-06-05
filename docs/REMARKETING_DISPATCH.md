# Re-marketing — Disparo de Campanhas via WhatsApp

> Runbook operacional + estado de prontidão da feature de re-marketing
> (audiências QUENTE/MORNO não-convertidas → campanha WhatsApp controlada).
> Para padrões de código/anti-regressão, ver a skill `bausa-remarketing-dispatch`.

---

## Visão geral

A aba **`/remarketing`** do BAUSA Engine permite ao CEO:

1. Escolher um **segmento** de leads qualificados não-convertidos (7 segmentos: `nao_agendaram`, `reuniao_sem_fechar`, `proposta_sem_resposta`, `perdidos_recuperaveis`, `inativos_90d`, `alto_score_sem_followup`, `aniversariantes`).
2. Aplicar **filtros** (faixa de idade, esporte, classificação).
3. Escrever/ajustar a **mensagem** (com sugestões de IA).
4. **Preparar** a campanha (cria `remarketing_campanhas` + 1 `remarketing_envios` por lead).
5. **Disparar** — sempre com **dry-run obrigatório** primeiro (simulação, zero envio real).

O disparo real (com salvaguardas anti-ban) é feito pela Cloud Function **`send-remarketing`**, nunca pelo Engine diretamente.

---

## ⚠️ Realidade de schema (LEIA — define onde a campanha roda)

**O BAUSA Engine (`bolsa-atleta-crm`) usa o schema `public` SEMPRE.** Os clients
(`supabase-server.ts` / `supabase-browser.ts`) não passam `db: { schema }`, então
o Supabase JS usa o default `public` — em produção **e** em preview/develop.

Consequência: **toda campanha criada pelo Engine vive em `public.remarketing_*` (PRD)**,
mesmo testando pelo link de preview. Logo, o `SEND_REMARKETING_URL` do Engine **deve**
apontar para uma CF que lê o schema `public` = a função **`send-remarketing` PRD**
(sem sufixo). Apontar para `send-remarketing-uat` (lê schema `uat`) causaria mismatch
— o Engine cria o envio em `public`, a CF procura em `uat` e não acha nada.

> Não existe "Engine de UAT". A validação por **dry-run** (simulação) é a rede de
> segurança, não o ambiente. Dry-run não envia nada ao Z-API.

---

## Modelo de dados (`supabase/migrations/20260605115850` + `20260605180000`)

| Tabela | Papel |
|---|---|
| `remarketing_campanhas` | 1 linha por campanha (segmento + mensagem + status `rascunho`/`enviando`/`concluida`/`pausada`) |
| `remarketing_envios` | 1 linha por destinatário. **CAS** via `enviado_at` (NULL=pendente). `UNIQUE(campanha_id, deal_id)` = idempotência |
| `remarketing_optout` | Telefones que pediram para não receber (LGPD). A CF respeita antes de enviar |

**RLS:** leitura autenticada; escrita de campanhas/optout só CEO; **escrita de envios:
CEO (cria a fila) + `service_role` (a CF marca `enviado_at`)**. GRANTs explícitos em
`public`/`uat`/`dev` (schemas custom não herdam default privileges do Supabase).

---

## Salvaguardas anti-ban (na CF `send-remarketing`, não no schema)

| Salvaguarda | Valor (env override) |
|---|---|
| Throttle entre envios | 30–45 s (`REMKTG_THROTTLE_MIN`/`MAX`) |
| Limite diário | 120 (`REMKTG_LIMITE_DIARIO`) |
| Horário seguro | 9h–20h BRT (fora disso, não envia) |
| Batch por invocação | 10 (`REMKTG_MAX_BATCH`) — o cron re-invoca a cada 15 min |
| Idempotência | CAS em `enviado_at` (marca ANTES de enviar) |
| Opt-out | Checado por telefone antes de cada envio |
| **Dry-run** | `dry_run: true` no payload → simula, conta, **não chama Z-API** |

---

## Variáveis de ambiente

### Engine (`bolsa-atleta-crm` — Vercel)
| Var | Valor | Status |
|---|---|---|
| `SEND_REMARKETING_URL` | `https://us-central1-elite-portal-forms.cloudfunctions.net/send-remarketing` | ✅ set (production + preview/develop) |
| `WEBHOOK_SECRET` | = secret PRD (já usado p/ outras CFs) | ✅ já existia |

### Cloud Function `send-remarketing` (GCP)
CI (`deploy-functions.yml`) injeta só `WEBHOOK_SECRET` + `SUPABASE_SCHEMA`. As demais
são manuais pós-primeiro-deploy (padrão das outras funções), via `--update-env-vars`:
`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN`.

---

## Estado de prontidão (2026-06-05)

| Item | Estado |
|---|---|
| Tabelas `remarketing_*` em `public` (PRD) | ✅ criadas + grants + policy CEO de envios |
| Migration de correção (grants/RLS) | ✅ merged em develop, aplicada ao banco (uat/dev/public → REST 200) |
| UI `/remarketing` | ✅ em develop (preview tem; prod recebe na promoção) |
| Engine `SEND_REMARKETING_URL` | ✅ configurado (prod + preview) |
| Engine `WEBHOOK_SECRET` | ✅ já existia |
| CF `send-remarketing` **PRD** | ⛔ **não deployada** (precisa develop→main) |
| CF `send-remarketing-uat` | ✅ ACTIVE (p/ teste direto da CF; não é o caminho do Engine) |

### Passos restantes para disparar (próxima sessão)

1. **Promover `develop → main`** (PR, sem `--delete-branch`). Deploya a CF
   `send-remarketing` PRD + publica `/remarketing` no Engine de produção + aplica
   as migrations no `main`.
2. **Configurar env da CF PRD** pós-deploy (`--update-env-vars`):
   `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_SCHEMA=public`, `ZAPI_*`.
   Validar: `gcloud functions describe send-remarketing --gen2 --region=us-central1`
   deve listar as 7+ chaves.
3. **(Opcional) Criar o scheduler PRD** que continua campanhas em andamento:
   `bash infra/scheduler.sh prd` (job `send-remarketing-job`, a cada 15 min).
4. **Disparar** no Engine: `/remarketing` → segmento → revisar alcance →
   **DRY-RUN** (confere contagem) → revisar amostra → **disparar de verdade**.

---

## Runbook de incidentes (emergência)

```bash
# Pausar TODOS os disparos imediatamente (campanha em andamento)
gcloud scheduler jobs pause send-remarketing-job --location=us-central1 --project=elite-portal-forms

# Marcar uma campanha como pausada (SQL — schema public)
# UPDATE public.remarketing_campanhas SET status='pausada' WHERE id='<uuid>';

# Adicionar telefone à lista de opt-out (LGPD / pedido do lead)
# INSERT INTO public.remarketing_optout(telefone, motivo) VALUES ('5571...', 'pedido do lead');

# Retomar
gcloud scheduler jobs resume send-remarketing-job --location=us-central1 --project=elite-portal-forms
```

---

## Incidente fundador — 2 bugs latentes (2026-06-05, corrigidos antes do 1º disparo)

A migration `20260605115850` criou as tabelas com RLS, mas dois defeitos impediam
a criação de campanha (descobertos durante a preparação do disparo, via verificação
REST direta no banco — **mandato regression-safe**):

1. **GRANTs ausentes em `uat`/`dev`.** `public` herda privilégios via *default privileges*
   do Supabase; schemas custom **não** → REST retornava `42501 permission denied`.
2. **`remarketing_envios` sem policy de INSERT para o CEO.** `prepararCampanha()` insere
   a fila como o **CEO autenticado** (publishable key + sessão), não como `service_role`.
   Sem a policy, o INSERT era bloqueado por RLS em **todos os schemas (inclusive PRD)**.

Corrigidos pela migration `20260605180000` (idempotente). **Lição:** ao criar tabela em
schema custom, sempre conceder GRANTs explícitos; e alinhar policies de RLS ao **role real**
que executa cada escrita (audited client = `authenticated`, não `service_role`).
