# Tarefa: Diagnosticar a auto-promoção do CRM e fazer backfill de leads — BAUSA

> **Cole este documento inteiro no início da conversa com o outro agente.** Ele contém todo o contexto, o problema, o estado atual, as opções de solução e os comandos necessários.

---

## Sua função

Você é um agente engenheiro responsável por:

1. **Diagnosticar** por que a auto-promoção de leads para o CRM (`autoPromoteToCRM`) não está executando em produção
2. **Corrigir** a causa raiz para que novos leads entrem no CRM automaticamente
3. **Fazer o backfill** dos 177 leads históricos que estão em `form_submissions` mas não no CRM

Trabalhe com cautela, sempre confirmando ações destrutivas antes de executar, e prefira dry-run antes de execução real.

---

## Contexto do projeto

**Produto:** Bolsa Atleta USA (BAUSA) — assessoria para bolsas esportivas em universidades americanas
**Repositório:** `/Users/lucasbau/BAUSA` — monorepo Turborepo com pnpm
**URL produção:** https://bolsaatletausa.com
**Branch principal:** `main` (PRD) / `develop` (UAT)

**Stack relevante para esta tarefa:**

- Supabase (PostgreSQL) — projeto `nikrlikwghqcxcjzthmc`, schema `public` em PRD
- Cloud Functions GCP Gen2 (Node.js 20) — projeto `elite-portal-forms`, região `us-central1`
- A função `lead-qualifier` (código em `functions/qualify-lead/index.js`) qualifica leads via Gemini 2.5 Flash e deveria promovê-los ao CRM
- Frontend CRM em `apps/crm` (Next.js 16 + React 19), lê dados das tabelas Supabase
- Padrão de auth nas Cloud Functions: header `x-webhook-secret`

**Documentação que vale a pena ler antes:**

- `CLAUDE.md` (raiz) — instruções gerais e gitflow
- `docs/CRM_ARCHITECTURE.md` — schema completo das 20 tabelas do CRM
- `docs/DATA_MODEL.md` — campos, tipos, enums, triggers
- `docs/INTEGRATIONS.md` — integrações externas (Resend, Brevo, Z-API, Gemini, Calendar)
- `apps/crm/CLAUDE.md` — particularidades do CRM (BAUSA Engine)

---

## O problema em uma frase

A tabela `atletas` (e `deals`, `responsaveis`, `enderecos`) está **100% vazia em produção**, apesar de existirem **177 leads qualificados** (QUENTE/MORNO) na tabela `form_submissions`. Isso significa que o CRM (BAUSA Engine) abre todas as telas em branco.

---

## Estado atual confirmado (PRD)

| Tabela | Atual | Esperado |
|---|---:|---:|
| `form_submissions` | 262 | 262 (✅) |
| Leads QUENTE+MORNO em `form_submissions` | 177 | 177 (✅) |
| Reuniões marcadas (`meeting_scheduled=true`) | 57 | 57 (✅) |
| `atletas` | **0** | ~177 |
| `deals` | **0** | ~177 |
| `responsaveis` | **0** | ~150 (dedup por whatsapp) |
| `enderecos` | **0** | ~165 |

Para confirmar o estado, basta rodar via Supabase REST com a chave anon (read-only):

```bash
SUPA_URL="https://nikrlikwghqcxcjzthmc.supabase.co"
SUPA_KEY="<peça ao usuário a NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY de apps/web/.env.local>"

curl -sI "$SUPA_URL/rest/v1/atletas?select=id" \
  -H "apikey: $SUPA_KEY" -H "Authorization: Bearer $SUPA_KEY" \
  -H "Prefer: count=exact" -H "Range: 0-0" | grep -i content-range
```

---

## Como o fluxo automático deveria funcionar

Quando um lead preenche o formulário, em segundos:

```
1. Form submetido em bolsaatletausa.com/forms
   ↓
2. INSERT em form_submissions
   ↓
3. Supabase dispara 3 webhooks em paralelo:
   ├─ messenger-service ───→ e-mail (funcional desde fix de 2026-05-29)
   ├─ sync-elite-leads ────→ Google Sheets (funcional)
   └─ lead-qualifier ──────→ classifica via Gemini:
                              • QUENTE  → família com claro poder aquisitivo
                              • MORNO   → contexto de alto padrão sustenta
                              • FRIO    → não se enquadra
                              ↓
                              Se QUENTE ou MORNO, executar autoPromoteToCRM:
                                a) Cria endereço em `enderecos`
                                b) Cria responsável em `responsaveis` (ou usa existente, dedup por WhatsApp)
                                c) Cria atleta em `atletas` (vincula `form_submission_id`)
                                d) Cria deal na etapa `lead` (ou `aguardando_timing` se timing_status='muito_cedo', ou `perdido` se timing_status='tarde_demais')
                              ↓
                              Lead aparece automaticamente no BAUSA Engine
```

A função `autoPromoteToCRM` está em **`functions/qualify-lead/index.js` linhas 473-683**.

O passo final (3.d) **nunca está executando em PRD desde que essa feature foi implantada (provavelmente desde 2026-04-03)**.

---

## Onde está a quebra — análise do código

Trecho exato que decide se vai promover (`functions/qualify-lead/index.js`, linhas 882-908):

```javascript
// 4. Auto-promoção CRM para leads QUENTE/MORNO
let crmResult = null;
if (
  SUPABASE_URL && SUPABASE_SERVICE_KEY &&
  (qualification.classification === 'QUENTE' || qualification.classification === 'MORNO')
) {
  try {
    crmResult = await autoPromoteToCRM(data, qualification.classification, qualification.reason, qualification.confidence, timingStatus);
    if (crmResult) {
      log('INFO', 'crm_auto_created', { submissionId, atletaId, dealId });
    }
  } catch (crmError) {
    log('ERROR', 'crm_auto_promote_failed', { error, email, athlete });
  }
}
```

**Detalhe importante:** o `if` da linha 884 só executa se `SUPABASE_URL` E `SUPABASE_SERVICE_KEY` estiverem definidas como env vars. Se uma das duas estiver ausente, o bloco inteiro é pulado **silenciosamente** (sem log, sem erro). É um clássico "silent skip".

---

## Hipóteses (em ordem de probabilidade)

| # | Hipótese | Como confirmar |
|---|---|---|
| 🥇 | `SUPABASE_SERVICE_KEY` não foi configurada como env var na função `lead-qualifier` em PRD | Google Cloud Console → função → "Variáveis e segredos" |
| 🥈 | Erro de runtime dentro de `autoPromoteToCRM` (RLS bloqueia INSERT, schema errado, payload inválido) | Logs do GCP: filtrar por `crm_auto_promote_failed` |
| 🥉 | Versão antiga da função deployada (sem o código de `autoPromoteToCRM`) | Comparar `gcloud functions describe lead-qualifier` vs HEAD do main |

---

## Objetivos (na ordem)

### Objetivo 1 — Diagnóstico definitivo

Confirmar qual das 3 hipóteses é a verdadeira. Dois caminhos possíveis:

**Caminho 1.A — verificar env vars (rápido, sem efeito colateral)**

Peça ao usuário para abrir https://console.cloud.google.com/functions/list?project=elite-portal-forms , clicar em `lead-qualifier`, aba "Editar", seção "Variáveis e segredos do ambiente de execução" e confirmar:
- Existe a variável `SUPABASE_SERVICE_KEY`?
- Tem valor preenchido?

**Caminho 1.B — teste cirúrgico via curl (mais conclusivo)**

Pegue 1 lead QUENTE existente (ex: id `2494b90a-8f8d-42c7-a9b8-a1c25e95c315` = Pedro Sergi Dias). Chame `lead-qualifier` em PRD com esse lead. Aguarde 5 segundos. Verifique se um atleta novo apareceu em `atletas`.

```bash
SECRET="<peça ao usuário o WEBHOOK_SECRET de PRD>"
LEAD_ID="2494b90a-8f8d-42c7-a9b8-a1c25e95c315"

# Pegar dados completos do lead
LEAD_JSON=$(curl -s "https://nikrlikwghqcxcjzthmc.supabase.co/rest/v1/form_submissions?id=eq.$LEAD_ID&select=*" \
  -H "apikey: $SUPA_KEY" -H "Authorization: Bearer $SUPA_KEY")

# Chamar lead-qualifier
curl -X POST "https://us-central1-elite-portal-forms.cloudfunctions.net/lead-qualifier" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: $SECRET" \
  -d "{\"record\": $(echo "$LEAD_JSON" | python3 -c 'import json,sys;print(json.dumps(json.load(sys.stdin)[0]))')}"

# Verificar se atleta foi criado
sleep 5
curl -s "https://nikrlikwghqcxcjzthmc.supabase.co/rest/v1/atletas?form_submission_id=eq.$LEAD_ID&select=id,nome_completo,lead_score,classificacao_gemini" \
  -H "apikey: $SUPA_KEY" -H "Authorization: Bearer $SUPA_KEY"
```

Possíveis resultados:
- **HTTP 200 + atleta criado** → função está OK em PRD, problema é o webhook do Supabase não estar disparando (improvável, mas precisa investigar)
- **HTTP 200 + atleta NÃO criado** → confirma hipótese 1 (env var ausente) ou 2 (erro silencioso)
- **HTTP 500** → erro em runtime, ler resposta para detalhes

**Custo do teste:** 1 chamada Gemini (~$0.0001). **Risco:** quase zero — `autoPromoteToCRM` é idempotente (linha 481 verifica `form_submission_id` existente antes de criar).

### Objetivo 2 — Corrigir a causa raiz

Depende do diagnóstico:

- Se `SUPABASE_SERVICE_KEY` está ausente: adicionar via Cloud Console ou via gcloud:
  ```bash
  gcloud functions deploy lead-qualifier \
    --update-env-vars SUPABASE_SERVICE_KEY=eyJxxx... \
    --region=us-central1 --project=elite-portal-forms --gen2
  ```
- Se for problema de schema: ajustar `SUPABASE_SCHEMA` (deve ser `public` em PRD)
- Se for erro de RLS: verificar policies em `atletas`, `deals`, `responsaveis`, `enderecos`
- Se for outro: investigar conforme

**Importante:** sem esse fix, todo novo lead continua não aparecendo no CRM. Backfill sem fix da raiz é trabalho em vão.

### Objetivo 3 — Backfill dos 177 leads históricos

Para cada lead `QUENTE` ou `MORNO` em `form_submissions` sem atleta correspondente, criar `endereco` + `responsavel` + `atleta` + `deal`.

**Garantias (todas as opções):**

| Risco | Mitigação |
|---|---|
| Reenvio de WhatsApp | ❌ Impossível — `process-pending-whatsapp` filtra `whatsapp_sent_at IS NULL`; os 177 leads já têm esse campo populado |
| Reenvio de e-mail | ❌ Impossível — messenger-service só dispara por INSERT em `form_submissions`; backfill cria em outras tabelas |
| Duplicação de atletas | ❌ Impossível — `autoPromoteToCRM` (e o script baseado nela) verifica `form_submission_id` antes de criar |
| Quebrar dashboards do BAUSA Engine | 🟢 Improvável — queries esperam dados nessas tabelas; hoje recebem array vazio. Backfill faz as queries retornarem dados, comportamento esperado |
| Erros parciais (alguns sim, outros não) | ✅ Mitigado — dry-run obrigatório + fail-fast em 3 erros consecutivos |

**Três opções, com pros e contras:**

#### Opção 1 — Script Node direto via Supabase REST (recomendada)

- Reaproveita a lógica de `autoPromoteToCRM` mas sem Gemini (já temos a classificação no banco)
- Lê os 177 leads via `SELECT *` (com anon key)
- Para cada lead, faz POST direto em `enderecos`/`responsaveis`/`atletas`/`deals` via Supabase REST (com service_role key)
- Idempotente, throttled, dry-run primeiro, fail-fast em 3 erros
- **Tempo:** ~5 minutos
- **Custo:** zero
- **Precisa:** `SUPABASE_SERVICE_KEY` (peça ao usuário)

Estrutura sugerida do script (criar em `scripts/backfill-crm-from-qualified-leads.js`):

```javascript
// Lê leads QUENTE/MORNO sem atleta correspondente
// Para cada um:
//   1. Cria/encontra responsável (dedup por whatsapp)
//   2. Cria endereço se houver dados
//   3. Cria atleta com vínculo form_submission_id e responsavel_id
//   4. Cria deal na etapa apropriada (lead/aguardando_timing/perdido)
// Throttle 500ms, fail-fast em 3 erros, dry-run com --dry-run, execute com --execute
```

Use como referência a função `autoPromoteToCRM` em `functions/qualify-lead/index.js` linhas 473-683 — replique a mesma lógica em Node standalone.

#### Opção 2 — Forçar via `retry-qualification` para cada lead

- A função `functions/retry-qualification/index.js` já está deployada em PRD
- Aceita `lead_id` específico via body POST
- Re-chama Gemini → re-classifica → `autoPromoteToCRM`
- **Tempo:** ~90 minutos (177 × 30s)
- **Custo:** 177 chamadas Gemini (~$0.02–0.04)
- **Risco:** Gemini pode classificar diferente em rerun
- **Precisa:** só `WEBHOOK_SECRET`

#### Opção 3 — Criar Cloud Function de backfill dedicada

- Escrever uma função nova em `functions/backfill-crm/`
- Lógica idêntica ao Opção 1 mas rodando em GCP
- Deploy via PR → develop → main
- **Tempo:** ~30 minutos de implementação + ~5 min de execução
- **Custo:** zero
- **Vantagem:** fica como ferramenta reusável no repo

### Objetivo 4 — Validação visual

Após o backfill:

1. Abrir BAUSA Engine → `/crm/leads` — listar os ~177 atletas
2. Abrir `/crm/pipeline` — Kanban com deals nas colunas corretas
3. Abrir 3 leads específicos (Pedro Sergi Dias, Manuela Tavares Rolnik, Enzo Zilio Hagemann) — confirmar dados completos no modal

---

## Restrições importantes

1. **NUNCA commitar direto em `main` ou `develop`** — sempre branch feature/fix/hotfix
2. **NUNCA usar `--delete-branch` em PR `develop → main`** — `develop` é branch permanente, deletar quebra o repo (incidente 2026-05-17 documentado no `CLAUDE.md`)
3. **NUNCA hardcodar credenciais** — sempre via env var ou input do usuário
4. **NUNCA chamar APIs externas sem dry-run** — para tarefas em lote, listar o que será feito antes de executar
5. **Conventional commits obrigatório:** `feat:`, `fix:`, `chore:`, `docs:`, etc.
6. **PRs precisam de CI verde antes de mergear** — workflow `ci.yml` deve dar 18 SUCCESS
7. **TypeScript strict está DESABILITADO** neste repo (legado) — não habilitar sem alinhamento

---

## O que pedir ao usuário no começo

Antes de qualquer execução, pergunte:

1. **Onde está rodando?** Confirme que está no diretório `/Users/lucasbau/BAUSA`
2. **Tem `WEBHOOK_SECRET` de PRD?** Necessário para qualquer teste cirúrgico
3. **Pode pegar `SUPABASE_SERVICE_KEY` no Cloud Console?** Necessário para a Opção 1 (recomendada) do backfill
4. **Qual abordagem preferida?** Opção 1 (script direto), Opção 2 (retry-qualification) ou Opção 3 (nova função)?
5. **Pode validar o teste cirúrgico antes do backfill em massa?** Recomendação forte: rode 1 lead primeiro

---

## Credenciais necessárias (peça ao usuário, não invente)

| Credencial | Onde encontrar |
|---|---|
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (anon) | `apps/web/.env.local` ou `apps/crm/.env.local` |
| `SUPABASE_SERVICE_KEY` (service_role) | Cloud Console → função PRD → env vars, OU Supabase Dashboard → Settings → API |
| `WEBHOOK_SECRET` (PRD) | Cloud Console → função PRD → env vars |
| Acesso `gcloud` (opcional) | `gcloud auth login` no terminal do usuário |

---

## Tarefas anteriores resolvidas hoje (contexto da operação)

Em 2026-05-29 foram resolvidos 3 incidentes não relacionados ao CRM. Esta tarefa é a quarta e está pendente:

| Incidente | Status | Detalhe |
|---|---|---|
| Calendar-webhook apagando dados do Sheets (43 leads) | ✅ Resolvido | PR #55, #56, #57 — backfill executado |
| `main` e `develop` desalinhadas | ✅ Resolvido | PR #57 |
| E-mails travados há 12 dias (ReferenceError `payload`) | ✅ Resolvido | PR #58, #59 — função restaurada |
| **CRM vazio (177 leads não promovidos)** | 🔴 **Pendente — esta tarefa** | Aguardando diagnóstico e backfill |

---

## Sucesso esperado

Ao final desta tarefa:

- ✅ Causa raiz identificada e documentada
- ✅ Função `lead-qualifier` em PRD corrigida — próximos leads aparecem no CRM automaticamente
- ✅ `atletas`, `deals`, `responsaveis`, `enderecos` com os 177 leads históricos populados
- ✅ Validação visual no BAUSA Engine confirmando que `/crm/leads` e `/crm/pipeline` mostram dados
- ✅ PR mergeado com o fix da causa raiz
- ✅ Script de backfill no repo (caso seja Opção 1 ou 3) como ferramenta reusável

---

## Como começar (primeira mensagem ao usuário)

Comece pedindo confirmação do diretório de trabalho e listando o que você vai fazer em alto nível. Algo como:

> Vou diagnosticar por que a auto-promoção do CRM não funciona em PRD e propor um plano de fix + backfill dos 177 leads pendentes. Antes de começar, preciso:
>
> 1. Confirmar que estou em `/Users/lucasbau/BAUSA`
> 2. Verificar o estado atual do CRM (vou rodar uma query read-only no Supabase)
> 3. Decidir com você qual caminho de diagnóstico seguir (verificar env vars no Cloud Console ou fazer teste cirúrgico via curl)
>
> Posso prosseguir?

A partir daí, conduza a conversa com perguntas objetivas e dry-runs antes de execução.

---

*Documento gerado em 2026-05-29 para ser usado como prompt em sessão paralela.*
