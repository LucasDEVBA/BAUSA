# Engenharia BAUSA — Guia Mestre

> **Princípio número 1: Regression-safe by default.** Tudo que está funcional DEVE continuar funcional. Cada mudança prova que não quebra o que já existe — não por promessa, mas por checklist, guard de CI e validação.

Este documento é o índice da disciplina de engenharia do BAUSA. As **skills** acionáveis (carregadas automaticamente pelo Claude Code ao trabalhar) vivem em `.claude/skills/`. Este arquivo dá a visão geral, os princípios e o runbook de incidentes.

---

## Por que isso existe

Em maio/2026 tivemos **dois incidentes silenciosos** que custaram caro e passaram despercebidos por dias:

1. **Email travado 12 dias** (`send-messages`, PR #58): um `payload?.messageType` referenciava variável nunca declarada (`payload`), só `req.body` existia. Toda chamada lançava `ReferenceError` → HTTP 500. **100% dos emails de confirmação pararam de 17/05 a 29/05.** Não foi detectado porque o WhatsApp continuou funcionando e ninguém monitorava o volume de emails.

2. **Calendar data loss em 43 leads** (`calendar-webhook`, PR #55): um `SELECT` com 7 colunas em vez de `SELECT *` ao detectar reunião → o sync para o Google Sheets sobrescrevia a linha inteira com campos `undefined`, deletando endereço, esporte, qualificação, UTMs.

**Lições que viraram regra:**
- Mudança em função de produção exige checklist anti-regressão (a skill correspondente tem o seu).
- Ausência de erro ≠ funcionando. Precisamos de **monitoramento proativo de volume** (task #19).
- `SELECT` parcial em código que reescreve registro inteiro é proibido — sempre `SELECT *` ou colunas explicitamente completas.
- Toda variável referenciada deve existir no escopo — `tsc`/lint pega em TS, mas Cloud Functions são JS puro: `node --check` + revisão.

---

## As 5 Skills (carregadas automaticamente)

| Skill | Quando o agente carrega | O que garante |
|---|---|---|
| **bausa-cloud-function** | Criar/editar qualquer função em `functions/` | Padrão Gen2, log estruturado, CAS atômico, env vars, deploy, checklist dos 2 incidentes |
| **bausa-supabase-migration** | Criar migration em `supabase/migrations/` | DO blocks multi-schema (public/uat/dev), RLS por papel, audit, idempotência |
| **bausa-crm-page** | Criar/editar página em `apps/crm/` | Server+Client, `requirePapel`, dark theme, TS strict sem `any`, nav |
| **bausa-scheduler-safety** | Tocar em qualquer scheduler de mensageria | Invariantes classe+timing, CAS, horário seguro, guard de CI |
| **bausa-gitflow-deploy** | Commit, PR, merge, deploy | feature→develop→main, nunca `--delete-branch` em develop→main, validação pré-merge |

---

## Princípios de Arquitetura (resumo)

1. **Separação de ambientes:** `feature/*` → DEV, `develop` → UAT, `main` → PRD. Schemas Supabase isolados (`dev`/`uat`/`public`).
2. **Idempotência sempre:** crons re-executam. CAS atômico (`column=is.null` no filtro do PATCH) garante exactly-once. Upsert com `onConflict` para dados.
3. **Defesa em profundidade:** RLS no banco (não confiar só na aplicação) + `requirePapel` na página + validação Zod no server action.
4. **Fail fast + nunca engolir erro:** try/catch em toda operação async, log estruturado, sem catch vazio. Mas: triggers SQL que tocam tabelas secundárias usam `EXCEPTION WHEN OTHERS` para **nunca abortar a operação crítica** (lição do #52 — handoff de experiência não pode travar o CEO de mover deal).
5. **Reusar antes de criar:** helpers existem (`war-room-queries.ts`, `createServerSupabaseClient`, `MetricCard`, templates seeded). Buscar antes de escrever novo.
6. **TS strict no Engine, JS puro nas Functions:** `apps/crm` é `strict: true` sem `any`. `functions/` é Node 20 JS — validar com `node --check`.

---

## Checklist universal pré-merge (qualquer mudança)

- [ ] A mudança **restringe ou adiciona** — não remove um filtro/guard existente sem justificativa explícita
- [ ] `tsc --noEmit` EXIT 0 (Engine) ou `node --check` (Functions)
- [ ] Lint dos arquivos novos limpo (warnings pré-existentes em arquivos não-tocados são aceitáveis)
- [ ] `next build` compila (mudança no Engine)
- [ ] Guard CI `Scheduler Eligibility Invariants` continua verde (mudança em scheduler)
- [ ] Migration aplicada em UAT antes de PRD; validada nos 3 schemas
- [ ] PR descreve: o quê, por quê, risco, test plan
- [ ] Nenhum segredo hardcoded (CI `Secrets Scan`)
- [ ] Docs atualizadas (`CLAUDE.md`/`docs/*`) se a mudança altera comportamento documentado

---

## Runbook de Incidentes

### Detecção
- `/automacoes-monitor` no Engine — estado atual das filas
- Cloud Logging GCP — `gcloud logging read 'resource.labels.service_name="<fn>"'`
- (futuro #19) Cloud Monitoring — alertas proativos de volume zero

### Contenção (ordem)
1. **Pausar o que está sangrando:** `gcloud scheduler jobs pause <job> --location=us-central1`
2. **Estancar duplicação/dano:** se mensagens indevidas, marcar `whatsapp_sent_at=NOW()` (CAS) nos alvos via REST — bloqueia reprocessamento
3. **Diagnóstico:** logs + reprodução. Identificar blast radius (quantos registros/dias).
4. **Fix mínimo:** menor mudança que corrige. PR dedicado, CI verde.
5. **Deploy:** feature→develop→UAT→main→PRD.
6. **Backfill/reparo:** script idempotente para corrigir dados afetados.
7. **Retomar:** resume schedulers, validar com amostra.
8. **Post-mortem:** atualizar a skill correspondente com a lição (como este documento foi atualizado).

### Rollback
- Cloud Function: `gcloud functions deploy <name> --source=<commit anterior>` ou revert do PR + redeploy
- Migration: migrations são forward-only; reverter exige migration nova compensatória (nunca editar migration já aplicada em PRD)
- Frontend: Vercel mantém deploys anteriores — promover deploy estável anterior

### Casos históricos (consultar antes de mexer nas áreas)
- **Email travado:** `functions/send-messages/index.js` — variável `payload` não existia. Lição: `node --check` + monitorar volume.
- **Calendar data loss:** `functions/calendar-webhook/` — `SELECT` parcial. Lição: `SELECT *` quando reescreve registro inteiro.
- **Develop deletado:** `--delete-branch` em PR `develop→main`. Lição: NUNCA usar a flag em PR cujo HEAD é branch permanente.
- **FRIO recebeu mensagem timing / follow-up timing:** filtro de elegibilidade ausente em scheduler. Lição: guard `tests/scheduler-eligibility.test.js`.

---

## Stack de referência rápida

- **Frontend/Engine:** Next.js 16 App Router, React 19, TS strict, Tailwind 4, Recharts 3, Radix, RHF+Zod, sonner, dark theme
- **Backend:** GCP Cloud Functions Gen2, Node 20, us-central1, 256Mi
- **BaaS:** Supabase (Postgres + RLS + schemas dev/uat/public)
- **IA:** Gemini 2.5 Flash (qualificação)
- **WhatsApp:** Z-API | **Email:** Resend (primário) + Brevo (fallback)
- **CI/CD:** GitHub Actions + Workload Identity Federation | **Deploy:** Vercel (front) + GCP (functions)
- **Package manager:** pnpm (monorepo Turborepo)

Detalhes completos: `CLAUDE.md` (raiz) e `apps/crm/CLAUDE.md`.
