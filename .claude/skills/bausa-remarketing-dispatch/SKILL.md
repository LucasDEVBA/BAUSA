---
name: bausa-remarketing-dispatch
description: Use ao criar ou editar a feature de re-marketing do BAUSA — aba /remarketing no Engine, segmentos/audiências de leads QUENTE/MORNO não-convertidos, criação/disparo de campanhas WhatsApp, a Cloud Function send-remarketing, ou as tabelas remarketing_campanhas/remarketing_envios/remarketing_optout. Garante schema correto, salvaguardas anti-ban, CAS idempotente, dry-run obrigatório e o checklist anti-regressão derivado dos 2 bugs fundadores.
---

# BAUSA — Re-marketing (disparo WhatsApp controlado)

## Contexto

Audiências de leads qualificados (QUENTE/MORNO) **não-convertidos** → campanha
WhatsApp em massa, controlada, com salvaguardas anti-ban. Runbook operacional +
estado de prontidão: `docs/REMARKETING_DISPATCH.md`.

Peças:
- UI: `apps/crm/src/app/(dashboard)/remarketing/{page,client}.tsx`
- Queries/segmentos: `apps/crm/src/lib/remarketing-queries.ts` (metadados anônimos ao client; PII só server-side)
- Server actions: `apps/crm/src/lib/actions/remarketing-campanha.ts` (`prepararCampanha`/`dispararCampanha`/`cancelarCampanha`) + `remarketing.ts` (export CSV Meta)
- Cloud Function: `functions/send-remarketing/index.js`
- Schema: `supabase/migrations/20260605115850_*` + `20260605180000_*` (grants/policy)

## ⛔ INVARIANTE nº 1 — schema do Engine é SEMPRE `public`

`supabase-server.ts`/`supabase-browser.ts` não passam `db:{schema}` → Supabase JS
usa `public` em prod **e** preview. Campanhas criadas pelo Engine vivem em
`public.remarketing_*`. Portanto `SEND_REMARKETING_URL` (no Engine) **deve** apontar
para a CF que lê `public` = **`send-remarketing` PRD** (sem sufixo). Apontar para
`-uat` quebra (Engine escreve em public, CF lê uat → fila vazia). Não existe "Engine UAT".

## ⛔ INVARIANTE nº 2 — dry-run obrigatório antes de qualquer disparo real

O fluxo de UI **sempre** força uma simulação (`dry_run: true`) primeiro: conta os
alvos, mostra amostra, **não chama o Z-API**. Só depois de o CEO revisar é que o
disparo real acontece. Nunca remover o gate de dry-run.

## ⛔ INVARIANTE nº 3 — salvaguardas anti-ban (na CF, não no schema)

Throttle 30–45s · limite diário 120 · horário seguro 9–20h BRT · batch 10/invocação
(cron re-invoca 15/15min) · **CAS em `enviado_at` (marca ANTES de enviar)** · opt-out
checado por telefone. Todos com override por env (`REMKTG_*`). Nunca afrouxar sem
alinhamento — risco de ban do número WhatsApp.

## ⛔ INVARIANTE nº 4 — tipos de mensagem e mídia

`tipo_mensagem` ∈ {`texto`,`imagem`,`link`} decide o endpoint Z-API (send-text /
send-image / send-link). **Botão nativo é proibido** (reply-only, não abre URL, e
o Z-API o entrega de forma inconsistente) — o CTA confiável é `link` (send-link).
Imagem exige **URL pública estável**: upload vai ao bucket PÚBLICO `remarketing-media`
(`getPublicUrl`), nunca signed URL (expiraria durante os dias de throttle do disparo).
A CF tem fallback defensivo para texto se faltar a mídia (não quebra o disparo).

## Regras de Supabase

- A fila de envios é criada pelo **CEO autenticado** (`createAuditedSupabaseClient` →
  publishable key + sessão = role `authenticated`), e marcada pela **CF**
  (`service_role`). Ambos os roles precisam de GRANT **e** policy de escrita em
  `remarketing_envios`.
- CAS atômico na CF: PATCH com `&enviado_at=is.null` + `Prefer: return=representation`.
  Resposta vazia = outra instância venceu → pular. Marca antes de enviar.

## ⛔ Checklist anti-regressão (lições dos 2 bugs fundadores — 2026-06-05)

Ambos descobertos ANTES do 1º disparo, via verificação REST direta no banco:

- [ ] **GRANT explícito em schema custom.** `public` herda default privileges do
  Supabase; `uat`/`dev` **não**. Tabela nova sem `GRANT ... TO authenticated, service_role`
  → REST `42501 permission denied`. Sempre incluir GRANTs no DO-block de uat/dev.
- [ ] **Policy de RLS alinhada ao role REAL da escrita.** `remarketing_envios` tinha só
  `SELECT(authenticated)` + `ALL(service_role)`, mas `prepararCampanha` insere como
  `authenticated` (CEO) → bloqueado em TODOS os schemas. Antes de escrever via cliente
  audited, confirme: é `authenticated` ou `service_role`? A policy precisa cobrir esse role.
- [ ] **Verifique no banco, não só no código.** Teste REST por schema
  (`Accept-Profile: uat`) com a service key: 200 = ok, 42501 = grant faltando.
- [ ] **Schema alignment Engine↔CF** (Invariante nº 1): campanha em `public` ⇒ CF lê `public`.
- [ ] **CAS + UNIQUE(campanha_id, deal_id)**: re-disparo não duplica.
- [ ] **Migration idempotente** (DROP POLICY IF EXISTS + CREATE; GRANT é cumulativo).
- [ ] Cloud Function: seguir também a skill `bausa-cloud-function` (Gen2/Node20, log
  estruturado, `node --check`, deploy via workflow com `esac` intacto).

## Deploy

CF nova já está nos workflows (`deploy-functions.yml` + `-uat.yml`, entry `sendRemarketing`,
name `send-remarketing`/`-uat`) e no `infra/scheduler.sh` (job 15/15min). CI injeta só
`WEBHOOK_SECRET`+`SUPABASE_SCHEMA`; setar `SUPABASE_URL`/`SUPABASE_SERVICE_KEY`/`ZAPI_*`
manualmente pós-primeiro-deploy (`--update-env-vars`, nunca `--set-env-vars`).
