---
name: bausa-scheduler-safety
description: Use ao tocar em qualquer scheduler de mensageria do BAUSA (process-pending-whatsapp, process-followup-whatsapp, process-scheduled-followups, ou novos schedulers de cobrança/nutrição/régua). Codifica os invariantes de elegibilidade (classe Gemini + timing_status), CAS atômico, horário seguro e o guard de CI anti-regressão — derivados de 2 incidentes de produção.
---

# BAUSA — Segurança de Schedulers de Mensageria

## Por que esta skill existe (2 incidentes da MESMA classe)

1. **2026-05-15** — `process-pending-whatsapp` Bucket B (timing alternativo) não filtrava `qualification_classification` → leads **FRIO** receberam `early_potential`/`late_timing`. 3 envios indevidos.
2. **2026-05-18** — `process-followup-whatsapp` não filtrava `timing_status` → leads `muito_cedo`/`tarde_demais` receberam follow-up "agende a reunião" contradizendo a mensagem que já tinham recebido. 6 leads afetados.

**Causa raiz comum:** uma cláusula de filtro de elegibilidade ausente. **Por isso existe um guard de CI que bloqueia o merge** se qualquer filtro sumir.

## INVARIANTES (nunca violar)

Todo scheduler que envia mensagem a lead DEVE filtrar:

1. **Classe Gemini:** `qualification_classification IN ('QUENTE','MORNO')`. **FRIO NUNCA recebe** mensagem automática — em nenhum bucket, nenhum timing, nenhuma régua.
2. **Timing correto:**
   - Fluxo **ideal** (initial, follow-up 48h/7d, nutrição): `(timing_status IS NULL OR timing_status = 'ideal')`
   - Fluxo **alternativo** (early_potential, late_timing): `timing_status IN ('muito_cedo','tarde_demais')`
   - **Os dois fluxos NUNCA se misturam.** `muito_cedo`/`tarde_demais` seguem caminho próprio (`scheduled_return` em novembro / nada).
3. **Aprovação humana (2026-08-10):** buckets de outreach inicial (A/B) e retomada de novembro exigem `aprovacao_status=eq.aprovado` — lead `pendente`/`reprovado`/NULL NUNCA recebe mensagem. Follow-ups herdam via `whatsapp_sent_at IS NOT NULL` (só existe pós-aprovação). Monitores de fila (monitor-health, observabilidade-checks, automacoes-queries) espelham o filtro — sem ele, lead retido pelo CEO vira falso "fila presa".
4. **CAS atômico ANTES do envio:** marcar `<coluna>_sent_at=NOW()` com filtro `&<coluna>_sent_at=is.null` no PATCH. Se 0 rows atualizadas → outra instância venceu → PULAR. Marcar antes de chamar a Z-API (se o envio falhar depois, o lead não é reprocessado — preferível a duplicar).
5. **`meeting_scheduled IS NOT TRUE`** nos follow-ups (quem agendou reunião não recebe cobrança de agendamento).
6. **Horário seguro** (quando implementado): não disparar fora da janela configurada.

## Guard de CI (anti-regressão) — `tests/scheduler-eligibility.test.js`

Job CI **`Scheduler Eligibility Invariants`** (no `needs` do `ci-passed`). Análise estática que falha o build se as cláusulas obrigatórias sumirem do source dos schedulers. Roda local:
```bash
node --test tests/*.test.js
```
**Ao adicionar um scheduler novo de mensageria, ADICIONAR um teste ao guard** cobrindo seus filtros obrigatórios. Ao mudar um existente, o guard já protege — se você legitimamente mudar a regra, atualizar o teste junto (com justificativa no PR).

## Regras de negócio dos schedulers atuais (referência)

| Scheduler | Janela | Filtro extra | Template |
|---|---|---|---|
| process-pending Bucket A | qualified_at > 22h | timing ideal/null + **aprovado** | initial |
| process-pending Bucket B | qualified_at > 48h | timing muito_cedo/tarde_demais + **aprovado** | early_potential / late_timing |
| process-followup FU1 | whatsapp_sent_at > 48h, fu1 null | timing ideal/null, meeting not true | followup_1 |
| process-followup FU2 | whatsapp_sent_at > 7d, fu1 not null, fu2 null | timing ideal/null, meeting not true | followup_2 |
| process-scheduled-followups | scheduled_followup_at <= NOW | timing = muito_cedo + **aprovado** | scheduled_return |

## ⛔ Checklist ao tocar em scheduler
- [ ] Filtro `qualification_classification IN ('QUENTE','MORNO')` presente em TODA query de elegibilidade?
- [ ] Filtro `timing_status` correto para o fluxo (ideal vs alternativo)?
- [ ] Filtro `aprovacao_status=eq.aprovado` nos buckets de outreach inicial/retomada (e paridade nos monitores de fila)?
- [ ] CAS atômico antes do envio (não depois)?
- [ ] `node --test tests/*.test.js` passa? Se adicionou scheduler, adicionou teste ao guard?
- [ ] Idempotente (re-tick não duplica)?
- [ ] Respeita horário seguro?
- [ ] `node --check functions/<pasta>/index.js`?
- [ ] Simulação pré-deploy: rodar a query de elegibilidade contra o banco e conferir que só os leads esperados entram (zero FRIO, zero timing cruzado)?

## Plano de mudança seguro (sempre)
1. Pausar o scheduler antes de testar mudança arriscada: `gcloud scheduler jobs pause <job> --location=us-central1`
2. Simular a query no Supabase (REST) e validar a lista de elegíveis
3. Deploy via gitflow, validar em UAT
4. Retomar: `gcloud scheduler jobs resume <job>`
5. Monitorar o primeiro tick real (logs `processing_lead` + `zapi_response`)
