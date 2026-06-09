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

## Modelo de dados (`20260605115850` + `20260605180000` + `20260605190000`)

| Tabela | Papel |
|---|---|
| `remarketing_campanhas` | 1 linha por campanha (segmento + mensagem + status `rascunho`/`enviando`/`concluida`/`pausada` + `tipo_mensagem` `texto`/`imagem`/`link` + campos de mídia `imagem_url`/`link_url`/`link_titulo`/`link_descricao`/`link_imagem`) |
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

## Tipos de mensagem (texto / imagem / link)

A campanha escolhe `tipo_mensagem`; a CF despacha pelo endpoint Z-API correspondente:

| Tipo | Endpoint Z-API | Campos | Confiabilidade |
|---|---|---|---|
| `texto` | `send-text` | `mensagem` (com `{nome}`/`{esporte}`) | ✅ provado |
| `imagem` | `send-image` | `imagem_url` (público) + legenda (`mensagem`) | ✅ padrão |
| `link` | `send-link` | `link_url` + `link_titulo` + `link_descricao` + `link_imagem` + `mensagem` | ✅ provado (card clicável) |

> **Botão nativo NÃO é usado.** O botão interativo do Z-API é *reply-only* (não abre
> URL) e os próprios docs avisam que tem "fatores decisivos para funcionar". O CTA
> clicável e confiável é o **`link`** (card rico via `send-link`, que já roda nesta conta).

**Imagem precisa de URL pública e estável.** O upload (botão "Enviar") vai para o
bucket **público** `remarketing-media` e retorna `getPublicUrl` — não signed URL,
que expiraria durante os dias de throttle. O CEO também pode colar uma URL externa.

**Lista de leads + detalhe.** A tela mostra os nomes da audiência filtrada; clicar
abre o `DealDetailSheet` completo in-place (reusa `fetchDeal` de `lib/deal-fetch.ts`).
O nome vai ao client (ferramenta CEO-only); contato (email/telefone) só server-side.

## Canais: WhatsApp ou E-mail

A campanha tem um `canal` (`whatsapp` default ou `email`). Mesmos segmentos, filtros,
lista de leads e dry-run; o que muda é o contato exigido e o transporte:

| Canal | Contato | Transporte | Salvaguardas |
|---|---|---|---|
| `whatsapp` | telefone (E.164) | Z-API (texto/imagem/link) | horário 9–20h, ~120/dia, throttle 30–45s |
| `email` | e-mail | Resend → Brevo (fallback) | sem horário, ~500/dia, throttle ~2,5s, **descadastro 1-clique** |

**E-mail = template HTML único** (logo + imagem opcional + corpo `{nome}`/`{esporte}` +
**botão CTA real** + rodapé com descadastro). O "botão" que o WhatsApp não entrega de forma
confiável **funciona no e-mail** (HTML). Assunto obrigatório.

**Descadastro (LGPD):** cada e-mail tem link com token HMAC → CF pública
`remarketing-unsubscribe` grava em `remarketing_optout_email`. A CF de envio respeita
opt-out por **e-mail** (email) e por **telefone** (whatsapp), separadamente.

> A `alcance`/lista de leads filtra por contato do canal (e-mail tem e-mail; WhatsApp tem
> telefone) via flags `temEmail`/`temTelefone`.

## Variáveis de ambiente

### Engine (`bolsa-atleta-crm` — Vercel)
| Var | Valor | Status |
|---|---|---|
| `SEND_REMARKETING_URL` | `https://us-central1-elite-portal-forms.cloudfunctions.net/send-remarketing` | ✅ set (production + preview/develop) |
| `WEBHOOK_SECRET` | = secret PRD (já usado p/ outras CFs) | ✅ já existia |

### Cloud Function `send-remarketing` (GCP)
CI (`deploy-functions.yml`) injeta só `WEBHOOK_SECRET` + `SUPABASE_SCHEMA`. As demais
são manuais pós-primeiro-deploy (padrão das outras funções), via `--update-env-vars`:
- **WhatsApp:** `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN`.
- **E-mail:** `RESEND_API_KEY`, `BREVO_API_KEY`, `FROM_EMAIL`, `LOGO_URL`, `UNSUBSCRIBE_URL`
  (URL da CF `remarketing-unsubscribe`, p/ montar o link de descadastro com token HMAC).

### Cloud Function `remarketing-unsubscribe` (GCP, pública)
Endpoint público de descadastro (LGPD). Env: `WEBHOOK_SECRET` (valida o token HMAC),
`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_SCHEMA`. Não tem scheduler (é acionada
pelo clique do lead no link do e-mail).

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
